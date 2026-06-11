import { useState, useRef } from 'react';
import { FaArrowLeft, FaCog, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { LuMonitorOff } from 'react-icons/lu';

export default function SongPresentationPage({
  displayFont,
  selectedSong,
  activeStanza,
  isEditingSong,
  editableStanzas,
  setActiveStanza,
  setIsEditingSong,
  setEditTitle,
  setEditableStanzas,
  editTitle,
  addEditableStanza,
  saveEditedSongToDb,
  savingEdits,
  FONTS,
  setDisplayFont,
  displayFontSize,
  setDisplayFontSize,
  presentLyrics,
  updateEditableStanza,
  removeEditableStanza,
  clearScreen,
  onBack,
  openSettingsPage,
  songQueue,
  onQueueNavigate,
}) {
  const [showPresSettings, setShowPresSettings] = useState(false);
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 60) return;
    const { results, index } = songQueue || {};
    if (!results || results.length === 0) return;
    const nextIndex = dx < 0 ? index + 1 : index - 1;
    if (nextIndex < 0 || nextIndex >= results.length) return;
    onQueueNavigate(results[nextIndex], nextIndex);
  };

  const safeSelectedSong = selectedSong || {};
  const songStanzas = Array.isArray(safeSelectedSong.stanzas) ? safeSelectedSong.stanzas : [];
  const editorStanzas = Array.isArray(editableStanzas) ? editableStanzas : [];
  const displayStanzas = isEditingSong ? editorStanzas : songStanzas;

  return (
    <div className="app-container presentation-view" style={{ fontFamily: displayFont }}>
      <div className="app-header presentation-header">
        <button className="back-btn" onClick={onBack}>
          <FaArrowLeft />
        </button>
        <h1 style={{ flex: 1, textAlign: 'left', fontSize: '1.1rem', margin: 0 }}>{safeSelectedSong.title || 'Song'}</h1>
        <button className={`icon-btn${isEditingSong ? ' active' : ''}`} title="Edit Song" onClick={() => setIsEditingSong(v => !v)}>
          <FaEdit />
        </button>
        <button className="icon-btn" title="Clear TV Screen" onClick={clearScreen} style={{ color: 'var(--error-color)' }}>
          <LuMonitorOff />
        </button>
        <button className="icon-btn" title="Settings" onClick={() => setShowPresSettings(true)}>
          <FaCog />
        </button>
      </div>

      {/* Non-scrolling panels */}
      {isEditingSong && (
        <div className="presentation-panels" style={{ paddingTop: 0 }}>
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
                  setEditTitle(safeSelectedSong.title || '');
                  setEditableStanzas([...songStanzas]);
                }}>
                  <FaTimes style={{ marginRight: 6 }} /> Cancel
                </button>
                <button className="btn-save" onClick={saveEditedSongToDb} disabled={savingEdits}>
                  <FaSave style={{ marginRight: 6 }} /> {savingEdits ? 'Saving...' : 'Save To DB'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable stanza list */}
      <div className="presentation-scroll" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {displayStanzas.length === 0 && (
          <div className="loading">No lyrics yet. Go back and reopen the song.</div>
        )}

        {displayStanzas.map((stanza, i) => (
          <div
            key={i}
            className={`stanza-card ${!isEditingSong ? 'presentable' : ''} ${activeStanza === i ? 'active' : ''}`}
            onClick={!isEditingSong ? () => presentLyrics(stanza, i) : undefined}
            onKeyDown={!isEditingSong ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); presentLyrics(stanza, i); }
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
              <>
                <div className="stanza-body">
                  <span className="stanza-number">{i + 1}</span>
                  <pre className="stanza-text" style={{ fontFamily: displayFont }}>{stanza}</pre>
                </div>
                {activeStanza === i && <div className="presented-indicator">● On Screen</div>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Settings bottom sheet */}
      {showPresSettings && (
        <div className="bible-backdrop" onClick={() => setShowPresSettings(false)}>
          <div className="bible-bottom-sheet settings-drawer" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Presentation Settings</div>

            <div className="drawer-section">
              <div className="drawer-label">Font style</div>
              <div className="font-chip-row">
                {(Array.isArray(FONTS) ? FONTS : []).map(f => (
                  <button
                    key={f.value}
                    className={`font-chip${displayFont === f.value ? ' active' : ''}`}
                    style={{ fontFamily: f.value }}
                    onClick={() => setDisplayFont(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="drawer-section">
              <div className="drawer-label">TV text size</div>
              <div className="size-row">
                <button
                  className="size-step-btn"
                  onClick={() => setDisplayFontSize(prev => prev === 'auto' ? 8 : Math.max(2, prev - 1))}
                >−</button>
                <span className="size-value">{displayFontSize === 'auto' ? 'Auto fit' : `${displayFontSize}vw`}</span>
                <button
                  className="size-step-btn"
                  onClick={() => setDisplayFontSize(prev => prev === 'auto' ? 8 : Math.min(20, prev + 1))}
                >+</button>
                <button
                  className={`size-auto-btn${displayFontSize === 'auto' ? ' active' : ''}`}
                  onClick={() => setDisplayFontSize('auto')}
                >Auto</button>
              </div>
            </div>

            <div className="drawer-section">
              <div className="drawer-toggle-row">
                <div>
                  <div className="drawer-label">Edit lyrics</div>
                  <div className="drawer-sublabel">Modify stanzas and save to database</div>
                </div>
                <button
                  className={`toggle-switch${isEditingSong ? ' on' : ''}`}
                  onClick={() => {
                    setIsEditingSong(v => !v);
                    setShowPresSettings(false);
                  }}
                  role="switch"
                  aria-checked={isEditingSong}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>
            </div>

            <button
              className="drawer-clear-btn"
              onClick={() => { clearScreen(); setShowPresSettings(false); }}
            >
              Clear Screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
