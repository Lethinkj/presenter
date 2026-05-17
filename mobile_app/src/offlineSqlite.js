import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'worshipcast_offline';
const DB_VERSION = 1;
const TABLE_NAME = 'offline_songs';

let sqlite;
let db;

const ensureDb = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }
  if (!db) {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
    await db.open();
    await db.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        stanzas TEXT NOT NULL,
        source TEXT,
        pending_sync INTEGER DEFAULT 0,
        source_url TEXT
      );`
    );
    await db.execute(`CREATE INDEX IF NOT EXISTS ${TABLE_NAME}_title_idx ON ${TABLE_NAME}(title);`);
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

export const initOfflineSqlite = async () => {
  const active = await ensureDb();
  return !!active;
};

export const loadOfflineSongs = async () => {
  const active = await ensureDb();
  if (!active) return [];

  const res = await active.query(
    `SELECT id, title, stanzas, source, pending_sync, source_url FROM ${TABLE_NAME}`
  );
  const rows = res?.values || [];
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title || ''),
    stanzas: parseStanzas(row.stanzas),
    source: row.source || 'db',
    pendingSync: Number(row.pending_sync) === 1,
    sourceUrl: row.source_url || null
  }));
};

export const upsertOfflineSong = async (song) => {
  const active = await ensureDb();
  if (!active) return;

  const payload = {
    id: String(song.id || ''),
    title: String(song.title || ''),
    stanzas: JSON.stringify(song.stanzas || []),
    source: song.source || 'db',
    pending_sync: song.pendingSync ? 1 : 0,
    source_url: song.sourceUrl || null
  };

  if (!payload.id || !payload.title) return;

  await active.run(
    `INSERT OR REPLACE INTO ${TABLE_NAME} (id, title, stanzas, source, pending_sync, source_url) VALUES (?, ?, ?, ?, ?, ?)` ,
    [
      payload.id,
      payload.title,
      payload.stanzas,
      payload.source,
      payload.pending_sync,
      payload.source_url
    ]
  );
};

export const bulkUpsertOfflineSongs = async (songs) => {
  const active = await ensureDb();
  if (!active) return;

  const list = Array.isArray(songs) ? songs : [];
  if (!list.length) return;

  await active.execute('BEGIN TRANSACTION;');
  try {
    for (const song of list) {
      const payload = {
        id: String(song?.id || ''),
        title: String(song?.title || ''),
        stanzas: JSON.stringify(song?.stanzas || []),
        source: song?.source || 'db',
        pending_sync: song?.pendingSync ? 1 : 0,
        source_url: song?.sourceUrl || null
      };

      if (!payload.id || !payload.title) continue;

      await active.run(
        `INSERT OR REPLACE INTO ${TABLE_NAME} (id, title, stanzas, source, pending_sync, source_url) VALUES (?, ?, ?, ?, ?, ?)` ,
        [
          payload.id,
          payload.title,
          payload.stanzas,
          payload.source,
          payload.pending_sync,
          payload.source_url
        ]
      );
    }
    await active.execute('COMMIT;');
  } catch (err) {
    await active.execute('ROLLBACK;');
    throw err;
  }
};

export const deleteOfflineSong = async (songId) => {
  const active = await ensureDb();
  if (!active) return;
  const id = String(songId || '');
  if (!id) return;
  await active.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
};
