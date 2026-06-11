import {
  FaArrowLeft,
  FaBook,
  FaDatabase,
  FaGlobe,
  FaHistory,
  FaImage,
  FaStickyNote,
  FaWifi,
  FaCog,
  FaStop,
  FaStar,
} from 'react-icons/fa';
import BiblePage from './BiblePage';
import ImagePage from './ImagePage';
import NotesPage from './NotesPage';
import ProfileSetupModal from './ProfileSetupModal';
import SongSearchPage from './SongSearchPage';

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
  bibleRefOnlyMode,
  setBibleRefOnlyMode,
  FONTS,
  displayFont,
  setDisplayFont,
  displayFontSize,
  setDisplayFontSize,
  apiBase,
  sqliteEnabled,
  offlineCache,
  setOfflineCache,
  upsertOfflineSongSqlite,
  persistLocallyAndQueue,
  setStorageState,
  writeLocalStorage,
  onSongSelect,
  registerLoadSong,
  showProfileSetup,
  profileNameInput,
  setProfileNameInput,
  completeProfileSetup,
  openSettingsPage,
  registerBibleBackHandler,
}) {
  const homeCards = [
    { key: 'db', label: 'DB Search', icon: <FaDatabase /> },
    { key: 'web', label: 'Web Search', icon: <FaGlobe /> },
    { key: 'bible', label: 'Bible', icon: <FaBook /> },
    { key: 'favorites', label: 'Favorites', icon: <FaStar /> },
    { key: 'recents', label: 'Recents', icon: <FaHistory /> },
    { key: 'images', label: 'Images', icon: <FaImage /> },
    { key: 'notes', label: 'Notes', icon: <FaStickyNote /> },
    { key: 'settings', label: 'Settings', icon: <FaCog /> }
  ];

  return (
    <div className={`app-container ${showHomeCards ? 'has-header' : 'no-header'}`}>
      {showHomeCards && (
        <div className="app-header home-header">
          <div className="home-header-row">
            <div className="brand-header">
              <img src="/logo.png" alt="WorshipCast logo" className="brand-logo" />
              <h1>WorshipCast</h1>
            </div>
            <button
              className="settings-icon-btn"
              onClick={() => openHomeCard('settings')}
              title="Settings"
              type="button"
            >
              <FaCog />
            </button>
          </div>
          <div className="home-welcome">
            Welcome, {userName || 'Anonymous'} | Device: {deviceCode}
          </div>
          {!isOnline && (
            <span className="offline-chip"><FaWifi style={{ marginRight: 4 }} />Offline</span>
          )}
        </div>
      )}

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
        <div className={`content-area ${activeTab === 'bible' ? 'bible-content-area' : ''} ${activeTab !== 'bible' && activeTab !== 'images' && activeTab !== 'notes' ? 'song-content-area' : ''}`}>
          <div className="section-topbar">
            <div className="section-back-title">
              <button className="back-btn" onClick={() => setShowHomeCards(true)}>
                <FaArrowLeft />
              </button>
              <div className="section-title">{homeCards.find(c => c.key === activeTab)?.label || 'Section'}</div>
            </div>
            <div className="section-actions">
              {activeTab === 'bible' && !!activeBibleVerseKey && (
                <button
                  className="settings-icon-btn top-settings-btn"
                  onClick={clearScreen}
                  title="Clear screen"
                  type="button"
                  style={{ color: 'var(--error-color)', background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.35)',borderRadius: 50 }}
                >
                  <FaStop />
                </button>
              )}
              <button
                className="settings-icon-btn top-settings-btn"
                onClick={openSettingsPage}
                title="Settings"
                type="button"
              >
                <FaCog />
              </button>
            </div>
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

          {activeTab === 'notes' && <NotesPage />}

          {activeTab === 'bible' && (
            <BiblePage
              bibleLoading={bibleLoading}
              bibleError={bibleError}
              selectedBibleBook={selectedBibleBook}
              bibleChapterNumber={bibleChapterNumber}
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
              bibleRefOnlyMode={bibleRefOnlyMode}
              setBibleRefOnlyMode={setBibleRefOnlyMode}
              registerBibleBackHandler={registerBibleBackHandler}
            />
          )}

          {activeTab !== 'images' && activeTab !== 'bible' && activeTab !== 'notes' && (
            <SongSearchPage
              activeTab={activeTab}
              apiBase={apiBase}
              sqliteEnabled={sqliteEnabled}
              offlineCache={offlineCache}
              setOfflineCache={setOfflineCache}
              upsertOfflineSongSqlite={upsertOfflineSongSqlite}
              persistLocallyAndQueue={persistLocallyAndQueue}
              setStorageState={setStorageState}
              writeLocalStorage={writeLocalStorage}
              onSongSelect={onSongSelect}
              openSettingsPage={openSettingsPage}
              setShowHomeCards={setShowHomeCards}
              registerLoadSong={registerLoadSong}
            />
          )}
        </div>
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
