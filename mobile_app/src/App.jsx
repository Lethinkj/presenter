import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import SongPresentationPage from './pages/SongPresentationPage';
import SettingsPage from './pages/SettingsPage';
import MainPage from './pages/MainPage';

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

const buildRoomScopedWsUrl = (baseWsUrl, room) => {
  const safeRoom = String(room || 'DEFAULT').trim() || 'DEFAULT';

  try {
    const parsed = new URL(baseWsUrl);
    parsed.pathname = '/ws';
    parsed.searchParams.set('room', safeRoom);
    return parsed.toString();
  } catch {
    const normalizedBase = String(baseWsUrl || '').replace(/\/+$/, '');
    const separator = normalizedBase.includes('?') ? '&' : '?';
    return `${normalizedBase}/ws${separator}room=${encodeURIComponent(safeRoom)}`;
  }
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
const OFFLINE_STORAGE_FOLDER = 'worship-cast';
const OFFLINE_DATA_FILE_PATH = `${OFFLINE_STORAGE_FOLDER}/offline-data.json`;
const OFFLINE_STORAGE_DIR_FALLBACK = Directory.Data;
const NATIVE_FILE_STORAGE_ENABLED_IN_BUILD = true;
const LOCAL_DATA_SNAPSHOT_KEY = 'worship_local_data_snapshot';
const DEFAULT_PRESENT_ROUTING_MODE = 'mirror';
const normalizePresentRoutingMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'offline' || mode === 'online' || mode === 'mirror') return mode;
  return DEFAULT_PRESENT_ROUTING_MODE;
};

const readImageAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read image file'));
  reader.readAsDataURL(file);
});

const setLocalStorageSafely = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return null;
  } catch (err) {
    return err;
  }
};

const readJsonLocalStorageSafely = (key, fallbackValue, options = {}) => {
  const { maxChars = 250000 } = options;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;

    // Large legacy payloads can cause startup memory pressure on low-end devices.
    // Skip parsing and clean up so app can boot and use device-file storage instead.
    if (raw.length > maxChars) {
      try { localStorage.removeItem(key); } catch { /* no-op */ }
      return fallbackValue;
    }

    const parsed = JSON.parse(raw);
    return parsed ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
};

const estimateUtf8Bytes = (value) => {
  try {
    return new Blob([String(value || '')]).size;
  } catch {
    return String(value || '').length * 2;
  }
};

