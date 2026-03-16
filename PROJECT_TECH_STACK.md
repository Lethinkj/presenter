# WorshipCast Project Technical Documentation

## 1) Project Overview

WorshipCast is a hybrid worship presentation platform with:

- A Node.js backend service for search, scraping, persistence, and real-time presentation relay
- A React + Vite mobile/web controller app for song lookup and presentation control
- A TV display web client that listens for presentation events over WebSocket
- Supabase (PostgreSQL + REST) as the data store for songs, lyrics, and heartbeat logs
- Optional Capacitor-native pathways for Android packaging and local/offline presentation workflows

Primary user flow:

1. Presenter searches songs from database or web.
2. If from web, lyrics are scraped and can be saved to database.
3. Presenter selects stanza/image/verse and sends presentation payload.
4. Backend WebSocket server broadcasts payload to all TV clients in the same room.
5. TV client renders text/image with adaptive sizing.

---

## 2) Repository Structure

Top-level:

- schema.sql
  - Database schema + indexes + RLS policies
- backend/
  - Express API server, scraper, heartbeat scheduler, import scripts, TV static assets
- mobile_app/
  - React app (controller) + Capacitor Android wrapper

Key backend files:

- backend/server.js
  - Main API + WebSocket service entry point
- backend/scraper.js
  - Search and lyrics extraction engine
- backend/daily_heartbeat.js
  - Scheduled service health logging to Supabase
- backend/import_songs.js
  - Bulk importer from sitemap to Supabase
- backend/public/tv.html
  - TV display client

Key mobile files:

- mobile_app/src/App.jsx
  - Main application logic (search, local cache, sync queue, present controls)
- mobile_app/src/main.jsx
  - React bootstrap + error boundary
- mobile_app/capacitor.config.json
  - Capacitor app identity and networking config

---

## 3) Technology Stack and Where It Is Implemented

### 3.1 Backend Stack (backend/package.json)

Runtime and framework:

- Node.js (CommonJS modules)
- Express 5
- HTTP server + ws WebSocket server

Data and external integrations:

- @supabase/supabase-js for DB operations via Supabase REST
- axios for outbound HTTP requests
- cheerio for HTML parsing/scraping

Platform/support:

- dotenv for env config loading
- cors for cross-origin frontend access

Implementation:

- API endpoints and room-scoped WebSocket broadcast in backend/server.js
- Scraping pipeline in backend/scraper.js
- Scheduler in backend/daily_heartbeat.js

### 3.2 Frontend Controller Stack (mobile_app/package.json)

UI/runtime:

- React 19 + ReactDOM
- Vite 5 bundler/dev server
- react-icons for iconography

Networking/data:

- axios for backend API calls
- @supabase/supabase-js for direct DB reads (song and lyric fetch/search)

Native/mobile:

- Capacitor core + Android + app lifecycle plugin
- @capacitor/filesystem dependency present (runtime file write path currently intentionally disabled by feature flag in App.jsx)

Implementation:

- All interaction and state orchestration in mobile_app/src/App.jsx
- Bootstrapping and crash fallback in mobile_app/src/main.jsx

### 3.3 TV Display Stack

- Plain HTML/CSS/JS page served by backend static middleware
- Browser WebSocket client connecting to same backend host
- Dynamic text/image rendering with auto-fit typography

Implementation:

- backend/public/tv.html

### 3.4 Database Stack

- Supabase-hosted PostgreSQL
- Tables: songs, lyrics, heartbeat_logs
- RLS enabled with permissive public policies for this internal app use case
- GIN trigram index for title search acceleration

Implementation:

- schema.sql

---

## 4) End-to-End Architecture

## 4.1 Runtime components

- Controller app (mobile_app) issues:
  - DB queries directly to Supabase for songs/lyrics
  - API calls to backend for web search/scrape/save operations
  - WebSocket present/clear events

- Backend service (server.js) provides:
  - /search and /lyrics proxy/scrape endpoints
  - /save_song persistence endpoint
  - Room-based WebSocket message fan-out
  - /health for LAN/offline checks

- TV display client (tv.html):
  - Joins room
  - Receives present/clear events
  - Renders text or image immediately

- Supabase stores:
  - Song metadata
  - Ordered lyric stanzas
  - Daily heartbeat status

## 4.2 Data flow summary

