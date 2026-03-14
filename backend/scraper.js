const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.christsquare.com';
const CSB_BASE_URL = 'https://christiansongbook.org';
const DDG_SEARCH_URL = 'https://duckduckgo.com/html/';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

function makeId(prefix, i) {
    return `${prefix}-${Date.now()}-${i}`;
}

function cleanTitle(rawTitle = '') {
    return rawTitle
        .replace(/ Lyrics Song Chords PPT.*/i, '')
        .replace(/ Song Lyrics Chords PPT.*/i, '')
        .replace(/ Lyrics PPT Chords.*/i, '')
        .replace(/ Lyrics Song.*/i, '')
        .replace(/\s+-\s+.*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function absoluteUrl(base, href) {
    if (!href) return '';
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    if (href.startsWith('/')) return `${base}${href}`;
    return `${base}/${href}`;
}

function buildQueryTokens(query) {
    return String(query || '')
        .toLowerCase()
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 1);
}

function matchesQuery(title, queryTokens) {
    if (queryTokens.length === 0) return true;
    const titleLower = String(title || '').toLowerCase();
    return queryTokens.some(token => titleLower.includes(token));
}

function normalizeResultUrl(href) {
    if (!href) return '';
    if (href.startsWith('//')) return `https:${href}`;

    // DuckDuckGo redirect wrapper: /l/?uddg=<encoded-url>
    if (href.startsWith('/l/?') || href.includes('duckduckgo.com/l/?')) {
        try {
            const redirectUrl = href.startsWith('http') ? href : `https://duckduckgo.com${href}`;
            const parsed = new URL(redirectUrl);
            const target = parsed.searchParams.get('uddg');
            if (target) return decodeURIComponent(target);
        } catch (_) {
            return '';
        }
    }

    return href;
}

function looksLikeLyricsPage(url, title) {
    const hay = `${url} ${title}`.toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
    if (/(facebook|instagram|youtube|x\.com|twitter|wikipedia|pinterest|linkedin)\./i.test(hay)) return false;
    if (/\/search|\/tag\/|\/category\/|\/author\//i.test(hay)) return false;
    return /(lyrics|christian|song|tamil|padal|keerthanai)/i.test(hay);
}

function scoreResult(item, queryTokens) {
    const text = `${item.title} ${item.url}`.toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
        if (text.includes(token)) score += 3;
    }
    if (/lyrics/.test(text)) score += 2;
    if (/tamil/.test(text)) score += 2;
    if (/christian|yesu|karthar|devan|jesus/.test(text)) score += 1;
    if (item.site === 'duckduckgo') score += 1;
    return score;
}

function htmlToPlainText(html = '') {
    return String(html)
        .replace(/<(br|BR)\s*\/?\s*>/g, '\n')
        .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article)>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function textToStanzas(text = '') {
    return String(text)
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 8)
        .filter(s => !/cookie|comment|subscribe|share|menu|privacy|terms|posted on|posted in/i.test(s))
        .filter((stanza, index, arr) => arr.indexOf(stanza) === index)
        .slice(0, 100);
}

async function searchWeb(query) {
    const queryTokens = buildQueryTokens(query);
    const fullQuery = `${query} tamil christian song lyrics`;
    const { data } = await axios.get(DDG_SEARCH_URL, {
        headers: HEADERS,
        timeout: 15000,
        params: { q: fullQuery, kl: 'in-en' }
    });

    const $ = cheerio.load(data);
    const raw = [];

    const candidates = $('.result__a, .result-link, a[href]');
    candidates.each((i, el) => {
        const href = $(el).attr('href') || '';
        const title = cleanTitle($(el).text().trim());
        const url = normalizeResultUrl(href);
        if (!title || !url) return;
        if (!looksLikeLyricsPage(url, title)) return;
        if (!matchesQuery(title, queryTokens)) return;
        if (raw.some(r => r.url === url)) return;

        raw.push({
            id: makeId('web-ddg', i),
            title,
            url,
            site: 'duckduckgo'
        });
    });

    return raw
        .sort((a, b) => scoreResult(b, queryTokens) - scoreResult(a, queryTokens))
        .slice(0, 40);
}

