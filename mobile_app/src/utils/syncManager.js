import {
  getMaxUpdatedAt,
  loadOfflineSongs,
  bulkUpsertOfflineSongs,
  deleteOfflineSong,
} from '../offlineSqlite';

const PAGE = 250;
const LYRICS_BATCH = 100;
const LYRICS_PAGE_SIZE = 1000; // Supabase default max rows per request
const FETCH_RETRIES = 3;
const FETCH_RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const withRetry = async (fn, retries = FETCH_RETRIES) => {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastErr;
};

export async function syncSongs(supabase, { onProgress, force = false } = {}) {
  const maxUpdatedAt = force ? null : await getMaxUpdatedAt();

  let stats;
  if (!maxUpdatedAt) {
    stats = await _initialDownload(supabase, onProgress);
  } else {
    stats = await _incrementalSync(supabase, maxUpdatedAt, onProgress);
  }

  const songs = await loadOfflineSongs();
  return { songs, stats };
}

async function _initialDownload(supabase, onProgress) {
  onProgress?.({ phase: 'counting' });

  let total = null;
  try {
    const { count } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false);
    if (Number.isFinite(count)) total = count;
  } catch {}

  onProgress?.({ phase: 'downloading', downloaded: 0, total });

  const allSongs = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, source_url, updated_at')
      .eq('is_deleted', false)
      .order('id')
      .range(from, from + PAGE - 1);

    if (error || !data?.length) break;
    allSongs.push(...data);
    from += PAGE;
    onProgress?.({ phase: 'downloading', downloaded: allSongs.length, total });
    if (data.length < PAGE) break;
  }

  if (!allSongs.length) return { added: 0, updated: 0, deleted: 0, failed: 0 };

  const fetchBatchLyrics = (ids) => withRetry(async () => {
    const rows = [];
    let offset = 0;
    while (true) {
      const { data: page, error } = await supabase
        .from('lyrics')
        .select('song_id, stanza_number, lyrics')
        .in('song_id', ids)
        .order('song_id')
        .order('stanza_number')
        .range(offset, offset + LYRICS_PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      if (!page?.length) break;
      rows.push(...page);
      if (page.length < LYRICS_PAGE_SIZE) break;
      offset += LYRICS_PAGE_SIZE;
    }
    return rows;
  });

  const buildSongs = (batch, lyricsRows) => {
    const lyricsBySong = {};
    for (const row of lyricsRows) {
      if (!lyricsBySong[row.song_id]) lyricsBySong[row.song_id] = [];
      lyricsBySong[row.song_id].push(row.lyrics);
    }
    return batch.map(s => ({
      id: s.id,
      title: s.title,
      stanzas: lyricsBySong[s.id] || [],
      source: 'db',
      pendingSync: false,
      sourceUrl: s.source_url || null,
      updatedAt: s.updated_at || null,
      isDeleted: false,
    }));
  };

  // Pipeline: prefetch next batch lyrics while current batch is saving to SQLite
  let saved = 0;
  let failedBatches = 0;
  let nextFetch = fetchBatchLyrics(allSongs.slice(0, LYRICS_BATCH).map(s => s.id));

  for (let i = 0; i < allSongs.length; i += LYRICS_BATCH) {
    const batch = allSongs.slice(i, i + LYRICS_BATCH);

    const nextI = i + LYRICS_BATCH;
    const nextBatchIds = allSongs.slice(nextI, nextI + LYRICS_BATCH).map(s => s.id);
    const upcomingFetch = nextBatchIds.length ? fetchBatchLyrics(nextBatchIds) : null;

    let lyricsRows = [];
    try {
      lyricsRows = await nextFetch;
    } catch {
      failedBatches++;
    }
    nextFetch = upcomingFetch;

    try {
      await bulkUpsertOfflineSongs(buildSongs(batch, lyricsRows));
    } catch {
      failedBatches++;
    }

    saved += batch.length;
    onProgress?.({ phase: 'saving', downloaded: saved, total: allSongs.length });
  }

  return { added: allSongs.length, updated: 0, deleted: 0, failed: failedBatches };
}

async function _incrementalSync(supabase, since, onProgress) {
  onProgress?.({ phase: 'checking' });

  const { data, error } = await supabase
    .from('songs')
    .select('id, title, source_url, updated_at, is_deleted')
    .gt('updated_at', since)
    .order('updated_at');

  if (error || !data?.length) {
    onProgress?.({ phase: 'done' });
    return { added: 0, updated: 0, deleted: 0, failed: 0 };
  }

  const toDelete = data.filter(s => s.is_deleted);
  const toUpdate = data.filter(s => !s.is_deleted);

  onProgress?.({ phase: 'syncing', total: data.length });

  for (const s of toDelete) {
    try { await deleteOfflineSong(s.id); } catch {}
  }

  if (toUpdate.length > 0) {
    const ids = toUpdate.map(s => s.id);
    const lyricsRows = [];
    let offset = 0;
    while (true) {
      const { data: page, error: lyricErr } = await supabase
        .from('lyrics')
        .select('song_id, stanza_number, lyrics')
        .in('song_id', ids)
        .order('song_id')
        .order('stanza_number')
        .range(offset, offset + LYRICS_PAGE_SIZE - 1);
      if (lyricErr || !page?.length) break;
      lyricsRows.push(...page);
      if (page.length < LYRICS_PAGE_SIZE) break;
      offset += LYRICS_PAGE_SIZE;
    }

    const lyricsBySong = {};
    for (const row of lyricsRows) {
      if (!lyricsBySong[row.song_id]) lyricsBySong[row.song_id] = [];
      lyricsBySong[row.song_id].push(row.lyrics);
    }

    try {
      await bulkUpsertOfflineSongs(
        toUpdate.map(s => ({
          id: s.id,
          title: s.title,
          stanzas: lyricsBySong[s.id] || [],
          source: 'db',
          pendingSync: false,
          sourceUrl: s.source_url || null,
          updatedAt: s.updated_at,
          isDeleted: false,
        }))
      );
    } catch {}
  }

  onProgress?.({ phase: 'done' });
  return { added: 0, updated: toUpdate.length, deleted: toDelete.length, failed: 0 };
}