- Search DB tab: App -> Supabase directly
- Search web tab: App -> backend /search -> scraper web queries
- Fetch web lyrics: App -> backend /lyrics -> scraper extraction
- Save song: App -> backend /save_song -> Supabase songs + lyrics
- Present stanza/image/verse: App -> WebSocket -> backend room broadcast -> TV client render
- Offline degraded save: App stores in local cache + pending queue, retries sync to /save_song when online

---

## 5) Backend Service Deep Dive

## 5.1 Environment bootstrap and validation (backend/server.js)

- Loads backend/.env through absolute path join
- Reads SUPABASE_URL and one of:
  - SUPABASE_ANON_KEY
  - SUPABASE_KEY
  - SUPABASE_SERVICE_ROLE_KEY
- Validates URL shape (https and supabase.co host pattern)
- Throws startup error when invalid/missing values

Why this matters:

- Prevents runtime ambiguity from malformed environment variables
- Fails fast instead of partial service boot

## 5.2 Express API endpoints

### GET /health

- Lightweight health endpoint
- Used by app LAN/offline host probing

### GET /t/:room

- Convenience route
- Redirects to /tv.html?room=<ROOM>
- Enables short LAN URL typing on a TV browser

### GET /search?q=<query>

- Calls scraper.searchSongs(query)
- Returns list of candidate song links with title/url/site metadata
- Handles failures with HTTP 500 and error payload

### GET /lyrics?url=<url>

- Calls scraper.fetchLyrics(url)
- Returns stanza array extracted from source page

### POST /save_song

Payload fields:

- title (required)
- stanzas (required array)
- songId (optional, update path)
- sourceUrl (optional)
- forceUpdate (optional)

Behavior:

1. Validates title + non-empty stanza list
2. If explicit update path (songId + forceUpdate):
   - updates songs row
   - replaces all lyrics rows by stanza order
3. Else tries title match (ilike) to detect existing song
4. Existing + no forceUpdate: returns existing id without write
5. Existing + forceUpdate: updates + rewrites lyrics
6. No existing: inserts new song + lyrics rows

Resilience:

- withRetry wrapper for transient DNS/network failures
- Schema fallback for source_url column absence (retries without field)
- Error hinting for ENOTFOUND/EAI_AGAIN style issues

## 5.3 WebSocket room service

State model:

- Map of clients keyed by socket
- Metadata: room, presenter name, device code

Protocol messages:

- join: binds client to room
- ping/pong: app-level keepalive
- present and clear: broadcast only to clients in same room

Connection reliability:

- server-side heartbeat interval every 30s
- dead sockets terminated when no pong activity

## 5.4 Heartbeat scheduler service (backend/daily_heartbeat.js)

Purpose:

- Log one heartbeat row per day per service name

Mechanics:

- Runs immediate startup heartbeat
- Schedules next UTC HH:mm run
- Then repeats every 24h
- Upserts on conflict (service_name, heartbeat_date)

Script modes:

- node daily_heartbeat.js --once
- node daily_heartbeat.js (scheduler mode)

## 5.5 Bulk import service (backend/import_songs.js)

Purpose:

- Crawl sitemap and seed songs + lyrics at scale

Workflow:

1. Fetch sitemap.xml
2. Extract song URLs
3. Resume from import_progress.json
4. Fetch each page and extract title/stanzas
5. Insert into songs + lyrics if not exists
6. Save progress after each item

Reliability controls:

- Request delay and batch pacing
- Retry wrapper with backoff
- Persistent done/failed tracking

---

## 6) Scraper Engine Deep Dive (backend/scraper.js)

## 6.1 Search strategy

Primary strategy:

- DuckDuckGo HTML search for query + tamil christian song lyrics
- Parse result anchors and normalize redirect URLs
- Filter likely lyric pages and score relevance

Fallback enrichment:

- Christsquare site search scrape
- ChristianSongBook site search scrape
- Merge + deduplicate by URL

Ranking features:

- Query token hits in title/url
- Keyword boosts for lyrics/tamil/christian terms
- Site weighting

## 6.2 Lyrics extraction strategy

Dispatcher:

- Domain-specific handlers for:
  - christsquare.com
  - christiansongbook.org
- Generic page extractor fallback for unknown/failed paths

Domain extractor approach:

- Prefer structured/known selectors first
- Normalize HTML to clean plain text
- Split into stanza blocks
- Remove menu/copyright/social noise