async function searchChristSquare(query) {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const $ = cheerio.load(data);
    const results = [];
    const queryTokens = buildQueryTokens(query);

    $('a[href*="/tamil-christian-songs/"]').each((i, el) => {
        const href = $(el).attr('href');
        const title = $(el).text().trim();
        const fullUrl = absoluteUrl(BASE_URL, href);
        const isIndexPage = fullUrl === `${BASE_URL}/tamil-christian-songs/` || fullUrl === `${BASE_URL}/tamil-christian-songs`;

        if (title && fullUrl && !isIndexPage && matchesQuery(title, queryTokens) && !results.some(r => r.url === fullUrl)) {
            results.push({
                id: makeId('web-cs', i),
                title: cleanTitle(title),
                url: fullUrl,
                site: 'christsquare'
            });
        }
    });

    return results;
}

async function searchChristianSongBook(query) {
    const searchUrls = [
        `${CSB_BASE_URL}/?language=tamil&s=${encodeURIComponent(query)}`,
        `${CSB_BASE_URL}/?s=${encodeURIComponent(query)}&language=tamil`
    ];

    const merged = [];
    const queryTokens = buildQueryTokens(query);
    for (const searchUrl of searchUrls) {
        try {
            const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 12000 });
            const $ = cheerio.load(data);

            // Prefer explicit post/search result title links first.
            const resultLinks = $('.entry-title a, .post-title a, article h2 a, article h3 a, .search-results a[href]');
            const scanSet = resultLinks.length > 0 ? resultLinks : $('a[href]');

            scanSet.each((i, el) => {
                const href = $(el).attr('href');
                let title = $(el).text().trim();
                const fullUrl = absoluteUrl(CSB_BASE_URL, href);
                const isSongLink =
                    fullUrl.includes('christiansongbook.org') &&
                    !fullUrl.includes('/wp-') &&
                    !fullUrl.includes('/category/') &&
                    !fullUrl.includes('/tag/') &&
                    !fullUrl.includes('/author/') &&
                    !fullUrl.includes('/feed') &&
                    !fullUrl.includes('/?') &&
                    !fullUrl.endsWith('/language/tamil/') &&
                    !fullUrl.endsWith('/language/tamil') &&
                    !fullUrl.endsWith('/') &&
                    !fullUrl.includes('/page/');

                if (!isSongLink || !title || title.length < 2) return;

                title = cleanTitle(title);
                if (!matchesQuery(title, queryTokens)) return;

                if (!merged.some(r => r.url === fullUrl)) {
                    merged.push({
                        id: makeId('web-csb', i),
                        title,
                        url: fullUrl,
                        site: 'christiansongbook'
                    });
                }
            });
        } catch (err) {
            console.warn(`[scraper] ChristianSongBook search URL failed: ${searchUrl} (${err.message})`);
        }
    }

    return merged.slice(0, 60);
}

/**
 * Search for songs on christsquare.com
 * @param {string} query
 * @returns {Array<{id, title, url}>}
 */
async function searchSongs(query) {
    try {
        console.log(`[scraper] Searching web for: ${query}`);
        const webResults = await searchWeb(query);

        let results = webResults;
        // If generic web search is sparse, enrich with known source search.
        if (results.length < 8) {
            const [christsquareResults, csbResults] = await Promise.all([
                searchChristSquare(query),
                searchChristianSongBook(query)
            ]);
            results = [...results, ...christsquareResults, ...csbResults];
        }

        // Deduplicate by URL
        const seen = new Set();
        return results.filter(r => {
            if (seen.has(r.url)) return false;
            seen.add(r.url);
            return r.title && r.url;
        }).slice(0, 50);
    } catch (error) {
        console.error('[scraper] Web search failed:', error.message);
        return [];
    }
}

