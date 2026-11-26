import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  FaSearch,
  FaDownload,
  FaTimes,
  FaSave,
  FaSpinner,
  FaGlobe
} from 'react-icons/fa';

export default function BrowserPage({
  apiBase,
  onImportSong,
}) {
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
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

  const navigate = useCallback((input) => {
    const trimmed = (input || '').trim();
    if (!trimmed) return;

    let targetUrl;
    if (isUrl(trimmed)) {
      targetUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    } else {
      // Use Google search with igu=1 for iframe compatibility
      targetUrl = `https://www.google.com/search?igu=1&q=${encodeURIComponent(trimmed)}`;
    }

    setIframeError(false);
    setLoadedUrl(targetUrl);
    setUrl(targetUrl);
    setImportError('');
  }, []);

  const handleGo = () => {
    navigate(url);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGo();
    }
  };

  const handleImport = async () => {
    const targetUrl = loadedUrl || url;
    if (!targetUrl) {
      setImportError('Please navigate to a song page first');
      return;
    }

    // Don't try to import from Google search pages
    if (targetUrl.includes('google.com/search')) {
      setImportError('Navigate to a song lyrics page first, then tap Import');
      return;
    }

    setImporting(true);
    setImportError('');
    setImportData(null);

    try {
      const res = await axios.get(`${apiBase}/lyrics?url=${encodeURIComponent(targetUrl)}`);
      const stanzas = (res.data || []).map(s => String(s || '').trim()).filter(Boolean);

      if (stanzas.length === 0) {
        throw new Error('No lyrics found on this page. Try navigating to a page with song lyrics.');
      }

      // Try to extract a suggested title from the URL path
      let suggestedTitle = '';
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

      setImportData({ stanzas, url: targetUrl });
      setImportTitle(suggestedTitle);
    } catch (err) {
      setImportError(err.response?.data?.details || err.message || 'Failed to import song');
    } finally {
      setImporting(false);
    }
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
      const result = await onImportSong(importTitle.trim(), importData.stanzas, importData.url);
      setImportData(null);
      setImportTitle('');
      if (result?.offline) {
        alert(`Song saved offline as ${result.id}. It will sync when connection is available.`);
      } else {
        alert(`✅ "${importTitle.trim()}" imported and saved successfully!`);
      }
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
      {/* URL Bar */}
      <div className="browser-url-bar">
        <input
          type="text"
          className="browser-url-input"
          placeholder="Search or enter website URL..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="browser-go-btn" onClick={handleGo} title="Go">
          <FaSearch />
        </button>
      </div>

      {/* Browser Frame */}
      <div className="browser-frame-container">
        {loadedUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={loadedUrl}
              className="browser-iframe"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
              allow="autoplay; fullscreen"
              title="In-App Browser"
              onError={() => setIframeError(true)}
            />
            {iframeError && (
              <div className="browser-iframe-fallback">
                <FaGlobe size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
                <p>This site may not load in the embedded browser.</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  You can still import lyrics from the URL above using the Import button.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="browser-empty-state">
            <FaGlobe size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Browse for Songs</p>
            <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: 4 }}>
              Search or enter a URL to find song lyrics
            </p>
            <div className="browser-quick-links">
              <button onClick={() => navigate('christsquare.com')} className="browser-quick-link">
                christsquare.com
              </button>
              <button onClick={() => navigate('christiansongbook.org')} className="browser-quick-link">
                christiansongbook.org
              </button>
              <button onClick={() => navigate('tamil christian song lyrics')} className="browser-quick-link">
                🔍 Tamil Songs
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
