const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const scraper = require('./scraper');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve TV display frontend

app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'worshipcast-backend' });
});

// Short offline-present route for easy browser typing on hotspot/LAN.
app.get('/t/:room', (req, res) => {
    const rawRoom = String(req.params.room || 'default').trim().toUpperCase();
    const safeRoom = encodeURIComponent(rawRoom.slice(0, 24) || 'DEFAULT');
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
            const message = JSON.parse(messageAsString);
            console.log('Received message:', message);

            if (message.type === 'join') {
                const room = message.room || 'default';
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
            else if (message.type === 'present' || message.type === 'present-image' || message.type === 'clear') {
                const senderData = clients.get(ws);
                const targetRoom = senderData ? senderData.room : null;

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`WorshipCast Presentation Server running on port ${PORT}`);
});
