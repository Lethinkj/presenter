import { FaArrowLeft, FaEdit, FaFont, FaSave, FaTimes } from 'react-icons/fa';

export default function SongPresentationPage({
  displayFont,
  selectedSong,
  activeStanza,
  isEditingSong,
  editableStanzas,
  setSelectedSong,
  setActiveStanza,
  setIsEditingSong,
  setEditTitle,
  setEditableStanzas,
  editTitle,
  addEditableStanza,
  saveEditedSongToDb,
  savingEdits,
  FONTS,
  showFontPicker,
  setShowFontPicker,
  setDisplayFont,
  displayFontSize,
  setDisplayFontSize,
  handleSaveWebResultToDb,
  savingWebSongs,
  presentLyrics,
  updateEditableStanza,
  removeEditableStanza,
  clearScreen
}) {
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
