import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'worshipcast_offline';
const DB_VERSION = 2;
const TABLE_NAME = 'offline_songs';

let sqlite;
let db;
let writeQueue = Promise.resolve();

const ensureDb = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }
  if (!db) {
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    db = isConn
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
    await db.open();
    await db.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        stanzas TEXT NOT NULL,
        source TEXT,
        pending_sync INTEGER DEFAULT 0,
        source_url TEXT,
        updated_at TEXT,
        is_deleted INTEGER DEFAULT 0
      );`
    );
    await db.execute(`CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_title_idx ON ${TABLE_NAME}(title);`);
    try { await db.execute(`ALTER TABLE ${TABLE_NAME} ADD COLUMN updated_at TEXT;`); } catch {}
    try { await db.execute(`ALTER TABLE ${TABLE_NAME} ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch {}
    await db.execute(`CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_updated_at_idx ON ${TABLE_NAME}(updated_at);`);
  }
  return db;
};

const parseStanzas = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Serialise all writes — each fn runs only after the previous one settles
const enqueueWrite = (fn) => {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.catch(() => {}); // keep chain alive even if fn throws
  return result;
};

export const initOfflineSqlite = async () => {
  const active = await ensureDb();
  return !!active;
};

export const loadOfflineSongs = async () => {
  const active = await ensureDb();
  if (!active) return [];

  const res = await active.query(
    `SELECT id, title, stanzas, source, pending_sync, source_url, updated_at, is_deleted FROM ${TABLE_NAME} WHERE is_deleted = 0`
  );
  const rows = res?.values || [];
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title || ''),
    stanzas: parseStanzas(row.stanzas),
    source: row.source || 'db',
    pendingSync: Number(row.pending_sync) === 1,
    sourceUrl: row.source_url || null,
    updatedAt: row.updated_at || null,
  }));
};

export const getMaxUpdatedAt = async () => {
  const active = await ensureDb();
  if (!active) return null;

  const res = await active.query(
    `SELECT MAX(updated_at) as max_updated_at FROM ${TABLE_NAME}`
  );
  const val = res?.values?.[0]?.max_updated_at;
  return val || null;
};

export const upsertOfflineSong = (song) => enqueueWrite(async () => {
  const active = await ensureDb();
  if (!active) return;

  const payload = {
    id: String(song.id || ''),
    title: String(song.title || ''),
    stanzas: JSON.stringify(song.stanzas || []),
    source: song.source || 'db',
    pending_sync: song.pendingSync ? 1 : 0,
    source_url: song.sourceUrl || null,
    updated_at: song.updatedAt || null,
    is_deleted: song.isDeleted ? 1 : 0,
  };

  if (!payload.id || !payload.title) return;

  await active.run(
    `INSERT OR REPLACE INTO ${TABLE_NAME} (id, title, stanzas, source, pending_sync, source_url, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [payload.id, payload.title, payload.stanzas, payload.source, payload.pending_sync, payload.source_url, payload.updated_at, payload.is_deleted]
  );
});

// SQLite allows max 999 bound params per statement; 8 cols → max 124 rows per INSERT
const INSERT_CHUNK = 100;

export const bulkUpsertOfflineSongs = (songs) => enqueueWrite(async () => {
  const active = await ensureDb();
  if (!active) return;

  const rows = (Array.isArray(songs) ? songs : [])
    .map(song => ({
      id: String(song?.id || ''),
      title: String(song?.title || ''),
      stanzas: JSON.stringify(song?.stanzas || []),
      source: song?.source || 'db',
      pending_sync: song?.pendingSync ? 1 : 0,
      source_url: song?.sourceUrl || null,
      updated_at: song?.updatedAt || null,
      is_deleted: song?.isDeleted ? 1 : 0,
    }))
    .filter(p => p.id && p.title);

  if (!rows.length) return;

  await active.beginTransaction();
  try {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = chunk.flatMap(p => [p.id, p.title, p.stanzas, p.source, p.pending_sync, p.source_url, p.updated_at, p.is_deleted]);
      await active.run(
        `INSERT OR REPLACE INTO ${TABLE_NAME} (id, title, stanzas, source, pending_sync, source_url, updated_at, is_deleted) VALUES ${placeholders}`,
        values,
        false, // transaction managed externally
      );
    }
    await active.commitTransaction();
  } catch (err) {
    try { await active.rollbackTransaction(); } catch {} // guard: rollback must not shadow real error
    throw err;
  }
});

export const deleteOfflineSong = (songId) => enqueueWrite(async () => {
  const active = await ensureDb();
  if (!active) return;
  const id = String(songId || '');
  if (!id) return;
  await active.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
});