Generic fallback approach:

- Remove script/style/ads/navigation elements
- Try high-confidence content roots (.lyrics, article, main)
- JSON-LD articleBody fallback
- Full-body fallback
- Stanza segmentation + dedupe + cleanup heuristics

Error contract:

- Returns friendly error stanza when extraction fails
- Avoids throwing unhandled exceptions into API layer

---

## 7) Mobile Controller App Deep Dive (mobile_app/src/App.jsx)

This file is the main application runtime and contains multiple subsystems.

## 7.1 Configuration and environment

- API and WebSocket base from Vite env when provided
- Fallback to localhost or runtime host
- WS URL normalization upgrades ws -> wss when needed
- Room-scoped WS URL builder

## 7.2 Identity and session model

- Device code generated and persisted
- Presenter user name persisted
- Room code persisted and reused

## 7.3 Search subsystem

Tabs include:

- db (Supabase songs)
- web (backend scraper)
- favorites
- recents
- images
- bible

Features:

- Query token ranking for relevance
- Debounced DB live search
- A-Z quick filter
- Offline fallback search over local cache

## 7.4 Song retrieval and caching

- DB songs: fetch lyrics from Supabase lyrics table ordered by stanza_number
- Web songs: fetch via backend /lyrics
- Cache songs locally in offlineCache for quick reuse
- Recent song list deduped and capped

## 7.5 Offline-first persistence model

Local stores:

- offlineCache: local canonical song copies
- pendingSyncQueue: write operations waiting for network

Write behavior:

- Online save path: POST /save_song
- Failure fallback: persist locally + enqueue sync item

Sync behavior:

- Triggered when online and queue non-empty
- Also periodic interval sync attempts
- On successful sync, local temporary IDs can be replaced by DB IDs
- Favorites/selected song references updated accordingly

## 7.6 Presentation transport and routing

Core payload types:

- present text
- present image data
- clear

Routing modes:

- mirror: send via both native offline and WebSocket path
- offline: native-only route
- online: WebSocket-only route

Reliability patterns:

- Queue pending present payload when socket unavailable
- Ensure reconnect and replay one pending payload
- One-tap retry after short delay for transient socket races

## 7.7 WebSocket lifecycle (client side)

- Connects with room in query path
- Sends join payload with room/name/device
- Heartbeat ping every 20s
- Stale detection; force reconnect if no pong >45s
- Reconnect backoff up to capped delay
- Reconnect on visibility, focus, pageshow, online events

## 7.8 TV formatting control synchronization

- Presenter font and size are included in payloads
- Active stanza can be re-presented when font/size changes
- Similar re-present sync for active image size and active Bible verse formatting

## 7.9 Image subsystem

- Upload image files (max list size enforced)
- Optimize via canvas resize + JPEG quality reduction
- Present image via payload imageData + imageSize

## 7.10 Bible subsystem

- Loads Books list from static JSON
- Loads selected book JSON chapters/verses
- Supports chapter navigation and swipe gestures
- Presents selected verse through same presentation transport

## 7.11 LAN/offline host management

- Health probing against /health endpoint
- Auto-detect candidate LAN IPs/hosts
- Native plugin status/start server hooks when on Capacitor runtime
- Generates short offline TV links of form /t/<ROOM>

---

## 8) TV Display Client Deep Dive (backend/public/tv.html)

Responsibilities:

- Open WS connection to backend host
- Join room from URL query
- Listen for present/present-image/clear messages
- Render either lyric text or image mode

Rendering details:

- Text uses auto-fit algorithm (binary search on font size)
- Optional presenter font and explicit size support
- Image mode supports auto or percentage scaling
- Transition animation applied without full clear flicker between same-mode updates

Operational behavior:

- Displays room code until first content arrives
- Auto reconnects on socket close

---

## 9) Database Design and Data Semantics (schema.sql)

## 9.1 songs table

Fields:

- id UUID primary key
- title text not null
- language text default tamil
- source_url text optional
- created_at timestamptz default utc now

## 9.2 lyrics table

Fields:

- id UUID primary key
- song_id UUID FK -> songs.id with cascade delete
- stanza_number int not null
- lyrics text not null

Semantics:

- One song has ordered stanza rows
- Save/update path rewrites stanza rows for deterministic ordering

