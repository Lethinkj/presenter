import { useState, useEffect } from 'react';
import { FaPen, FaCut, FaTv, FaPencilAlt, FaSave, FaTimes } from 'react-icons/fa';

const autoResizeTextarea = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

export default function AddSongModal({
  setShowAddModal,
  addTitle,
  setAddTitle,
  addMode,
  setAddMode,
  manualStanzas,
  updateManualStanza,
  removeManualStanza,
  addManualStanza,
  autoText,
  setAutoText,
  addError,
  handleSaveSong,
  addSaving,
  onOpenTransliterate,
}) {
  const [preview, setPreview] = useState(false);

  // Reset preview when switching modes
  useEffect(() => { setPreview(false); }, [addMode]);

  // If parent sets addMode to auto externally (prefill), ensure we're in auto
  useEffect(() => {
    if (addMode === 'auto') setPreview(false);
  }, [addMode]);

  const autoStanzas = autoText
    ? autoText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="modal-overlay">
      <div className="modal">

        <div className="modal-scroll">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 4,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <FaTimes size={18} />
              </button>
              <h2 className="modal-title" style={{ margin: 0 }}>Add Song</h2>
            </div>
            {onOpenTransliterate && (
              <button
                type="button"
                onClick={() => { setShowAddModal(false); onOpenTransliterate(); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent-color)',
                  fontSize: '0.82rem', cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline',
                }}
              >
                Convert Lyrics ↗
              </button>
            )}
          </div>

          {/* Song title */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              id="add-song-title"
              className="modal-input"
              style={{ marginBottom: 0 }}
              placeholder="Song Title"
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
            />
            {!!addTitle && (
              <button className="text-clear-btn inline-clear-btn" onClick={() => setAddTitle('')}>Clear</button>
            )}
          </div>

          {/* Mode toggle */}
          <div className="mode-toggle" style={{ marginBottom: 14 }}>
            <button className={`mode-btn ${addMode === 'manual' ? 'active' : ''}`} onClick={() => setAddMode('manual')}>
              <FaPen size={11} /> Manual
            </button>
            <button className={`mode-btn ${addMode === 'auto' ? 'active' : ''}`} onClick={() => setAddMode('auto')}>
              <FaCut size={11} /> Auto Split
            </button>
          </div>

          {/* Manual mode */}
          {addMode === 'manual' && (
            <div className="stanza-editor">
              {manualStanzas.map((stanza, i) => (
                <div key={i} className="stanza-row">
                  <textarea
                    id={`manual-stanza-${i}`}
                    className="stanza-textarea"
                    placeholder={`Stanza ${i + 1}...`}
                    value={stanza}
                    onChange={e => { updateManualStanza(i, e.target.value); autoResizeTextarea(e.target); }}
                    ref={el => el && autoResizeTextarea(el)}
                  />
                  {!!stanza && <button className="text-clear-btn" onClick={() => updateManualStanza(i, '')}>Clear</button>}
                  {manualStanzas.length > 1 && (
                    <button className="remove-stanza" onClick={() => removeManualStanza(i)}>✕</button>
                  )}
                </div>
              ))}
              <button className="add-stanza-btn" onClick={addManualStanza}>+ Add Stanza</button>
            </div>
          )}

          {/* Auto Split mode */}
          {addMode === 'auto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                Paste full lyrics — blank lines will automatically become stanza splits.
              </p>

              {/* Info row: Clear · stanza count · preview toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!!autoText && (
                  <button
                    className="text-clear-btn"
                    style={{ position: 'static', margin: 0, color: 'var(--error-color)', borderColor: 'var(--error-color)' }}
                    onClick={() => { setAutoText(''); setPreview(false); }}
                  >
                    Clear
                  </button>
                )}
                {autoStanzas.length > 0 && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flex: 1 }}>
                    {autoStanzas.length} stanza{autoStanzas.length !== 1 ? 's' : ''} detected
                  </span>
                )}
                <button
                  onClick={() => setPreview(p => !p)}
                  style={{
                    marginLeft: 'auto',
                    background: preview ? 'var(--accent-color)' : 'var(--bg-card)',
                    color: preview ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 7, padding: '4px 10px',
                    fontSize: '0.75rem', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {preview ? <><FaPencilAlt size={11} /> Edit</> : <><FaTv size={11} /> Preview</>}
                </button>
              </div>

              {/* Textarea or preview */}
              {!preview ? (
                <textarea
                  id="auto-split-lyrics"
                  className="stanza-textarea"
                  style={{ width: '100%', flex: 1, minHeight: 100, overflowY: 'auto', resize: 'none' }}
                  placeholder={'Verse 1 line 1\nVerse 1 line 2\n\nVerse 2 line 1\nVerse 2 line 2'}
                  value={autoText}
                  onChange={e => setAutoText(e.target.value)}
                />
              ) : (
                <div style={{ flex: 1, minHeight: 100, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  {autoStanzas.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.88rem', padding: 16 }}>
                      No stanzas yet — add some lyrics first.
                    </p>
                  ) : (
                    autoStanzas.map((stanza, i) => (
                      <div key={i} className="stanza-card">
                        <div className="stanza-body">
                          <span className="stanza-number">{i + 1}</span>
                          <pre className="stanza-text">{stanza}</pre>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {addError && <p className="add-error">{addError}</p>}
        </div>

        {/* Pinned footer */}
        <div className="modal-footer">
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn-save" onClick={handleSaveSong} disabled={addSaving}>
              {addSaving ? 'Saving...' : <><FaSave size={13} /> Save Song</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
