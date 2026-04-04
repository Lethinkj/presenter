import { FaFont } from 'react-icons/fa';

export default function BiblePage({
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
  clearScreen
}) {
  return (
    <div className="bible-panel">
      {bibleLoading && <div className="loading">Loading Bible...</div>}
      {!bibleLoading && bibleError && <div className="bible-error">{bibleError}</div>}

      {!bibleLoading && !bibleError && selectedBibleBook && (
        <>
          <div className="bible-top-controls">
            <div className="bible-header-row">
              <button className="bible-book-title-btn" onClick={() => setShowBibleControls(v => !v)} type="button">
                {(selectedBibleBook.tamil || selectedBibleBook.english)} {`- ${bibleChapterNumber}`}
              </button>
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
  );
}
