/**
 * import_songs.js
 * 
 * Bulk importer: reads all song URLs from christsquare.com's sitemap,
 * fetches lyrics for each, and saves them to Supabase.
 * 
 * Usage:
 *   node import_songs.js
 * 
 * Progress is saved to import_progress.json so you can resume if interrupted.
 */

require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// --- Config ---
const BASE_URL = 'https://www.christsquare.com';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
const DELAY_MS = 1000;       // 1 second between requests (be respectful to the server)
const BATCH_SIZE = 50;       // Songs per batch before pausing
const MAX_RETRIES = Number(process.env.IMPORT_MAX_RETRIES || 3);
const RETRY_BASE_MS = Number(process.env.IMPORT_RETRY_BASE_MS || 1500);
const PROGRESS_FILE = 'import_progress.json';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// --- Helpers ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        return {
            done: parsed.done || [],
            failed: parsed.failed || []
        };
    }
    return { done: [], failed: [] };
}

async function withRetries(fn, label) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const status = err?.response?.status;
            const canRetry = attempt < MAX_RETRIES && (!status || status >= 500 || status === 429);
            if (!canRetry) break;
            const waitMs = RETRY_BASE_MS * attempt;
            process.stdout.write(`(retry ${attempt}/${MAX_RETRIES - 1} in ${waitMs}ms) `);
            await sleep(waitMs);
        }
    }
    throw new Error(`${label}: ${lastError?.message || 'Unknown error'}`);
}

function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function getAllSongUrls() {
    console.log('[import] Fetching sitemap...');
    const { data } = await withRetries(
        () => axios.get(SITEMAP_URL, { headers: HEADERS, timeout: 15000 }),
        'Sitemap fetch failed'
    );
    
    // Extract all loc tags
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    const urls = [];
    while ((match = locRegex.exec(data)) !== null) {
        const u = match[1].trim();
        if (u.includes('/tamil-christian-songs/') && !u.endsWith('/tamil-christian-songs/')) {
            urls.push(u);
        }
    }
    console.log(`[import] Found ${urls.length} song URLs in sitemap.`);
    return urls;
}

async function fetchLyricsFromPage(url) {
    const { data } = await withRetries(
        () => axios.get(url, { headers: HEADERS, timeout: 12000 }),
        'Lyrics fetch failed'
    );
    const $ = cheerio.load(data);

    // Extract song title from h1
    let title = $('div.member-profile-details h1').first().text().trim();
    if (!title) title = $('h1').first().text().trim();
    
    // Clean up title 
    title = title
        .replace(/ Lyrics Song Chords PPT.*/i, '')
        .replace(/ Song Lyrics Chords PPT.*/i, '')
        .replace(/ Lyrics PPT Chords.*/i, '')
        .replace(/ Lyrics Song.*/i, '')
        .split(' -')[0]
        .trim();

    // Method 1: Use the hidden pre-formatted text (most reliable, cleanest content)
    let rawText = '';
    const preFormatted = $('p[id^="verseTextToCopy"]').first();
    if (preFormatted.length > 0) {
        rawText = preFormatted.text().trim();
    }

    // Method 2: Fallback to div.text-song p tags
    if (!rawText) {
        const stanzaTexts = [];
        $('.text-song p:not([id^="verseTextToCopy"])').each((i, el) => {
            let html = $(el).html() || '';
            let text = html.replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '');
            text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
            if (text.length > 5 && !text.toLowerCase().includes('sign in')) {
                stanzaTexts.push(text);
            }
        });
        rawText = stanzaTexts.join('\n\n');
    }

    const stanzas = rawText
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 5 && !s.toLowerCase().includes('copyright'));

    return { title, stanzas };
}

async function saveSongToDb(title, stanzas, url) {
    // Check if already exists
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

    // Insert song
    const { data: newSong, error: songErr } = await supabase
        .from('songs')
        .insert([{ title, source_url: url }])
        .select()
        .single();

    if (songErr) throw new Error(`Song insert failed: ${songErr.message}`);

    // Insert lyrics
    const lyricsData = stanzas.map((stanza, i) => ({
        song_id: newSong.id,
        stanza_number: i + 1,
        lyrics: stanza
    }));

    const { error: lyricsErr } = await supabase.from('lyrics').insert(lyricsData);
    if (lyricsErr) throw new Error(`Lyrics insert failed: ${lyricsErr.message}`);

    return { inserted: true, id: newSong.id };
}

// --- Main ---
async function main() {
    const allUrls = await getAllSongUrls();
    const progress = loadProgress();
    const doneSet = new Set(progress.done);

    const remaining = allUrls.filter(u => !doneSet.has(u));
    console.log(`[import] ${doneSet.size} already done. ${remaining.length} remaining.`);

    let inserted = 0, skipped = 0, failed = 0;

    const failedSet = new Set(progress.failed);

    for (let i = 0; i < remaining.length; i++) {
        const url = remaining[i];
        process.stdout.write(`[${i + 1}/${remaining.length}] ${url.split('/').slice(-2, -1)[0]} ... `);

        try {
            const { title, stanzas } = await fetchLyricsFromPage(url);
            if (!title || stanzas.length === 0) {
                process.stdout.write('⚠️  No lyrics\n');
                progress.failed.push(url);
                failed++;
            } else {
                const result = await saveSongToDb(title, stanzas, url);
                if (result.skipped) {
                    process.stdout.write('⏭️  Skipped (exists)\n');
                    skipped++;
                } else {
                    process.stdout.write(`✅ Saved (${stanzas.length} stanzas)\n`);
                    inserted++;
                }
            }
            progress.done.push(url);
            failedSet.delete(url);
        } catch (err) {
            process.stdout.write(`❌ Error: ${err.message}\n`);
            failedSet.add(url);
            failed++;
        }

        progress.failed = Array.from(failedSet);

        saveProgress(progress);
        await sleep(DELAY_MS);

        // Status update every batch
        if ((i + 1) % BATCH_SIZE === 0) {
            console.log(`\n--- Batch complete: ${inserted} inserted, ${skipped} skipped, ${failed} failed ---\n`);
        }
    }

    console.log(`\n=== Import Complete ===`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped:  ${skipped}`);
    console.log(`Failed:   ${failed}`);
    console.log(`Progress saved to: ${PROGRESS_FILE}`);

    // Exit successfully for one-off job platforms (Render cron/job) once loop completes.
    process.exit(0);
}

main().catch(err => {
    console.error('[import] Fatal error:', err.message);
    process.exit(1);
});
