import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaSearch, FaCopy, FaChevronLeft, FaChevronRight, FaTimes,
  FaBook,
} from 'react-icons/fa';
import StudyPage from './StudyPage';

/* ── Helpers ───────────────────────────────────────────────────────────── */

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
  if (normalizedQuery === bookSingular || querySingular === normalizedBook || querySingular === bookSingular) return 98;
  if (normalizedBook.startsWith(normalizedQuery)) return 92;
  if (normalizedBook.includes(normalizedQuery)) return 84;

  const distance = levenshteinDistance(normalizedQuery, normalizedBook);
  const similarity = 1 - (distance / Math.max(normalizedQuery.length, normalizedBook.length));
  if (distance <= 2) return Math.round(70 + (similarity * 20));
  return 0;
};

const ONE_CHAPTER_BOOKS = new Set(['obadiah', 'philemon', '2john', '3john', 'jude']);
const isSingleChapterBook = (bookName) => ONE_CHAPTER_BOOKS.has(normalizeSearchText(bookName));

const parseQuickSelectInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { raw: '', bookText: '', numbers: [], chapter: '', verse: '', hasDigits: false };

  const tokens = raw.split(/\s+/).filter(Boolean);
  const trailingNumbers = [];

  while (tokens.length > 0 && /^\d+$/.test(tokens[tokens.length - 1])) {
    trailingNumbers.unshift(tokens.pop());
  }

  const bookText = tokens.join(' ').trim();
  const chapter = trailingNumbers.length > 0 ? trailingNumbers[trailingNumbers.length - 2] || trailingNumbers[0] : '';
  const verse = trailingNumbers.length > 1 ? trailingNumbers[trailingNumbers.length - 1] : '';

  return { raw, bookText, numbers: trailingNumbers, chapter, verse, hasDigits: trailingNumbers.length > 0 };
};

const scrollItemIntoList = (container, target) => {
  if (!container || !target) return;
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offset = targetRect.top - containerRect.top;
  const desired = offset - (containerRect.height / 2) + (targetRect.height / 2);
  container.scrollTo({ top: Math.max(0, container.scrollTop + desired), behavior: 'smooth' });
};

