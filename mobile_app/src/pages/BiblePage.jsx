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

const ONE_CHAPTER_BOOKS = new Set([
  'obadiah',
  'philemon',
  '2john',
  '3john',
  'jude'
]);

const isSingleChapterBook = (bookName) => ONE_CHAPTER_BOOKS.has(normalizeSearchText(bookName));

const parseQuickSelectInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return { raw: '', bookText: '', numbers: [], chapter: '', verse: '', hasDigits: false };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  const trailingNumbers = [];

  while (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1])) {
    trailingNumbers.unshift(tokens.pop());
  }

  const bookText = tokens.join(' ').trim();
  const chapter = trailingNumbers.length > 0 ? trailingNumbers[trailingNumbers.length - 2] || trailingNumbers[0] : '';
  const verse = trailingNumbers.length > 1 ? trailingNumbers[trailingNumbers.length - 1] : '';

  return {
    raw,
    bookText,
    numbers: trailingNumbers,
    chapter,
    verse,
    hasDigits: trailingNumbers.length > 0
  };
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

  const parsedQuickSelect = useMemo(() => parseQuickSelectInput(quickSelectValue), [quickSelectValue]);

  const bookSuggestions = useMemo(() => {
    if (quickSelectPhase !== 'book') return [];
    const query = parsedQuickSelect.bookText || quickSelectValue.trim();
    if (!query) return [];

    return (Array.isArray(bibleBooks) ? bibleBooks : [])
      .map(book => ({
        book,
        score: scoreBookMatch(query, book.english)
      }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score || left.book.english.localeCompare(right.book.english))
      .slice(0, 5);
  }, [bibleBooks, parsedQuickSelect.bookText, quickSelectPhase, quickSelectValue]);

  const bestBookSuggestion = bookSuggestions[0] || null;
  const previewBook = bestBookSuggestion?.book || null;
  const previewReference = previewBook
    ? (() => {
      const singleChapter = isSingleChapterBook(previewBook.english);
      if (singleChapter && parsedQuickSelect.numbers.length > 0) {
        const verseNo = parsedQuickSelect.verse || parsedQuickSelect.chapter || parsedQuickSelect.numbers[0];
        return `${previewBook.english} 1:${verseNo}`;
      }

      return `${previewBook.english}${parsedQuickSelect.chapter ? ` ${parsedQuickSelect.chapter}${parsedQuickSelect.verse ? `:${parsedQuickSelect.verse}` : ''}` : ''}`;
    })()
    : '';

  useEffect(() => {
    if (!quickSelectOpen) return;
    const frame = requestAnimationFrame(() => {
      quickSelectInputRef.current?.focus?.();
      quickSelectInputRef.current?.select?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [quickSelectOpen, quickSelectPhase]);

  useEffect(() => {
    if (!activeBibleVerseKey) return;

    const frame = requestAnimationFrame(() => {
      const container = bibleVerseListRef.current;
      if (!container) return;

      const target = container.querySelector(`[data-verse-key="${activeBibleVerseKey}"]`);
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [activeBibleVerseKey, bibleVerseListRef, selectedBibleChapterIndex]);

  const openQuickSelect = () => {
    setQuickSelectOpen(true);
    setQuickSelectPhase('book');
    setQuickSelectValue('');
    setQuickSelectMessage('Type a book name or shorthand like "1 chr 12 3".');
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

      if (parsedQuickSelect.numbers.length > 0) {
        const singleChapter = isSingleChapterBook(chosenBook.english);
        const chapterNumber = singleChapter ? 1 : parsedQuickSelect.chapter;
        const verseNumber = singleChapter
          ? (parsedQuickSelect.verse || parsedQuickSelect.chapter || parsedQuickSelect.numbers[0])
          : (parsedQuickSelect.verse || '');

        await openBibleBook(chosenBook, {
          chapterNumber,
          verseNumber
        });
        closeQuickSelect();
        return;
      }

      const loadedBook = await openBibleBook(chosenBook);
      if (Array.isArray(loadedBook?.chapters) && loadedBook.chapters.length === 1) {
        setQuickSelectPhase('verse');
        setQuickSelectValue('');
        setQuickSelectMessage('Single-chapter book. Type verse number, then press Enter.');
      } else {
        setQuickSelectPhase('chapter');
        setQuickSelectValue('');
        setQuickSelectMessage('Type chapter number, then press Enter.');
      }
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
    const nextParsed = parseQuickSelectInput(nextValue);
    setQuickSelectValue(nextValue);
    setQuickSelectMessage('');

    if (quickSelectPhase === 'book') {
      const normalized = normalizeSearchText(nextParsed.bookText || nextValue);
      const exactMatch = (Array.isArray(bibleBooks) ? bibleBooks : []).find(book => normalizeSearchText(book.english) === normalized);
      if (exactMatch && normalized.length > 0) {
        void (async () => {
          const loadedBook = await openBibleBook(exactMatch);
          if (Array.isArray(loadedBook?.chapters) && loadedBook.chapters.length === 1) {
            setQuickSelectPhase('verse');
            setQuickSelectValue('');
            setQuickSelectMessage('Single-chapter book. Type verse number, then press Enter.');
          } else {
            setQuickSelectPhase('chapter');
            setQuickSelectValue('');
            setQuickSelectMessage('Type chapter number, then press Enter.');
          }
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
      if (parsedQuickSelect.numbers.length > 0) {
        const singleChapter = isSingleChapterBook(book.english);
        await openBibleBook(book, {
          chapterNumber: singleChapter ? 1 : parsedQuickSelect.chapter,
          verseNumber: singleChapter
            ? (parsedQuickSelect.verse || parsedQuickSelect.chapter || parsedQuickSelect.numbers[0])
            : (parsedQuickSelect.verse || '')
        });
        closeQuickSelect();
        return;
      }

      const loadedBook = await openBibleBook(book);
      if (Array.isArray(loadedBook?.chapters) && loadedBook.chapters.length === 1) {
        setQuickSelectPhase('verse');
        setQuickSelectValue('');
        setQuickSelectMessage('Single-chapter book. Type verse number, then press Enter.');
      } else {
        setQuickSelectPhase('chapter');
        setQuickSelectValue('');
        setQuickSelectMessage('Type chapter number, then press Enter.');
      }
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

                {quickSelectPhase === 'verse' && selectedBibleBook && isSingleChapterBook(selectedBibleBook.english) && (
                  <div className="bible-quick-select-preview">
                    Single-chapter book: enter verse only, for example 3.
                  </div>
                )}

                {quickSelectPhase === 'book' && previewReference && (
                  <div className="bible-quick-select-preview">
                    Interpreted as: {previewReference}
                  </div>
                )}

                {quickSelectPhase === 'book' && bestBookSuggestion && (
                  <button className="bible-quick-select-suggestion" type="button" onClick={() => handleSuggestionClick(bestBookSuggestion.book)}>
                    Suggested: {previewReference || bestBookSuggestion.book.english}
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
