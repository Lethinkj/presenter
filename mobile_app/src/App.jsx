import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { FaSearch, FaArrowLeft, FaGlobe, FaDatabase, FaStar, FaRegStar, FaShareAlt, FaPlus, FaFont, FaWifi, FaEdit, FaSave, FaTimes, FaCog, FaTrash, FaDownload, FaImage, FaBook, FaHistory } from 'react-icons/fa';
import { App as CapacitorApp } from '@capacitor/app';

// Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xxvhhgberfkqvwjzkoia.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4dmhoZ2JlcmZrcXZ3anprb2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzODcyNjksImV4cCI6MjA4ODk2MzI2OX0.GLvwq5RUcTBM7yZxiSmi7sa7NQ4ItmIUrkoCJzkC8I0';
const supabase = createClient(supabaseUrl, supabaseKey);

import { Capacitor, registerPlugin } from '@capacitor/core';

const OfflinePresenter = registerPlugin('OfflinePresenter');

// Use Production URLs if provided via .env, otherwise fallback to local dev network
const PROD_URL = import.meta.env.VITE_API_URL; 
const PROD_WS = import.meta.env.VITE_WS_URL;   

// Detect runtime host when available (native app usually has no browser host).
const host = window.location.hostname || '';
const SERVER_IP = (host && host !== 'localhost' && host !== '127.0.0.1') ? host : '';
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

export const API_BASE = API_BASE_NORMALIZED || (SERVER_IP ? `http://${SERVER_IP}:3000` : 'http://localhost:3000');
export const WS_URL = normalizeWsUrl(
  PROD_WS || (API_BASE_NORMALIZED ? API_BASE_NORMALIZED.replace(/^http/, 'ws') : (SERVER_IP ? `ws://${SERVER_IP}:3000` : 'ws://localhost:3000'))
);

const FONTS = [
  { label: 'Default', value: "'Inter', sans-serif" },
  { label: 'Serif', value: "'Georgia', serif" },
  { label: 'Noto Tamil', value: "'Noto Sans Tamil', sans-serif" },
  { label: 'Lato', value: "'Lato', sans-serif" },
  { label: 'Roboto Slab', value: "'Roboto Slab', serif" },
  { label: 'Courier', value: "'Courier New', monospace" },
];

const safeUuid = () => {
  const c = globalThis?.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createDeviceCode = () => {
  const seed = safeUuid()
    .replace(/-/g, '')
    .toUpperCase();
  return `DEV-${seed.slice(0, 8)}`;
};

const loadTabSearchState = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('tabSearchState') || '{}');
    return {
      db: parsed.db || '',
      web: parsed.web || '',
      favorites: parsed.favorites || '',
      images: parsed.images || '',
      bible: parsed.bible || '',
      recents: parsed.recents || ''
    };
  } catch {
    return { db: '', web: '', favorites: '', images: '', bible: '', recents: '' };
  }
};

const rankByRelatedness = (items, query) => {
  const tokens = String(query || '').toLowerCase().split(/\s+/).map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return items;

  return [...items]
    .map(item => {
      const title = String(item.title || '').toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (title === token) score += 8;
        else if (title.startsWith(token)) score += 5;
        else if (title.includes(token)) score += 2;
      }
      if (title.includes(tokens.join(' '))) score += 4;
      return { ...item, _score: score };
    })
    .sort((a, b) => b._score - a._score || a.title.localeCompare(b.title))
    .map(({ _score, ...rest }) => rest);
};

const extractFirstIpv4 = (value) => {
  const text = String(value || '');
  const match = text.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  if (!match) return '';
  const ip = match[1];
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return '';
  if (parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return '';
  return ip;
};

const isValidIpv4 = (value) => {
  const parts = String(value || '').split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  }
  return true;
};

const isValidHostname = (value) => {
  const host = String(value || '').trim();
  if (!host || host.length > 253) return false;
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return false;
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) return false;
  const labels = host.split('.');
  if (labels.some(label => !label || label.length > 63)) return false;
  if (labels.some(label => label.startsWith('-') || label.endsWith('-'))) return false;
  return true;
};

const normalizeHostInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const stripped = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^wss?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .trim();

  const ipv4 = extractFirstIpv4(stripped);
  if (ipv4 && isValidIpv4(ipv4)) return ipv4;

  if (isValidIpv4(stripped)) return stripped;
  if (isValidHostname(stripped)) return stripped.toLowerCase();
  return '';
};

const formatOfflineLink = (host, port, roomCode, includeProtocol = true) => {
  if (!host) return '';
  const safePort = String(port || '3000');
  const portPart = safePort === '80' ? '' : `:${safePort}`;
  return `${includeProtocol ? 'http://' : ''}${host}${portPart}/t/${roomCode}`;
};

const isPrivateIpv4 = (ip) => {
  if (!ip) return false;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }
  return false;
};

const isShareableOfflineHost = (host) => {
  const normalized = normalizeHostInput(host);
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized.startsWith('127.')) return false;
  if (isValidIpv4(normalized)) {
    return isPrivateIpv4(normalized);
  }
  return true;
};

const hostFromUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname || '';
  } catch {
    return '';
  }
};

const discoverLocalIps = async () => {
  const RTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
  if (!RTC) return [];

  return new Promise((resolve) => {
    const ips = new Set();
    let settled = false;
    const pc = new RTC({ iceServers: [] });

    const finish = () => {
      if (settled) return;
      settled = true;
      try { pc.onicecandidate = null; } catch { /* no-op */ }
      try { pc.close(); } catch { /* no-op */ }
      resolve(Array.from(ips));
    };

    const timer = setTimeout(finish, 1800);

    pc.createDataChannel('worshipcast');
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        clearTimeout(timer);
        finish();
        return;
      }
      const text = String(event.candidate.candidate || '');
      const found = text.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
      if (found && isPrivateIpv4(found[1])) {
        ips.add(found[1]);
      }
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => {
        clearTimeout(timer);
        finish();
      });
  });
};

const createLocalSongId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const OFFLINE_DATA_FILE_PATH = 'worshipcast/offline-data.json';
const NATIVE_FILE_STORAGE_ENABLED_IN_BUILD = false;
const LOCAL_DATA_SNAPSHOT_KEY = 'worship_local_data_snapshot';

const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read image file'));
  reader.readAsDataURL(file);
});

