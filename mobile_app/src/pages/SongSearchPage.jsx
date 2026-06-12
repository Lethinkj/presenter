import { useState, useEffect, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import axios from 'axios';
import { FaSearch, FaPlus, FaSave, FaStar, FaRegStar } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { initOfflineSqlite, loadOfflineSongs, bulkUpsertOfflineSongs } from '../offlineSqlite';
import { syncSongs } from '../utils/syncManager';
import AddSongModal from './AddSongModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

const loadTabSearchState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('tabSearchState') || '{}');
    return {
      db: parsed.db || '',
      web: parsed.web || '',
      favorites: parsed.favorites || '',
      images: parsed.images || '',
      bible: parsed.bible || '',
      recents: parsed.recents || '',
    };
  } catch {
    return { db: '', web: '', favorites: '', images: '', bible: '', recents: '' };
  }
};

const readJsonLocalStorageSafely = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const normalizeSearchText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (left, right) => {
  const a = normalizeSearchText(left);
  const b = normalizeSearchText(right);
  if (!a) return b.length;
  if (!b) return a.length;
  if (a === b) return 0;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
};

const similarityPercent = (left, right) => {
  const a = normalizeSearchText(left);
  const b = normalizeSearchText(right);
  if (!a && !b) return 0;
  if (a === b) return 100;
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  const base = Math.max(0, Math.round((1 - dist / maxLen) * 100));
  if (b.length >= 2 && a.startsWith(b)) return Math.max(90, base);
  if (b.length >= 3 && a.includes(b)) return Math.max(70, base);
  return base;
};

const matchRank = (title, query) => {
  const a = normalizeSearchText(title);
  const b = normalizeSearchText(query);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.startsWith(b)) return 2;
  if (a.includes(b)) return 1;
  return 0;
};

const rankByRelatedness = (items, query) => {
  const q = normalizeSearchText(query);
  if (!q) return items;
  const scored = items.map(item => ({ ...item, _s: similarityPercent(item.title, q) }));
  const sorter = (a, b) =>
    b._s - a._s ||
    matchRank(b.title, q) - matchRank(a.title, q) ||
    a.title.length - b.title.length ||
    a.title.localeCompare(b.title);
  for (const t of [100, 90, 80, 70, 60, 50]) {
    const hits = scored.filter(i => i._s >= t);
    if (hits.length) return hits.sort(sorter).map(({ _s, ...rest }) => rest);
  }
  return scored.sort(sorter).map(({ _s, ...rest }) => rest);
};

const parseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try { return new URL(raw); } catch {
    try { return new URL(`https://${raw}`); } catch { return null; }
  }
};

const getWebDomain = (url) => {
  if (!url) return 'Web';
  const parsed = parseUrl(String(url));
  if (!parsed) return 'Web';
  return parsed.hostname.replace(/^www\./i, '') || 'Web';
};

// Module-level session cache — survives component unmounts (e.g. navigating to song presentation)
const _session = { results: [], selectedLetter: null };

// ── Component ─────────────────────────────────────────────────────────────────