## 9.3 heartbeat_logs table

Fields:

- id UUID primary key
- service_name text
- heartbeat_date date
- status text
- details jsonb
- created_at timestamptz
- unique constraint on (service_name, heartbeat_date)

## 9.4 Indexes and policies

- GIN trigram index on songs.title for fast ilike search
- RLS enabled on all tables
- Public read/write policies enabled for internal-tool simplicity

Security note:

- Current policies are open and suitable only for trusted/internal use.
- Internet-facing production should tighten RLS policies and move writes behind authenticated backend-only service role access.

---

## 10) Service Boundaries and Responsibilities

Backend service owns:

- Web scraping and extraction logic
- Data mutation orchestration for songs/lyrics
- Real-time presentation broadcast room management
- Operational heartbeat writes

Mobile app owns:

- User workflow, search UX, stanza/image/verse selection
- Local caching and deferred write queue
- Session identity, room control, and presentation command origin

TV client owns:

- Stateless render target for live payloads

Supabase owns:

- Durable data persistence and query/filter primitives

---

## 11) Commands and Operational Workflows

## 11.1 Backend

From backend directory:

- npm install
- npm start
- npm run import:songs
- npm run heartbeat:once
- npm run heartbeat:daily
- npm run search:test <query>

## 11.2 Mobile app

From mobile_app directory:

- npm install
- npm run dev
- npm run build
- npm run preview
- npm run lint

## 11.3 Database

- Execute schema.sql on Supabase SQL editor once (and on updates)

---

## 12) Configuration Matrix

Backend env (required):

- SUPABASE_URL
- SUPABASE_ANON_KEY (or SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY)

Backend optional:

- PORT
- HEARTBEAT_SERVICE_NAME
- HEARTBEAT_STATUS
- HEARTBEAT_RUN_UTC
- IMPORT_MAX_RETRIES
- IMPORT_RETRY_BASE_MS

Mobile env (optional but recommended for production):

- VITE_API_URL
- VITE_WS_URL
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

---

## 13) Testing and Diagnostics Assets

Existing script-style checks in backend:

- test_integration.js
  - Basic end-to-end API checks for search -> lyrics -> save
- test_scraper_direct.js
  - Direct scraper smoke check
- test_scrape.js, test_cs.js, debug_lyrics.js
  - Exploratory scraper diagnostics

Note:

- There is no consolidated automated test runner currently integrated into package scripts.

---

## 14) Known Design Tradeoffs

- Large single-file App component increases coupling and maintenance complexity.
- Open RLS policies prioritize convenience over strict security.
- Direct Supabase reads in client improve speed but expose broader read surface.
- Native file storage code path exists but is intentionally disabled by build flag in current app logic.

---

## 15) Suggested Refactor Roadmap

1. Split App.jsx into feature modules (search, presentation, bible, offline sync).
2. Introduce typed API contracts (TypeScript or runtime schema validation).
3. Replace open RLS policies with authenticated policies and role separation.
4. Add integration tests for /save_song update semantics and room isolation in WebSocket broadcast.
5. Add deterministic scraper fixtures to reduce breakage from source-site HTML changes.

---

## 16) Quick Troubleshooting Guide

Symptom: Save song fails with DNS/network-like errors

- Check SUPABASE_URL correctness and DNS reachability from backend host.
- Review backend/server.js retry and hint response details.

Symptom: TV not receiving presentation

- Confirm presenter and TV joined same room code.
- Confirm backend WebSocket reachable on LAN IP/port.
- Check room-scoped URL in TV link (/t/<room>).

Symptom: Offline edits not appearing in DB

- Verify device has regained connectivity.
- Check pending sync queue behavior in mobile app.
- Ensure backend /save_song is reachable from app network.

Symptom: Web lyric extraction poor quality

- Source site layout may have changed.
- Update selectors/heuristics in backend/scraper.js.

---

## 17) Implementation Reference Map

Backend:

- backend/server.js
- backend/scraper.js
- backend/daily_heartbeat.js
- backend/import_songs.js
- backend/public/tv.html

Mobile:

- mobile_app/src/App.jsx
- mobile_app/src/main.jsx
- mobile_app/vite.config.js
- mobile_app/capacitor.config.json

Data:

- schema.sql

This document is designed to be a living technical source of truth. Update it whenever transport protocol, schema, or persistence logic changes.
