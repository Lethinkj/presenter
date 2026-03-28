import {
  FaArrowLeft,
  FaBook,
  FaDatabase,
  FaGlobe,
  FaHistory,
  FaImage,
  FaPlus,
  FaRegStar,
  FaSave,
  FaSearch,
  FaStar,
  FaWifi,
  FaCog
} from 'react-icons/fa';
import BiblePage from './BiblePage';
import ImagePage from './ImagePage';
import AddSongModal from './AddSongModal';
import ProfileSetupModal from './ProfileSetupModal';

export default function MainPage({
  userName,
  deviceCode,
  isOnline,
  showHomeCards,
  startingOfflinePresent,
  startPresenterFromHome,
  homePresentExpanded,
  stopPresenterFromHome,
  onlineTvUrl,
  homeOfflineLink,
  openHomeCard,
  activeTab,
  setShowHomeCards,
  imageInputRef,
  imageRemoveMode,
  setImageRemoveMode,
  clearScreen,
  uploadedImages,
  activeImageId,
  presentImage,
  removeUploadedImage,
  handleImageUpload,
  displayImageSize,
  setDisplayImageSize,
  bibleLoading,
  bibleError,
  selectedBibleBook,
  showBibleControls,
  setShowBibleControls,
  bibleChapterNumber,
  showFontPicker,
  setShowFontPicker,
  bibleBooks,
  openBibleBook,
  goToBibleChapter,
  activeBibleVerseNumber,
  handleBibleVerseSelect,
  bibleVerses,
  bibleVerseListRef,
  handleBibleSwipeStart,
  handleBibleSwipeEnd,
  selectedBibleChapterIndex,
  activeBibleVerseKey,
  presentBibleVerse,
  FONTS,
  displayFont,
  setDisplayFont,
  displayFontSize,
  setDisplayFontSize,
  tabSearch,
  setTabSearch,
  handleSearch,
  loading,
  openAddModal,
  selectedLetter,
  setSelectedLetter,
  setResults,
  handleLetterFilter,
  results,
  favorites,
  offlineCache,
  handleSongSelect,
  handleSaveWebResultToDb,
  savingWebSongs,
  toggleFavorite,
  showAddModal,
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
  showProfileSetup,
  profileNameInput,
  setProfileNameInput,
  completeProfileSetup
}) {
  const homeCards = [
    { key: 'db', label: 'DB Search', icon: <FaDatabase /> },
    { key: 'web', label: 'Web Search', icon: <FaGlobe /> },
    { key: 'bible', label: 'Bible', icon: <FaBook /> },
    { key: 'favorites', label: 'Favorites', icon: <FaStar /> },
    { key: 'recents', label: 'Recents', icon: <FaHistory /> },
    { key: 'images', label: 'Images', icon: <FaImage /> },
    { key: 'settings', label: 'Settings', icon: <FaCog /> }
  ];

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="brand-header">
          <img src="/logo.png" alt="WorshipCast logo" className="brand-logo" />
          <h1>WorshipCast</h1>
        </div>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
          User: {userName || 'Anonymous'} | Device: {deviceCode}
        </div>
        {!isOnline && (
          <span className="offline-chip"><FaWifi style={{ marginRight: 4 }} />Offline</span>
        )}
      </div>

      {showHomeCards ? (
        <div className="content-area">
          <div className="home-present-panel">
            <button
              className="btn-save"
              onClick={startPresenterFromHome}
              disabled={startingOfflinePresent}
            >
              {startingOfflinePresent ? 'Starting...' : 'Start Presenter'}
            </button>
            {homePresentExpanded && (
              <>
                <button className="btn-save" onClick={stopPresenterFromHome}>
                  Stop Presenter
                </button>
                <div className="home-present-link">Online Present: {onlineTvUrl}</div>
                <div className="home-present-link">Offline Present: {homeOfflineLink || 'Not ready yet'}</div>
              </>
            )}
          </div>
          <div className="home-cards-grid">
            {homeCards.map(card => (
              <button
                key={card.key}
                className="home-card"
                onClick={() => openHomeCard(card.key)}
              >
                <span className="home-card-icon">{card.icon}</span>
                <span className="home-card-label">{card.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="content-area">
          <div className="section-topbar">
            <button className="back-btn" onClick={() => setShowHomeCards(true)}>
              <FaArrowLeft />
            </button>
            <div className="section-title">{homeCards.find(c => c.key === activeTab)?.label || 'Section'}</div>
          </div>
          {activeTab === 'images' && (
            <ImagePage
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
            />
          )}

          {activeTab === 'bible' && (
            <BiblePage
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
              FONTS={FONTS}
              displayFont={displayFont}
              setDisplayFont={setDisplayFont}
              displayFontSize={displayFontSize}
              setDisplayFontSize={setDisplayFontSize}
              clearScreen={clearScreen}
            />
          )}

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
      )}

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
        />
      )}

      {showProfileSetup && (
        <ProfileSetupModal
          profileNameInput={profileNameInput}
          setProfileNameInput={setProfileNameInput}
          completeProfileSetup={completeProfileSetup}
          deviceCode={deviceCode}
        />
      )}
    </div>
  );
}
