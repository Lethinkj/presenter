import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { FaSearch, FaArrowLeft, FaDesktop, FaGlobe, FaDatabase, FaStar, FaRegStar, FaShareAlt, FaPlus, FaFont, FaWifi, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

// Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xxvhhgberfkqvwjzkoia.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4dmhoZ2JlcmZrcXZ3anprb2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzODcyNjksImV4cCI6MjA4ODk2MzI2OX0.GLvwq5RUcTBM7yZxiSmi7sa7NQ4ItmIUrkoCJzkC8I0';
const supabase = createClient(supabaseUrl, supabaseKey);

import { Capacitor } from '@capacitor/core';

// Use Production URLs if provided via .env, otherwise fallback to local dev network
const PROD_URL = import.meta.env.VITE_API_URL; 
const PROD_WS = import.meta.env.VITE_WS_URL;   

// Automatically detect the host IP address for local fallback
const host = window.location.hostname || '192.168.1.35';
const SERVER_IP = (host === 'localhost' || host === '127.0.0.1') ? '192.168.1.35' : host;
const API_BASE_NORMALIZED = PROD_URL ? PROD_URL.replace(/\/+$/, '') : null;

const normalizeWsUrl = (url) => {
  if (!url) return url;
  const apiIsHttps = !!API_BASE_NORMALIZED && API_BASE_NORMALIZED.startsWith('https://');
  const securePage = window.location.protocol === 'https:';
  if ((apiIsHttps || securePage) && url.startsWith('ws://')) {
    return `wss://${url.slice(5)}`;
  }
  return url;
};

export const API_BASE = API_BASE_NORMALIZED || `http://${SERVER_IP}:3000`;
export const WS_URL = normalizeWsUrl(
  PROD_WS || (API_BASE_NORMALIZED ? API_BASE_NORMALIZED.replace(/^http/, 'ws') : `ws://${SERVER_IP}:3000`)
);

const FONTS = [
  { label: 'Default', value: "'Inter', sans-serif" },
  { label: 'Serif', value: "'Georgia', serif" },
  { label: 'Noto Tamil', value: "'Noto Sans Tamil', sans-serif" },
  { label: 'Lato', value: "'Lato', sans-serif" },
  { label: 'Roboto Slab', value: "'Roboto Slab', serif" },
  { label: 'Courier', value: "'Courier New', monospace" },
];

const createDeviceCode = () => {
  const seed = (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '')
    .toUpperCase();
  return `DEV-${seed.slice(0, 8)}`;
};

function App() {
  const [activeTab, setActiveTab] = useState('db');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Presentation
  const [selectedSong, setSelectedSong] = useState(null);
  const [ws, setWs] = useState(null);
  const wsRef = useRef(null);
  const roomCodeRef = useRef(roomCode);
  const reconnectTimerRef = useRef(null);
  const [activeStanza, setActiveStanza] = useState(null);
  const [isEditingSong, setIsEditingSong] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editableStanzas, setEditableStanzas] = useState([]);
  const [savingEdits, setSavingEdits] = useState(false);
  const [savingWebSongs, setSavingWebSongs] = useState({});

  // Identity / Device
  const [deviceCode, setDeviceCode] = useState(() => {
    const saved = localStorage.getItem('deviceCode');
    if (saved) return saved;
    const generated = createDeviceCode();
    localStorage.setItem('deviceCode', generated);
    return generated;
  });
  const [userName, setUserName] = useState(() => localStorage.getItem('presenterUserName') || '');
  const [showProfileSetup, setShowProfileSetup] = useState(() => !localStorage.getItem('presenterUserName'));
  const [profileNameInput, setProfileNameInput] = useState(() => localStorage.getItem('presenterUserName') || '');
  const userNameRef = useRef(userName);
  const deviceCodeRef = useRef(deviceCode);

  // Room
  const [roomCode, setRoomCode] = useState(() => {
    const saved = localStorage.getItem('tvRoomCode');
    if (saved) return saved;
    return deviceCode.slice(-6).padStart(6, '0').toUpperCase();
  });
  const [copiedLink, setCopiedLink] = useState(false);

  // A-Z filter
  const [selectedLetter, setSelectedLetter] = useState(null);

  // Font
  const [displayFont, setDisplayFont] = useState(() => localStorage.getItem('displayFont') || FONTS[0].value);
  const [displayFontSize, setDisplayFontSize] = useState(() => {
    const saved = localStorage.getItem('displayFontSize');
    return saved ? (saved === 'auto' ? 'auto' : Number(saved)) : 'auto';
  });
  const [showFontPicker, setShowFontPicker] = useState(false);

  // Add Song Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addMode, setAddMode] = useState('manual'); // 'manual' | 'auto'
  const [manualStanzas, setManualStanzas] = useState(['']);
  const [autoText, setAutoText] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Favorites & Offline Cache
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worship_favorites')) || []; }
    catch { return []; }
  });
  const [offlineCache, setOfflineCache] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worship_offline_cache')) || {}; }
    catch { return {}; }
  });

  // Persist settings
  useEffect(() => { localStorage.setItem('tvRoomCode', roomCode); }, [roomCode]);
  useEffect(() => { localStorage.setItem('deviceCode', deviceCode); }, [deviceCode]);
  useEffect(() => {
    if (userName.trim()) {
      localStorage.setItem('presenterUserName', userName.trim());
    }
  }, [userName]);
  useEffect(() => { localStorage.setItem('worship_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('worship_offline_cache', JSON.stringify(offlineCache)); }, [offlineCache]);
  useEffect(() => { localStorage.setItem('displayFont', displayFont); }, [displayFont]);
  useEffect(() => { localStorage.setItem('displayFontSize', displayFontSize); }, [displayFontSize]);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Keep the latest room code available to WebSocket callbacks.
  useEffect(() => {
    roomCodeRef.current = roomCode;
    userNameRef.current = userName;
    deviceCodeRef.current = deviceCode;
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'join',
        room: roomCode,
        name: userNameRef.current || 'Anonymous',
        deviceCode: deviceCodeRef.current
      }));
    }
  }, [roomCode, userName, deviceCode]);

  // WebSocket
  useEffect(() => {
    let isDisposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (isDisposed) return;

      const existing = wsRef.current;
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (existing && existing.readyState !== WebSocket.CLOSED) {
        try { existing.close(); } catch { /* no-op */ }
      }

      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;
      setWs(socket);

      socket.onopen = () => {
        clearReconnectTimer();
        socket.send(JSON.stringify({
          type: 'join',
          room: roomCodeRef.current,
          name: userNameRef.current || 'Anonymous',
          deviceCode: deviceCodeRef.current
        }));
      };

      socket.onclose = () => {
        if (isDisposed) return;
        reconnectTimerRef.current = setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        // Close and trigger reconnect via onclose.
        try { socket.close(); } catch { /* no-op */ }
      };
    };

    const ensureConnected = () => {
      if (isDisposed) return;
      clearReconnectTimer();
      connect();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        ensureConnected();
      }
    };

    connect();

    // Mobile browsers/webviews may suspend timers when screen is off.
    // Re-check socket immediately when app/page becomes active again.
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ensureConnected);
    window.addEventListener('pageshow', ensureConnected);
    window.addEventListener('online', ensureConnected);

    return () => {
      isDisposed = true;
      clearReconnectTimer();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ensureConnected);
      window.removeEventListener('pageshow', ensureConnected);
      window.removeEventListener('online', ensureConnected);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* no-op */ }
      }
      wsRef.current = null;
      setWs(null);
    };
  }, []);

  // ---- Search ----
  const handleSearch = async () => {
    if (activeTab === 'favorites') { setResults(favorites); return; }
    if (!searchQuery.trim()) { setResults([]); return; }
    setLoading(true);
    setResults([]);
    setSelectedLetter(null);
    try {
      if (activeTab === 'db') {
        const { data, error } = await supabase.from('songs').select('id, title').ilike('title', `%${searchQuery}%`).limit(100);
        if (error) throw error;
        setResults(data.map(item => ({ id: item.id, title: item.title, source: 'db' })));
      } else {
        const res = await axios.get(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
        setResults(res.data.map(item => ({ url: item.url, title: item.title, source: 'web' })));
      }
    } catch (err) {
      console.error('Search error:', err);
      if (activeTab === 'db') {
        const cachedSongs = Object.values(offlineCache);
        const localMatches = cachedSongs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
        setResults(localMatches.map(item => ({ id: item.id, title: item.title, source: 'db', offline: true })));
      } else {
        alert('Search failed. Check connection.');
      }
    } finally { setLoading(false); }
  };

  const handleLetterFilter = async (letter) => {
    setSelectedLetter(letter);
    setSearchQuery('');
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.from('songs').select('id, title').ilike('title', `${letter}%`).order('title', { ascending: true }).limit(100);
      if (error) throw error;
      setResults(data.map(item => ({ id: item.id, title: item.title, source: 'db' })));
    } catch (err) {
      // Offline fallback
      const cachedSongs = Object.values(offlineCache);
      const matches = cachedSongs.filter(s => s.title.toUpperCase().startsWith(letter));
      setResults(matches.map(item => ({ id: item.id, title: item.title, source: 'db', offline: true })));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'favorites') handleSearch();
  }, [activeTab, favorites]);

  // ---- Song Select ----
  const handleSongSelect = async (songMetadata) => {
    setLoading(true);
    try {
      if (songMetadata.source === 'db') {
        let stanzasData = [];
        // Offline cache first
        if (offlineCache[songMetadata.id]) {
          stanzasData = offlineCache[songMetadata.id].stanzas;
        } else {
          const { data, error } = await supabase.from('lyrics').select('lyrics').eq('song_id', songMetadata.id).order('stanza_number', { ascending: true });
          if (error) throw error;
          stanzasData = data.map(item => item.lyrics);
          // Cache it
          setOfflineCache(prev => ({ ...prev, [songMetadata.id]: { id: songMetadata.id, title: songMetadata.title, stanzas: stanzasData, source: 'db' } }));
        }
        setSelectedSong({ id: songMetadata.id, title: songMetadata.title, stanzas: stanzasData, isCached: true });
      } else {
        const res = await axios.get(`${API_BASE}/lyrics?url=${encodeURIComponent(songMetadata.url)}`);
        setSelectedSong({ url: songMetadata.url, title: songMetadata.title, stanzas: res.data, isCached: false });
      }
    } catch (err) {
      if (offlineCache[songMetadata.id]) {
        const c = offlineCache[songMetadata.id];
        setSelectedSong({ id: c.id, title: c.title, stanzas: c.stanzas, isCached: true });
      } else {
        alert('Error fetching lyrics. Song not available offline.');
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!selectedSong) {
      setIsEditingSong(false);
      setEditTitle('');
      setEditableStanzas([]);
      return;
    }
    setIsEditingSong(false);
    setEditTitle(selectedSong.title || '');
    setEditableStanzas(Array.isArray(selectedSong.stanzas) ? [...selectedSong.stanzas] : []);
  }, [selectedSong]);

  const updateEditableStanza = (index, value) => {
    setEditableStanzas(prev => prev.map((item, i) => (i === index ? value : item)));
  };

  const addEditableStanza = () => setEditableStanzas(prev => [...prev, '']);
  const removeEditableStanza = (index) => setEditableStanzas(prev => prev.filter((_, i) => i !== index));

  const saveEditedSongToDb = async () => {
    if (!selectedSong) return;

    const cleanTitle = editTitle.trim();
    const cleanStanzas = editableStanzas.map(s => s.trim()).filter(Boolean);

    if (!cleanTitle) {
      alert('Title is required.');
      return;
    }
    if (cleanStanzas.length === 0) {
      alert('At least one stanza is required.');
      return;
    }

    setSavingEdits(true);
    try {
      const payload = {
        title: cleanTitle,
        stanzas: cleanStanzas,
        forceUpdate: true,
        sourceUrl: selectedSong.url || null
      };
      if (selectedSong.id) payload.songId = selectedSong.id;

      const res = await axios.post(`${API_BASE}/save_song`, payload);
      const persistedId = res.data.songId || selectedSong.id;

      setSelectedSong(prev => ({
        ...(prev || {}),
        id: persistedId,
        title: cleanTitle,
        stanzas: cleanStanzas,
        isCached: true
      }));

      if (persistedId) {
        setOfflineCache(prev => ({
          ...prev,
          [persistedId]: { id: persistedId, title: cleanTitle, stanzas: cleanStanzas, source: 'db' }
        }));
      }

      setIsEditingSong(false);
      alert('Song saved to database.');
    } catch (err) {
      alert('Failed to save edits: ' + (err.response?.data?.details || err.message));
    } finally {
      setSavingEdits(false);
    }
  };

  const handleSaveWebResultToDb = async (songItem) => {
    const saveKey = songItem.url || songItem.title;
    setSavingWebSongs(prev => ({ ...prev, [saveKey]: true }));

    try {
      const lyricRes = await axios.get(`${API_BASE}/lyrics?url=${encodeURIComponent(songItem.url)}`);
      const stanzas = (lyricRes.data || []).map(s => String(s || '').trim()).filter(Boolean);
      if (stanzas.length === 0) throw new Error('No stanzas found to save');

      const saveRes = await axios.post(`${API_BASE}/save_song`, {
        title: songItem.title,
        stanzas,
        sourceUrl: songItem.url
      });

      const newId = saveRes.data.songId;
      if (newId) {
        setOfflineCache(prev => ({ ...prev, [newId]: { id: newId, title: songItem.title, stanzas, source: 'db' } }));
      }
      alert(`Saved "${songItem.title}" to DB.`);
    } catch (err) {
      alert('Save to DB failed: ' + (err.response?.data?.details || err.message));
    } finally {
      setSavingWebSongs(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  // ---- Present / Clear ----
  const presentLyrics = async (stanzaText, stanzaIndex) => {
    const socket = wsRef.current || ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'present',
        text: stanzaText,
        room: roomCode,
        font: displayFont,
        fontSize: displayFontSize,
        name: userNameRef.current || 'Anonymous',
        deviceCode: deviceCodeRef.current
      }));
      setActiveStanza(stanzaIndex);
    } else {
      alert('WebSocket not connected. TV may not update.');
    }
    // Auto-save web songs to DB
    if (selectedSong && !selectedSong.isCached) {
      try {
        const res = await axios.post(`${API_BASE}/save_song`, { title: selectedSong.title, stanzas: selectedSong.stanzas });
        const newId = res.data.songId;
        setSelectedSong(prev => ({ ...prev, isCached: true, id: newId }));
        setOfflineCache(prev => ({ ...prev, [newId]: { id: newId, title: selectedSong.title, stanzas: selectedSong.stanzas, source: 'db' } }));
      } catch { /* silent */ }
    }
  };

  const clearScreen = () => {
    const socket = wsRef.current || ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'clear',
        room: roomCode,
        name: userNameRef.current || 'Anonymous',
        deviceCode: deviceCodeRef.current
      }));
      setActiveStanza(null);
    }
  };

  const completeProfileSetup = () => {
    const normalized = profileNameInput.trim();
    if (!normalized) {
      alert('Please enter your name to continue.');
      return;
    }
    setUserName(normalized);
    setShowProfileSetup(false);
  };

  // ---- Share Link ----
  const handleShareLink = () => {
    const tvUrl = `${API_BASE}/tv.html?room=${roomCode}`;
    navigator.clipboard.writeText(tvUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => alert('Could not copy link.'));
  };

  // ---- Favorites ----
  const toggleFavorite = (e, songItem) => {
    e.stopPropagation();
    const isFav = favorites.some(f => f.title === songItem.title);
    setFavorites(isFav ? favorites.filter(f => f.title !== songItem.title) : [...favorites, songItem]);
  };

  // ---- Add Song ----
  const openAddModal = () => {
    setAddTitle('');
    setAddMode('manual');
    setManualStanzas(['']);
    setAutoText('');
    setAddError('');
    setShowAddModal(true);
  };

  const addManualStanza = () => setManualStanzas(prev => [...prev, '']);
  const removeManualStanza = (i) => setManualStanzas(prev => prev.filter((_, idx) => idx !== i));
  const updateManualStanza = (i, val) => setManualStanzas(prev => prev.map((s, idx) => idx === i ? val : s));

  const handleSaveSong = async () => {
    if (!addTitle.trim()) { setAddError('Please enter a song title.'); return; }
    let stanzas = [];
    if (addMode === 'manual') {
      stanzas = manualStanzas.map(s => s.trim()).filter(s => s.length > 0);
    } else {
      stanzas = autoText.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
    }
    if (stanzas.length === 0) { setAddError('Add at least one stanza.'); return; }
    setAddSaving(true);
    setAddError('');
    try {
      const res = await axios.post(`${API_BASE}/save_song`, { title: addTitle.trim(), stanzas });
      const newId = res.data.songId;
      // Cache locally too
      setOfflineCache(prev => ({ ...prev, [newId]: { id: newId, title: addTitle.trim(), stanzas, source: 'db' } }));
      setShowAddModal(false);
      alert(`✅ "${addTitle.trim()}" saved with ${stanzas.length} stanza(s)!`);
    } catch (err) {
      setAddError('Save failed: ' + (err.response?.data?.details || err.message));
    } finally { setAddSaving(false); }
  };

  // ---- Presentation View ----
  if (selectedSong) {
    const displayStanzas = isEditingSong ? editableStanzas : selectedSong.stanzas;
    const selectedSongSaveKey = selectedSong.url || selectedSong.title;

    return (
      <div className="app-container" style={{ fontFamily: displayFont }}>
        <div className="app-header presentation-header">
          <button className="back-btn" onClick={() => { setSelectedSong(null); setActiveStanza(null); }}>
            <FaArrowLeft />
          </button>
          <h1 style={{ flex: 1, textAlign: 'left', fontSize: '1.1rem', margin: 0 }}>{selectedSong.title}</h1>
          <button className={`icon-btn ${isEditingSong ? 'active' : ''}`} title="Edit Song" onClick={() => setIsEditingSong(v => !v)}>
            <FaEdit />
          </button>
          <button className="icon-btn" title="Change Font" onClick={() => setShowFontPicker(f => !f)}>
            <FaFont />
          </button>
        </div>

        {isEditingSong && (
          <div className="song-edit-panel">
            <input
              className="modal-input"
              placeholder="Song Title"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
            <div className="song-edit-actions">
              <button className="add-stanza-btn" onClick={addEditableStanza}>+ Add Stanza</button>
              <button className="btn-cancel" onClick={() => {
                setIsEditingSong(false);
                setEditTitle(selectedSong.title || '');
                setEditableStanzas([...(selectedSong.stanzas || [])]);
              }}>
                <FaTimes style={{ marginRight: 6 }} /> Cancel
              </button>
              <button className="btn-save" onClick={saveEditedSongToDb} disabled={savingEdits}>
                <FaSave style={{ marginRight: 6 }} /> {savingEdits ? 'Saving...' : 'Save To DB'}
              </button>
            </div>
          </div>
        )}

        {showFontPicker && (
          <div className="font-picker-container">
            <div className="font-picker">
              {FONTS.map(f => (
                <button key={f.value} className={`font-opt ${displayFont === f.value ? 'active' : ''}`}
                  style={{ fontFamily: f.value }} onClick={() => setDisplayFont(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="size-picker">
              <label>TV Size:</label>
              <button className="size-btn" onClick={() => setDisplayFontSize(prev => prev === 'auto' ? 8 : Math.max(2, prev - 1))}>-</button>
              <button className={`size-btn auto-btn ${displayFontSize === 'auto' ? 'active' : ''}`} onClick={() => setDisplayFontSize('auto')}>Auto</button>
              <button className="size-btn" onClick={() => setDisplayFontSize(prev => prev === 'auto' ? 8 : Math.min(20, prev + 1))}>+</button>
              <span className="size-val">{displayFontSize === 'auto' ? 'Fitting' : `${displayFontSize}vw`}</span>
              <button className="done-btn" onClick={() => setShowFontPicker(false)}>Done</button>
            </div>
          </div>
        )}

        <div className="content-area">
          {!selectedSong.isCached && (
            <button
              className="web-save-current-btn"
              onClick={() => handleSaveWebResultToDb({ title: selectedSong.title, url: selectedSong.url })}
              disabled={!!savingWebSongs[selectedSongSaveKey]}
            >
              <FaSave style={{ marginRight: 6 }} /> {savingWebSongs[selectedSongSaveKey] ? 'Saving...' : 'Save This Song To DB'}
            </button>
          )}

          {displayStanzas.map((stanza, i) => (
            <div key={i} className="stanza-card">
              {isEditingSong ? (
                <div className="stanza-row">
                  <textarea
                    className="stanza-textarea"
                    rows={4}
                    value={stanza}
                    onChange={e => updateEditableStanza(i, e.target.value)}
                  />
                  {displayStanzas.length > 1 && (
                    <button className="remove-stanza" onClick={() => removeEditableStanza(i)}>✕</button>
                  )}
                </div>
              ) : (
                <pre className="stanza-text" style={{ fontFamily: displayFont }}>{stanza}</pre>
              )}
              <button
                className={`present-btn ${activeStanza === i ? 'active' : ''}`}
                onClick={() => presentLyrics(stanza, i)}
              >
                <FaDesktop /> {activeStanza === i ? 'Presented' : 'Present'}
              </button>
            </div>
          ))}
          <button className="clear-btn" onClick={clearScreen}>Clear TV Screen</button>
        </div>
      </div>
    );
  }

  // ---- Main View ----
  return (
    <div className="app-container">
      {/* Header */}
      <div className="app-header">
        <h1>WorshipCast</h1>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
          User: {userName || 'Anonymous'} | Device: {deviceCode}
        </div>
        <div className="room-control">
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TV Room: </label>
          <input type="text" className="room-input" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} />
          <button className={`share-btn ${copiedLink ? 'copied' : ''}`} onClick={handleShareLink} title="Copy TV Link">
            <FaShareAlt /> {copiedLink ? '✓' : ''}
          </button>
        </div>
        {!isOnline && (
          <span className="offline-chip"><FaWifi style={{ marginRight: 4 }} />Offline</span>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'db' ? 'active' : ''}`}
          onClick={() => { setActiveTab('db'); setResults([]); setSearchQuery(''); setSelectedLetter(null); }}>
          <FaDatabase style={{ marginRight: 6 }} />DB
        </button>
        <button className={`tab-btn ${activeTab === 'web' ? 'active' : ''}`}
          onClick={() => { setActiveTab('web'); setResults([]); setSearchQuery(''); }}>
          <FaGlobe style={{ marginRight: 6 }} />Web
        </button>
        <button className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => { setActiveTab('favorites'); setSearchQuery(''); }}>
          <FaStar style={{ marginRight: 6 }} />Favs
        </button>
      </div>

      <div className="content-area">
        {/* Search */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder={`Search ${activeTab === 'db' ? 'Database' : activeTab === 'web' ? 'Web' : 'Favorites'}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn" onClick={handleSearch} disabled={loading}><FaSearch /></button>
          {activeTab === 'db' && (
            <button className="add-btn" onClick={openAddModal} title="Add Song"><FaPlus /></button>
          )}
        </div>

        {/* A-Z Filter */}
        {activeTab === 'db' && (
          <div className="az-filter">
            {['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map(letter => (
              <button
                key={letter}
                className={`az-btn ${selectedLetter === letter ? 'active' : ''}`}
                onClick={() => {
                  if (letter === 'ALL') { setSelectedLetter(null); setResults([]); setSearchQuery(''); }
                  else handleLetterFilter(letter);
                }}
              >{letter}</button>
            ))}
          </div>
        )}

        {loading && <div className="loading">Searching...</div>}

        {!loading && results.length > 0 && (
          <div className="song-list">
            {results.map((item, index) => {
              const isFav = favorites.some(f => f.title === item.title);
              const isCached = !!offlineCache[item.id];
              return (
                <div key={index} className="song-card" onClick={() => handleSongSelect(item)}>
                  <div style={{ flex: 1 }}>
                    <p className="song-title">{item.title}</p>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {item.source === 'db' ? '📦 DB' : '🌐 Web'}
                      {item.offline && ' • 💾 Offline'}
                      {isCached && item.source === 'db' && ' • ⚡ Cached'}
                    </span>
                  </div>
                  {item.source === 'web' && (
                    <button
                      className="web-save-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveWebResultToDb(item);
                      }}
                      disabled={!!savingWebSongs[item.url || item.title]}
                    >
                      <FaSave style={{ marginRight: 6 }} /> {savingWebSongs[item.url || item.title] ? 'Saving...' : 'Save DB'}
                    </button>
                  )}
                  <button className="fav-btn" onClick={e => toggleFavorite(e, item)}>
                    {isFav ? <FaStar color="#f5b041" size={18} /> : <FaRegStar color="#666" size={18} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && results.length === 0 && searchQuery && !selectedLetter && (
          <div className="loading">No songs found.</div>
        )}
        {!loading && results.length === 0 && selectedLetter && (
          <div className="loading">No songs starting with "{selectedLetter}".</div>
        )}
      </div>

      {/* Add Song Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add Song</h2>

            <input
              className="modal-input"
              placeholder="Song Title"
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
            />

            {/* Mode Toggle */}
            <div className="mode-toggle">
              <button className={`mode-btn ${addMode === 'manual' ? 'active' : ''}`} onClick={() => setAddMode('manual')}>
                ✍️ Manual (Stanza by Stanza)
              </button>
              <button className={`mode-btn ${addMode === 'auto' ? 'active' : ''}`} onClick={() => setAddMode('auto')}>
                ✂️ Auto Split
              </button>
            </div>

            {addMode === 'manual' ? (
              <div className="stanza-editor">
                {manualStanzas.map((stanza, i) => (
                  <div key={i} className="stanza-row">
                    <textarea
                      className="stanza-textarea"
                      placeholder={`Stanza ${i + 1}...`}
                      value={stanza}
                      onChange={e => updateManualStanza(i, e.target.value)}
                      rows={3}
                    />
                    {manualStanzas.length > 1 && (
                      <button className="remove-stanza" onClick={() => removeManualStanza(i)}>✕</button>
                    )}
                  </div>
                ))}
                <button className="add-stanza-btn" onClick={addManualStanza}>+ Add Stanza</button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '8px 0 4px' }}>
                  Paste full lyrics — blank lines will automatically become stanza splits.
                </p>
                <textarea
                  className="stanza-textarea"
                  style={{ width: '100%', minHeight: 180 }}
                  placeholder={"Verse 1 line 1\nVerse 1 line 2\n\nVerse 2 line 1\nVerse 2 line 2"}
                  value={autoText}
                  onChange={e => setAutoText(e.target.value)}
                />
                {autoText && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4 }}>
                    Preview: {autoText.split(/\n\s*\n/).filter(s => s.trim()).length} stanza(s) detected
                  </p>
                )}
              </div>
            )}

            {addError && <p className="add-error">{addError}</p>}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSaveSong} disabled={addSaving}>
                {addSaving ? 'Saving...' : '💾 Save Song'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileSetup && (
        <div className="modal-overlay" onClick={e => e.stopPropagation()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Welcome</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 0 }}>
              Enter your name for this device. A unique device code is generated automatically.
            </p>
            <input
              className="modal-input"
              placeholder="Your Name"
              value={profileNameInput}
              onChange={e => setProfileNameInput(e.target.value)}
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Device Code: {deviceCode}
            </p>
            <div className="modal-actions">
              <button className="btn-save" onClick={completeProfileSetup}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
