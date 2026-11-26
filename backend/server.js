const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const scraper = require('./scraper');
const { startDailyScheduler } = require('./daily_heartbeat');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const normalizeRoomCode = (value) => {
    const normalized = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 24);
    return normalized || 'DEFAULT';
};

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve TV display frontend

app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'worshipcast-backend' });
});

// Short offline-present route for easy browser typing on hotspot/LAN.
app.get('/t/:room', (req, res) => {
    const safeRoom = encodeURIComponent(normalizeRoomCode(req.params.room));
    res.redirect(`/tv.html?room=${safeRoom}`);
});

// Short online-present route for easy sharing.
app.get('/room/:room', (req, res) => {
    const safeRoom = encodeURIComponent(normalizeRoomCode(req.params.room));
    res.redirect(`/tv.html?room=${safeRoom}`);
});

// Initialize Supabase client
const cleanEnv = (value) => String(value || '').trim().replace(/^['\"]|['\"]$/g, '');
const supabaseUrl = cleanEnv(process.env.SUPABASE_URL);
const supabaseKey = cleanEnv(
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isValidSupabaseUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' && /\.supabase\.co$/i.test(parsed.hostname);
    } catch {
        return false;
    }
};

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY) in your host environment variables or backend/.env for local runs.'
    );
}

if (!isValidSupabaseUrl(supabaseUrl)) {
    throw new Error(`Invalid SUPABASE_URL: ${supabaseUrl}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isTransientNetworkError = (err) => {
    const text = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
    return (
        text.includes('fetch failed') ||
        text.includes('enotfound') ||
        text.includes('eai_again') ||
        text.includes('econnreset') ||
        text.includes('etimedout') ||
        text.includes('network')
    );
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (operation, retries = 2) => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err;
            if (!isTransientNetworkError(err) || attempt === retries) {
                throw err;
            }
            await delay(400 * (attempt + 1));
        }
    }
    throw lastError;
};

// --- REST API for Web Search ---

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
        console.log(`Searching web for: ${query}`);
        const results = await scraper.searchSongs(query);
        res.json(results);
    } catch (error) {
        console.error("Web search error:", error);
        res.status(500).json({ error: "Failed to search web" });
    }
});

app.get('/lyrics', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({ error: "URL parameter 'url' is required" });
    }

    try {
        console.log(`Fetching lyrics from: ${url}`);
        const stanzas = await scraper.fetchLyrics(url);
        res.json(stanzas);
    } catch (error) {
        console.error("Fetch lyrics error:", error);
        res.status(500).json({ error: "Failed to fetch lyrics" });
    }
});

const isSafePublicHttpUrl = (rawUrl) => {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        if (
            host === 'localhost' ||
            host === '::1' ||
            host.endsWith('.local') ||
            /^127\./.test(host) ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^169\.254\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
        ) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
};

// --- In-App Browser Proxy (strips X-Frame-Options/CSP so sites open inside iframe) ---
app.get('/browse', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    if (!targetUrl || !isSafePublicHttpUrl(targetUrl)) {
        return res.status(400).send('Invalid or unsupported URL');
    }

    try {
        const axios = require('axios');
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ta;q=0.8'
            },
            timeout: 15000,
            maxRedirects: 5,
            responseType: 'arraybuffer',
            validateStatus: (status) => status >= 200 && status < 400
        });

        const contentType = String(response.headers['content-type'] || 'text/html; charset=utf-8');
        const finalUrl = response.request?.res?.responseUrl || targetUrl;

        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('Content-Type', contentType);

        if (!contentType.toLowerCase().includes('text/html')) {
            return res.send(Buffer.from(response.data));
        }

        let html = Buffer.from(response.data).toString('utf8');
        const safeBase = finalUrl.replace(/"/g, '&quot;');
        const baseTag = `<base href="${safeBase}">`;
        const helperScript = `
<script>
(function() {
  var currentUrl = ${JSON.stringify(finalUrl)};
  try { window.parent.postMessage({ type: 'browser-navigate', url: currentUrl }, '*'); } catch (e) {}
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var raw = a.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
    try {
      var resolved = new URL(raw, currentUrl).href;
      if (/^https?:\\/\\//i.test(resolved)) {
        e.preventDefault();
        window.location.href = '/browse?url=' + encodeURIComponent(resolved);
      }
    } catch (err) {}
  }, true);
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return;
    var method = (form.getAttribute('method') || 'get').toLowerCase();
    if (method !== 'get') return;
    try {
      var action = form.getAttribute('action') || currentUrl;
      var target = new URL(action, currentUrl);
      var data = new FormData(form);
      data.forEach(function(val, key) { target.searchParams.set(key, String(val)); });
      e.preventDefault();
      window.location.href = '/browse?url=' + encodeURIComponent(target.href);
    } catch (err) {}
  }, true);
})();
</script>`;

        if (/<head[^>]*>/i.test(html)) {
            html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}`);
        } else {
            html = `${baseTag}\n${html}`;
        }

        if (/<\/body>/i.test(html)) {
            html = html.replace(/<\/body>/i, `${helperScript}\n</body>`);
        } else {
            html = `${html}\n${helperScript}`;
        }

        res.send(html);
    } catch (error) {
        console.error('Browse proxy error:', error.message);
        res.status(502).send(`
            <html><body style="font-family:sans-serif;background:#121212;color:#eee;padding:24px;text-align:center;">
              <h3>Could not open website</h3>
              <p style="opacity:0.75;">${String(error.message || 'Connection failed').replace(/</g, '&lt;')}</p>
            </body></html>
        `);
    }
});