const formatBytes = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = n;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unit]}`;
};

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
    let optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
    const MAX_SAFE_DATA_URL_LEN = 1_200_000;

    if (optimizedDataUrl.length > MAX_SAFE_DATA_URL_LEN) {
      // Keep reducing quality for very large images to improve local/offline delivery reliability.
      for (let quality = 0.76; quality >= 0.48; quality -= 0.08) {
        const candidate = canvas.toDataURL('image/jpeg', quality);
        if (candidate.length < optimizedDataUrl.length) {
          optimizedDataUrl = candidate;
        }
        if (optimizedDataUrl.length <= MAX_SAFE_DATA_URL_LEN) break;
      }
    }

    // Use optimized output on meaningful reduction, or always for oversized originals.
    if (optimizedDataUrl.length < originalDataUrl.length * 0.95 || originalDataUrl.length > MAX_SAFE_DATA_URL_LEN) {
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
  const [showHomeCards, setShowHomeCards] = useState(true);

  // Presentation
  const [selectedSong, setSelectedSong] = useState(null);
  const [ws, setWs] = useState(null);
  const wsRef = useRef(null);
  const websocketManuallyStoppedRef = useRef(false);
  const [presenterConnectionStopped, setPresenterConnectionStopped] = useState(false);
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

  const [homePresentExpanded, setHomePresentExpanded] = useState(false);
  const [homeOfflineLink, setHomeOfflineLink] = useState('');

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
  const [activeBibleReference, setActiveBibleReference] = useState('');
  const [showBibleControls, setShowBibleControls] = useState(false);
  const [bibleRefOnlyMode, setBibleRefOnlyMode] = useState(false);
  const bibleSwipeStartXRef = useRef(null);
  const bibleSwipeStartYRef = useRef(null);
  const bibleVerseListRef = useRef(null);
  const lastFontSyncRef = useRef({ initialized: false, font: '', size: '' });
  const lastImageSizeSyncRef = useRef({ initialized: false, size: '' });
  const lastBibleFontSyncRef = useRef({ initialized: false, font: '', size: '', refOnly: false, verseKey: '' });

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
    const parsed = readJsonLocalStorageSafely('worship_favorites', [], { maxChars: 40000 });
    return Array.isArray(parsed) ? parsed : [];
  });
  const [recentSongs, setRecentSongs] = useState(() => {
    const parsed = readJsonLocalStorageSafely('worship_recent_songs', [], { maxChars: 40000 });
    return Array.isArray(parsed) ? parsed : [];
  });
  const [offlineCache, setOfflineCache] = useState(() => {
    const parsed = readJsonLocalStorageSafely('worship_offline_cache', {}, { maxChars: 120000 });
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  });
  const [pendingSyncQueue, setPendingSyncQueue] = useState(() => {
    const parsed = readJsonLocalStorageSafely('worship_pending_sync_queue', [], { maxChars: 60000 });
    return Array.isArray(parsed) ? parsed : [];
  });
  const [syncState, setSyncState] = useState({ syncing: false, lastRun: null, lastError: '' });
  const [offlineDownloadState, setOfflineDownloadState] = useState({ downloading: false, downloaded: 0, total: null, lastError: '' });
  const [storageState, setStorageState] = useState({ permission: 'unknown', loaded: false, lastSavedAt: null, lastError: '', directory: 'Data' });
  const [localSnapshotSavedAt, setLocalSnapshotSavedAt] = useState(() => {
    const parsed = readJsonLocalStorageSafely(LOCAL_DATA_SNAPSHOT_KEY, {}, { maxChars: 120000 });
    return parsed?.savedAt || null;
  });
  const [nativeFileStorageEnabled, setNativeFileStorageEnabled] = useState(() => {
    // Crash-safe default on native: require explicit user enable from Settings.
    if (Capacitor.isNativePlatform()) return false;
    return localStorage.getItem('nativeFileStorageEnabled') === 'true';
  });
  const [offlineServerStatus, setOfflineServerStatus] = useState({ checking: false, ok: null, message: '' });
  const [autoDetectingLan, setAutoDetectingLan] = useState(false);
  const [startingOfflinePresent, setStartingOfflinePresent] = useState(false);
  const [nativeOfflineServer, setNativeOfflineServer] = useState({ running: false, host: '', port: 3000, url: '' });
  const [useLanApi, setUseLanApi] = useState(() => localStorage.getItem('presenterUseLanApi') === 'true');
  const [presentRoutingMode, setPresentRoutingMode] = useState(() => normalizePresentRoutingMode(localStorage.getItem('presenterRoutingMode')));

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
    // Keep internet API as default; LAN override is opt-in.
    if (useLanApi && cleanedServerHost) return `http://${cleanedServerHost}:${cleanedServerPort}`;
    if (API_BASE_NORMALIZED) return API_BASE_NORMALIZED;
    return API_BASE;
  }, [useLanApi, cleanedServerHost, cleanedServerPort]);

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
  const onlineTvUrl = useMemo(
    () => `${apiBase}/tv.html?room=${encodeURIComponent(roomCode)}`,
    [apiBase, roomCode]
  );

  const pendingQueueRef = useRef(pendingSyncQueue);
  const offlineCacheRef = useRef(offlineCache);
  const storageDirectoryRef = useRef(OFFLINE_STORAGE_DIR_FALLBACK);
  const syncInProgressRef = useRef(false);
  const nativeStorageLoadedRef = useRef(false);
  const autoDetectAttemptedRef = useRef(false);
  const autoDetectPromiseRef = useRef(null);

  useEffect(() => { pendingQueueRef.current = pendingSyncQueue; }, [pendingSyncQueue]);
  useEffect(() => { offlineCacheRef.current = offlineCache; }, [offlineCache]);

  const writeLocalStorage = useCallback((key, value, label = 'local storage') => {
    const error = setLocalStorageSafely(key, value);
    if (!error) return true;

    const message = error?.message || 'Storage write failed';
    const lower = String(message).toLowerCase();
    const isQuotaError = lower.includes('quota') || lower.includes('exceeded');

    if (isQuotaError) {
      // Recover from legacy large blobs occupying storage quota.
      const keysToTrim = [
        'worship_offline_cache',
        'worship_pending_sync_queue',
        LOCAL_DATA_SNAPSHOT_KEY
      ];

      for (const trimKey of keysToTrim) {
        if (trimKey === key) continue;
        try {
          localStorage.removeItem(trimKey);
        } catch {
          // ignore cleanup failures
        }
      }

      // Retry once after cleanup.
      const retryError = setLocalStorageSafely(key, value);
      if (!retryError) {
        setStorageState(prev => ({ ...prev, lastError: '' }));
        return true;
      }
    }

    setStorageState(prev => ({
      ...prev,
      lastError: `${label}: ${message}`
    }));
    return false;
  }, []);

  const ensureStoragePermission = useCallback(async (askUser = true) => {
    if (!NATIVE_FILE_STORAGE_ENABLED_IN_BUILD) {
      setStorageState(prev => ({ ...prev, permission: 'disabled-in-build', loaded: true }));
      if (askUser) {
        alert('Device file storage is disabled in this build for stability. Offline data will continue using app local storage.');
      }
      return false;
    }

    if (!Capacitor.isNativePlatform()) {
      setStorageState(prev => ({ ...prev, permission: 'not-required', directory: 'BrowserLocalStorage' }));
      return true;
    }

    try {
      if (askUser) {
        const allow = window.confirm('Create "worship-cast" app storage folder for offline files?');
        if (!allow) {
          setStorageState(prev => ({ ...prev, permission: 'app-data-only', directory: 'Data' }));
          return true;
        }
      }

      // App-private storage does not require runtime permission and is safest across devices.
      await Filesystem.mkdir({
        path: OFFLINE_STORAGE_FOLDER,
        directory: OFFLINE_STORAGE_DIR_FALLBACK,
        recursive: true
      });

      storageDirectoryRef.current = OFFLINE_STORAGE_DIR_FALLBACK;
      setStorageState(prev => ({ ...prev, permission: 'app-data-only', directory: 'Data', lastError: '' }));
      return true;
    } catch (err) {
      storageDirectoryRef.current = OFFLINE_STORAGE_DIR_FALLBACK;
      setStorageState(prev => ({ ...prev, permission: 'app-data-only', directory: 'Data', lastError: err.message || '' }));
      return false;
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

      await Filesystem.writeFile({
        path: OFFLINE_DATA_FILE_PATH,
        data: JSON.stringify(payload),
        directory: storageDirectoryRef.current,
        recursive: true
      });

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
      const tried = [storageDirectoryRef.current, OFFLINE_STORAGE_DIR_FALLBACK];
      let file = null;

      for (const directory of tried) {
        try {
          // eslint-disable-next-line no-await-in-loop
          file = await Filesystem.readFile({
            path: OFFLINE_DATA_FILE_PATH,
            directory
          });
          storageDirectoryRef.current = directory;
          setStorageState(prev => ({ ...prev, directory: 'Data' }));
          break;
        } catch {
          // try next location
        }
      }

      if (!file) throw new Error('offline file not found');

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

  const shouldStoreLargeDataInLocalStorage = !Capacitor.isNativePlatform() || !nativeFileStorageEnabled;

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !nativeFileStorageEnabled) return;

    // Quota-safety migration: remove heavy payloads from localStorage once device-file mode is active.
    const heavyKeys = [
      'worship_offline_cache',
      'worship_pending_sync_queue',
      LOCAL_DATA_SNAPSHOT_KEY
    ];

    for (const key of heavyKeys) {
      const value = localStorage.getItem(key);
      if (!value) continue;

      // Keep tiny marker payloads, remove old large JSON blobs.
      if (value.length > 2048) {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore cleanup failures.
        }
      }
    }
  }, [nativeFileStorageEnabled]);
  const storageUsageSummary = useMemo(() => {
    const offlineSongCount = Object.keys(offlineCache || {}).length;
    const pendingCount = Array.isArray(pendingSyncQueue) ? pendingSyncQueue.length : 0;
    const offlineBytes = estimateUtf8Bytes(JSON.stringify(offlineCache || {}));
    const queueBytes = estimateUtf8Bytes(JSON.stringify(pendingSyncQueue || []));
    const totalBytes = offlineBytes + queueBytes;

    return {
      offlineSongCount,
      pendingCount,
      offlineBytes,
      queueBytes,
      totalBytes,
      target: shouldStoreLargeDataInLocalStorage ? 'LocalStorage' : 'Device Files (Directory.Data)'
    };
  }, [offlineCache, pendingSyncQueue, shouldStoreLargeDataInLocalStorage]);

  // Persist settings
  useEffect(() => { writeLocalStorage('activeTab', activeTab, 'active tab'); }, [activeTab, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('tvRoomCode', roomCode, 'room code'); }, [roomCode, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('tabSearchState', JSON.stringify(tabSearch), 'search state'); }, [tabSearch, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('deviceCode', deviceCode, 'device code'); }, [deviceCode, writeLocalStorage]);
  useEffect(() => {
    if (userName.trim()) {
      writeLocalStorage('presenterUserName', userName.trim(), 'user profile');
    }
  }, [userName, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('worship_favorites', JSON.stringify(favorites), 'favorites'); }, [favorites, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('worship_recent_songs', JSON.stringify(recentSongs), 'recent songs'); }, [recentSongs, writeLocalStorage]);
  useEffect(() => {
    if (shouldStoreLargeDataInLocalStorage) {
      writeLocalStorage('worship_offline_cache', JSON.stringify(offlineCache), 'offline cache');
      return;
    }
    // Keep a lightweight marker in localStorage while data lives in device files.
    writeLocalStorage('worship_offline_cache', JSON.stringify({ _storedInDeviceFile: true, count: Object.keys(offlineCache || {}).length }), 'offline cache marker');
  }, [offlineCache, shouldStoreLargeDataInLocalStorage, writeLocalStorage]);
  useEffect(() => {
    if (shouldStoreLargeDataInLocalStorage) {
      writeLocalStorage('worship_pending_sync_queue', JSON.stringify(pendingSyncQueue), 'pending sync queue');
      return;
    }
    writeLocalStorage('worship_pending_sync_queue', JSON.stringify({ _storedInDeviceFile: true, count: pendingSyncQueue.length }), 'pending queue marker');
  }, [pendingSyncQueue, shouldStoreLargeDataInLocalStorage, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('displayFont', displayFont, 'display font'); }, [displayFont, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('displayFontSize', String(displayFontSize), 'display font size'); }, [displayFontSize, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('displayImageSize', String(displayImageSize), 'display image size'); }, [displayImageSize, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('presenterServerHost', cleanedServerHost, 'server host'); }, [cleanedServerHost, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('presenterServerPort', cleanedServerPort, 'server port'); }, [cleanedServerPort, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('presenterUseLanApi', useLanApi ? 'true' : 'false', 'LAN API mode'); }, [useLanApi, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('presenterRoutingMode', presentRoutingMode, 'routing mode'); }, [presentRoutingMode, writeLocalStorage]);
  useEffect(() => { writeLocalStorage('nativeFileStorageEnabled', nativeFileStorageEnabled ? 'true' : 'false', 'native file storage toggle'); }, [nativeFileStorageEnabled, writeLocalStorage]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (nativeFileStorageEnabled) return;
    // Keep boot path stable across updates that previously enabled native file storage.
    writeLocalStorage('nativeFileStorageEnabled', 'false', 'native file storage boot-safe reset');
  }, [nativeFileStorageEnabled, writeLocalStorage]);

  useEffect(() => {
    const snapshot = {
      savedAt: Date.now(),
      favoritesCount: favorites.length,
      recentSongsCount: recentSongs.length,
      offlineCacheCount: Object.keys(offlineCache || {}).length,
      pendingSyncCount: pendingSyncQueue.length,
      roomCode,
      userName: userName || '',
      serverHost: cleanedServerHost,
      serverPort: cleanedServerPort,
      storageMode: shouldStoreLargeDataInLocalStorage ? 'local-storage' : 'device-files'
    };

    // In native device-file mode, avoid writing snapshots to localStorage entirely.
    // This prevents quota issues when users migrate from older builds.
    if (shouldStoreLargeDataInLocalStorage) {
      writeLocalStorage(LOCAL_DATA_SNAPSHOT_KEY, JSON.stringify(snapshot), 'local snapshot');
    }

    setLocalSnapshotSavedAt(snapshot.savedAt);
  }, [favorites, recentSongs, offlineCache, pendingSyncQueue, roomCode, userName, cleanedServerHost, cleanedServerPort, shouldStoreLargeDataInLocalStorage, writeLocalStorage]);

  useEffect(() => {
    if (!nativeFileStorageEnabled) return;
    loadOfflineDataFromDevice();
  }, [nativeFileStorageEnabled, loadOfflineDataFromDevice]);

  useEffect(() => {
    if (!nativeFileStorageEnabled) return;
    saveOfflineDataToDevice();
  }, [nativeFileStorageEnabled, offlineCache, pendingSyncQueue, saveOfflineDataToDevice]);

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

      // Native offline socket routing is room-bound from URL query.
      // Reconnect when room changes so image messages go to the selected room.
      try {
        const connectedRoom = new URL(socket.url).searchParams.get('room') || '';
        if (connectedRoom.toUpperCase() !== String(roomCode || '').toUpperCase()) {
          socket.close();
        }
      } catch {
        // no-op
      }
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
      if (websocketManuallyStoppedRef.current) return;
      clearReconnectTimer();
      const delay = reconnectDelayRef.current;
      reconnectTimerRef.current = setTimeout(connect, delay);
      reconnectDelayRef.current = Math.min(delay * 1.6, 10000);
    };

    const connect = () => {
      if (isDisposed) return;
      if (websocketManuallyStoppedRef.current) return;

      const existing = wsRef.current;
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (existing && existing.readyState !== WebSocket.CLOSED) {
        try { existing.close(); } catch { /* no-op */ }
      }

      let socket;
      try {
        const scopedWsUrl = buildRoomScopedWsUrl(WS_URL, roomCodeRef.current);
        socket = new WebSocket(scopedWsUrl);
      } catch (err) {
        setOfflineServerStatus(prev => ({
          ...prev,
          message: `WebSocket init failed: ${err?.message || 'invalid URL'}`
        }));
        scheduleReconnect();
        return;
      }

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
      if (websocketManuallyStoppedRef.current) return;
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

  const handleInternalBack = useCallback(() => {
    if (selectedSong) {
      setSelectedSong(null);
      setActiveStanza(null);
      return true;
    }
    if (showSettings) {
      setShowSettings(false);
      setShowHomeCards(true);
      setResults([]);
      setSelectedLetter(null);
      return true;
    }
    if (!showHomeCards) {
      setShowHomeCards(true);
      setResults([]);
      setSelectedLetter(null);
      return true;
    }
    return false;
  }, [selectedSong, showSettings, showHomeCards]);

  // In-app back stack: close song/settings on browser/mobile back before exiting app.
  useEffect(() => {
    const onPopState = () => {
      handleInternalBack();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [handleInternalBack]);

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
        // If not in modal/song/settings, always return to home instead of exiting app
        if (!showHomeCards) {
          setShowHomeCards(true);
          setResults([]);
          setSelectedLetter(null);
          return;
        }
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
  }, [handleInternalBack, showHomeCards]);

  const openSettingsPage = () => {
    if (showSettings) return;
    setShowSettings(true);
    setShowHomeCards(false);
  };

  const closeSettingsPage = () => {
    setShowSettings(false);
    setShowHomeCards(true);
    setResults([]);
    setSelectedLetter(null);
  };

  const handleSongPageBack = () => {
    if (window.history.state?.appView === 'song') {
      window.history.back();
      return;
    }
    setSelectedSong(null);
    setActiveStanza(null);
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
    const { allowNative = true, allowWebSocket = true } = options;

    const routeNative = allowNative && presentRoutingMode !== 'online';
    const routeWebSocket = allowWebSocket && presentRoutingMode !== 'offline';

    let sentAny = false;

    // Keep local/offline and online presentation in sync: do not make them mutually exclusive.
    if (routeNative && Capacitor.isNativePlatform() && nativeOfflineServer.running) {
      sentAny = true;
      OfflinePresenter.present({
        room: payload.room,
        text: payload.text,
        font: payload.font,
        fontSize: payload.fontSize,
        imageData: payload.imageData,
        imageName: payload.imageName,
        imageSize: payload.imageSize,
        name: payload.name,
        deviceCode: payload.deviceCode
      }).catch(() => {
        // Keep websocket path active as fallback for reliability.
      });
    }

    if (!routeWebSocket) {
      return sentAny;
    }

    const socket = wsRef.current || ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }

    pendingPresentRef.current = payload;
    ensureConnectedRef.current();
    return sentAny;
  }, [nativeOfflineServer.running, presentRoutingMode, ws]);

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
    const sentImmediately = sendPresentationPayload(payload);
    if (!sentImmediately) {
      setTimeout(() => {
        if (presentAttemptRef.current !== attemptId) return;
        sendPresentationPayload(payload);
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

  const openBibleBook = async (bookMeta, options = {}) => {
    if (!bookMeta?.english) return;
    setBibleLoading(true);
    setBibleError('');

    try {
      const fileName = encodeURIComponent(bookMeta.english) + '.json';
      const response = await fetch(`/bible/${fileName}`);
      if (!response.ok) throw new Error('Failed to load book data');
      const data = await response.json();
      const chapters = Array.isArray(data?.chapters) ? data.chapters : [];
      const targetChapterNumber = Number(options?.chapterNumber);
      const hasTargetChapter = Number.isInteger(targetChapterNumber) && targetChapterNumber > 0;
      const chapterIndex = hasTargetChapter
        ? Math.max(0, Math.min(chapters.length - 1, targetChapterNumber - 1))
        : 0;
      const targetVerseNumber = options?.verseNumber !== undefined && options?.verseNumber !== null
        ? String(options.verseNumber).trim()
        : '';
      const targetChapter = chapters[chapterIndex];
      const targetVerses = Array.isArray(targetChapter?.verses) ? targetChapter.verses : [];
      const targetVerse = targetVerseNumber
        ? targetVerses.find((item, idx) => String(item?.verse || idx + 1) === targetVerseNumber)
        : null;
      const loadedBook = {
        english: data?.book?.english || bookMeta.english,
        tamil: data?.book?.tamil || bookMeta.tamil,
        chapters
      };

      setSelectedBibleBook(loadedBook);
      setSelectedBibleChapterIndex(chapterIndex);
      setActiveBibleVerseKey('');
      setActiveBibleVerseText('');
      setActiveBibleReference('');

      if (targetVerse) {
        const verseNo = String(targetVerse?.verse || targetVerseNumber);
        const cleanText = String(targetVerse?.text || '').trim();
        if (cleanText) {
          const reference = `${loadedBook.tamil || loadedBook.english || ''} ${chapterIndex + 1}:${verseNo}`.trim();
          const key = `${loadedBook.english || ''}-${chapterIndex + 1}-${verseNo}`;

          setActiveBibleVerseKey(key);
          setActiveBibleVerseText(cleanText);
          setActiveBibleReference(reference);

          const payload = {
            type: 'present',
            text: bibleRefOnlyMode ? '' : cleanText,
            reference,
            refOnly: bibleRefOnlyMode,
            room: roomCode,
            font: displayFont,
            fontSize: displayFontSize,
            name: userNameRef.current || 'Anonymous',
            deviceCode: deviceCodeRef.current
          };

          const attemptId = ++presentAttemptRef.current;
          const sentImmediately = sendPresentationPayload(payload);
          if (!sentImmediately) {
            setTimeout(() => {
              if (presentAttemptRef.current !== attemptId) return;
              sendPresentationPayload(payload);
            }, 220);
          }
        }
      }

      return loadedBook;
    } catch {
      setBibleError('Failed to load selected book.');
      return null;
    } finally {
      setBibleLoading(false);
    }
  };

  const presentBibleVerse = (verseText, verseNumber) => {
    const cleanText = String(verseText || '').trim();
    if (!cleanText) return;

    const chapterNumber = Number(selectedBibleChapterIndex) + 1;
    const reference = `${selectedBibleBook?.tamil || selectedBibleBook?.english || ''} ${chapterNumber}:${verseNumber}`.trim();
    const payload = {
      type: 'present',
      text: bibleRefOnlyMode ? '' : cleanText,
      reference,
      refOnly: bibleRefOnlyMode,
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
    setActiveBibleReference(reference);

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
    setActiveBibleReference('');
  }, [selectedBibleBook]);

  const handleBibleSwipeStart = (event) => {
    const touch = event.changedTouches?.[0];
    bibleSwipeStartXRef.current = touch?.clientX ?? null;
    bibleSwipeStartYRef.current = touch?.clientY ?? null;
  };

  const handleBibleSwipeEnd = (event) => {
    const startX = bibleSwipeStartXRef.current;
    const startY = bibleSwipeStartYRef.current;
    const endX = event.changedTouches?.[0]?.clientX ?? null;
    const endY = event.changedTouches?.[0]?.clientY ?? null;
    bibleSwipeStartXRef.current = null;
    bibleSwipeStartYRef.current = null;
    if (startX === null || endX === null || startY === null || endY === null) return;

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Avoid accidental chapter changes while reading long chapters (vertical scroll).
    if (absY > absX || absY > 24) return;
    if (absX < 42) return;

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

    sendPresentationPayload(payload);
  }, [displayImageSize, activeImageId, uploadedImages, roomCode, sendPresentationPayload]);

  useEffect(() => {
    if (!activeBibleVerseKey || !activeBibleVerseText) return;

    const previous = lastBibleFontSyncRef.current;
    const settingsChanged = previous.initialized && (
      previous.font !== displayFont ||
      previous.size !== String(displayFontSize) ||
      previous.refOnly !== bibleRefOnlyMode
    );
    lastBibleFontSyncRef.current = {
      initialized: true,
      font: displayFont,
      size: String(displayFontSize),
      refOnly: bibleRefOnlyMode,
      verseKey: activeBibleVerseKey
    };
    if (!settingsChanged) return;

    const payload = {
      type: 'present',
      text: bibleRefOnlyMode ? '' : activeBibleVerseText,
      reference: activeBibleReference,
      refOnly: bibleRefOnlyMode,
      room: roomCode,
      font: displayFont,
      fontSize: displayFontSize,
      name: userNameRef.current || 'Anonymous',
      deviceCode: deviceCodeRef.current
    };

    sendPresentationPayload(payload);
  }, [activeBibleVerseKey, activeBibleVerseText, activeBibleReference, bibleRefOnlyMode, displayFont, displayFontSize, roomCode, sendPresentationPayload]);

  const clearScreen = () => {
    setActiveStanza(null);
    setActiveImageId(null);
    setActiveBibleVerseKey('');
    setActiveBibleVerseText('');
    setActiveBibleReference('');

    const routeNative = presentRoutingMode !== 'online';
    const routeWebSocket = presentRoutingMode !== 'offline';

    if (routeNative && Capacitor.isNativePlatform() && nativeOfflineServer.running) {
      OfflinePresenter.clear({
        room: roomCode,
        name: userNameRef.current || 'Anonymous',
        deviceCode: deviceCodeRef.current
      }).catch(() => {});
    }

    if (!routeWebSocket) {
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
    } else {
      pendingPresentRef.current = {
        type: 'clear',
        room: roomCode,
        name: userNameRef.current || 'Anonymous',
        deviceCode: deviceCodeRef.current
      };
      ensureConnectedRef.current();
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

  const handleStopOfflinePresent = async () => {
    if (!Capacitor.isNativePlatform()) {
      setOfflineServerStatus({ checking: false, ok: false, message: 'Stop is available on native app only.' });
      return;
    }

    try {
      await OfflinePresenter.stopServer();
      setNativeOfflineServer({ running: false, host: '', port: Number(cleanedServerPort), url: '' });
      setOfflineServerStatus({ checking: false, ok: false, message: 'Offline presenter stopped.' });
    } catch (err) {
      setOfflineServerStatus({ checking: false, ok: false, message: err?.message || 'Failed to stop offline presenter.' });
    }
  };

  const handleStopPresenterConnection = () => {
    websocketManuallyStoppedRef.current = true;
    setPresenterConnectionStopped(true);
    pendingPresentRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (staleCheckIntervalRef.current) {
      clearInterval(staleCheckIntervalRef.current);
      staleCheckIntervalRef.current = null;
    }
    const socket = wsRef.current;
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      try { socket.close(); } catch { /* no-op */ }
    }
    setOfflineServerStatus(prev => ({ ...prev, message: 'Presenter connection stopped. Tap Reconnect Presenter when needed.' }));
  };

  const handleReconnectPresenterConnection = () => {
    websocketManuallyStoppedRef.current = false;
    setPresenterConnectionStopped(false);
    ensureConnectedRef.current();
    setOfflineServerStatus(prev => ({ ...prev, message: 'Presenter reconnect requested.' }));
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

  const openHomeCard = (tabKey) => {
    if (tabKey === 'settings') {
      openSettingsPage();
      return;
    }
    setActiveTab(tabKey);
    setResults([]);
    setSelectedLetter(null);
    setShowHomeCards(false);
  };

  const startPresenterFromHome = async () => {
    setHomePresentExpanded(true);
    setStartingOfflinePresent(true);

    try {
      const hostToUse = await ensureOfflineServerReady();
      if (!hostToUse) {
        setHomeOfflineLink('');
        setOfflineServerStatus(prev => ({
          ...prev,
          ok: false,
          message: 'Offline presenter not available. Online link is still active.'
        }));
        return;
      }

      setHomeOfflineLink(formatOfflineLink(hostToUse, cleanedServerPort, roomCode, true));
    } finally {
      setStartingOfflinePresent(false);
    }
  };

  const stopPresenterFromHome = async () => {
    try {
      await handleStopOfflinePresent();
    } catch {
      // no-op
    }
    setHomePresentExpanded(false);
    setHomeOfflineLink('');
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

  // ---- Page Rendering ----
  if (selectedSong) {
    return (
      <SongPresentationPage
        displayFont={displayFont}
        selectedSong={selectedSong}
        activeStanza={activeStanza}
        isEditingSong={isEditingSong}
        editableStanzas={editableStanzas}
        setActiveStanza={setActiveStanza}
        setIsEditingSong={setIsEditingSong}
        setEditTitle={setEditTitle}
        setEditableStanzas={setEditableStanzas}
        editTitle={editTitle}
        addEditableStanza={addEditableStanza}
        saveEditedSongToDb={saveEditedSongToDb}
        savingEdits={savingEdits}
        FONTS={FONTS}
        showFontPicker={showFontPicker}
        setShowFontPicker={setShowFontPicker}
        setDisplayFont={setDisplayFont}
        displayFontSize={displayFontSize}
        setDisplayFontSize={setDisplayFontSize}
        handleSaveWebResultToDb={handleSaveWebResultToDb}
        savingWebSongs={savingWebSongs}
        presentLyrics={presentLyrics}
        updateEditableStanza={updateEditableStanza}
        removeEditableStanza={removeEditableStanza}
        clearScreen={clearScreen}
        onBack={handleSongPageBack}
      />
    );
  }

  if (showSettings) {
    return (
      <SettingsPage
        closeSettingsPage={closeSettingsPage}
        userName={userName}
        setUserName={setUserName}
        deviceCode={deviceCode}
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        copiedLink={copiedLink}
        handleShareLink={handleShareLink}
        presentRoutingMode={presentRoutingMode}
        setPresentRoutingMode={setPresentRoutingMode}
        nativeOfflineServer={nativeOfflineServer}
        offlineTvUrlSimple={offlineTvUrlSimple}
        autoDetectingLan={autoDetectingLan}
        serverHost={serverHost}
        setServerHost={setServerHost}
        serverPort={serverPort}
        setServerPort={setServerPort}
        useLanApi={useLanApi}
        setUseLanApi={setUseLanApi}
        apiBase={apiBase}
        WS_URL={WS_URL}
        detectedLanHost={detectedLanHost}
        offlineTvUrl={offlineTvUrl}
        checkOfflineServer={checkOfflineServer}
        offlineServerStatus={offlineServerStatus}
        pendingSyncQueue={pendingSyncQueue}
        syncState={syncState}
        runPendingSync={runPendingSync}
        downloadAllSongsForOffline={downloadAllSongsForOffline}
        offlineDownloadState={offlineDownloadState}
        storageState={storageState}
        nativeFileStorageEnabled={nativeFileStorageEnabled}
        OFFLINE_STORAGE_FOLDER={OFFLINE_STORAGE_FOLDER}
        storageUsageSummary={storageUsageSummary}
        formatBytes={formatBytes}
        localSnapshotSavedAt={localSnapshotSavedAt}
        NATIVE_FILE_STORAGE_ENABLED_IN_BUILD={NATIVE_FILE_STORAGE_ENABLED_IN_BUILD}
        clearLocalSearchCache={clearLocalSearchCache}
      />
    );
  }

  const selectedBibleChapter = selectedBibleBook?.chapters?.[selectedBibleChapterIndex] || null;
  const bibleVerses = Array.isArray(selectedBibleChapter?.verses) ? selectedBibleChapter.verses : [];
  const bibleChapterNumber = Number(selectedBibleChapter?.chapter || (selectedBibleChapterIndex + 1));
  const activeBibleVerseNumber = activeBibleVerseKey ? activeBibleVerseKey.split('-').slice(-1)[0] : '';

  return (
    <MainPage
      userName={userName}
      deviceCode={deviceCode}
      isOnline={isOnline}
      showHomeCards={showHomeCards}
      startingOfflinePresent={startingOfflinePresent}
      startPresenterFromHome={startPresenterFromHome}
      homePresentExpanded={homePresentExpanded}
      stopPresenterFromHome={stopPresenterFromHome}
      onlineTvUrl={onlineTvUrl}
      homeOfflineLink={homeOfflineLink}
      openHomeCard={openHomeCard}
      activeTab={activeTab}
      setShowHomeCards={setShowHomeCards}
      imageInputRef={imageInputRef}
      imageRemoveMode={imageRemoveMode}
      setImageRemoveMode={setImageRemoveMode}
      clearScreen={clearScreen}
      uploadedImages={uploadedImages}
      activeImageId={activeImageId}
      presentImage={presentImage}
      removeUploadedImage={removeUploadedImage}
      handleImageUpload={handleImageUpload}
      displayImageSize={displayImageSize}
      setDisplayImageSize={setDisplayImageSize}
      bibleLoading={bibleLoading}
      bibleError={bibleError}
      selectedBibleBook={selectedBibleBook}
      showBibleControls={showBibleControls}
      setShowBibleControls={setShowBibleControls}
      bibleChapterNumber={bibleChapterNumber}
      showFontPicker={showFontPicker}
      setShowFontPicker={setShowFontPicker}
      bibleBooks={bibleBooks}
      openBibleBook={openBibleBook}
      goToBibleChapter={goToBibleChapter}
      activeBibleVerseNumber={activeBibleVerseNumber}
      handleBibleVerseSelect={handleBibleVerseSelect}
      bibleVerses={bibleVerses}
      bibleVerseListRef={bibleVerseListRef}
      handleBibleSwipeStart={handleBibleSwipeStart}
      handleBibleSwipeEnd={handleBibleSwipeEnd}
      selectedBibleChapterIndex={selectedBibleChapterIndex}
      activeBibleVerseKey={activeBibleVerseKey}
      presentBibleVerse={presentBibleVerse}
      bibleRefOnlyMode={bibleRefOnlyMode}
      setBibleRefOnlyMode={setBibleRefOnlyMode}
      FONTS={FONTS}
      displayFont={displayFont}
      setDisplayFont={setDisplayFont}
      displayFontSize={displayFontSize}
      setDisplayFontSize={setDisplayFontSize}
      tabSearch={tabSearch}
      setTabSearch={setTabSearch}
      handleSearch={handleSearch}
      loading={loading}
      openAddModal={openAddModal}
      selectedLetter={selectedLetter}
      setSelectedLetter={setSelectedLetter}
      setResults={setResults}
      handleLetterFilter={handleLetterFilter}
      results={results}
      favorites={favorites}
      offlineCache={offlineCache}
      handleSongSelect={handleSongSelect}
      handleSaveWebResultToDb={handleSaveWebResultToDb}
      savingWebSongs={savingWebSongs}
      toggleFavorite={toggleFavorite}
      showAddModal={showAddModal}
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
      showProfileSetup={showProfileSetup}
      profileNameInput={profileNameInput}
      setProfileNameInput={setProfileNameInput}
      completeProfileSetup={completeProfileSetup}
    />
  );
}

export default App;
