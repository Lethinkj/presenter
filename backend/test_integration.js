const axios = require('axios');

async function testFullFlow() {
    try {
        console.log("=== Testing /search API ===");
        const { data: searchResults } = await axios.get('http://localhost:3000/search?q=yesu+en+rajane');
        console.log(`Found ${searchResults.length} results.`);
        
        if (searchResults.length > 0) {
            const firstResult = searchResults[0];
            console.log(`\n=== Testing /lyrics API for ${firstResult.title} ===`);
            const { data: lyrics } = await axios.get(`http://localhost:3000/lyrics?url=${encodeURIComponent(firstResult.url)}`);
            console.log(`Fetched ${lyrics.length} stanzas.`);
            console.log("First stanza:", lyrics[0]);
            
            console.log(`\n=== Testing /save_song API ===`);
            const { data: saveResponse } = await axios.post('http://localhost:3000/save_song', {
                title: firstResult.title,
                stanzas: lyrics
            });
            console.log("Save Response:", saveResponse);
        }
    } catch (e) {
        console.error("Integration Test Error:", e.response ? e.response.data : e.message);
    }
}

testFullFlow();
