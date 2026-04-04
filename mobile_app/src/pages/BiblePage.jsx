import { useEffect, useMemo, useRef, useState } from 'react';
import { FaFont, FaSearch } from 'react-icons/fa';

const normalizeSearchText = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const levenshteinDistance = (left, right) => {
  const a = String(left || '');
  const b = String(right || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = Array.from({ length: a.length + 1 }, (_, rowIndex) => [rowIndex]);
  for (let columnIndex = 1; columnIndex <= b.length; columnIndex += 1) {
    rows[0][columnIndex] = columnIndex;
  }

  for (let rowIndex = 1; rowIndex <= a.length; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= b.length; columnIndex += 1) {
      const cost = a[rowIndex - 1] === b[columnIndex - 1] ? 0 : 1;
      rows[rowIndex][columnIndex] = Math.min(
        rows[rowIndex - 1][columnIndex] + 1,
        rows[rowIndex][columnIndex - 1] + 1,
        rows[rowIndex - 1][columnIndex - 1] + cost
      );
    }
  }

  return rows[a.length][b.length];
};

const scoreBookMatch = (query, bookName) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedBook = normalizeSearchText(bookName);
  if (!normalizedQuery || !normalizedBook) return 0;

  if (normalizedQuery === normalizedBook) return 100;

  const querySingular = normalizedQuery.endsWith('s') ? normalizedQuery.slice(0, -1) : normalizedQuery;
  const bookSingular = normalizedBook.endsWith('s') ? normalizedBook.slice(0, -1) : normalizedBook;
  if (normalizedQuery === bookSingular || querySingular === normalizedBook || querySingular === bookSingular) {
    return 98;
  }

  if (normalizedBook.startsWith(normalizedQuery)) return 92;
  if (normalizedBook.includes(normalizedQuery)) return 84;

  const distance = levenshteinDistance(normalizedQuery, normalizedBook);
  const similarity = 1 - (distance / Math.max(normalizedQuery.length, normalizedBook.length));
  if (distance <= 2) return Math.round(70 + (similarity * 20));
  return 0;
};

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
  const quickSelectInputRef = useRef(null);
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);
  const [quickSelectPhase, setQuickSelectPhase] = useState('book');
  const [quickSelectValue, setQuickSelectValue] = useState('');
  const [quickSelectMessage, setQuickSelectMessage] = useState('');

  const bookSuggestions = useMemo(() => {
    if (quickSelectPhase !== 'book') return [];
    const query = quickSelectValue.trim();
    if (!query) return [];

    return (Array.isArray(bibleBooks) ? bibleBooks : [])
      .map(book => ({
        book,
        score: scoreBookMatch(query, book.english)
      }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score || left.book.english.localeCompare(right.book.english))
      .slice(0, 5);
  }, [bibleBooks, quickSelectPhase, quickSelectValue]);

  const bestBookSuggestion = bookSuggestions[0] || null;

  useEffect(() => {
    if (!quickSelectOpen) return;
    const frame = requestAnimationFrame(() => {
      quickSelectInputRef.current?.focus?.();
      quickSelectInputRef.current?.select?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [quickSelectOpen, quickSelectPhase]);

  const openQuickSelect = () => {
    setQuickSelectOpen(true);
    setQuickSelectPhase('book');
    setQuickSelectValue('');
    setQuickSelectMessage('Type a book name, then press Enter.');
  };

  const closeQuickSelect = () => {
    setQuickSelectOpen(false);
    setQuickSelectPhase('book');
    setQuickSelectValue('');
    setQuickSelectMessage('');
  };

  const confirmQuickSelect = async () => {
    if (quickSelectPhase === 'book') {
      const chosenBook = bestBookSuggestion?.book;
      if (!chosenBook) {
        setQuickSelectMessage('No matching book found.');
        return;
      }

      await openBibleBook(chosenBook);
      setQuickSelectPhase('chapter');
      setQuickSelectValue('');
      setQuickSelectMessage('Type chapter number, then press Enter.');
      return;
    }

    if (quickSelectPhase === 'chapter') {
      const chapterNo = Number(quickSelectValue.trim());
      const totalChapters = Array.isArray(selectedBibleBook?.chapters) ? selectedBibleBook.chapters.length : 0;
      if (!Number.isInteger(chapterNo) || chapterNo < 1 || (totalChapters > 0 && chapterNo > totalChapters)) {
        setQuickSelectMessage('Enter a valid chapter number.');
        return;
      }

      goToBibleChapter(chapterNo - 1);
      setQuickSelectPhase('verse');
      setQuickSelectValue('');
      setQuickSelectMessage('Type verse number, then press Enter.');
      return;
    }

    if (quickSelectPhase === 'verse') {
      const verseNo = Number(quickSelectValue.trim());
      if (!Number.isInteger(verseNo) || verseNo < 1) {
        setQuickSelectMessage('Enter a valid verse number.');
        return;
      }

      handleBibleVerseSelect(String(verseNo));
      closeQuickSelect();
    }
  };

  const handleQuickSelectChange = (event) => {
    const nextValue = event.target.value;
    setQuickSelectValue(nextValue);
    setQuickSelectMessage('');

    if (quickSelectPhase === 'book') {
      const normalized = normalizeSearchText(nextValue);
      const exactMatch = (Array.isArray(bibleBooks) ? bibleBooks : []).find(book => normalizeSearchText(book.english) === normalized);
      if (exactMatch && normalized.length > 0) {
        void (async () => {
          await openBibleBook(exactMatch);
          setQuickSelectPhase('chapter');
          setQuickSelectValue('');
          setQuickSelectMessage('Type chapter number, then press Enter.');
        })();
      }
    }
  };

  const handleQuickSelectKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void confirmQuickSelect();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeQuickSelect();
      return;
    }

    if (event.key === 'Backspace' && quickSelectValue === '' && quickSelectPhase !== 'book') {
      event.preventDefault();
      setQuickSelectPhase(prev => (prev === 'verse' ? 'chapter' : 'book'));
      setQuickSelectValue('');
      setQuickSelectMessage('');
    }
  };

  const handleSuggestionClick = (book) => {
    void (async () => {
      await openBibleBook(book);
      setQuickSelectPhase('chapter');
      setQuickSelectValue('');
      setQuickSelectMessage('Type chapter number, then press Enter.');
    })();
  };

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
              <button className={`bible-quick-select-btn ${quickSelectOpen ? 'active' : ''}`} onClick={quickSelectOpen ? closeQuickSelect : openQuickSelect} type="button" title="Quick select Bible book, chapter, and verse">
                <FaSearch />
              </button>
            </div>

            {quickSelectOpen && (
              <div className="bible-quick-select-panel">
                <input
                  ref={quickSelectInputRef}
                  className="bible-quick-select-input"
                  type={quickSelectPhase === 'book' ? 'text' : 'number'}
                  inputMode={quickSelectPhase === 'book' ? 'text' : 'numeric'}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={
                    quickSelectPhase === 'book'
                      ? 'Type book name, example Luke'
                      : quickSelectPhase === 'chapter'
                        ? 'Type chapter number'
                        : 'Type verse number'
                  }
                  value={quickSelectValue}
                  onChange={handleQuickSelectChange}
                  onKeyDown={handleQuickSelectKeyDown}
                />

                <div className="bible-quick-select-meta">
                  <span>
                    {quickSelectPhase === 'book'
                      ? 'Book'
                      : quickSelectPhase === 'chapter'
                        ? 'Chapter'
                        : 'Verse'}
                  </span>
                  <span>{quickSelectMessage || 'Press Enter to confirm.'}</span>
                </div>

                {quickSelectPhase === 'book' && bestBookSuggestion && (
                  <button className="bible-quick-select-suggestion" type="button" onClick={() => handleSuggestionClick(bestBookSuggestion.book)}>
                    Suggested: {bestBookSuggestion.book.english}
                  </button>
                )}

                {quickSelectPhase === 'book' && bookSuggestions.length > 1 && (
                  <div className="bible-quick-select-chips">
                    {bookSuggestions.slice(0, 3).map(({ book }) => (
                      <button
                        key={book.id}
                        type="button"
                        className="bible-quick-select-chip"
                        onClick={() => handleSuggestionClick(book)}
                      >
                        {book.english}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