// --- REST API for Auto Save ---
app.post('/save_song', async (req, res) => {
    const { title, stanzas, songId, sourceUrl, forceUpdate } = req.body;
    
    if (!title || !stanzas || !Array.isArray(stanzas)) {
        return res.status(400).json({ error: "Invalid payload. Required: title (string), stanzas (array of strings)" });
    }

    const cleanStanzas = stanzas.map(s => String(s || '').trim()).filter(Boolean);
    if (cleanStanzas.length === 0) {
        return res.status(400).json({ error: 'At least one non-empty stanza is required' });
    }

    try {
        const isSourceUrlColumnError = (err) => {
            if (!err) return false;
            const msg = `${err.message || ''} ${err.details || ''}`.toLowerCase();
            return msg.includes('source_url') || err.code === '42703';
        };

        const safeUpdateSong = async (id, payload) => {
            let updatePayload = { ...payload };
            let result = await withRetry(async () => supabase
                .from('songs')
                .update(updatePayload)
                .eq('id', id));

            if (result.error && isSourceUrlColumnError(result.error) && 'source_url' in updatePayload) {
                // Schema may not have source_url yet; retry without it.
                delete updatePayload.source_url;
                result = await withRetry(async () => supabase
                    .from('songs')
                    .update(updatePayload)
                    .eq('id', id));
            }

            if (result.error) throw result.error;
        };

        const safeInsertSong = async (payload) => {
            let insertPayload = { ...payload };
            let result = await withRetry(async () => supabase
                .from('songs')
                .insert([insertPayload])
                .select()
                .single());

            if (result.error && isSourceUrlColumnError(result.error) && 'source_url' in insertPayload) {
                // Schema may not have source_url yet; retry without it.
                delete insertPayload.source_url;
                result = await withRetry(async () => supabase
                    .from('songs')
                    .insert([insertPayload])
                    .select()
                    .single());
            }

            if (result.error) throw result.error;
            return result.data;
        };

        const updateLyricsForSong = async (targetSongId) => {
            const { error: deleteLyricsError } = await withRetry(async () => supabase
                .from('lyrics')
                .delete()
                .eq('song_id', targetSongId));

            if (deleteLyricsError) throw deleteLyricsError;

            const lyricsData = cleanStanzas.map((stanza, index) => ({
                song_id: targetSongId,
                stanza_number: index + 1,
                lyrics: stanza
            }));

            const { error: insertLyricsError } = await withRetry(async () => supabase
                .from('lyrics')
                .insert(lyricsData));

            if (insertLyricsError) throw insertLyricsError;
            return lyricsData.length;
        };

        // Explicit update path from presentation editor
        if (songId && forceUpdate) {
            const updatePayload = { title };
            if (sourceUrl) updatePayload.source_url = sourceUrl;

            await safeUpdateSong(songId, updatePayload);

            const savedCount = await updateLyricsForSong(songId);
            return res.json({ message: 'Song updated successfully', songId, updated: true, savedStanzas: savedCount });
        }

        // 1. Check if song already exists
        const { data: existingSong, error: searchError } = await withRetry(async () => supabase
            .from('songs')
            .select('id')
            .ilike('title', title)
            .limit(1)
            .single());

        if (searchError && searchError.code !== 'PGRST116') {
            throw searchError;
        }

        let resolvedSongId;

        if (existingSong) {
            resolvedSongId = existingSong.id;

            if (forceUpdate) {
                const updatePayload = { title };
                if (sourceUrl) updatePayload.source_url = sourceUrl;

                await safeUpdateSong(resolvedSongId, updatePayload);

                const savedCount = await updateLyricsForSong(resolvedSongId);
                return res.json({ message: 'Song updated successfully', songId: resolvedSongId, updated: true, savedStanzas: savedCount });
            }

            console.log(`Song "${title}" already exists in DB with ID: ${resolvedSongId}`);
            return res.json({ message: "Song already exists", songId: resolvedSongId, updated: false });
        } else {
            // 2. Insert new song
            const insertPayload = { title };
            if (sourceUrl) insertPayload.source_url = sourceUrl;

            const newSong = await safeInsertSong(insertPayload);
            resolvedSongId = newSong.id;
            console.log(`Inserted new song "${title}" with ID: ${resolvedSongId}`);

            const savedCount = await updateLyricsForSong(resolvedSongId);
            
            console.log(`Saved ${savedCount} stanzas for song ID: ${resolvedSongId}`);
            res.json({ message: "Song saved successfully", songId: resolvedSongId, updated: false, savedStanzas: savedCount });
        }
    } catch (error) {
        console.error("Error saving song:", error);
        const details = `${error?.message || ''} ${error?.details || ''}`;
        const hasDnsIssue = /enotfound|eai_again|getaddrinfo/i.test(details);
        const hint = hasDnsIssue
            ? 'Supabase hostname could not be resolved. Verify SUPABASE_URL in host environment variables (or backend/.env locally), internet DNS access, and that the server can reach supabase.co.'
            : '';
        res.status(500).json({ error: "Failed to save song", details: error.message, hint });
    }
});


