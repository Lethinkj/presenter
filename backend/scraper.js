const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.christsquare.com';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

/**
 * Search for songs on christsquare.com
 * @param {string} query
 * @returns {Array<{id, title, url}>}
 */
async function searchSongs(query) {
    try {
        console.log(`[scraper] Searching christsquare.com for: ${query}`);
        const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);
        const results = [];

        // Links to song pages follow the pattern /tamil-christian-songs/song-slug/
        $('a[href*="/tamil-christian-songs/"]').each((i, el) => {
            const href = $(el).attr('href');
            const title = $(el).text().trim();
            
            // Don't include the category index page itself
            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            const isIndexPage = fullUrl === `${BASE_URL}/tamil-christian-songs/` || fullUrl === `${BASE_URL}/tamil-christian-songs`;
            
            if (title && href && !isIndexPage && !results.some(r => r.url === fullUrl)) {
                // Clean up the title (remove " Lyrics Song Chords PPT" suffix and similar)
                const cleanTitle = title
                    .replace(/ Lyrics Song Chords PPT.*/i, '')
                    .replace(/ Song Lyrics Chords PPT.*/i, '')
                    .replace(/ Lyrics PPT Chords.*/i, '')
                    .replace(/ Lyrics Song.*/i, '')
                    .replace(/\s+-\s+.*/,'') // Remove the "- Tamil Title" suffix
                    .replace(/\s+/g, ' ')
                    .trim();
                    
                results.push({
                    id: `web-${Date.now()}-${i}`,
                    title: cleanTitle,
                    url: fullUrl
                });
            }
        });

        // Deduplicate by URL
        const seen = new Set();
        return results.filter(r => {
            if (seen.has(r.url)) return false;
            seen.add(r.url);
            return true;
        });
    } catch (error) {
        console.error('[scraper] Web search failed:', error.message);
        return [];
    }
}

/**
 * Fetch and extract lyrics stanzas from a christsquare.com song page
 * Best approach: use the hidden pre-formatted text div that stores lyrics with newlines.
 * @param {string} url
 * @returns {string[]}
 */
async function fetchLyrics(url) {
    try {
        console.log(`[scraper] Fetching lyrics from: ${url}`);
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);

        // The page has a hidden pre-formatted element with the full lyrics text
        // id starts with "verseTextToCopy" - we grab the first one (Tamil-English transliterated version)
        // Strategy: First try Tamil+tanglish merged version
        let rawText = '';
        
        // Method 1: Hidden pre-formatted text (most reliable)
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
                text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim();
                if (text.length > 5 && !text.toLowerCase().includes('sign in')) {
                    stanzaTexts.push(text);
                }
            });
            rawText = stanzaTexts.join('\n\n');
        }
        
        if (!rawText) {
            return ['Error: Could not extract lyrics from this page.'];
        }

        // Split the full text into stanzas by double newlines or single blank lines
        const stanzas = rawText
            .split(/\n\s*\n/)
            .map(s => s.trim())
            .filter(s => s.length > 5 && !s.toLowerCase().includes('copyright') && !s.toLowerCase().includes('all rights reserved'));

        return stanzas.length > 0 ? stanzas : ['Error: Could not extract lyrics from this page.'];

    } catch (error) {
        console.error('[scraper] Fetch lyrics failed:', error.message);
        return ['Error: The website might be blocking the request or the URL is invalid.'];
    }
}

module.exports = { searchSongs, fetchLyrics };
