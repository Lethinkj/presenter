const scraper = require('./scraper.js');

async function test() {
    console.log("=== Testing searchSongs on christsquare.com ===");
    const results = await scraper.searchSongs("yesu");
    console.log("Results count:", results.length);
    console.log("First 3:", results.slice(0, 3).map(r => ({ title: r.title, url: r.url })));
    
    if (results.length > 0) {
        console.log(`\n=== Testing fetchLyrics for: ${results[0].title} ===`);
        const stanzas = await scraper.fetchLyrics(results[0].url);
        console.log("Stanzas extracted:", stanzas.length);
        if (stanzas.length > 0) console.log("First stanza preview:", stanzas[0].substring(0, 150));
    }
}

test().catch(console.error);