// --- WebSocket Server for TV Presentation ---

const clients = new Map(); // Map from ws -> { room: string | null, name: string, deviceCode: string }

wss.on('connection', (ws) => {
    console.log('New WebSocket connection established (TV Screen / Controller)');
    ws.isAlive = true;
    clients.set(ws, { room: null, name: 'Anonymous', deviceCode: 'Unknown' });

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Send an initial connected message
    ws.send(JSON.stringify({ type: 'status', message: 'Connected to Presentation Server. Please join a room.' }));

    ws.on('message', (messageAsString) => {
        try {
            ws.isAlive = true;
            const message = JSON.parse(messageAsString);
            console.log('Received message:', message);

            if (message.type === 'join') {
                const room = normalizeRoomCode(message.room);
                const name = (message.name || 'Anonymous').toString().slice(0, 60);
                const deviceCode = (message.deviceCode || 'Unknown').toString().slice(0, 60);
                clients.set(ws, { room, name, deviceCode });
                console.log(`Client joined room: ${room} | user: ${name} | device: ${deviceCode}`);
                ws.send(JSON.stringify({ type: 'status', message: `Joined room: ${room}`, room, name, deviceCode }));
            }
            else if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
            }
            // Broadcast presentation messages to all connected clients in the SAME room
            else if (message.type === 'present' || message.type === 'present-image' || message.type === 'clear' || message.type === 'lower-third' || message.type === 'stage') {
                const senderData = clients.get(ws);
                const targetRoom = senderData ? normalizeRoomCode(senderData.room) : null;

                if (!targetRoom) {
                    ws.send(JSON.stringify({ type: 'error', message: 'You must join a room first' }));
                    return;
                }

                for (const [client, clientData] of clients.entries()) {
                    if (client.readyState === WebSocket.OPEN && clientData.room === targetRoom) {
                        // Don't echo back to the sender? Usually we want controllers to know it succeeded, but here we just broadcast to everyone in the room including the sender (or maybe TV only? No, all in room is fine).
                        client.send(JSON.stringify(message));
                    }
                }
            }
        } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        clients.delete(ws);
    });
});

// Server-side keepalive for broken idle connections.
const wsHeartbeat = setInterval(() => {
    for (const client of wss.clients) {
        if (client.isAlive === false) {
            try { client.terminate(); } catch { /* no-op */ }
            continue;
        }
        client.isAlive = false;
        try { client.ping(); } catch { /* no-op */ }
    }
}, 30000);

wss.on('close', () => {
    clearInterval(wsHeartbeat);
});

const PORT = Number(process.env.PORT) || 8901;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`WorshipCast Presentation Server running on port ${PORT}`);
    startDailyScheduler().catch((err) => {
        console.error('[heartbeat] scheduler failed to start from server:', err.message || err);
    });
});
