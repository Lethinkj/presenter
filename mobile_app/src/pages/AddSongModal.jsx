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
  addSaving
}) {
  return (
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
              placeholder={'Verse 1 line 1\nVerse 1 line 2\n\nVerse 2 line 1\nVerse 2 line 2'}
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
  );
}
