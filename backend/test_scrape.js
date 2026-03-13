const axios = require('axios');
const fs = require('fs');

async function getSongHtml() {
    try {
        const url = 'https://tamilchristiansongs.in/yesu-en0-rajanae-2/';
        // wait the url from the result was 'https://tamilchristiansongs.in/yesu-en-rajanae/'
        // let's do search again to be sure
        const searchUrl = `https://tamilchristiansongs.in/?s=Yesu+En+Rajane`;
        const { data: searchHtml } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const cheerio = require('cheerio');
        const $1 = cheerio.load(searchHtml);
        const songUrl = $1('.entry-title a').first().attr('href');
        console.log("Found URL:", songUrl);
        
        if (songUrl) {
           const { data: songHtml } = await axios.get(songUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
           fs.writeFileSync('song.html', songHtml);
           console.log("Saved song.html");
        }
    } catch (e) {
        console.error("Failed:", e.message);
    }
}
getSongHtml();