export default function SongSearchPage({
  activeTab,
  apiBase,
  sqliteEnabled,
  offlineCache,
  setOfflineCache,
  upsertOfflineSongSqlite,
  persistLocallyAndQueue,
  setStorageState,
  writeLocalStorage,
  onSongSelect,
  openSettingsPage,
  setShowHomeCards,
  openHomeCard,
  registerLoadSong,
}) {
  const [tabSearch, setTabSearch] = useState(() => loadTabSearchState());
  const [results, setResultsRaw] = useState(() => _session.results);
  const [loading, setLoading] = useState(false);
  const [selectedLetter, setSelectedLetterRaw] = useState(() => _session.selectedLetter);

  const setResults = (val) => {
    const next = typeof val === 'function' ? val(_session.results) : val;
    _session.results = next;
    setResultsRaw(next);
  };
  const setSelectedLetter = (val) => {
    _session.selectedLetter = val;
    setSelectedLetterRaw(val);
  };

  const [favorites, setFavorites] = useState(() => {
    const parsed = readJsonLocalStorageSafely('worship_favorites', []);
    return Array.isArray(parsed) ? parsed : [];
  });
  const [recentSongs, setRecentSongs] = useState(() => {
    const parsed = readJsonLocalStorageSafely('worship_recent_songs', []);
    return Array.isArray(parsed) ? parsed : [];
  });

  const [syncProgress, setSyncProgress] = useState({ active: false, phase: 'idle', downloaded: 0, total: null, message: '' });

  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addMode, setAddMode] = useState('manual');
  const [manualStanzas, setManualStanzas] = useState(['']);
  const [autoText, setAutoText] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (activeTab !== 'db') return;
    const prefill = sessionStorage.getItem('addSongPrefill');
    if (!prefill) return;
    sessionStorage.removeItem('addSongPrefill');
    setAutoText(prefill);
    setAddMode('auto');
    setAddTitle('');
    setShowAddModal(true);
  }, [activeTab]);
  const [savingWebSongs, setSavingWebSongs] = useState({});

  const fuseIndexRef = useRef(null);
  const fuseReadyRef = useRef(false);
  const searchGenRef = useRef(0);
  const searchMountedRef = useRef(false);
  const offlineCacheRef = useRef(offlineCache);
  useEffect(() => { offlineCacheRef.current = offlineCache; }, [offlineCache]);
  const handleSongSelectRef = useRef(null);

  const buildFuse = useCallback((items) => {
    if (!items || items.length === 0) return null;
    return new Fuse(items, {
      keys: ['title'],
      threshold: 0.4,
      minMatchCharLength: 2,
      ignoreLocation: true,
      distance: 200,
    });
  }, []);

  // Persist search state and lists
  useEffect(() => { writeLocalStorage('tabSearchState', JSON.stringify(tabSearch), 'search state'); }, [tabSearch, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('worship_favorites', JSON.stringify(favorites), 'favorites'); }, [favorites, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('worship_recent_songs', JSON.stringify(recentSongs), 'recent songs'); }, [recentSongs, writeLocalStorage]);

  // Build Fuse index on web (non-native) by paginating Supabase
  useEffect(() => {
    if (sqliteEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const PAGE = 1000;
        let all = [], from = 0;
        while (true) {
          const { data, error } = await supabase.from('songs').select('id, title').order('id').range(from, from + PAGE - 1);
          if (error || !data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        if (!cancelled && all.length > 0) {
          fuseIndexRef.current = buildFuse(all);
          fuseReadyRef.current = true;
        }
      } catch (e) { console.error('[Fuse] Failed to build index:', e); }
    })();
    return () => { cancelled = true; };
  }, [buildFuse, sqliteEnabled]);

  // Init SQLite + background sync on native
  useEffect(() => {
    if (!sqliteEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const ok = await initOfflineSqlite();
        if (!ok) return;
        const songs = await loadOfflineSongs();
        if (cancelled) return;
        if (songs.length > 0) {
          const map = {};
          for (const song of songs) map[song.id] = song;
          setOfflineCache(map);
          fuseIndexRef.current = buildFuse(songs);
          fuseReadyRef.current = true;
        } else {
          const localList = Object.values(offlineCacheRef.current || {});
          if (localList.length) await bulkUpsertOfflineSongs(localList);
        }
        setStorageState(prev => ({ ...prev, loaded: true, directory: 'SQLite', permission: 'app-data-only', lastError: '' }));

        if (!cancelled) {
          const progressHandler = ({ phase, downloaded, total }) => {
            const messages = {
              counting: 'Checking for updates...', checking: 'Checking for updates...',
              downloading: total ? `Downloading ${downloaded}/${total}...` : `Downloading ${downloaded}...`,
              saving: `Saving ${downloaded}/${total ?? '?'}...`,
              syncing: 'Syncing updates...', done: '',
            };
            setSyncProgress({ active: phase !== 'done', phase, downloaded: downloaded ?? 0, total: total ?? null, message: messages[phase] ?? '' });
          };
          try {
            const { songs: synced, stats } = await syncSongs(supabase, { onProgress: progressHandler });
            if (cancelled) return;
            setSyncProgress({ active: false, phase: 'done', downloaded: 0, total: null, message: '' });
            if (synced.length > 0) {
              fuseIndexRef.current = buildFuse(synced);
              fuseReadyRef.current = true;
              const map = {};
              for (const song of synced) map[song.id] = song;
              setOfflineCache(map);
            }
            if (stats.updated > 0 || stats.deleted > 0 || stats.added > 0)
              console.log(`[Sync] +${stats.added} updated:${stats.updated} deleted:${stats.deleted}`);
          } catch (syncErr) {
            if (!cancelled) {
              setSyncProgress({ active: false, phase: 'error', downloaded: 0, total: null, message: '' });
              console.error('[Sync] Background sync failed:', syncErr?.message || syncErr);
            }
          }
        }
      } catch (err) {
        if (!cancelled)
          setStorageState(prev => ({ ...prev, lastError: `SQLite init failed: ${err?.message || err}` }));
      }
    })();
    return () => { cancelled = true; };
  }, [sqliteEnabled, buildFuse, setOfflineCache, setStorageState]);

  // ── Search ──────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    const searchQuery = tabSearch[activeTab] || '';
    if (activeTab === 'favorites') { setResults(favorites); return; }
    if (activeTab === 'recents') {
      if (!searchQuery.trim()) { setResults(recentSongs); return; }
      const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const filtered = recentSongs.filter(item =>
        tokens.every(t => String(item.title || '').toLowerCase().includes(t))
      );
      setResults(rankByRelatedness(filtered, searchQuery));
      return;
    }
    if (!searchQuery.trim()) { setResults([]); return; }
    const gen = ++searchGenRef.current;
    setLoading(true);
    setResults([]);
    setSelectedLetter(null);
    const safeSet = (items) => { if (searchGenRef.current === gen) setResults(items); };
    try {
      if (activeTab === 'db') {
        if (fuseReadyRef.current) {
          const hits = fuseIndexRef.current.search(searchQuery, { limit: 100 });
          safeSet(hits.map(r => ({ id: r.item.id, title: r.item.title, source: 'db' })));
        } else {
          const { data, error } = await supabase.from('songs').select('id, title').ilike('title', `${searchQuery.trim()}%`).limit(100);
          if (error) throw error;
          safeSet((data || []).map(item => ({ id: item.id, title: item.title, source: 'db' })));
        }
      } else {
        const res = await axios.get(`${apiBase}/search?q=${encodeURIComponent(searchQuery)}`);
        safeSet(rankByRelatedness(res.data.map(i => ({ url: i.url, title: i.title, source: 'web' })), searchQuery).slice(0, 100));
      }
    } catch (err) {
      console.error('Search error:', err);
      if (activeTab === 'db') {
        if (fuseReadyRef.current) {
          const hits = fuseIndexRef.current.search(searchQuery, { limit: 100 });
          safeSet(hits.map(r => ({ id: r.item.id, title: r.item.title, source: 'db', offline: true })));
        } else {
          const cachedSongs = Object.values(offlineCacheRef.current || {});
          if (cachedSongs.length > 0) {
            const fb = buildFuse(cachedSongs);
            safeSet(fb.search(searchQuery, { limit: 100 }).map(r => ({ id: r.item.id, title: r.item.title, source: 'db', offline: true })));
          }
        }
      } else {
        alert('Search failed. Check connection.');
      }
    } finally { setLoading(false); }
  }, [activeTab, tabSearch, favorites, recentSongs, apiBase, buildFuse]);

  const handleLetterFilter = async (letter) => {
    setSelectedLetter(letter);
    setTabSearch(prev => ({ ...prev, db: '' }));
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.from('songs').select('id, title').ilike('title', `${letter}%`).order('title', { ascending: true }).limit(100);
      if (error) throw error;
      setResults(data.map(item => ({ id: item.id, title: item.title, source: 'db' })));
    } catch {
      const matches = Object.values(offlineCacheRef.current || {}).filter(s => s.title.toUpperCase().startsWith(letter));
      setResults(matches.map(item => ({ id: item.id, title: item.title, source: 'db', offline: true })));
    } finally { setLoading(false); }
  };

  // Auto-refresh favorites/recents when tab or data changes
  useEffect(() => {
    if (activeTab === 'favorites' || activeTab === 'recents') handleSearch();
  }, [activeTab, favorites, recentSongs]);

  // Live debounced search on DB tab
  useEffect(() => {
    if (!searchMountedRef.current) { searchMountedRef.current = true; return; }
    if (activeTab !== 'db' || selectedLetter) return;
    const query = tabSearch.db || '';
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => handleSearch(), 220);
    return () => clearTimeout(timer);
  }, [activeTab, tabSearch.db, selectedLetter]);

  // ── Song Select ─────────────────────────────────────────────────────────────

  const handleSongSelect = async (songMetadata, songIndex) => {
    setLoading(true);
    const recentItem = { title: songMetadata.title, source: songMetadata.source, id: songMetadata.id, url: songMetadata.url, offline: !!songMetadata.offline };
    setRecentSongs(prev => {
      const key = (i) => `${i.source || ''}:${i.id || i.url || i.title || ''}`;
      return [recentItem, ...prev.filter(i => key(i) !== key(recentItem))].slice(0, 20);
    });
    const queueResults = _session.results;
    const queueIndex = songIndex ?? queueResults.findIndex(r => (r.id && r.id === songMetadata.id) || (r.url && r.url === songMetadata.url) || r.title === songMetadata.title);
    try {
      if (songMetadata.source === 'db') {
        let stanzasData = [];
        if (offlineCache[songMetadata.id]) {
          stanzasData = offlineCache[songMetadata.id].stanzas;
        } else {
          const { data, error } = await supabase.from('lyrics').select('lyrics').eq('song_id', songMetadata.id).order('stanza_number', { ascending: true });
          if (error) throw error;
          stanzasData = data.map(item => item.lyrics);
          const entry = { id: songMetadata.id, title: songMetadata.title, stanzas: stanzasData, source: 'db' };
          setOfflineCache(prev => ({ ...prev, [songMetadata.id]: entry }));
          upsertOfflineSongSqlite(entry);
        }
        onSongSelect({ id: songMetadata.id, title: songMetadata.title, stanzas: stanzasData, isCached: true }, queueResults, queueIndex);
      } else {
        const res = await axios.get(`${apiBase}/lyrics?url=${encodeURIComponent(songMetadata.url)}`);
        onSongSelect({ url: songMetadata.url, title: songMetadata.title, stanzas: res.data, isCached: false }, queueResults, queueIndex);
      }
      window.history.pushState({ appView: 'song' }, '');
    } catch {
      const cached = offlineCache[songMetadata.id];
      if (cached) onSongSelect({ id: cached.id, title: cached.title, stanzas: cached.stanzas, isCached: true }, queueResults, queueIndex);
      else alert('Error fetching lyrics. Song not available offline.');
    } finally { setLoading(false); }
  };

  handleSongSelectRef.current = handleSongSelect;

  // Intercepts URL pastes — always fresh (not memoized) so it reads latest tabSearch
  const handleSearchOrUrl = () => {
    const q = (tabSearch[activeTab] || '').trim();
    if (/^https?:\/\//i.test(q)) {
      let title = '';
      try {
        const u = new URL(q);
        const songParam = u.searchParams.get('song');
        const keywordParam = u.searchParams.get('keyword');
        if (songParam) title = songParam.replace(/\+/g, ' ').trim();
        else if (keywordParam) title = keywordParam.replace(/\+/g, ' ').trim();
      } catch {}
      if (!title) title = getWebDomain(q);
      handleSongSelect({ url: q, title, source: 'web' }, 0);
    } else {
      handleSearch();
    }
  };

  // Let parent call handleSongSelect for queue-based navigation (e.g. swipe in presentation)
  if (registerLoadSong) registerLoadSong(handleSongSelect);

  const handleSaveWebResultToDb = async (songItem) => {
    const key = songItem.url || songItem.title;
    setSavingWebSongs(prev => ({ ...prev, [key]: true }));
    try {
      const lyricRes = await axios.get(`${apiBase}/lyrics?url=${encodeURIComponent(songItem.url)}`);
      const stanzas = (lyricRes.data || []).map(s => String(s || '').trim()).filter(Boolean);
      if (!stanzas.length) throw new Error('No stanzas found');
      const saveRes = await axios.post(`${apiBase}/save_song`, { title: songItem.title, stanzas, sourceUrl: songItem.url });
      const newId = saveRes.data.songId;
      if (newId) {
        const entry = { id: newId, title: songItem.title, stanzas, source: 'db' };
        setOfflineCache(prev => ({ ...prev, [newId]: entry }));
        upsertOfflineSongSqlite(entry);
      }
      alert(`Saved "${songItem.title}" to DB.`);
    } catch (err) {
      alert('Save to DB failed: ' + (err.response?.data?.details || err.message));
    } finally { setSavingWebSongs(prev => ({ ...prev, [key]: false })); }
  };

  const toggleFavorite = (e, songItem) => {
    e.stopPropagation();
    const isFav = favorites.some(f => f.title === songItem.title);
    setFavorites(isFav ? favorites.filter(f => f.title !== songItem.title) : [...favorites, songItem]);
  };

  // ── Add Song ────────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setAddTitle(''); setAddMode('manual'); setManualStanzas(['']); setAutoText(''); setAddError(''); setShowAddModal(true);
  };
  const addManualStanza = () => setManualStanzas(prev => [...prev, '']);
  const removeManualStanza = (i) => setManualStanzas(prev => prev.filter((_, idx) => idx !== i));
  const updateManualStanza = (i, val) => setManualStanzas(prev => prev.map((s, idx) => idx === i ? val : s));

  const handleSaveSong = async () => {
    if (!addTitle.trim()) { setAddError('Please enter a song title.'); return; }
    const stanzas = addMode === 'manual'
      ? manualStanzas.map(s => s.trim()).filter(Boolean)
      : autoText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (!stanzas.length) { setAddError('Add at least one stanza.'); return; }
    setAddSaving(true); setAddError('');
    try {
      const res = await axios.post(`${apiBase}/save_song`, { title: addTitle.trim(), stanzas });
      const newId = res.data.songId;
      const entry = { id: newId, title: addTitle.trim(), stanzas, source: 'db' };
      setOfflineCache(prev => ({ ...prev, [newId]: entry }));
      upsertOfflineSongSqlite(entry);
      setShowAddModal(false);
      alert(`"${addTitle.trim()}" saved with ${stanzas.length} stanza(s)!`);
    } catch {
      const localId = persistLocallyAndQueue({ title: addTitle.trim(), stanzas, sourceUrl: null, songId: null, forceUpdate: false });
      setShowAddModal(false); setAddError('');
      alert(`Saved offline as ${localId}. Will sync when connection is available.`);
    } finally { setAddSaving(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="song-controls">
        <div className="search-container">
          <div className="input-clear-wrap search-wrap">
            <input
              id="song-search-input"
              type="text"
              className="search-input"
              placeholder={`Search ${activeTab === 'db' ? 'Database' : activeTab === 'web' ? 'Web' : activeTab === 'recents' ? 'Recents' : 'Favorites'}...`}
              value={tabSearch[activeTab] || ''}
              onChange={e => setTabSearch(prev => ({ ...prev, [activeTab]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSearchOrUrl()}
            />
            {!!(tabSearch[activeTab] || '') && (
              <button className="text-clear-btn" onClick={() => setTabSearch(prev => ({ ...prev, [activeTab]: '' }))}>
                Clear
              </button>
            )}
          </div>
          <button className="btn" onClick={handleSearchOrUrl} disabled={loading}><FaSearch /></button>
          {activeTab === 'db' && (
            <button className="add-btn" onClick={openAddModal} title="Add Song"><FaPlus /></button>
          )}
        </div>

        {activeTab === 'db' && syncProgress?.active && syncProgress.message && (
          <div className="sync-progress-banner">
            <span className="sync-progress-dot" />
            {syncProgress.message}
          </div>
        )}

        {activeTab === 'db' && (
          <div className="az-filter">
            {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map(letter => (
              <button
                key={letter}
                className={`az-btn ${selectedLetter === letter ? 'active' : ''}`}
                onClick={() => {
                  if (letter === 'ALL') { setSelectedLetter(null); setResults([]); setTabSearch(prev => ({ ...prev, db: '' })); }
                  else handleLetterFilter(letter);
                }}
              >{letter}</button>
            ))}
          </div>
        )}
      </div>

      <div className="song-results">
        {loading && <div className="loading">Searching...</div>}

        {!loading && results.length > 0 && (
          <>
            <div className="result-count">{results.length} song{results.length !== 1 ? 's' : ''} found</div>
            <div className="song-list">
              {results.map((item, index) => {
                const isFav = favorites.some(f => f.title === item.title);
                return (
                  <div key={index} className="song-card" onClick={() => handleSongSelect(item, index)}>
                    <span className="song-card-number">{index + 1}</span>
                    <div className="song-card-info">
                      <p className="song-title">{item.title}</p>
                      <div className="song-meta">
                        {item.language && <span className="lang-badge">{item.language}</span>}
                        {item.source === 'web' && (
                          <span className="source-badge source-web">{getWebDomain(item.url)}</span>
                        )}
                      </div>
                    </div>
                    {item.source === 'web' && (
                      <button
                        className="web-save-btn"
                        onClick={e => { e.stopPropagation(); handleSaveWebResultToDb(item); }}
                        disabled={!!savingWebSongs[item.url || item.title]}
                      >
                        <FaSave style={{ marginRight: 6 }} />
                        {savingWebSongs[item.url || item.title] ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    <button className="fav-btn" onClick={e => toggleFavorite(e, item)}>
                      {isFav ? <FaStar color="#f5b041" size={18} /> : <FaRegStar color="#666" size={18} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && results.length === 0 && (tabSearch[activeTab] || '') && !selectedLetter && (
          <div className="empty-state">
            <FaSearch size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
            <p>No songs found for "{tabSearch[activeTab]}"</p>
          </div>
        )}
        {!loading && results.length === 0 && selectedLetter && (
          <div className="empty-state">
            <span className="empty-state-letter">{selectedLetter}</span>
            <p>No songs starting with "{selectedLetter}"</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddSongModal
          setShowAddModal={setShowAddModal}
          addTitle={addTitle}
          setAddTitle={setAddTitle}
          addMode={addMode}
          setAddMode={setAddMode}
          manualStanzas={manualStanzas}
          updateManualStanza={updateManualStanza}
          removeManualStanza={removeManualStanza}
          addManualStanza={addManualStanza}
          autoText={autoText}
          setAutoText={setAutoText}
          addError={addError}
          handleSaveSong={handleSaveSong}
          addSaving={addSaving}
          onOpenTransliterate={openHomeCard ? () => { setShowAddModal(false); openHomeCard('transliterate'); } : undefined}
        />
      )}
    </>
  );
}