const optimizeImageForPresent = async (file) => {
  const originalDataUrl = await readImageAsDataUrl(file);
  const objectUrl = URL.createObjectURL(file);

  try {
    const imageElement = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = objectUrl;
    });

    const width = imageElement.naturalWidth || 0;
    const height = imageElement.naturalHeight || 0;
    if (!width || !height) return originalDataUrl;

    const MAX_DIMENSION = 1600;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return originalDataUrl;

    context.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
    const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.84);

    // Keep the optimized image only when there is a meaningful size reduction.
    if (optimizedDataUrl.length < originalDataUrl.length * 0.95) {
      return optimizedDataUrl;
    }
    return originalDataUrl;
  } catch {
    return originalDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'db');
  const [tabSearch, setTabSearch] = useState(() => loadTabSearchState());
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSettings, setShowSettings] = useState(false);

  // Presentation
  const [selectedSong, setSelectedSong] = useState(null);
  const [ws, setWs] = useState(null);
  const wsRef = useRef(null);
  const roomCodeRef = useRef('');
  const reconnectTimerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const staleCheckIntervalRef = useRef(null);
  const lastPongAtRef = useRef(Date.now());
  const pendingPresentRef = useRef(null);
  const reconnectDelayRef = useRef(1500);
  const presentAttemptRef = useRef(0);
  const ensureConnectedRef = useRef(() => {});
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
  const [copiedOfflineLink, setCopiedOfflineLink] = useState(false);

  // A-Z filter
  const [selectedLetter, setSelectedLetter] = useState(null);

  // Font
  const [displayFont, setDisplayFont] = useState(() => localStorage.getItem('displayFont') || FONTS[0].value);
  const [displayFontSize, setDisplayFontSize] = useState(() => {
    const saved = localStorage.getItem('displayFontSize');
    return saved ? (saved === 'auto' ? 'auto' : Number(saved)) : 'auto';
  });
  const [displayImageSize, setDisplayImageSize] = useState(() => {
    const saved = localStorage.getItem('displayImageSize');
    return saved ? (saved === 'auto' ? 'auto' : Number(saved)) : 'auto';
  });
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [activeImageId, setActiveImageId] = useState(null);
  const [imageRemoveMode, setImageRemoveMode] = useState(false);
  const imageInputRef = useRef(null);
  const [bibleBooks, setBibleBooks] = useState([]);
  const [selectedBibleBook, setSelectedBibleBook] = useState(null);
  const [selectedBibleChapterIndex, setSelectedBibleChapterIndex] = useState(0);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [bibleError, setBibleError] = useState('');
  const [activeBibleVerseKey, setActiveBibleVerseKey] = useState('');
  const [activeBibleVerseText, setActiveBibleVerseText] = useState('');
  const [showBibleControls, setShowBibleControls] = useState(false);
  const bibleSwipeStartXRef = useRef(null);
  const bibleVerseListRef = useRef(null);
  const lastFontSyncRef = useRef({ initialized: false, font: '', size: '' });
  const lastImageSizeSyncRef = useRef({ initialized: false, size: '' });
  const lastBibleFontSyncRef = useRef({ initialized: false, font: '', size: '', verseKey: '' });

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
  const [recentSongs, setRecentSongs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worship_recent_songs')) || []; }
    catch { return []; }
  });
  const [offlineCache, setOfflineCache] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worship_offline_cache')) || {}; }
    catch { return {}; }
  });
  const [pendingSyncQueue, setPendingSyncQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worship_pending_sync_queue')) || []; }
    catch { return []; }
  });
  const [syncState, setSyncState] = useState({ syncing: false, lastRun: null, lastError: '' });
  const [offlineDownloadState, setOfflineDownloadState] = useState({ downloading: false, downloaded: 0, total: null, lastError: '' });
  const [storageState, setStorageState] = useState({ permission: 'unknown', loaded: false, lastSavedAt: null, lastError: '' });
  const [localSnapshotSavedAt, setLocalSnapshotSavedAt] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_DATA_SNAPSHOT_KEY) || '{}');
      return parsed.savedAt || null;
    } catch {
      return null;
    }
  });
  const [nativeFileStorageEnabled, setNativeFileStorageEnabled] = useState(() => localStorage.getItem('nativeFileStorageEnabled') === 'true');
  const [offlineServerStatus, setOfflineServerStatus] = useState({ checking: false, ok: null, message: '' });
  const [autoDetectingLan, setAutoDetectingLan] = useState(false);
  const [startingOfflinePresent, setStartingOfflinePresent] = useState(false);
  const [nativeOfflineServer, setNativeOfflineServer] = useState({ running: false, host: '', port: 3000, url: '' });

  // Connection config for LAN/hotspot use.
  const [serverHost, setServerHost] = useState(() => localStorage.getItem('presenterServerHost') || '');
  const [serverPort, setServerPort] = useState(() => localStorage.getItem('presenterServerPort') || '3000');

  const cleanedServerHost = useMemo(() => normalizeHostInput(serverHost), [serverHost]);
  const cleanedServerPort = useMemo(() => {
    const parsed = Number(serverPort);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return '3000';
    return String(parsed);
  }, [serverPort]);

  const apiBase = useMemo(() => {
    if (API_BASE_NORMALIZED) return API_BASE_NORMALIZED;
    if (cleanedServerHost) return `http://${cleanedServerHost}:${cleanedServerPort}`;
    return API_BASE;
  }, [cleanedServerHost, cleanedServerPort]);

  const detectedLanHost = useMemo(() => {
    if (cleanedServerHost) return cleanedServerHost;
    return '';
  }, [cleanedServerHost]);

  const offlineTvUrl = useMemo(
    () => formatOfflineLink(detectedLanHost, cleanedServerPort, roomCode, true),
    [detectedLanHost, cleanedServerPort, roomCode]
  );
  const offlineTvUrlSimple = useMemo(
    () => formatOfflineLink(detectedLanHost, cleanedServerPort, roomCode, false),
    [detectedLanHost, cleanedServerPort, roomCode]
  );

  const pendingQueueRef = useRef(pendingSyncQueue);
  const offlineCacheRef = useRef(offlineCache);
  const syncInProgressRef = useRef(false);
  const nativeStorageLoadedRef = useRef(false);
  const autoDetectAttemptedRef = useRef(false);
  const autoDetectPromiseRef = useRef(null);

  useEffect(() => { pendingQueueRef.current = pendingSyncQueue; }, [pendingSyncQueue]);
  useEffect(() => { offlineCacheRef.current = offlineCache; }, [offlineCache]);

  const ensureStoragePermission = useCallback(async (askUser = true) => {
    if (!NATIVE_FILE_STORAGE_ENABLED_IN_BUILD) {
      setStorageState(prev => ({ ...prev, permission: 'disabled-in-build', loaded: true }));
      if (askUser) {
        alert('Device file storage is disabled in this build for stability. Offline data will continue using app local storage.');
      }
      return false;
    }

    if (!Capacitor.isNativePlatform()) {
      setStorageState(prev => ({ ...prev, permission: 'not-required' }));
      return true;
    }

    // App-private files (Directory.Data) normally do not need runtime permission.
    // Keep permission prompt optional for users who want explicit storage grant.
    try {
      if (!askUser) {
        setStorageState(prev => ({ ...prev, permission: 'app-data-only' }));
        return true;
      }

      const allow = window.confirm('Allow storage permission for offline files? This lets the app save song data for offline access.');
      if (!allow) {
        setStorageState(prev => ({ ...prev, permission: 'app-data-only' }));
        return true;
      }

      setStorageState(prev => ({ ...prev, permission: 'app-data-only' }));
      setNativeFileStorageEnabled(false);
      return false;
    } catch (err) {
      // Directory.Data generally works without external storage permission on Android.
      setStorageState(prev => ({ ...prev, permission: 'app-data-only', lastError: err.message || '' }));
      return true;
    }
  }, []);

  const saveOfflineDataToDevice = useCallback(async () => {
    if (!NATIVE_FILE_STORAGE_ENABLED_IN_BUILD) return;
    if (!Capacitor.isNativePlatform()) return;
    if (!nativeFileStorageEnabled) return;
    if (!nativeStorageLoadedRef.current) return;

    try {
      const payload = {
        updatedAt: Date.now(),
        offlineCache: offlineCacheRef.current,
        pendingSyncQueue: pendingQueueRef.current
      };

      // Native file storage runtime is intentionally disabled in this build.
      void payload;

      setStorageState(prev => ({ ...prev, lastSavedAt: Date.now(), lastError: '' }));
    } catch (err) {
      setStorageState(prev => ({ ...prev, lastError: err.message || 'Failed to save app file' }));
    }
  }, [nativeFileStorageEnabled]);

  const loadOfflineDataFromDevice = useCallback(async () => {
    if (!NATIVE_FILE_STORAGE_ENABLED_IN_BUILD) {
      nativeStorageLoadedRef.current = true;
      setStorageState(prev => ({ ...prev, loaded: true, permission: 'disabled-in-build' }));
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      nativeStorageLoadedRef.current = true;
      setStorageState(prev => ({ ...prev, loaded: true }));
      return;
    }

    if (!nativeFileStorageEnabled) {
      nativeStorageLoadedRef.current = true;
      setStorageState(prev => ({ ...prev, loaded: true, permission: 'app-data-only' }));
      return;
    }

    try {
      const file = null;

      const parsed = JSON.parse(file?.data || '{}');
      if (parsed.offlineCache && typeof parsed.offlineCache === 'object') {
        setOfflineCache(parsed.offlineCache);
      }
      if (Array.isArray(parsed.pendingSyncQueue)) {
        setPendingSyncQueue(parsed.pendingSyncQueue);
      }
    } catch {
      // Missing file is expected on first install.
    } finally {
      nativeStorageLoadedRef.current = true;
      setStorageState(prev => ({ ...prev, loaded: true }));
    }
  }, [nativeFileStorageEnabled]);

  const enqueueSongForSync = useCallback((item) => {
    const syncItem = {
      queueId: `q-${safeUuid().replace(/-/g, '').slice(0, 16)}`,
      title: String(item.title || '').trim(),
      stanzas: (item.stanzas || []).map(s => String(s || '').trim()).filter(Boolean),
      sourceUrl: item.sourceUrl || null,
      songId: item.songId || null,
      forceUpdate: Boolean(item.forceUpdate),
      localId: item.localId || null,
      createdAt: Date.now()
    };

    if (!syncItem.title || syncItem.stanzas.length === 0) return;

    setPendingSyncQueue(prev => {
      // Replace older queue entry for same song/update target when possible.
      const filtered = prev.filter(existing => {
        if (syncItem.songId && existing.songId) return existing.songId !== syncItem.songId;
        if (syncItem.localId && existing.localId) return existing.localId !== syncItem.localId;
        return true;
      });
      return [...filtered, syncItem];
    });
  }, []);

  const persistLocallyAndQueue = useCallback(({ title, stanzas, songId = null, sourceUrl = null, forceUpdate = false }) => {
    const localId = songId || createLocalSongId();
    const cleanTitle = String(title || '').trim();
    const cleanStanzas = (stanzas || []).map(s => String(s || '').trim()).filter(Boolean);

    setOfflineCache(prev => ({
      ...prev,
      [localId]: { id: localId, title: cleanTitle, stanzas: cleanStanzas, source: 'db', pendingSync: true }
    }));

    enqueueSongForSync({
      title: cleanTitle,
      stanzas: cleanStanzas,
      sourceUrl,
      songId: String(localId).startsWith('local-') ? null : localId,
      forceUpdate,
      localId
    });

    return localId;
  }, [enqueueSongForSync]);

  // Persist settings
  useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('tvRoomCode', roomCode); }, [roomCode]);
  useEffect(() => { localStorage.setItem('tabSearchState', JSON.stringify(tabSearch)); }, [tabSearch]);
  useEffect(() => { localStorage.setItem('deviceCode', deviceCode); }, [deviceCode]);
  useEffect(() => {
    if (userName.trim()) {
      localStorage.setItem('presenterUserName', userName.trim());
    }
  }, [userName]);
  useEffect(() => { localStorage.setItem('worship_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('worship_recent_songs', JSON.stringify(recentSongs)); }, [recentSongs]);
  useEffect(() => { localStorage.setItem('worship_offline_cache', JSON.stringify(offlineCache)); }, [offlineCache]);
  useEffect(() => { localStorage.setItem('worship_pending_sync_queue', JSON.stringify(pendingSyncQueue)); }, [pendingSyncQueue]);
  useEffect(() => { localStorage.setItem('displayFont', displayFont); }, [displayFont]);
  useEffect(() => { localStorage.setItem('displayFontSize', displayFontSize); }, [displayFontSize]);
  useEffect(() => { localStorage.setItem('displayImageSize', displayImageSize); }, [displayImageSize]);
  useEffect(() => { localStorage.setItem('presenterServerHost', cleanedServerHost); }, [cleanedServerHost]);
  useEffect(() => { localStorage.setItem('presenterServerPort', cleanedServerPort); }, [cleanedServerPort]);
  useEffect(() => { localStorage.setItem('nativeFileStorageEnabled', nativeFileStorageEnabled ? 'true' : 'false'); }, [nativeFileStorageEnabled]);

  useEffect(() => {
    const snapshot = {
      savedAt: Date.now(),
      favorites,
      offlineCache,
      pendingSyncQueue,
      roomCode,
      userName: userName || '',
      recentSongs,
      serverHost: cleanedServerHost,
      serverPort: cleanedServerPort
    };
    localStorage.setItem(LOCAL_DATA_SNAPSHOT_KEY, JSON.stringify(snapshot));
    setLocalSnapshotSavedAt(snapshot.savedAt);
  }, [favorites, recentSongs, offlineCache, pendingSyncQueue, roomCode, userName, cleanedServerHost, cleanedServerPort]);

  useEffect(() => {
    loadOfflineDataFromDevice();
  }, [loadOfflineDataFromDevice]);

  useEffect(() => {
    saveOfflineDataToDevice();
  }, [offlineCache, pendingSyncQueue, saveOfflineDataToDevice]);

  const runPendingSync = useCallback(async () => {
    if (syncInProgressRef.current) return;
    const queue = pendingQueueRef.current;
    if (!queue.length) return;
    if (!navigator.onLine) return;

    syncInProgressRef.current = true;
    setSyncState(prev => ({ ...prev, syncing: true, lastError: '' }));

    const remaining = [];
    let firstError = '';

    for (const item of queue) {
      try {
        const payload = {
          title: item.title,
          stanzas: item.stanzas,
          sourceUrl: item.sourceUrl || null,
          forceUpdate: item.forceUpdate
        };

        if (item.songId) payload.songId = item.songId;

        const res = await axios.post(`${apiBase}/save_song`, payload);
        const syncedSongId = res?.data?.songId;

        if (item.localId && syncedSongId && item.localId !== syncedSongId) {
          setOfflineCache(prev => {
            const localEntry = prev[item.localId];
            if (!localEntry) return prev;
            const next = { ...prev };
            delete next[item.localId];
            next[syncedSongId] = { ...localEntry, id: syncedSongId, pendingSync: false };
            return next;
          });

          setFavorites(prev => prev.map(f => (
            f.id === item.localId ? { ...f, id: syncedSongId, source: 'db' } : f
          )));

          setSelectedSong(prev => (
            prev && prev.id === item.localId
              ? { ...prev, id: syncedSongId, isCached: true }
              : prev
          ));
        } else if (item.localId) {
          setOfflineCache(prev => {
            if (!prev[item.localId]) return prev;
            return {
              ...prev,
              [item.localId]: { ...prev[item.localId], pendingSync: false }
            };
          });
        }
      } catch (err) {
        if (!firstError) {
          firstError = err.response?.data?.details || err.message || 'Sync failed';
        }
        remaining.push(item);
      }
    }

    setPendingSyncQueue(remaining);
    setSyncState({ syncing: false, lastRun: Date.now(), lastError: firstError });
    syncInProgressRef.current = false;
  }, [apiBase]);

  const downloadAllSongsForOffline = useCallback(async () => {
    const confirmed = window.confirm('Do you want to download all songs to local app files for offline access?');
    if (!confirmed) return;

    if (!navigator.onLine) {
      alert('Internet/mobile data is required for initial download.');
      return;
    }

    setOfflineDownloadState({ downloading: true, downloaded: 0, total: null, lastError: '' });

    try {
      const PAGE_SIZE = 250;
      let page = 0;
      let totalDownloaded = 0;
      const merged = { ...offlineCacheRef.current };

      // Fetch songs in pages to avoid large payload spikes.
      while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data: songs, error: songsError } = await supabase
          .from('songs')
          .select('id, title, source_url')
          .order('title', { ascending: true })
          .range(from, to);

        if (songsError) throw songsError;
        if (!songs || songs.length === 0) break;

        const ids = songs.map(song => song.id);
        const { data: lyricsRows, error: lyricsError } = await supabase
          .from('lyrics')
          .select('song_id, stanza_number, lyrics')
          .in('song_id', ids)
          .order('stanza_number', { ascending: true });

        if (lyricsError) throw lyricsError;

        const lyricsBySong = {};
        for (const row of lyricsRows || []) {
          if (!lyricsBySong[row.song_id]) lyricsBySong[row.song_id] = [];
          lyricsBySong[row.song_id].push(row.lyrics);
        }

        for (const song of songs) {
          merged[song.id] = {
            id: song.id,
            title: song.title,
            stanzas: lyricsBySong[song.id] || [],
            source: 'db',
            pendingSync: false,
            sourceUrl: song.source_url || null
          };
        }

        totalDownloaded += songs.length;
        setOfflineDownloadState(prev => ({ ...prev, downloaded: totalDownloaded }));
        page += 1;

        if (songs.length < PAGE_SIZE) break;
      }

      setOfflineCache(merged);
      setOfflineDownloadState({ downloading: false, downloaded: totalDownloaded, total: totalDownloaded, lastError: '' });
      alert(`Downloaded ${totalDownloaded} songs for offline access.`);
    } catch (err) {
      setOfflineDownloadState(prev => ({ ...prev, downloading: false, lastError: err.message || 'Failed to download songs' }));
      alert('Offline download failed: ' + (err.message || 'Unknown error'));
    }
  }, [ensureStoragePermission]);

  const probeHealth = useCallback(async (candidateHost) => {
    try {
      const res = await axios.get(`http://${candidateHost}:${cleanedServerPort}/health`, { timeout: 1600 });
      return !!res?.data?.ok;
    } catch {
      return false;
    }
  }, [cleanedServerPort]);

  const autoDetectLanServer = useCallback(async () => {
    if (autoDetectPromiseRef.current) {
      return autoDetectPromiseRef.current;
    }

    const run = (async () => {
      setAutoDetectingLan(true);

      try {
      const candidates = [];
      const addCandidate = (hostValue) => {
        const normalized = normalizeHostInput(hostValue);
        if (!isShareableOfflineHost(normalized)) return;
        if (!candidates.includes(normalized)) candidates.push(normalized);
      };

      const immediateCandidates = [
        cleanedServerHost,
        hostFromUrl(apiBase),
        hostFromUrl(WS_URL)
      ];

      for (const hostValue of immediateCandidates) {
        addCandidate(hostValue);
      }

      // Fast path: try known hosts first before broader scanning.
      for (const hostValue of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await probeHealth(hostValue);
        if (ok) {
          setServerHost(hostValue);
          setOfflineServerStatus({ checking: false, ok: true, message: `Auto-detected local server: ${hostValue}` });
          return hostValue;
        }
      }

      const localIps = await discoverLocalIps();
      for (const ip of localIps) addCandidate(ip);

      for (const ip of localIps) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) continue;

        const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const preferredOctets = [
          parts[3],
          1, 2, 10, 20, 30, 35, 40, 50, 60, 80, 90, 100, 101, 120, 150, 200, 254
        ];

        for (let d = 1; d <= 5; d++) {
          preferredOctets.push(parts[3] + d, parts[3] - d);
        }

        for (const octet of preferredOctets) {
          if (octet < 1 || octet > 254) continue;
          addCandidate(`${prefix}.${octet}`);
        }
      }

      // Keep scanning bounded to avoid long waits on weak networks.
      const boundedCandidates = candidates.slice(0, 80);

      if (!boundedCandidates.length) {
        setOfflineServerStatus({ checking: false, ok: false, message: 'Could not auto-detect LAN IP. Connect to hotspot/Wi-Fi first.' });
        return '';
      }

      // Probe in parallel batches and short-circuit on first success.
      const batchSize = 16;
      for (let i = 0; i < boundedCandidates.length; i += batchSize) {
        const batch = boundedCandidates.slice(i, i + batchSize);
        const found = await Promise.any(
          batch.map(async (hostValue) => {
            const ok = await probeHealth(hostValue);
            if (!ok) throw new Error('unreachable');
            return hostValue;
          })
        ).catch(() => '');

        if (found) {
          const cleanHost = normalizeHostInput(found);
          setServerHost(cleanHost);
          setOfflineServerStatus({ checking: false, ok: true, message: `Auto-detected local server: ${cleanHost}` });
          return cleanHost;
        }
      }

      setOfflineServerStatus({ checking: false, ok: false, message: 'Auto-detect failed. Ensure backend is running on same hotspot/Wi-Fi.' });
      return '';
      } finally {
        setAutoDetectingLan(false);
      }
    })();

    autoDetectPromiseRef.current = run;
    return run.finally(() => {
      if (autoDetectPromiseRef.current === run) {
        autoDetectPromiseRef.current = null;
      }
    });
  }, [cleanedServerHost, apiBase, probeHealth]);

  const checkOfflineServer = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await OfflinePresenter.getStatus();
        if (status?.running && status?.host && isShareableOfflineHost(status.host)) {
          const cleanHost = normalizeHostInput(status.host);
          setServerHost(cleanHost);
          setOfflineServerStatus({ checking: false, ok: true, message: `Offline server running at ${cleanHost}` });
          setNativeOfflineServer(prev => ({ ...prev, running: true, host: cleanHost }));
          return;
        }
      } catch {
        // fallback to LAN check below
      }
    }

    let hostToCheck = detectedLanHost;
    if (!hostToCheck) {
      hostToCheck = await autoDetectLanServer();
    }

    if (!hostToCheck) return;

    setOfflineServerStatus({ checking: true, ok: null, message: 'Checking local server...' });
    try {
      const res = await axios.get(`http://${hostToCheck}:${cleanedServerPort}/health`, { timeout: 2500 });
      if (res?.data?.ok) {
        setOfflineServerStatus({ checking: false, ok: true, message: 'Local offline server reachable.' });
      } else {
        setOfflineServerStatus({ checking: false, ok: false, message: 'Server responded unexpectedly.' });
      }
    } catch {
      setOfflineServerStatus({
        checking: false,
        ok: false,
        message: 'Cannot reach local server. Start backend and keep both devices on same hotspot/Wi-Fi.'
      });
    }
  }, [detectedLanHost, cleanedServerPort, autoDetectLanServer]);

  const ensureOfflineServerReady = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await OfflinePresenter.getStatus();
        if (status?.running && status?.host && isShareableOfflineHost(status.host)) {
          const cleanHost = normalizeHostInput(status.host);
          setServerHost(cleanHost);
          setNativeOfflineServer(prev => ({ ...prev, running: true, host: cleanHost, port: Number(cleanedServerPort) }));
          setOfflineServerStatus({ checking: false, ok: true, message: `Offline server running at ${cleanHost}` });
          return cleanHost;
        }
      } catch {
        // continue to startServer fallback
      }

      try {
        const started = await OfflinePresenter.startServer({
          port: Number(cleanedServerPort),
          room: roomCode
        });
        const host = String(started?.host || '');
        const url = String(started?.url || '');
        const cleanHost = normalizeHostInput(host) || normalizeHostInput(hostFromUrl(url));
        if (cleanHost && isShareableOfflineHost(cleanHost)) {
          setServerHost(cleanHost);
          setNativeOfflineServer({
            running: true,
            host: cleanHost,
            port: Number(cleanedServerPort),
            url
          });
          setOfflineServerStatus({ checking: false, ok: true, message: `Offline server started in app: ${cleanHost}` });
          return cleanHost;
        }
      } catch (err) {
        setOfflineServerStatus({ checking: false, ok: false, message: err?.message || 'Failed to start in-app offline server.' });
      }
    }

    let hostToUse = detectedLanHost;
    if (!hostToUse) {
      hostToUse = await autoDetectLanServer();
    }
    if (!hostToUse) return '';

    const ok = await probeHealth(hostToUse);
    if (!ok) return '';
    return hostToUse;
  }, [detectedLanHost, autoDetectLanServer, probeHealth, cleanedServerPort, roomCode]);

  useEffect(() => {
    if (!showSettings) return;
    if (cleanedServerHost) return;
    if (autoDetectAttemptedRef.current) return;

    autoDetectAttemptedRef.current = true;
    autoDetectLanServer();
  }, [showSettings, cleanedServerHost, autoDetectLanServer]);

  useEffect(() => {
    if (!isOnline) return;
    if (!pendingSyncQueue.length) return;
    runPendingSync();
  }, [isOnline, pendingSyncQueue.length, runPendingSync]);

  useEffect(() => {
    const id = setInterval(() => {
      if (navigator.onLine && pendingQueueRef.current.length > 0) {
        runPendingSync();
      }
    }, 30000);
    return () => clearInterval(id);
  }, [runPendingSync]);

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

    const clearHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (staleCheckIntervalRef.current) {
        clearInterval(staleCheckIntervalRef.current);
        staleCheckIntervalRef.current = null;
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (isDisposed) return;
      clearReconnectTimer();
      const delay = reconnectDelayRef.current;
      reconnectTimerRef.current = setTimeout(connect, delay);
      reconnectDelayRef.current = Math.min(delay * 1.6, 10000);
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
        clearHeartbeat();
        reconnectDelayRef.current = 1500;
        lastPongAtRef.current = Date.now();

        socket.send(JSON.stringify({
          type: 'join',
          room: roomCodeRef.current,
          name: userNameRef.current || 'Anonymous',
          deviceCode: deviceCodeRef.current
        }));

        // Flush queued present action if user tapped while socket was down.
        const pending = pendingPresentRef.current;
        if (pending) {
          socket.send(JSON.stringify(pending));
          pendingPresentRef.current = null;
        }

        // App-level heartbeat for mobile/webview reliability.
        heartbeatIntervalRef.current = setInterval(() => {
          const active = wsRef.current;
          if (!active || active.readyState !== WebSocket.OPEN) return;
          active.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        }, 20000);

        staleCheckIntervalRef.current = setInterval(() => {
          const active = wsRef.current;
          if (!active || active.readyState !== WebSocket.OPEN) return;
          // If we don't receive any pong for too long, force reconnect.
          if (Date.now() - lastPongAtRef.current > 45000) {
            try { active.close(); } catch { /* no-op */ }
          }
        }, 10000);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong' || msg.type === 'status') {
            lastPongAtRef.current = Date.now();
          }
        } catch {
          // ignore non-JSON control messages
        }
      };

      socket.onclose = () => {
        clearHeartbeat();
        if (isDisposed) return;
        scheduleReconnect();
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
    ensureConnectedRef.current = ensureConnected;

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
      ensureConnectedRef.current = () => {};
      clearHeartbeat();
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

  const handleInternalBack = () => {
    if (selectedSong) {
      setSelectedSong(null);
      setActiveStanza(null);
      return true;
    }
    if (showSettings) {
      setShowSettings(false);
      return true;
    }
    return false;
  };

  // In-app back stack: close song/settings on browser/mobile back before exiting app.
  useEffect(() => {
    const onPopState = () => {
      handleInternalBack();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedSong, showSettings]);

  useEffect(() => {
    const onCordovaBack = (event) => {
      if (handleInternalBack()) {
        event.preventDefault();
      }
    };

    document.addEventListener('backbutton', onCordovaBack, false);

    let removeBackButtonListener;
    let removeAppStateListener;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (handleInternalBack()) return;
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.minimizeApp();
      }
    }).then(h => { removeBackButtonListener = h; }).catch(() => {});

    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        ensureConnectedRef.current();
      }
    }).then(h => { removeAppStateListener = h; }).catch(() => {});

    return () => {
      document.removeEventListener('backbutton', onCordovaBack, false);
      if (removeBackButtonListener) removeBackButtonListener.remove();
      if (removeAppStateListener) removeAppStateListener.remove();
    };
  }, [selectedSong, showSettings]);

  const openSettingsPage = () => {
    if (showSettings) return;
    setShowSettings(true);
    window.history.pushState({ appView: 'settings' }, '');
  };

  const closeSettingsPage = () => {
    setShowSettings(false);
    if (window.history.state?.appView === 'settings') {
      window.history.back();
    }
  };

  // ---- Search ----
  const handleSearch = async () => {
    const searchQuery = tabSearch[activeTab] || '';
    if (activeTab === 'images' || activeTab === 'bible') { setResults([]); return; }
    if (activeTab === 'favorites') { setResults(favorites); return; }
    if (activeTab === 'recents') {
      if (!searchQuery.trim()) {
        setResults(recentSongs);
      } else {
        const tokens = searchQuery.toLowerCase().split(/\s+/).map(t => t.trim()).filter(Boolean);
        const filtered = recentSongs.filter(item => {
          const title = String(item.title || '').toLowerCase();
          return tokens.every(t => title.includes(t));
        });
        setResults(rankByRelatedness(filtered, searchQuery));
      }
      return;
    }
    if (!searchQuery.trim()) { setResults([]); return; }
    setLoading(true);
    setResults([]);
    setSelectedLetter(null);
    try {
      if (activeTab === 'db') {
        const tokens = searchQuery.toLowerCase().split(/\s+/).map(t => t.trim()).filter(Boolean);
        let queryBuilder = supabase.from('songs').select('id, title');

        if (tokens.length <= 1) {
          queryBuilder = queryBuilder.ilike('title', `%${searchQuery}%`);
        } else {
          const orFilters = tokens.map(t => `title.ilike.%${t.replace(/,/g, '')}%`).join(',');
          queryBuilder = queryBuilder.or(orFilters);
        }

        const { data, error } = await queryBuilder.limit(250);
        if (error) throw error;
        const mapped = data.map(item => ({ id: item.id, title: item.title, source: 'db' }));
        setResults(rankByRelatedness(mapped, searchQuery).slice(0, 100));
      } else {
        const res = await axios.get(`${apiBase}/search?q=${encodeURIComponent(searchQuery)}`);
        setResults(res.data.map(item => ({ url: item.url, title: item.title, source: 'web' })));
      }
    } catch (err) {
      console.error('Search error:', err);
      if (activeTab === 'db') {
        const cachedSongs = Object.values(offlineCache);
        const localMatches = cachedSongs.filter(s => {
          const title = (s.title || '').toLowerCase();
          return searchQuery.toLowerCase().split(/\s+/).filter(Boolean).some(t => title.includes(t));
        });
        const mapped = localMatches.map(item => ({ id: item.id, title: item.title, source: 'db', offline: true }));
        setResults(rankByRelatedness(mapped, searchQuery).slice(0, 100));
      } else {
        alert('Search failed. Check connection.');
      }
    } finally { setLoading(false); }
  };

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
      // Offline fallback
      const cachedSongs = Object.values(offlineCache);
      const matches = cachedSongs.filter(s => s.title.toUpperCase().startsWith(letter));
      setResults(matches.map(item => ({ id: item.id, title: item.title, source: 'db', offline: true })));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'favorites' || activeTab === 'recents') handleSearch();
  }, [activeTab, favorites, recentSongs]);

  // Live search for DB tab while typing.
  useEffect(() => {
    if (activeTab !== 'db') return;
    if (selectedLetter) return;

    const query = tabSearch.db || '';
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 220);

    return () => clearTimeout(timer);
  }, [activeTab, tabSearch.db, selectedLetter]);

  // ---- Song Select ----
  const handleSongSelect = async (songMetadata) => {
    setLoading(true);

    const recentItem = {
      title: songMetadata.title,
      source: songMetadata.source,
      id: songMetadata.id,
      url: songMetadata.url,
      offline: !!songMetadata.offline
    };
    setRecentSongs(prev => {
      const keyOf = (item) => `${item.source || ''}:${item.id || item.url || item.title || ''}`;
      const targetKey = keyOf(recentItem);
      const deduped = prev.filter(item => keyOf(item) !== targetKey);
      return [recentItem, ...deduped].slice(0, 20);
    });

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
        const res = await axios.get(`${apiBase}/lyrics?url=${encodeURIComponent(songMetadata.url)}`);
        setSelectedSong({ url: songMetadata.url, title: songMetadata.title, stanzas: res.data, isCached: false });
      }
      window.history.pushState({ appView: 'song' }, '');
    } catch {
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

      const res = await axios.post(`${apiBase}/save_song`, payload);
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
    } catch {
      const localId = persistLocallyAndQueue({
        title: cleanTitle,
        stanzas: cleanStanzas,
        songId: selectedSong.id || null,
        sourceUrl: selectedSong.url || null,
        forceUpdate: Boolean(selectedSong.id && !String(selectedSong.id).startsWith('local-'))
      });

      setSelectedSong(prev => ({
        ...(prev || {}),
        id: localId,
        title: cleanTitle,
        stanzas: cleanStanzas,
        isCached: true
      }));
      setIsEditingSong(false);
      alert('Saved offline. It will sync automatically when data connection is available.');
    } finally {
      setSavingEdits(false);
    }
  };

  const handleSaveWebResultToDb = async (songItem) => {
    const saveKey = songItem.url || songItem.title;
    setSavingWebSongs(prev => ({ ...prev, [saveKey]: true }));

    try {
      const lyricRes = await axios.get(`${apiBase}/lyrics?url=${encodeURIComponent(songItem.url)}`);
      const stanzas = (lyricRes.data || []).map(s => String(s || '').trim()).filter(Boolean);
      if (stanzas.length === 0) throw new Error('No stanzas found to save');

      const saveRes = await axios.post(`${apiBase}/save_song`, {
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
  const sendPresentationPayload = useCallback((payload, options = {}) => {
    const { allowNative = true } = options;

    if (allowNative && Capacitor.isNativePlatform() && nativeOfflineServer.running) {
      OfflinePresenter.present({
        room: payload.room,
        text: payload.text,
        font: payload.font,
        fontSize: payload.fontSize,
        name: payload.name,
        deviceCode: payload.deviceCode
      }).catch(() => {
        // fallback will happen on next tap through ws path if needed
      });
      return true;
    }

    const socket = wsRef.current || ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    } else {
      pendingPresentRef.current = payload;
      ensureConnectedRef.current();
      return false;
    }
  }, [nativeOfflineServer.running, ws]);

  const presentLyrics = async (stanzaText, stanzaIndex, options = {}) => {
    const payload = {
      type: 'present',
      text: stanzaText,
      room: roomCode,
      font: displayFont,
      fontSize: displayFontSize,
      name: userNameRef.current || 'Anonymous',
      deviceCode: deviceCodeRef.current
    };

    setActiveStanza(stanzaIndex);
    setActiveImageId(null);

    // One-tap reliability: send immediately, then retry once shortly after.
    // If user taps another stanza, stale retry is ignored.
    const attemptId = ++presentAttemptRef.current;
    const sentImmediately = sendPresentationPayload(payload);
    if (!sentImmediately) {
      setTimeout(() => {
        if (presentAttemptRef.current !== attemptId) return;
        sendPresentationPayload(payload);
      }, 220);
    }

    // Auto-save web songs to DB
    if (!options.skipAutoSave && selectedSong && !selectedSong.isCached) {
      try {
        const res = await axios.post(`${apiBase}/save_song`, { title: selectedSong.title, stanzas: selectedSong.stanzas });
        const newId = res.data.songId;
        setSelectedSong(prev => ({ ...prev, isCached: true, id: newId }));
        setOfflineCache(prev => ({ ...prev, [newId]: { id: newId, title: selectedSong.title, stanzas: selectedSong.stanzas, source: 'db' } }));
      } catch { /* silent */ }
    }
  };

  const presentImage = (imageItem) => {
    if (!imageItem?.dataUrl) return;

    const payload = {
      type: 'present',
      imageData: imageItem.dataUrl,
      imageName: imageItem.name,
      imageSize: displayImageSize,
      room: roomCode,
      text: '',
      name: userNameRef.current || 'Anonymous',
      deviceCode: deviceCodeRef.current
    };

    setActiveImageId(imageItem.id);
    setActiveStanza(null);

    const attemptId = ++presentAttemptRef.current;
    const sentImmediately = sendPresentationPayload(payload, { allowNative: false });
    if (!sentImmediately) {
      setTimeout(() => {
        if (presentAttemptRef.current !== attemptId) return;
        sendPresentationPayload(payload, { allowNative: false });
      }, 220);
    }
  };

  const removeUploadedImage = (imageId) => {
    setUploadedImages(prev => prev.filter(item => item.id !== imageId));
    if (activeImageId === imageId) {
      setActiveImageId(null);
    }
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const imageFiles = files.filter(file => String(file.type || '').startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Please select valid image files.');
      event.target.value = '';
      return;
    }

    const availableSlots = Math.max(0, 20 - uploadedImages.length);
    if (availableSlots <= 0) {
      alert('Maximum 20 images reached. Remove some images to add new ones.');
      event.target.value = '';
      return;
    }

    if (imageFiles.length > availableSlots) {
      alert(`Only ${availableSlots} more image(s) can be added (max 20 total).`);
    }

    const selected = imageFiles.slice(0, availableSlots);
    try {
      const mapped = await Promise.all(selected.map(async (file, index) => {
        const dataUrl = await optimizeImageForPresent(file);
        return {
          id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          dataUrl
        };
      }));

      setUploadedImages(prev => [...prev, ...mapped]);
    } catch {
      alert('Failed to read one or more images. Please try again.');
    } finally {
      event.target.value = '';
    }
  };

  const openBibleBook = async (bookMeta) => {
    if (!bookMeta?.english) return;
    setBibleLoading(true);
    setBibleError('');

    try {
      const fileName = encodeURIComponent(bookMeta.english) + '.json';
      const response = await fetch(`/bible/${fileName}`);
      if (!response.ok) throw new Error('Failed to load book data');
      const data = await response.json();
      const chapters = Array.isArray(data?.chapters) ? data.chapters : [];

      setSelectedBibleBook({
        english: data?.book?.english || bookMeta.english,
        tamil: data?.book?.tamil || bookMeta.tamil,
        chapters
      });
      setSelectedBibleChapterIndex(0);
      setActiveBibleVerseKey('');
      setActiveBibleVerseText('');
      setShowBibleControls(false);
    } catch {
      setBibleError('Failed to load selected book.');
    } finally {
      setBibleLoading(false);
    }
  };

  const presentBibleVerse = (verseText, verseNumber) => {
    const cleanText = String(verseText || '').trim();
    if (!cleanText) return;

    const chapterNumber = Number(selectedBibleChapterIndex) + 1;
    const payload = {
      type: 'present',
      text: cleanText,
      room: roomCode,
      font: displayFont,
      fontSize: displayFontSize,
      name: userNameRef.current || 'Anonymous',
      deviceCode: deviceCodeRef.current
    };

    setActiveStanza(null);
    setActiveImageId(null);
    setActiveBibleVerseKey(`${selectedBibleBook?.english || ''}-${chapterNumber}-${verseNumber}`);
    setActiveBibleVerseText(cleanText);

    const attemptId = ++presentAttemptRef.current;
    const sentImmediately = sendPresentationPayload(payload);
    if (!sentImmediately) {
      setTimeout(() => {
        if (presentAttemptRef.current !== attemptId) return;
        sendPresentationPayload(payload);
      }, 220);
    }
  };

  const goToBibleChapter = useCallback((nextIndex) => {
    if (!selectedBibleBook) return;
    const total = Array.isArray(selectedBibleBook.chapters) ? selectedBibleBook.chapters.length : 0;
    if (!total) return;
    const bounded = Math.max(0, Math.min(total - 1, nextIndex));
    setSelectedBibleChapterIndex(bounded);
    setActiveBibleVerseKey('');
    setActiveBibleVerseText('');
  }, [selectedBibleBook]);

  const handleBibleSwipeStart = (event) => {
    bibleSwipeStartXRef.current = event.changedTouches?.[0]?.clientX ?? null;
  };

  const handleBibleSwipeEnd = (event) => {
    const startX = bibleSwipeStartXRef.current;
    const endX = event.changedTouches?.[0]?.clientX ?? null;
    bibleSwipeStartXRef.current = null;
    if (startX === null || endX === null) return;

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 42) return;

    // Requested flow update: swipe right -> previous chapter, swipe left -> next chapter.
    if (deltaX > 0) {
      goToBibleChapter(selectedBibleChapterIndex - 1);
    } else {
      goToBibleChapter(selectedBibleChapterIndex + 1);
    }
  };

  const handleBibleVerseSelect = (verseNo) => {
    if (!selectedBibleBook) return;
    const chapter = selectedBibleBook.chapters?.[selectedBibleChapterIndex];
    const verses = Array.isArray(chapter?.verses) ? chapter.verses : [];
    const selected = verses.find((item, idx) => String(item?.verse || idx + 1) === String(verseNo));
    if (!selected) return;

    const key = `${selectedBibleBook.english || ''}-${selectedBibleChapterIndex + 1}-${String(verseNo)}`;
    setActiveBibleVerseKey(key);
    presentBibleVerse(selected?.text || '', String(verseNo));
    setShowBibleControls(false);

    requestAnimationFrame(() => {
      const container = bibleVerseListRef.current;
      if (!container) return;
      const target = container.querySelector(`[data-verse-key="${key}"]`);
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  useEffect(() => {
    if (activeTab !== 'bible') return;
    if (bibleBooks.length > 0) return;

    setBibleLoading(true);
    setBibleError('');

    fetch('/bible/Books.json')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load book list');
        return response.json();
      })
      .then(data => {
        const mapped = Array.isArray(data)
          ? data.map((entry, index) => ({
            id: String(index + 1),
            english: String(entry?.book?.english || '').trim(),
            tamil: String(entry?.book?.tamil || '').trim()
          })).filter(item => item.english)
          : [];

        setBibleBooks(mapped);
      })
      .catch(() => {
        setBibleError('Failed to load Bible list.');
      })
      .finally(() => {
        setBibleLoading(false);
      });
  }, [activeTab, bibleBooks.length]);

  useEffect(() => {
    if (activeTab !== 'bible') return;
    if (selectedBibleBook) return;
    if (bibleBooks.length === 0) return;

    openBibleBook(bibleBooks[0]);
  }, [activeTab, bibleBooks, selectedBibleBook]);

  useEffect(() => {
    if (activeStanza === null || !selectedSong) return;

    const previous = lastFontSyncRef.current;
    const changed = !previous.initialized || previous.font !== displayFont || previous.size !== String(displayFontSize);
    lastFontSyncRef.current = { initialized: true, font: displayFont, size: String(displayFontSize) };
    if (!changed) return;

    const stanzas = isEditingSong ? editableStanzas : (selectedSong.stanzas || []);
    const activeText = stanzas[activeStanza];
    if (typeof activeText !== 'string') return;

    const payload = {
      type: 'present',
      text: activeText,
      room: roomCode,
      font: displayFont,
      fontSize: displayFontSize,
      name: userNameRef.current || 'Anonymous',
      deviceCode: deviceCodeRef.current
    };

    sendPresentationPayload(payload);
  }, [displayFont, displayFontSize, activeStanza, selectedSong, isEditingSong, editableStanzas, roomCode, sendPresentationPayload]);

  useEffect(() => {
    if (!activeImageId) return;

    const previous = lastImageSizeSyncRef.current;
    const changed = !previous.initialized || previous.size !== String(displayImageSize);
    lastImageSizeSyncRef.current = { initialized: true, size: String(displayImageSize) };
    if (!changed) return;

    const imageItem = uploadedImages.find(item => item.id === activeImageId);
    if (!imageItem?.dataUrl) return;

    const payload = {
      type: 'present',
      imageData: imageItem.dataUrl,
      imageName: imageItem.name,
      imageSize: displayImageSize,
      room: roomCode,
      text: '',
      name: userNameRef.current || 'Anonymous',
      deviceCode: deviceCodeRef.current
    };

    sendPresentationPayload(payload, { allowNative: false });
  }, [displayImageSize, activeImageId, uploadedImages, roomCode, sendPresentationPayload]);

  useEffect(() => {
    if (!activeBibleVerseKey || !activeBibleVerseText) return;

    const previous = lastBibleFontSyncRef.current;
    const fontChanged = previous.initialized && (previous.font !== displayFont || previous.size !== String(displayFontSize));
    lastBibleFontSyncRef.current = {
      initialized: true,
      font: displayFont,
      size: String(displayFontSize),
      verseKey: activeBibleVerseKey
    };
    if (!fontChanged) return;

    const payload = {
      type: 'present',
      text: activeBibleVerseText,
      room: roomCode,
      font: displayFont,
      fontSize: displayFontSize,
      name: userNameRef.current || 'Anonymous',
      deviceCode: deviceCodeRef.current
    };

    sendPresentationPayload(payload);
  }, [activeBibleVerseKey, activeBibleVerseText, displayFont, displayFontSize, roomCode, sendPresentationPayload]);

  const clearScreen = () => {
    setActiveStanza(null);
    setActiveImageId(null);
    setActiveBibleVerseKey('');
    setActiveBibleVerseText('');

    if (Capacitor.isNativePlatform() && nativeOfflineServer.running) {
      OfflinePresenter.clear({
        room: roomCode,
        name: userNameRef.current || 'Anonymous',
        deviceCode: deviceCodeRef.current
      }).catch(() => {});
      return;
    }

    const socket = wsRef.current || ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'clear',
        room: roomCode,
        name: userNameRef.current || 'Anonymous',
        deviceCode: deviceCodeRef.current
      }));
    }
  };

  const handleOfflinePresentLink = async () => {
    const hostToUse = await ensureOfflineServerReady();

    if (!hostToUse) {
      alert('Could not start offline present server. Ensure hotspot/Wi-Fi is active and try again.');
      return;
    }

    const resolvedUrl = formatOfflineLink(hostToUse, cleanedServerPort, roomCode, true);
    const shortLink = formatOfflineLink(hostToUse, cleanedServerPort, roomCode, false);

    navigator.clipboard.writeText(resolvedUrl).then(() => {
      setCopiedOfflineLink(true);
      setTimeout(() => setCopiedOfflineLink(false), 2200);
      alert([
        'Offline Present Link Ready',
        `Type this in browser: ${shortLink}`,
        `Full URL copied: ${resolvedUrl}`
      ].join('\n'));
    }).catch(() => {
      alert([
        'Offline Present Link',
        `Type this in browser: ${shortLink}`,
        `Full URL: ${resolvedUrl}`
      ].join('\n'));
    });
  };

  const handleStartOfflinePresent = async () => {
    if (startingOfflinePresent) return;
    setStartingOfflinePresent(true);
    try {
      const hostToUse = await ensureOfflineServerReady();
      if (!hostToUse) {
        setOfflineServerStatus({
          checking: false,
          ok: false,
          message: 'Cannot start offline presenter.'
        });
        alert('Offline present could not start.');
        return;
      }

      const resolvedUrl = formatOfflineLink(hostToUse, cleanedServerPort, roomCode, true);
      const shortLink = formatOfflineLink(hostToUse, cleanedServerPort, roomCode, false);
      setOfflineServerStatus({ checking: false, ok: true, message: `Offline presenting ready at ${hostToUse}` });

      navigator.clipboard.writeText(resolvedUrl).catch(() => {});
      alert([
        'Offline Present Started',
        `Open in browser: ${shortLink}`,
        `Copied URL: ${resolvedUrl}`
      ].join('\n'));
    } finally {
      setStartingOfflinePresent(false);
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

  const clearLocalSearchCache = () => {
    setTabSearch({ db: '', web: '', favorites: '', images: '', bible: '', recents: '' });
    setResults([]);
    setSelectedLetter(null);
  };

  // ---- Share Link ----
  const handleShareLink = () => {
    const tvUrl = `${apiBase}/tv.html?room=${roomCode}`;
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
      const res = await axios.post(`${apiBase}/save_song`, { title: addTitle.trim(), stanzas });
      const newId = res.data.songId;
      // Cache locally too
      setOfflineCache(prev => ({ ...prev, [newId]: { id: newId, title: addTitle.trim(), stanzas, source: 'db' } }));
      setShowAddModal(false);
      alert(`✅ "${addTitle.trim()}" saved with ${stanzas.length} stanza(s)!`);
    } catch {
      const localId = persistLocallyAndQueue({
        title: addTitle.trim(),
        stanzas,
        sourceUrl: null,
        songId: null,
        forceUpdate: false
      });
      setShowAddModal(false);
      setAddError('');
      alert(`Saved offline as ${localId}. It will sync automatically when data connection is available.`);
    } finally { setAddSaving(false); }
  };

  // ---- Presentation View ----
  if (selectedSong) {
    const displayStanzas = isEditingSong ? editableStanzas : selectedSong.stanzas;
    const selectedSongSaveKey = selectedSong.url || selectedSong.title;

    return (
      <div className="app-container" style={{ fontFamily: displayFont }}>
        <div className="app-header presentation-header">
          <button className="back-btn" onClick={() => {
            setSelectedSong(null);
            setActiveStanza(null);
            if (window.history.state?.appView === 'song') {
              window.history.back();
            }
          }}>
            <FaArrowLeft />
          </button>
          <h1 style={{ flex: 1, textAlign: 'left', fontSize: '1.1rem', margin: 0 }}>{selectedSong.title}</h1>
          <button className={`icon-btn ${isEditingSong ? 'active' : ''}`} title="Edit Song" onClick={() => setIsEditingSong(v => !v)}>
            <FaEdit />
          </button>
          <button className="icon-btn" title="Change Font" onClick={() => setShowFontPicker(f => !f)}>
            <FaFont />
          </button>
          <button className="mini-clear-btn" title="Clear TV Screen" onClick={clearScreen}>
            Clear
          </button>
        </div>

        {isEditingSong && (
          <div className="song-edit-panel">
            <div className="input-clear-wrap">
              <input
                className="modal-input"
                placeholder="Song Title"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
              {!!editTitle && <button className="text-clear-btn" onClick={() => setEditTitle('')}>Clear</button>}
            </div>
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
            <div
              key={i}
              className={`stanza-card ${!isEditingSong ? 'presentable' : ''} ${activeStanza === i ? 'active' : ''}`}
              onClick={!isEditingSong ? () => presentLyrics(stanza, i) : undefined}
              onKeyDown={!isEditingSong ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  presentLyrics(stanza, i);
                }
              } : undefined}
              role={!isEditingSong ? 'button' : undefined}
              tabIndex={!isEditingSong ? 0 : undefined}
            >
              {isEditingSong ? (
                <div className="stanza-row">
                  <div className="input-clear-wrap">
                    <textarea
                      className="stanza-textarea"
                      rows={4}
                      value={stanza}
                      onChange={e => updateEditableStanza(i, e.target.value)}
                    />
                    {!!stanza && <button className="text-clear-btn" onClick={() => updateEditableStanza(i, '')}>Clear</button>}
                  </div>
                  {displayStanzas.length > 1 && (
                    <button className="remove-stanza" onClick={() => removeEditableStanza(i)}>✕</button>
                  )}
                </div>
              ) : (
                <pre className="stanza-text" style={{ fontFamily: displayFont }}>{stanza}</pre>
              )}
              {!isEditingSong && activeStanza === i && <div className="presented-indicator">Presented</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Main View ----
  if (showSettings) {
    return (
      <div className="app-container">
        <div className="app-header presentation-header">
          <button className="back-btn" onClick={closeSettingsPage}>
            <FaArrowLeft />
          </button>
          <h1 style={{ flex: 1, textAlign: 'left', fontSize: '1.1rem', margin: 0 }}>Settings</h1>
        </div>

        <div className="content-area">
          <div className="stanza-card">
            <h3 style={{ margin: 0 }}>Presenter Identity</h3>
            <input
              className="modal-input"
              placeholder="Your Name"
              value={userName}
              onChange={e => setUserName(e.target.value)}
            />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Device: {deviceCode}</div>
          </div>

          <div className="stanza-card">
            <h3 style={{ margin: 0 }}>TV Room</h3>
            <div className="room-control settings-room-control">
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Room Code:</label>
              <input type="text" className="room-input" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} />
              <button className={`share-btn ${copiedLink ? 'copied' : ''}`} onClick={handleShareLink} title="Copy TV Link">
                <FaShareAlt /> {copiedLink ? '✓' : ''}
              </button>
            </div>
          </div>

          <div className="stanza-card">
            <h3 style={{ margin: 0 }}>Offline Present</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 8 }}>
              Open TV/browser on same hotspot or Wi-Fi network.
            </p>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
              Simple link: {offlineTvUrlSimple || 'Auto-detecting...'}
            </div>
            <button
              className={`share-btn ${copiedOfflineLink ? 'copied' : ''}`}
              style={{ marginTop: 10 }}
              onClick={handleOfflinePresentLink}
              title="Copy Offline Present Link"
            >
              <FaWifi style={{ marginRight: 6 }} /> {copiedOfflineLink ? 'Copied' : 'Offline Present Link'}
            </button>
            <button
              className="btn-save"
              style={{ marginTop: 10 }}
              onClick={handleStartOfflinePresent}
              disabled={startingOfflinePresent || autoDetectingLan}
            >
              {startingOfflinePresent ? 'Starting...' : 'Start Present Offline'}
            </button>
            {autoDetectingLan && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 6 }}>
                Auto-detecting local server...
              </div>
            )}
          </div>

          <div className="stanza-card">
            <h3 style={{ margin: 0 }}>LAN / Hotspot Server</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 8 }}>
              Use server device IP so browser and mobile can connect on the same Wi-Fi or hotspot.
            </p>
            <input
              className="modal-input"
              placeholder="Server IP (e.g., 192.168.1.35)"
              value={serverHost}
              onChange={e => setServerHost(e.target.value)}
            />
            <input
              className="modal-input"
              placeholder="Port (default 3000)"
              value={serverPort}
              onChange={e => setServerPort(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              API: {apiBase}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              WebSocket: {WS_URL}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              Offline LAN IP: {detectedLanHost || 'Not set'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4, wordBreak: 'break-all' }}>
              Offline TV URL: {offlineTvUrl || 'Set LAN Server IP to generate link'}
            </div>
            <button
              className="btn-save"
              style={{ marginTop: 10 }}
              onClick={checkOfflineServer}
              disabled={offlineServerStatus.checking}
            >
              {offlineServerStatus.checking ? 'Checking...' : 'Check Offline Server'}
            </button>
            {offlineServerStatus.message && (
              <div style={{ color: offlineServerStatus.ok ? '#29a36a' : '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
                {offlineServerStatus.message}
              </div>
            )}
          </div>

          <div className="stanza-card">
            <h3 style={{ margin: 0 }}>Offline Sync</h3>
            <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Pending items: {pendingSyncQueue.length}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              Status: {syncState.syncing ? 'Syncing...' : 'Idle'}
            </div>
            {syncState.lastRun && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
                Last run: {new Date(syncState.lastRun).toLocaleString()}
              </div>
            )}
            {syncState.lastError && (
              <div style={{ color: '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
                Last error: {syncState.lastError}
              </div>
            )}
            <button
              className="btn-save"
              style={{ marginTop: 10 }}
              onClick={runPendingSync}
              disabled={syncState.syncing || pendingSyncQueue.length === 0}
            >
              {syncState.syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              className="btn-save"
              style={{ marginTop: 10 }}
              onClick={downloadAllSongsForOffline}
              disabled={offlineDownloadState.downloading}
            >
              <FaDownload style={{ marginRight: 6 }} />
              {offlineDownloadState.downloading ? `Downloading... ${offlineDownloadState.downloaded}` : 'Download All Songs Offline'}
            </button>
            {offlineDownloadState.lastError && (
              <div style={{ color: '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
                Download error: {offlineDownloadState.lastError}
              </div>
            )}
          </div>

          <div className="stanza-card">
            <h3 style={{ margin: 0 }}>Device File Storage</h3>
            <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Permission: {storageState.permission}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              Enabled: {nativeFileStorageEnabled ? 'Yes' : 'No'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
              Loaded: {storageState.loaded ? 'Yes' : 'No'}
            </div>
            {localSnapshotSavedAt && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
                Local data saved: {new Date(localSnapshotSavedAt).toLocaleString()}
              </div>
            )}
            {storageState.lastSavedAt && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 4 }}>
                Last saved: {new Date(storageState.lastSavedAt).toLocaleString()}
              </div>
            )}
            {storageState.lastError && (
              <div style={{ color: '#d35454', fontSize: '0.78rem', marginTop: 6 }}>
                Storage error: {storageState.lastError}
              </div>
            )}
            <button
              className="btn-save"
              style={{ marginTop: 10 }}
              onClick={() => ensureStoragePermission(true)}
            >
              Ask Storage Permission
            </button>
            <button
              className="btn-save"
              style={{ marginTop: 10 }}
              onClick={() => setNativeFileStorageEnabled(v => !v)}
            >
              {nativeFileStorageEnabled ? 'Disable Device File Storage' : 'Enable Device File Storage'}
            </button>
            {!NATIVE_FILE_STORAGE_ENABLED_IN_BUILD && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 6 }}>
                Native file storage is disabled in this build for crash safety.
              </div>
            )}
          </div>

          <div className="stanza-card">
            <h3 style={{ margin: 0 }}>Storage</h3>
            <button className="clear-btn" onClick={clearLocalSearchCache}>
              <FaTrash style={{ marginRight: 8 }} /> Clear Saved Search Text
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedBibleChapter = selectedBibleBook?.chapters?.[selectedBibleChapterIndex] || null;
  const bibleVerses = Array.isArray(selectedBibleChapter?.verses) ? selectedBibleChapter.verses : [];
  const bibleChapterNumber = Number(selectedBibleChapter?.chapter || (selectedBibleChapterIndex + 1));
  const activeBibleVerseNumber = activeBibleVerseKey ? activeBibleVerseKey.split('-').slice(-1)[0] : '';

  return (
    <div className="app-container">
      {/* Header */}
      <div className="app-header">
        <h1>WorshipCast</h1>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
          User: {userName || 'Anonymous'} | Device: {deviceCode}
        </div>
        <div className="header-actions">
          <button className="share-btn" onClick={openSettingsPage} title="Open Settings">
            <FaCog style={{ marginRight: 6 }} /> Settings
          </button>
        </div>
        {!isOnline && (
          <span className="offline-chip"><FaWifi style={{ marginRight: 4 }} />Offline</span>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'db' ? 'active' : ''}`}
          onClick={() => { setActiveTab('db'); setResults([]); setSelectedLetter(null); }}>
          <FaDatabase style={{ marginRight: 6 }} />DB
        </button>
        <button className={`tab-btn ${activeTab === 'web' ? 'active' : ''}`}
          onClick={() => { setActiveTab('web'); setResults([]); }}>
          <FaGlobe style={{ marginRight: 6 }} />Web
        </button>
        <button className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => { setActiveTab('favorites'); }}>
          <FaStar style={{ marginRight: 6 }} />Favs
        </button>
        <button className={`tab-btn ${activeTab === 'recents' ? 'active' : ''}`}
          onClick={() => { setActiveTab('recents'); }}>
          <FaHistory style={{ marginRight: 6 }} />Recents
        </button>
        <button className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => { setActiveTab('images'); setResults([]); setSelectedLetter(null); }}>
          <FaImage style={{ marginRight: 6 }} />Images
        </button>
        <button className={`tab-btn ${activeTab === 'bible' ? 'active' : ''}`}
          onClick={() => { setActiveTab('bible'); setResults([]); setSelectedLetter(null); }}>
          <FaBook style={{ marginRight: 6 }} />Bible
        </button>
      </div>

      <div className="content-area">
        {activeTab === 'images' && (
          <div className="image-share-panel">
            <div className="image-share-topbar">
              <button className="btn-save" onClick={() => imageInputRef.current?.click()}>
                <FaImage style={{ marginRight: 6 }} /> Upload Images
              </button>
              <button
                className={`image-remove-mode-btn ${imageRemoveMode ? 'active' : ''}`}
                onClick={() => setImageRemoveMode(v => !v)}
                title="Toggle remove mode"
              >
                {imageRemoveMode ? 'Done' : 'Remove'}
              </button>
              <button className="mini-clear-btn" onClick={clearScreen} title="Clear TV Screen">Clear</button>
              <span className="image-limit-text">{uploadedImages.length}/20 images</span>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </div>

            <div className="size-picker image-size-picker">
              <label>Image Size:</label>
              <button className="size-btn" onClick={() => setDisplayImageSize(prev => prev === 'auto' ? 80 : Math.max(20, prev - 5))}>-</button>
              <button className={`size-btn auto-btn ${displayImageSize === 'auto' ? 'active' : ''}`} onClick={() => setDisplayImageSize('auto')}>Auto</button>
              <button className="size-btn" onClick={() => setDisplayImageSize(prev => prev === 'auto' ? 80 : Math.min(200, prev + 5))}>+</button>
              <span className="size-val">{displayImageSize === 'auto' ? 'Fitting' : `${displayImageSize}%`}</span>
            </div>

            <div className="image-grid">
              {uploadedImages.length === 0 ? (
                <div className="image-empty">Upload images, then tap one to present it on TV.</div>
              ) : (
                uploadedImages.map(imageItem => (
                  <button
                    key={imageItem.id}
                    className={`image-tile ${activeImageId === imageItem.id ? 'active' : ''}`}
                    onClick={() => {
                      if (!imageRemoveMode) presentImage(imageItem);
                    }}
                  >
                    {imageRemoveMode && (
                      <button
                        className="image-remove-btn"
                        title="Remove image"
                        aria-label="Remove image"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeUploadedImage(imageItem.id);
                        }}
                      >
                        ×
                      </button>
                    )}
                    <img src={imageItem.dataUrl} alt={imageItem.name} className="image-thumb" />
                    <span className="image-name">{imageItem.name}</span>
                    {activeImageId === imageItem.id && <span className="image-presented-badge">Presented</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'bible' && (
          <div className="bible-panel">
            {bibleLoading && <div className="loading">Loading Bible...</div>}
            {!bibleLoading && bibleError && <div className="bible-error">{bibleError}</div>}

            {!bibleLoading && !bibleError && selectedBibleBook && (
              <>
                <div className="bible-top-controls">
                  <div className="bible-top-row">
                    <button className="bible-book-title-btn" onClick={() => setShowBibleControls(v => !v)} type="button">
                      {(selectedBibleBook.tamil || selectedBibleBook.english)} {`- ${bibleChapterNumber}`}
                    </button>
                    <button className="bible-font-btn" onClick={() => setShowFontPicker(f => !f)}>
                      <FaFont style={{ marginRight: 6 }} /> Font
                    </button>
                    <button className="mini-clear-btn" onClick={clearScreen} title="Clear TV Screen">Clear</button>
                  </div>

                  {showBibleControls && (
                    <div className="bible-controls-dropdown">
                      <select
                        className="bible-select"
                        value={selectedBibleBook.english}
                        onChange={(event) => {
                          const nextBook = bibleBooks.find(item => item.english === event.target.value);
                          if (nextBook) openBibleBook(nextBook);
                        }}
                      >
                        {bibleBooks.map(bookItem => (
                          <option key={bookItem.id} value={bookItem.english}>
                            {bookItem.tamil || bookItem.english}
                          </option>
                        ))}
                      </select>

                      <div className="bible-inline-selects">
                        <select
                          className="bible-select"
                          value={String(bibleChapterNumber)}
                          onChange={(event) => {
                            const chapter = Number(event.target.value);
                            if (!Number.isNaN(chapter)) {
                              goToBibleChapter(chapter - 1);
                            }
                          }}
                        >
                          {(selectedBibleBook.chapters || []).map((chapterItem, idx) => {
                            const chapterNo = String(chapterItem?.chapter || (idx + 1));
                            return (
                              <option key={`${selectedBibleBook.english}-chapter-${chapterNo}`} value={chapterNo}>
                                Chapter {chapterNo}
                              </option>
                            );
                          })}
                        </select>

                        <select
                          className="bible-select"
                          value={activeBibleVerseNumber || ''}
                          onChange={(event) => {
                            if (event.target.value) {
                              handleBibleVerseSelect(event.target.value);
                            }
                          }}
                        >
                          <option value="">Verse</option>
                          {bibleVerses.map((verseItem, idx) => {
                            const verseNo = String(verseItem?.verse || idx + 1);
                            return (
                              <option key={`${selectedBibleBook.english}-verse-${verseNo}`} value={verseNo}>
                                Verse {verseNo}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {showFontPicker && (
                  <div className="font-picker-container">
                    <div className="font-picker">
                      {FONTS.map(f => (
                        <button
                          key={f.value}
                          className={`font-opt ${displayFont === f.value ? 'active' : ''}`}
                          style={{ fontFamily: f.value }}
                          onClick={() => setDisplayFont(f.value)}
                        >
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

                <div className="bible-swipe-hint">Swipe right for previous chapter, swipe left for next chapter.</div>

                <div
                  ref={bibleVerseListRef}
                  className="bible-verse-list"
                  onTouchStart={handleBibleSwipeStart}
                  onTouchEnd={handleBibleSwipeEnd}
                >
                  {bibleVerses.map((verseItem, idx) => {
                    const verseNo = String(verseItem?.verse || idx + 1);
                    const verseKey = `${selectedBibleBook.english || ''}-${selectedBibleChapterIndex + 1}-${verseNo}`;
                    return (
                      <button
                        key={verseKey}
                        data-verse-key={verseKey}
                        className={`bible-verse-btn ${activeBibleVerseKey === verseKey ? 'active' : ''}`}
                        onClick={() => presentBibleVerse(verseItem?.text || '', verseNo)}
                      >
                        <span className="bible-verse-no">{verseNo}</span>
                        <span className="bible-verse-text">{verseItem?.text || ''}</span>
                      </button>
                    );
                  })}
                </div>

              </>
            )}
          </div>
        )}

        {/* Search */}
        {activeTab !== 'images' && activeTab !== 'bible' && (
          <div className="search-container">
            <div className="input-clear-wrap search-wrap">
              <input
                type="text"
                className="search-input"
                placeholder={`Search ${activeTab === 'db' ? 'Database' : activeTab === 'web' ? 'Web' : activeTab === 'recents' ? 'Recents' : 'Favorites'}...`}
                value={tabSearch[activeTab] || ''}
                onChange={e => setTabSearch(prev => ({ ...prev, [activeTab]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              {!!(tabSearch[activeTab] || '') && (
                <button
                  className="text-clear-btn"
                  onClick={() => setTabSearch(prev => ({ ...prev, [activeTab]: '' }))}
                >
                  Clear
                </button>
              )}
            </div>
            <button className="btn" onClick={handleSearch} disabled={loading}><FaSearch /></button>
            {activeTab === 'db' && (
              <button className="add-btn" onClick={openAddModal} title="Add Song"><FaPlus /></button>
            )}
          </div>
        )}

        {/* A-Z Filter */}
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

        {activeTab !== 'images' && activeTab !== 'bible' && loading && <div className="loading">Searching...</div>}

        {activeTab !== 'images' && activeTab !== 'bible' && !loading && results.length > 0 && (
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

        {activeTab !== 'images' && activeTab !== 'bible' && !loading && results.length === 0 && (tabSearch[activeTab] || '') && !selectedLetter && (
          <div className="loading">No songs found.</div>
        )}
        {activeTab !== 'images' && activeTab !== 'bible' && !loading && results.length === 0 && selectedLetter && (
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
            {!!addTitle && <button className="text-clear-btn inline-clear-btn" onClick={() => setAddTitle('')}>Clear</button>}

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
                    {!!stanza && <button className="text-clear-btn" onClick={() => updateManualStanza(i, '')}>Clear</button>}
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
                {!!autoText && <button className="text-clear-btn inline-clear-btn" onClick={() => setAutoText('')}>Clear</button>}
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
            {!!profileNameInput && <button className="text-clear-btn inline-clear-btn" onClick={() => setProfileNameInput('')}>Clear</button>}
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