/* ── Component ─────────────────────────────────────────────────────────── */
export default function BiblePage({
  bibleLoading,
  bibleError,
  selectedBibleBook,
  bibleChapterNumber,
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
  clearScreen,
  bibleRefOnlyMode,
  setBibleRefOnlyMode,
  registerBibleBackHandler,
}) {
  const quickSelectInputRef = useRef(null);
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);
  const [quickSelectPhase, setQuickSelectPhase] = useState('book');
  const [quickSelectValue, setQuickSelectValue] = useState('');
  const [quickSelectMessage, setQuickSelectMessage] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chapterSheetOpen, setChapterSheetOpen] = useState(false);
  const [bookSheetOpen, setBookSheetOpen] = useState(false);
  const [verseSheetOpen, setVerseSheetOpen] = useState(false);
  const [verseMenuKey, setVerseMenuKey] = useState(null);

  /* Study panel state */
  const [studyPanelOpen, setStudyPanelOpen] = useState(false);
  const [studyVerseData, setStudyVerseData] = useState(null);

  /* Back-button closes sheets */
  const sheetStateRef = useRef({});
  useEffect(() => {
    sheetStateRef.current = {
      quickSelectOpen, drawerOpen, verseSheetOpen, chapterSheetOpen, bookSheetOpen, studyPanelOpen,
    };
  }, [quickSelectOpen, drawerOpen, verseSheetOpen, chapterSheetOpen, bookSheetOpen, studyPanelOpen]);

  const prevHasSheetRef = useRef(false);
  useEffect(() => {
    const hasSheet = bookSheetOpen || chapterSheetOpen || verseSheetOpen || drawerOpen || quickSelectOpen || studyPanelOpen;
    if (hasSheet && !prevHasSheetRef.current) {
      history.pushState({ bibleSheet: true }, '');
    }
    prevHasSheetRef.current = hasSheet;
  }, [bookSheetOpen, chapterSheetOpen, verseSheetOpen, drawerOpen, quickSelectOpen, studyPanelOpen]);

  useEffect(() => {
    const handlePopState = () => {
      const s = sheetStateRef.current;
      if (s.studyPanelOpen) { setStudyPanelOpen(false); return; }
      if (s.quickSelectOpen) { closeQuickSelect(); return; }
      if (s.drawerOpen) { setDrawerOpen(false); return; }
      if (s.verseSheetOpen) { setVerseSheetOpen(false); return; }
      if (s.chapterSheetOpen) { setChapterSheetOpen(false); return; }
      if (s.bookSheetOpen) { setBookSheetOpen(false); return; }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /* Register with App so the native back button closes sheets before App navigates home */
  useEffect(() => {
    if (!registerBibleBackHandler) return;
    const hasAny = studyPanelOpen || quickSelectOpen || drawerOpen || verseSheetOpen || chapterSheetOpen || bookSheetOpen;
    if (hasAny) {
      registerBibleBackHandler(() => {
        const s = sheetStateRef.current;
        if (s.studyPanelOpen) { setStudyPanelOpen(false); return true; }
        if (s.quickSelectOpen) { closeQuickSelect(); return true; }
        if (s.drawerOpen) { setDrawerOpen(false); return true; }
        if (s.verseSheetOpen) { setVerseSheetOpen(false); return true; }
        if (s.chapterSheetOpen) { setChapterSheetOpen(false); return true; }
        if (s.bookSheetOpen) { setBookSheetOpen(false); return true; }
        return false;
      });
    } else {
      registerBibleBackHandler(null);
    }
  }, [registerBibleBackHandler, studyPanelOpen, quickSelectOpen, drawerOpen, verseSheetOpen, chapterSheetOpen, bookSheetOpen]);

  const parsedQuickSelect = useMemo(() => parseQuickSelectInput(quickSelectValue), [quickSelectValue]);

  const contextShortcut = useMemo(() => {
    if (!selectedBibleBook || quickSelectPhase !== 'book') return null;
    const raw = quickSelectValue.trim();
    const colonMatch = raw.match(/^(\d+):(\d+)$/);
    if (colonMatch) return { chapter: Number(colonMatch[1]), verse: Number(colonMatch[2]), display: `${selectedBibleBook.english} ${colonMatch[1]}:${colonMatch[2]}` };
    const spaceMatch = raw.match(/^(\d+)\s+(\d+)$/);
    if (spaceMatch) return { chapter: Number(spaceMatch[1]), verse: Number(spaceMatch[2]), display: `${selectedBibleBook.english} ${spaceMatch[1]}:${spaceMatch[2]}` };
    const singleMatch = raw.match(/^\d+$/);
    if (singleMatch) return { chapter: null, verse: Number(raw), display: `${selectedBibleBook.english} ${bibleChapterNumber}:${raw}` };
    return null;
  }, [selectedBibleBook, quickSelectValue, quickSelectPhase, bibleChapterNumber]);

  const bookSuggestions = useMemo(() => {
    if (quickSelectPhase !== 'book') return [];
    const query = parsedQuickSelect.bookText || quickSelectValue.trim();
    if (!query) return [];

    return (Array.isArray(bibleBooks) ? bibleBooks : [])
      .map(book => ({ book, score: scoreBookMatch(query, book.english) }))
      .filter(item => item.score > 0)
      .sort((l, r) => r.score - l.score || l.book.english.localeCompare(r.book.english))
      .slice(0, 5);
  }, [bibleBooks, parsedQuickSelect.bookText, quickSelectPhase, quickSelectValue]);

  const bestBookSuggestion = bookSuggestions[0] || null;
  const previewBook = bestBookSuggestion?.book || null;
  const previewReference = previewBook
    ? (() => {
        const single = isSingleChapterBook(previewBook.english);
        if (single && parsedQuickSelect.numbers.length > 0) {
          const v = parsedQuickSelect.verse || parsedQuickSelect.chapter || parsedQuickSelect.numbers[0];
          return `${previewBook.english} 1:${v}`;
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
      if (!target) return;
      scrollItemIntoList(container, target);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeBibleVerseKey, bibleVerseListRef, selectedBibleChapterIndex]);

  useEffect(() => { setVerseMenuKey(null); }, [activeBibleVerseKey]);

  const openQuickSelect = () => {
    setQuickSelectOpen(true);
    setQuickSelectPhase('book');
    setQuickSelectValue('');
    setQuickSelectMessage('');
  };

  const closeQuickSelect = () => {
    setQuickSelectOpen(false);
    setQuickSelectPhase('book');
    setQuickSelectValue('');
    setQuickSelectMessage('');
  };

  const openStudyPanel = (verseItem, verseNo) => {
    setStudyVerseData({
      text: verseItem?.text || '',
      verseNo: String(verseNo),
      bookEnglish: selectedBibleBook?.english || '',
      bookTamil: selectedBibleBook?.tamil || '',
      chapterNum: bibleChapterNumber,
    });
    setStudyPanelOpen(true);
  };

  const confirmQuickSelect = async () => {
    if (quickSelectPhase === 'book') {
      if (contextShortcut) {
        if (contextShortcut.chapter !== null) {
          await openBibleBook(selectedBibleBook, { chapterNumber: contextShortcut.chapter, verseNumber: contextShortcut.verse });
        } else {
          handleBibleVerseSelect(String(contextShortcut.verse));
        }
        closeQuickSelect();
        return;
      }

      const chosenBook = bestBookSuggestion?.book;
      if (!chosenBook) { setQuickSelectMessage('No matching book found.'); return; }

      if (parsedQuickSelect.numbers.length > 0) {
        const single = isSingleChapterBook(chosenBook.english);
        await openBibleBook(chosenBook, {
          chapterNumber: single ? 1 : parsedQuickSelect.chapter,
          verseNumber: single
            ? (parsedQuickSelect.verse || parsedQuickSelect.chapter || parsedQuickSelect.numbers[0])
            : (parsedQuickSelect.verse || '')
        });
        closeQuickSelect();
        return;
      }

      const loadedBook = await openBibleBook(chosenBook);
      if (Array.isArray(loadedBook?.chapters) && loadedBook.chapters.length === 1) {
        setQuickSelectPhase('verse');
        setQuickSelectValue('');
        setQuickSelectMessage('Single-chapter book — enter verse number.');
      } else {
        setQuickSelectPhase('chapter');
        setQuickSelectValue('');
        setQuickSelectMessage('');
      }
      return;
    }

    if (quickSelectPhase === 'chapter') {
      const chapterNo = Number(quickSelectValue.trim());
      const total = Array.isArray(selectedBibleBook?.chapters) ? selectedBibleBook.chapters.length : 0;
      if (!Number.isInteger(chapterNo) || chapterNo < 1 || (total > 0 && chapterNo > total)) {
        setQuickSelectMessage('Enter a valid chapter number.');
        return;
      }
      goToBibleChapter(chapterNo - 1);
      setQuickSelectPhase('verse');
      setQuickSelectValue('');
      setQuickSelectMessage('');
      return;
    }

    if (quickSelectPhase === 'verse') {
      const verseNo = Number(quickSelectValue.trim());
      if (!Number.isInteger(verseNo) || verseNo < 1) { setQuickSelectMessage('Enter a valid verse number.'); return; }
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
            setQuickSelectMessage('Single-chapter book — enter verse number.');
          } else {
            setQuickSelectPhase('chapter');
            setQuickSelectValue('');
            setQuickSelectMessage('');
          }
        })();
      }
    }
  };

  const handleQuickSelectKeyDown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); void confirmQuickSelect(); return; }
    if (event.key === 'Escape') { event.preventDefault(); closeQuickSelect(); return; }
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
        const single = isSingleChapterBook(book.english);
        await openBibleBook(book, {
          chapterNumber: single ? 1 : parsedQuickSelect.chapter,
          verseNumber: single
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
        setQuickSelectMessage('Single-chapter book — enter verse number.');
      } else {
        setQuickSelectPhase('chapter');
        setQuickSelectValue('');
        setQuickSelectMessage('');
      }
    })();
  };

  const books = Array.isArray(bibleBooks) ? bibleBooks : [];
  const currentBookIdx = books.findIndex(b => b.english === selectedBibleBook?.english);

  const handlePrevChapter = async () => {
    if (selectedBibleChapterIndex > 0) {
      goToBibleChapter(selectedBibleChapterIndex - 1);
    } else if (currentBookIdx > 0) {
      const prevBook = books[currentBookIdx - 1];
      const loaded = await openBibleBook(prevBook);
      const lastIdx = Math.max(0, (loaded?.chapters?.length ?? 1) - 1);
      goToBibleChapter(lastIdx);
    }
  };

  const handleNextChapter = async () => {
    if (selectedBibleChapterIndex < totalChapters - 1) {
      goToBibleChapter(selectedBibleChapterIndex + 1);
    } else if (currentBookIdx < books.length - 1) {
      const nextBook = books[currentBookIdx + 1];
      await openBibleBook(nextBook);
    }
  };

  const copyText = (text) => { navigator.clipboard?.writeText(text).catch(() => {}); };
  const copyReference = (verseNo) => {
    copyText(`${selectedBibleBook?.english || ''} ${bibleChapterNumber}:${verseNo}`);
  };

  const totalChapters = Array.isArray(selectedBibleBook?.chapters) ? selectedBibleBook.chapters.length : 0;

  const phasePlaceholder =
    quickSelectPhase === 'book'
      ? (selectedBibleBook ? `Verse, Ch:Verse, or book — e.g. 5 or 12:3` : 'Book name — e.g. Luke or 1 chr 12 3')
      : quickSelectPhase === 'chapter' ? 'Chapter number'
      : 'Verse number';

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="bible-panel">
      {bibleLoading && <div className="loading">Loading…</div>}
      {!bibleLoading && bibleError && <div className="bible-error">{bibleError}</div>}

      {!bibleLoading && !bibleError && !selectedBibleBook && (
        <div className="bible-empty-state">
          <div className="bible-empty-icon">📖</div>
          <p className="bible-empty-text">Search for a book to begin</p>
          <button className="bible-empty-search-btn" onClick={openQuickSelect}>
            <FaSearch size={13} style={{ marginRight: 7 }} />Search
          </button>
        </div>
      )}

      {!bibleLoading && !bibleError && selectedBibleBook && !studyPanelOpen && (
        <>
          {/* ── Verse list + floating pill wrapper ── */}
          <div className="bible-scroll-area">
          <div
            ref={bibleVerseListRef}
            className="bible-verse-list"
            onTouchStart={handleBibleSwipeStart}
            onTouchEnd={handleBibleSwipeEnd}
          >
            <div className="bible-list-start-pad" />
            {bibleVerses.map((verseItem, idx) => {
              const verseNo = String(verseItem?.verse || idx + 1);
              const verseKey = `${selectedBibleBook.english || ''}-${selectedBibleChapterIndex + 1}-${verseNo}`;
              const isActive = activeBibleVerseKey === verseKey;
              const menuOpen = verseMenuKey === verseKey;

              return (
                <div
                  key={verseKey}
                  data-verse-key={verseKey}
                  className={`bible-verse-item${isActive ? ' active' : ''}`}
                >
                  <button
                    className="bible-verse-body"
                    onClick={() => presentBibleVerse(verseItem?.text || '', verseNo)}
                  >
                    <span className="bible-verse-no">{verseNo}</span>
                    <span className="bible-verse-text">{verseItem?.text || ''}</span>
                  </button>

                  <div className="bible-verse-actions">
                    <button
                      className="verse-action-btn"
                      onClick={() => copyText(verseItem?.text || '')}
                    >
                      <FaCopy size={11} />
                      <span>Copy</span>
                    </button>
                    <div className="verse-action-sep" />
                    <button
                      className="verse-action-btn verse-action-study"
                      onClick={() => openStudyPanel(verseItem, verseNo)}
                    >
                      <FaBook size={11} />
                      <span>Study</span>
                    </button>
                    <div className="verse-action-sep" />
                    <div className="verse-more-wrap">
                      <button
                        className="verse-action-btn"
                        onClick={() => setVerseMenuKey(menuOpen ? null : verseKey)}
                      >
                        <span className="verse-dots">•••</span>
                      </button>
                      {menuOpen && (
                        <>
                          <div
                            className="verse-menu-backdrop"
                            onClick={() => setVerseMenuKey(null)}
                          />
                          <div className="verse-context-menu">
                            <button
                              className="verse-menu-item verse-menu-study"
                              onClick={() => { openStudyPanel(verseItem, verseNo); setVerseMenuKey(null); }}
                            >
                              Cross References
                            </button>
                            <div className="verse-menu-divider" />
                            <button
                              className="verse-menu-item"
                              onClick={() => { copyReference(verseNo); setVerseMenuKey(null); }}
                            >
                              Copy reference
                            </button>
                            <button
                              className="verse-menu-item"
                              onClick={() => { setBibleRefOnlyMode(v => !v); setVerseMenuKey(null); }}
                            >
                              {bibleRefOnlyMode ? 'Show full text' : 'Reference only'}
                            </button>
                            <div className="verse-menu-divider" />
                            <button
                              className="verse-menu-item verse-menu-danger"
                              onClick={() => { clearScreen(); setVerseMenuKey(null); }}
                            >
                              Clear screen
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="bible-list-end-pad" />
          </div>

          {/* ── Single floating bottom pill ── */}
          <div className="bible-float-pill">
            <button className="pill-icon-btn" onClick={() => setDrawerOpen(true)} title="Display settings">
              <span className="pill-dots">•••</span>
            </button>
            <div className="pill-divider" />
            <button
              className="pill-nav-btn"
              onClick={handlePrevChapter}
              disabled={selectedBibleChapterIndex <= 0 && currentBookIdx <= 0}
            >
              <FaChevronLeft size={11} />
            </button>
            <button className="pill-book-btn" onClick={() => setBookSheetOpen(true)}>
              <span className="pill-book-name">{selectedBibleBook.tamil || selectedBibleBook.english}</span>
              <span className="pill-chapter-num">· {bibleChapterNumber}</span>
            </button>
            <button
              className="pill-nav-btn"
              onClick={handleNextChapter}
              disabled={selectedBibleChapterIndex >= totalChapters - 1 && currentBookIdx >= books.length - 1}
            >
              <FaChevronRight size={11} />
            </button>
            <div className="pill-divider" />
            <button className="pill-icon-btn" onClick={openQuickSelect} title="Search">
              <FaSearch size={13} />
            </button>
          </div>
          </div>
        </>
      )}

      {/* ── Quick select overlay ── */}
      {quickSelectOpen && (
        <div className="bible-overlay" onClick={closeQuickSelect}>
          <div className="bible-search-card" onClick={e => e.stopPropagation()}>
            <div className="search-card-toprow">
              <span className="search-phase-pill">
                {quickSelectPhase === 'book' ? 'Book' : quickSelectPhase === 'chapter' ? 'Chapter' : 'Verse'}
              </span>
              <button className="search-close-btn" onClick={closeQuickSelect}>
                <FaTimes size={14} />
              </button>
            </div>
            <input
              ref={quickSelectInputRef}
              className="bible-search-input"
              type={quickSelectPhase === 'book' ? 'text' : 'number'}
              inputMode={quickSelectPhase === 'book' ? 'text' : 'numeric'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={phasePlaceholder}
              value={quickSelectValue}
              onChange={handleQuickSelectChange}
              onKeyDown={handleQuickSelectKeyDown}
            />
            {quickSelectMessage && (
              <div className="search-message">{quickSelectMessage}</div>
            )}
            {quickSelectPhase === 'book' && contextShortcut && (
              <div className="search-preview">{contextShortcut.display}</div>
            )}
            {quickSelectPhase === 'book' && !contextShortcut && previewReference && (
              <div className="search-preview">{previewReference}</div>
            )}
            {quickSelectPhase === 'book' && !contextShortcut && bookSuggestions.length > 0 && (
              <div className="search-suggestions">
                {bookSuggestions.map(({ book }) => (
                  <button
                    key={book.id}
                    className="search-suggestion-item"
                    onClick={() => handleSuggestionClick(book)}
                  >
                    <span className="suggestion-primary">{book.english}</span>
                    {book.tamil && book.tamil !== book.english && (
                      <span className="suggestion-secondary">{book.tamil}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Book bottom sheet ── */}
      {bookSheetOpen && (
        <div className="bible-backdrop" onClick={() => setBookSheetOpen(false)}>
          <div className="bible-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Select Book</div>
            <div className="book-list-scroll">
              {(Array.isArray(bibleBooks) ? bibleBooks : []).map(book => (
                <button
                  key={book.id}
                  className={`book-list-item${selectedBibleBook?.english === book.english ? ' active' : ''}`}
                  onClick={async () => {
                    const loaded = await openBibleBook(book);
                    setBookSheetOpen(false);
                    const singleChapter = isSingleChapterBook(book.english) || (Array.isArray(loaded?.chapters) && loaded.chapters.length === 1);
                    if (singleChapter) {
                      setVerseSheetOpen(true);
                    } else {
                      setChapterSheetOpen(true);
                    }
                  }}
                >
                  <span className="book-item-primary">{book.tamil || book.english}</span>
                  {book.tamil && book.tamil !== book.english && (
                    <span className="book-item-secondary">{book.english}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Chapter picker bottom sheet ── */}
      {chapterSheetOpen && (
        <div className="bible-backdrop" onClick={() => setChapterSheetOpen(false)}>
          <div className="bible-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">{selectedBibleBook?.tamil || selectedBibleBook?.english}</div>
            <div className="chapter-grid">
              {(selectedBibleBook?.chapters || []).map((ch, idx) => {
                const chNo = Number(ch?.chapter || idx + 1);
                return (
                  <button
                    key={chNo}
                    className={`chapter-grid-btn${chNo === bibleChapterNumber ? ' active' : ''}`}
                    onClick={() => { goToBibleChapter(idx); setChapterSheetOpen(false); setVerseSheetOpen(true); }}
                  >
                    {chNo}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Verse picker bottom sheet ── */}
      {verseSheetOpen && (
        <div className="bible-backdrop" onClick={() => setVerseSheetOpen(false)}>
          <div className="bible-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">
              {selectedBibleBook?.tamil || selectedBibleBook?.english} {bibleChapterNumber} — Select Verse
            </div>
            <div className="chapter-grid">
              {(Array.isArray(bibleVerses) ? bibleVerses : []).map((verseItem, idx) => {
                const verseNo = String(verseItem?.verse || idx + 1);
                return (
                  <button
                    key={verseNo}
                    className="chapter-grid-btn"
                    onClick={() => { handleBibleVerseSelect(verseNo); setVerseSheetOpen(false); }}
                  >
                    {verseNo}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings drawer ── */}
      {drawerOpen && (
        <div className="bible-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="bible-bottom-sheet settings-drawer" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Display Settings</div>

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
                  <div className="drawer-label">Reference only</div>
                  <div className="drawer-sublabel">Show book/chapter/verse on TV, no text</div>
                </div>
                <button
                  className={`toggle-switch${bibleRefOnlyMode ? ' on' : ''}`}
                  onClick={() => setBibleRefOnlyMode(v => !v)}
                  role="switch"
                  aria-checked={bibleRefOnlyMode}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>
            </div>

            <button
              className="drawer-clear-btn"
              onClick={() => { clearScreen(); setDrawerOpen(false); }}
            >
              Clear Screen
            </button>
          </div>
        </div>
      )}

      {/* ── Verse Study Page ── */}
      {studyPanelOpen && selectedBibleBook && (
        <StudyPage
          selectedBibleBook={selectedBibleBook}
          bibleChapterNumber={bibleChapterNumber}
          bibleVerses={bibleVerses}
          bibleBooks={bibleBooks}
          selectedBibleChapterIndex={selectedBibleChapterIndex}
          activeBibleVerseKey={activeBibleVerseKey}
          initialVerseData={studyVerseData}
          onClose={() => setStudyPanelOpen(false)}
          presentBibleVerse={presentBibleVerse}
          openBibleBook={openBibleBook}
          goToBibleChapter={goToBibleChapter}
          handleBibleSwipeStart={handleBibleSwipeStart}
          handleBibleSwipeEnd={handleBibleSwipeEnd}
          onDrawerOpen={() => setDrawerOpen(true)}
          onBookSheetOpen={() => setBookSheetOpen(true)}
          openQuickSelect={openQuickSelect}
        />
      )}
    </div>
  );
}
