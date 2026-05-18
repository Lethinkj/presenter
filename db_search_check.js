const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xxvhhgberfkqvwjzkoia.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4dmhoZ2JlcmZrcXZ3anprb2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzODcyNjksImV4cCI6MjA4ODk2MzI2OX0.GLvwq5RUcTBM7yZxiSmi7sa7NQ4ItmIUrkoCJzkC8I0';
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeSearchText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(s1, s2) {
    if (!s1 || !s2) return Math.max(s1?.length || 0, s2?.length || 0);
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
        }
    }
    return track[s2.length][s1.length];
}

function similarityPercent(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 100.0;
    const distance = levenshteinDistance(longer, shorter);
    return ((longer.length - distance) / longer.length) * 100;
}

async function search() {
    const queryStr = "um alagana kangal song";
    const tokens = queryStr.split(/\s+/).filter(t => t.length > 0);
    let dbQuery = supabase.from('songs').select('*');

    if (tokens.length <= 1) {
        dbQuery = dbQuery.ilike('title', `%${queryStr}%`);
    } else {
        const orQuery = tokens.map(t => `title.ilike.%${t}%`).join(',');
        dbQuery = dbQuery.or(orQuery);
    }

    const { data, error } = await dbQuery.limit(250);
    if (error) {
        console.error('DB Error:', error);
        return;
    }

    const normalizedQuery = normalizeSearchText(queryStr);
    const thresholds = [100, 90, 80, 70, 60, 50];
    
    let matches = [];
    let usedThreshold = 0;

    for (const threshold of thresholds) {
        matches = data.map(song => {
            const normalizedTitle = normalizeSearchText(song.title);
            const sim = similarityPercent(normalizedQuery, normalizedTitle);
            return { ...song, similarity: sim };
        })
        .filter(song => song.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

        if (matches.length > 0) {
            usedThreshold = threshold;
            break;
        }
    }

    console.log(`Threshold bucket: ${usedThreshold}`);
    console.log('Top 5 results:');
    matches.slice(0, 5).forEach(m => {
        console.log(`${m.title} (${m.similarity.toFixed(2)}%)`);
    });
}

search();
