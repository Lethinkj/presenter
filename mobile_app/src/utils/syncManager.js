/**
 * syncManager.js — Offline-first sync for WorshipCast
 *
 * On native (SQLite available):
 *   - First launch: bulk-downloads all songs + lyrics page by page
 *   - Subsequent opens: one Supabase request to find rows with updated_at > local max
 *
 * On web (no SQLite): caller should skip and use the Supabase-direct Fuse builder.
 *
 * Usage:
 *   const { songs, stats } = await syncSongs(supabase, {
 *     onProgress: ({ phase, downloaded, total }) => ...,
 *   });
 *   // songs: full list from local DB (use to build Fuse index)
 *   // stats: { added, updated, deleted }
 */

import {
  getMaxUpdatedAt,
  loadOfflineSongs,
  bulkUpsertOfflineSongs,
  deleteOfflineSong,
} from '../offlineSqlite';

const PAGE = 250;
const LYRICS_BATCH = 100;

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

  // Fetch song metadata page by page
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

  if (!allSongs.length) return { added: 0, updated: 0, deleted: 0 };

  // Fetch + save lyrics in batches so memory stays bounded
  let saved = 0;
  for (let i = 0; i < allSongs.length; i += LYRICS_BATCH) {
    const batch = allSongs.slice(i, i + LYRICS_BATCH);
    const ids = batch.map(s => s.id);

    const { data: lyricsRows } = await supabase
      .from('lyrics')
      .select('song_id, stanza_number, lyrics')
      .in('song_id', ids)
      .order('stanza_number');

    const lyricsBySong = {};
    for (const row of lyricsRows || []) {
      if (!lyricsBySong[row.song_id]) lyricsBySong[row.song_id] = [];
      lyricsBySong[row.song_id].push(row.lyrics);
    }

    await bulkUpsertOfflineSongs(
      batch.map(s => ({
        id: s.id,
        title: s.title,
        stanzas: lyricsBySong[s.id] || [],
        source: 'db',
        pendingSync: false,
        sourceUrl: s.source_url || null,
        updatedAt: s.updated_at || null,
        isDeleted: false,
      }))
    );

    saved += batch.length;
    onProgress?.({ phase: 'saving', downloaded: saved, total: allSongs.length });
  }

  return { added: allSongs.length, updated: 0, deleted: 0 };
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
    return { added: 0, updated: 0, deleted: 0 };
  }

  const toDelete = data.filter(s => s.is_deleted);
  const toUpdate = data.filter(s => !s.is_deleted);

  onProgress?.({ phase: 'syncing', total: data.length });

  for (const s of toDelete) {
    await deleteOfflineSong(s.id);
  }

  if (toUpdate.length > 0) {
    const { data: lyricsRows } = await supabase
      .from('lyrics')
      .select('song_id, stanza_number, lyrics')
      .in('song_id', toUpdate.map(s => s.id))
      .order('stanza_number');

    const lyricsBySong = {};
    for (const row of lyricsRows || []) {
      if (!lyricsBySong[row.song_id]) lyricsBySong[row.song_id] = [];
      lyricsBySong[row.song_id].push(row.lyrics);
    }

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
  }

  onProgress?.({ phase: 'done' });
  return { added: 0, updated: toUpdate.length, deleted: toDelete.length };
}
