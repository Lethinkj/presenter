import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  FaSearch,
  FaDownload,
  FaTimes,
  FaSave,
  FaSpinner,
  FaGlobe,
  FaArrowLeft,
  FaExternalLinkAlt,
  FaMusic
} from 'react-icons/fa';

const NativeLyricsBrowser = registerPlugin('NativeLyricsBrowser');

export default function BrowserPage({
  apiBase,
  onImportSong,
}) {
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [lastQuery, setLastQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importTitle, setImportTitle] = useState('');
  const [importError, setImportError] = useState('');
  const [saving, setSaving] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef(null);

  const isUrl = (text) => {
    const trimmed = text.trim();
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/^[a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,}(\/|$)/i.test(trimmed)) return true;
    return false;
  };

  const getSiteLabel = (itemUrl, site) => {
    if (site) return site;
    try {
      return new URL(itemUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  };

  const openUrl = useCallback((targetUrl) => {
    setIframeError(false);
    setLoadedUrl(targetUrl);
    setUrl(targetUrl);
    setImportError('');
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event?.data?.type === 'browser-navigate' && typeof event.data.url === 'string') {
        setLoadedUrl(event.data.url);
        setUrl(event.data.url);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const proxySrc = loadedUrl ? `${apiBase}/browse?url=${encodeURIComponent(loadedUrl)}` : '';

  const searchChristianSongs = useCallback(async (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError('');
    setLoadedUrl('');
    setIframeError(false);
    setImportError('');
    setLastQuery(trimmed);

    try {
      const res = await axios.get(`${apiBase}/search?q=${encodeURIComponent(trimmed)}`);
      const items = Array.isArray(res.data) ? res.data : [];
      setSearchResults(items);
      if (items.length === 0) {
        setSearchError(`No Christian song results found for "${trimmed}". Try another title or enter a website URL.`);
      }
    } catch (err) {
      setSearchResults([]);
      setSearchError(err.response?.data?.error || 'Christian song search failed. Check your server connection.');
    } finally {
      setSearching(false);
    }
  }, [apiBase]);

  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  const launchNativeBrowser = useCallback(async (targetUrl) => {
    try {
      setImportError('');
      const res = await NativeLyricsBrowser.open({ url: targetUrl });
      if (res?.imported && Array.isArray(res.stanzas) && res.stanzas.length > 0) {
        const cleanStanzas = res.stanzas.map(s => String(s || '').trim()).filter(Boolean);
        if (cleanStanzas.length > 0) {
          setImportData({ stanzas: cleanStanzas, url: res.url || targetUrl });
          setImportTitle(String(res.title || '').trim());
        }
      }
    } catch (err) {
      setImportError(err?.message || 'Failed to open native browser');
    }
  }, []);

  const navigate = useCallback((input) => {
    const trimmed = (input || '').trim();
    if (!trimmed) return;

    if (isNativeAndroid) {
      const targetUrl = isUrl(trimmed)
        ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
        : `https://www.google.com/search?q=${encodeURIComponent(
            trimmed.toLowerCase().includes('christian') ? trimmed : `${trimmed} christian song lyrics`
          )}`;
      launchNativeBrowser(targetUrl);
      return;
    }

    if (isUrl(trimmed)) {
      const targetUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      openUrl(targetUrl);
    } else {
      searchChristianSongs(trimmed);
    }
  }, [isNativeAndroid, launchNativeBrowser, openUrl, searchChristianSongs]);

  const handleGo = () => {
    navigate(url);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGo();
    }
  };

  const handleBackToResults = () => {
    setLoadedUrl('');
    setIframeError(false);
    setImportError('');
    if (lastQuery) {
      setUrl(lastQuery);
    }
  };

  const handleImportUrl = async (targetUrl, fallbackTitle = '') => {
    if (!targetUrl) {
      setImportError('Please navigate to a song page first');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportData(null);

    try {
      const res = await axios.get(`${apiBase}/lyrics?url=${encodeURIComponent(targetUrl)}`);
      const stanzas = (res.data || []).map(s => String(s || '').trim()).filter(Boolean);

      if (stanzas.length === 0) {
        throw new Error('No lyrics found on this page. Try navigating to a page with Christian song lyrics.');
      }

      let suggestedTitle = fallbackTitle.trim();
      if (!suggestedTitle) {
        try {
          const parsed = new URL(targetUrl);
          const pathParts = parsed.pathname.split('/').filter(Boolean);
          const last = pathParts[pathParts.length - 1] || '';
          suggestedTitle = decodeURIComponent(last)
            .replace(/[-_]/g, ' ')
            .replace(/\.(html?|php|aspx?)$/i, '')
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
        } catch { /* ignore */ }
      }

      setImportData({ stanzas, url: targetUrl });
      setImportTitle(suggestedTitle);
    } catch (err) {
      setImportError(err.response?.data?.details || err.message || 'Failed to import song');
    } finally {
      setImporting(false);
    }
  };

  const handleImport = () => {
    handleImportUrl(loadedUrl || url);
  };

  const handleSaveImport = async () => {
    if (!importTitle.trim()) {
      setImportError('Please enter a song title');
      return;
    }
    if (!importData?.stanzas?.length) {
      setImportError('No lyrics to save');
      return;
    }

    setSaving(true);
    setImportError('');

    try {
      await onImportSong(importTitle.trim(), importData.stanzas, importData.url);
      setImportData(null);
      setImportTitle('');
    } catch (err) {
      setImportError(err.message || 'Failed to save song');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelImport = () => {
    setImportData(null);
    setImportTitle('');
    setImportError('');
  };

  return (
    <div className="browser-page">
      {/* URL / Christian Song Search Bar */}
      <div className="browser-url-bar">
        {loadedUrl && searchResults.length > 0 && (
          <button
            className="browser-back-results-btn"
            onClick={handleBackToResults}
            title="Back to search results"
            type="button"
          >
            <FaArrowLeft />
          </button>
        )}
        <input
          type="text"
          className="browser-url-input"
          placeholder="Search Christian songs or enter URL..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="browser-go-btn" onClick={handleGo} title="Search Christian Songs or Go" disabled={searching}>
          {searching ? <FaSpinner className="spin" /> : <FaSearch />}
        </button>
      </div>

      {/* Browser Content */}
      <div className="browser-frame-container">
        {loadedUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={proxySrc}
              className="browser-iframe"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              allow="autoplay; fullscreen"
              title="In-App Browser"
              onError={() => setIframeError(true)}
            />
            {iframeError && (
              <div className="browser-iframe-fallback">
                <FaGlobe size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
                <p>This site may not load in the embedded browser.</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  You can still import lyrics from the URL above using the Import Song button.
                </p>
              </div>
            )}
          </>
        ) : searching ? (
          <div className="browser-empty-state">
            <FaSpinner size={36} className="spin" style={{ color: 'var(--accent-gold)', marginBottom: 16 }} />
            <p style={{ fontWeight: 600, fontSize: '1rem' }}>Searching Christian Songs...</p>
            <p style={{ fontSize: '0.82rem', opacity: 0.65, marginTop: 4 }}>
              Checking christsquare, christiansongbook, tamilchristiansongs &amp; Christian lyrics
            </p>
          </div>
        ) : searchResults.length > 0 || searchError ? (
          <div className="browser-search-results">
            <div className="browser-results-header">
              <span>Christian Songs for &ldquo;{lastQuery}&rdquo;</span>
              <span className="browser-results-count">{searchResults.length} found</span>
            </div>

            {searchError && (
              <div className="browser-results-empty">{searchError}</div>
            )}

            <div className="browser-results-list">
              {searchResults.map((item, idx) => (
                <div
                  key={item.id || `${item.url}-${idx}`}
                  className="browser-result-card"
                  onClick={() => openUrl(item.url)}
                >
                  <div className="browser-result-main">
                    <div className="browser-result-title">
                      <FaMusic className="browser-result-icon" />
                      <span>{item.title}</span>
                    </div>
                    <div className="browser-result-meta">
                      <span className="browser-result-site">{getSiteLabel(item.url, item.site)}</span>
                      <span className="browser-result-url">{item.url}</span>
                    </div>
                  </div>
                  <div className="browser-result-actions">
                    <button
                      type="button"
                      className="browser-result-import-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImportUrl(item.url, item.title);
                      }}
                      disabled={importing}
                      title="Import lyrics directly"
                    >
                      <FaDownload />
                      <span>Import</span>
                    </button>
                    <button
                      type="button"
                      className="browser-result-open-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openUrl(item.url);
                      }}
                      title="Open page"
                    >
                      <FaExternalLinkAlt />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="browser-empty-state">
            <FaGlobe size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Browse Christian Songs</p>
            <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: 4 }}>
              Search Christian song lyrics or enter a Christian songbook URL
            </p>
            <div className="browser-quick-links">
              {isNativeAndroid && (
                <button
                  onClick={() => launchNativeBrowser('https://www.google.com/search?q=tamil+christian+song+lyrics')}
                  className="browser-quick-link"
                >
                  🌐 Open Chrome-Engine Browser
                </button>
              )}
              <button onClick={() => navigate('christiansongbook.org')} className="browser-quick-link">
                christiansongbook.org
              </button>
              <button onClick={() => navigate('christsquare.com')} className="browser-quick-link">
                christsquare.com
              </button>
              <button onClick={() => navigate('tamilchristiansongs.in')} className="browser-quick-link">
                tamilchristiansongs.in
              </button>
              <button onClick={() => navigate('Yesuve')} className="browser-quick-link">
                🔍 Search Tamil Christian
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import FAB */}
      {loadedUrl && (
        <button
          className="browser-import-fab"
          onClick={handleImport}
          disabled={importing}
          title="Import Song from this page"
        >
          {importing ? <FaSpinner className="spin" /> : <FaDownload />}
          <span>{importing ? 'Importing...' : 'Import Song'}</span>
        </button>
      )}

      {/* Import Error Toast */}
      {importError && !importData && (
        <div className="browser-import-error">
          <span>{importError}</span>
          <button onClick={() => setImportError('')}><FaTimes /></button>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {importData && (
        <div className="browser-import-modal-overlay" onClick={handleCancelImport}>
          <div className="browser-import-modal" onClick={e => e.stopPropagation()}>
            <h3>
              <FaDownload style={{ marginRight: 8 }} />
              Import Song
            </h3>

            <label className="browser-import-label">Song Title</label>
            <input
              type="text"
              className="browser-import-title-input"
              placeholder="Enter song title..."
              value={importTitle}
              onChange={e => setImportTitle(e.target.value)}
              autoFocus
            />

            <label className="browser-import-label">
              Lyrics Preview ({importData.stanzas.length} stanza{importData.stanzas.length !== 1 ? 's' : ''})
            </label>
            <div className="browser-import-preview">
              {importData.stanzas.map((stanza, i) => (
                <div key={i} className="browser-import-stanza">
                  <span className="browser-stanza-num">#{i + 1}</span>
                  <pre>{stanza}</pre>
                </div>
              ))}
            </div>

            {importError && (
              <div className="browser-import-error-inline">{importError}</div>
            )}

            <div className="browser-import-actions">
              <button className="btn-cancel" onClick={handleCancelImport} disabled={saving}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveImport} disabled={saving}>
                <FaSave style={{ marginRight: 6 }} />
                {saving ? 'Saving...' : 'Save to DB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
