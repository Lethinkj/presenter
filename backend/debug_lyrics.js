const axios = require('axios');
const fs = require('fs');

async function dump() {
    const url = 'https://www.christsquare.com/tamil-christian-songs/enthan-kanmalai/';
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    fs.writeFileSync('cs_song.html', data);
    console.log("Dumped to cs_song.html. Size:", data.length);
}
dump().catch(console.error);
