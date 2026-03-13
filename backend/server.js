require('dotenv').config();
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

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://xxxxxxxxxxxxxxxxxxxx.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { title, stanzas } = req.body;
    
    if (!title || !stanzas || !Array.isArray(stanzas)) {
        return res.status(400).json({ error: "Invalid payload. Required: title (string), stanzas (array of strings)" });
    }

    try {
        // 1. Check if song already exists
        const { data: existingSong, error: searchError } = await supabase
            .from('songs')
            .select('id')
            .ilike('title', title)
            .limit(1)
            .single();

        let songId;

        if (existingSong) {
            songId = existingSong.id;
            console.log(`Song "${title}" already exists in DB with ID: ${songId}`);
            return res.json({ message: "Song already exists", songId });
        } else {
            // 2. Insert new song
            const { data: newSong, error: insertSongError } = await supabase
                .from('songs')
                .insert([{ title }])
                .select()
                .single();

            if (insertSongError) throw insertSongError;
            songId = newSong.id;
            console.log(`Inserted new song "${title}" with ID: ${songId}`);

            // 3. Insert lyrics stanzas
            const lyricsData = stanzas.map((stanza, index) => ({
                song_id: songId,
                stanza_number: index + 1,
                lyrics: stanza
            }));

            const { error: insertLyricsError } = await supabase
                .from('lyrics')
                .insert(lyricsData);

            if (insertLyricsError) throw insertLyricsError;
            
            console.log(`Saved ${lyricsData.length} stanzas for song ID: ${songId}`);
            res.json({ message: "Song saved successfully", songId });
        }
    } catch (error) {
        console.error("Error saving song:", error);
        res.status(500).json({ error: "Failed to save song", details: error.message });
    }
});


// --- WebSocket Server for TV Presentation ---

const clients = new Map(); // Map from ws -> { room: string | null }

wss.on('connection', (ws) => {
    console.log('New WebSocket connection established (TV Screen / Controller)');
    clients.set(ws, { room: null });

    // Send an initial connected message
    ws.send(JSON.stringify({ type: 'status', message: 'Connected to Presentation Server. Please join a room.' }));

    ws.on('message', (messageAsString) => {
        try {
            const message = JSON.parse(messageAsString);
            console.log('Received message:', message);

            if (message.type === 'join') {
                const room = message.room || 'default';
                clients.set(ws, { room });
                console.log(`Client joined room: ${room}`);
                ws.send(JSON.stringify({ type: 'status', message: `Joined room: ${room}` }));
            }
            // Broadcast 'present' messages to all connected clients in the SAME room
            else if (message.type === 'present' || message.type === 'clear') {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`WorshipCast Presentation Server running on port ${PORT}`);
});