async function fetchLyricsFromChristSquare(url) {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const $ = cheerio.load(data);

    let rawText = '';
    const preFormatted = $('p[id^="verseTextToCopy"]').first();
    if (preFormatted.length > 0) {
        rawText = preFormatted.text().trim();
    }

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

    const stanzas = rawText
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 5 && !s.toLowerCase().includes('copyright') && !s.toLowerCase().includes('all rights reserved'));

    return stanzas.length > 0 ? stanzas : ['Error: Could not extract lyrics from this page.'];
}

async function fetchLyricsFromChristianSongBook(url) {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const $ = cheerio.load(data);

    $('script, style, noscript, .sharedaddy, .jp-relatedposts').remove();

    const blocks = [];
    const contentRoot = $('.entry-content, .post-content, article').first();
    const root = contentRoot.length ? contentRoot : $('body');

    root.find('p, li, div').each((i, el) => {
        let html = $(el).html() || '';
        if (!html) return;
        let text = html
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+\n/g, '\n')
            .replace(/\n\s+/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();

        if (!text) return;
        if (text.length < 8) return;
        if (/search|menu|comment|share|copyright|posted on|posted in/i.test(text)) return;
        blocks.push(text);
    });

    const rawText = blocks.join('\n\n');
    const stanzas = rawText
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 5)
        .filter((stanza, index, arr) => arr.indexOf(stanza) === index);

    return stanzas.length > 0 ? stanzas : ['Error: Could not extract lyrics from this ChristianSongBook page.'];
}

async function fetchLyricsFromGenericPage(url) {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);

    $('script, style, noscript, iframe, nav, header, footer, .ads, .advertisement').remove();

    const candidates = [
        '.lyrics',
        '#lyrics',
        '.entry-content',
        '.post-content',
        'article',
        'main',
        'body'
    ];

    let bestBlocks = [];
    for (const selector of candidates) {
        const root = $(selector).first();
        if (!root.length) continue;

        const blocks = [];
        root.find('p, li, div').each((i, el) => {
            let html = $(el).html() || '';
            if (!html) return;
            const text = htmlToPlainText(html);

            if (!text || text.length < 8) return;
            if (/cookie|comment|subscribe|share|menu|copyright|privacy/i.test(text)) return;
            blocks.push(text);
        });

        if (blocks.length > bestBlocks.length) bestBlocks = blocks;
    }

    // Fallback to full body text if block extraction is sparse.
    let rawText = bestBlocks.join('\n\n');
    if (!rawText || rawText.length < 80) {
        rawText = htmlToPlainText(($('main').html() || $('article').html() || $('body').html() || ''));
    }

    let stanzas = textToStanzas(rawText);

    // Final fallback: split by line breaks if stanza-based split did not work.
    if (stanzas.length === 0) {
        const lines = String(rawText)
            .split(/\n+/)
            .map(s => s.trim())
            .filter(s => s.length > 8)
            .slice(0, 80);

        if (lines.length > 0) {
            const grouped = [];
            for (let i = 0; i < lines.length; i += 4) {
                grouped.push(lines.slice(i, i + 4).join('\n'));
            }
            stanzas = grouped;
        }
    }

    return stanzas.length > 0 ? stanzas : ['Error: Could not extract lyrics from this page.'];
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
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./i, '');

        if (host.includes('christsquare.com')) {
            const stanzas = await fetchLyricsFromChristSquare(url);
            if (stanzas[0] && stanzas[0].startsWith('Error:')) {
                return await fetchLyricsFromGenericPage(url);
            }
            return stanzas;
        }

        if (host.includes('christiansongbook.org')) {
            const stanzas = await fetchLyricsFromChristianSongBook(url);
            if (stanzas[0] && stanzas[0].startsWith('Error:')) {
                return await fetchLyricsFromGenericPage(url);
            }
            return stanzas;
        }

        return await fetchLyricsFromGenericPage(url);

    } catch (error) {
        console.error('[scraper] Fetch lyrics failed:', error.message);
        return ['Error: The website might be blocking the request or the URL is invalid.'];
    }
}

module.exports = { searchSongs, fetchLyrics };
