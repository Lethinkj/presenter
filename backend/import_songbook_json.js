/**
 * import_songbook_json.js
 *
 * Import songs from songbook/full_tamil_songbook.json into Supabase.
 *
 * Usage:
 *   node import_songbook_json.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SONGBOOK_PATH = path.join(__dirname, '..', 'songbook', 'full_tamil_songbook.json');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const normalizeNewlines = (text) => String(text || '').replace(/\r\n/g, '\n').trim();

const splitStanzas = (text) => {
    const normalized = normalizeNewlines(text);
    if (!normalized) return [];
    return normalized
        .split(/\n\s*\n/)
        .map((stanza) => stanza.trim())
        .filter((stanza) => stanza.length > 0);
};

const buildSourceUrl = (youtubeId) => {
    const id = String(youtubeId || '').trim();
    if (!id) return null;
    return `https://www.youtube.com/watch?v=${id}`;
};

async function saveSongToDb(title, stanzas, sourceUrl) {
    const { data: existing, error: existingErr } = await supabase
        .from('songs')
        .select('id')
        .ilike('title', title)
        .limit(1)
        .single();

    if (existingErr && existingErr.code !== 'PGRST116') {
        throw new Error(`Song lookup failed: ${existingErr.message}`);
    }

    if (existing) {
        return { skipped: true, id: existing.id };
    }

    const insertPayload = {
        title,
        language: 'tamil',
    };

    if (sourceUrl) {
        insertPayload.source_url = sourceUrl;
    }

    const { data: newSong, error: songErr } = await supabase
        .from('songs')
        .insert([insertPayload])
        .select()
        .single();

    if (songErr) throw new Error(`Song insert failed: ${songErr.message}`);

    const lyricsData = stanzas.map((stanza, i) => ({
        song_id: newSong.id,
        stanza_number: i + 1,
        lyrics: stanza,
    }));

    const { error: lyricsErr } = await supabase.from('lyrics').insert(lyricsData);
    if (lyricsErr) throw new Error(`Lyrics insert failed: ${lyricsErr.message}`);

    return { inserted: true, id: newSong.id };
}

async function main() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend/.env or host environment.');
    }

    const raw = fs.readFileSync(SONGBOOK_PATH, 'utf8');
    const songs = JSON.parse(raw);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < songs.length; i += 1) {
        const entry = songs[i];
        const title = String(entry?.title_roman || '').trim();
        const lyricsText = entry?.lyrics_tamil || entry?.lyrics_roman || '';
        const stanzas = splitStanzas(lyricsText);
        const sourceUrl = buildSourceUrl(entry?.youtube_id);

        process.stdout.write(`[${i + 1}/${songs.length}] ${title || '(no title)'} ... `);

        if (!title || stanzas.length === 0) {
            process.stdout.write('skipped (missing title or lyrics)\n');
            skipped += 1;
            continue;
        }

        try {
            const result = await saveSongToDb(title, stanzas, sourceUrl);
            if (result.skipped) {
                process.stdout.write('skipped (exists)\n');
                skipped += 1;
            } else {
                process.stdout.write(`saved (${stanzas.length} stanzas)\n`);
                inserted += 1;
            }
        } catch (err) {
            process.stdout.write(`error: ${err.message}\n`);
            failed += 1;
        }
    }

    console.log('\n=== Import Complete ===');
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped:  ${skipped}`);
    console.log(`Failed:   ${failed}`);
}

main().catch((err) => {
    console.error('[import] Fatal error:', err.message);
    process.exit(1);
});
