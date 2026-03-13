const axios = require('axios');
const cheerio = require('cheerio');

async function checkSongPage() {
    const url = 'https://www.christsquare.com/tamil-christian-songs/enthan-kanmalai/';
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
    const $ = cheerio.load(data);

    const title = $('h1').first().text().trim();
    console.log("Title:", title);

    // Try various containers
    const containers = {
        '.entry-content': $('.entry-content').length,
        'article .entry-content': $('article .entry-content').length,
        '.post-content': $('.post-content').length,
        'article': $('article').length,
    };
    console.log("Containers:", containers);

    // Try to get all <p> tags
    const paras = [];
    $('article p, .entry-content p').each((i, el) => {
        const html = $(el).html() || '';
        const clean = html.replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
        if (clean.length > 5) paras.push(clean.substring(0, 80));
    });
    console.log("Sample paragraphs:", paras.slice(0, 5));

    // Also check search page structure
    const searchUrl = 'https://www.christsquare.com/?s=yesu';
    const { data: searchData } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    const $s = cheerio.load(searchData);
    const links = [];
    $s('a[href*="/tamil-christian-songs/"]').each((i, el) => {
        const href = $s(el).attr('href');
        const text = $s(el).text().trim();
        if (text && href && !links.some(l => l.href === href)) links.push({ href, text });
    });
    console.log("Search result links:", links.slice(0, 5));
}
checkSongPage().catch(console.error);
