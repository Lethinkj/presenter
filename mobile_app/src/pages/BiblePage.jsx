import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaSearch, FaCopy, FaChevronLeft, FaChevronRight, FaTimes,
  FaBook, FaGlobe, FaList, FaLink, FaInfoCircle, FaMagic, FaColumns, FaChevronDown, FaAlignLeft, FaLanguage,
} from 'react-icons/fa';

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

/* ── Book info lookup ──────────────────────────────────────────────────── */
const BOOK_INFO = {
  Genesis:         { author: 'Moses',           period: 'c. 1446–1406 BC', theme: 'Creation, fall, flood, and the patriarchs — foundation of God\'s covenant with humanity.' },
  Exodus:          { author: 'Moses',           period: 'c. 1446–1406 BC', theme: 'God delivers Israel from Egypt through Moses and establishes the Law at Sinai.' },
  Leviticus:       { author: 'Moses',           period: 'c. 1446 BC',      theme: 'Instructions for worship, priestly duties, and holiness before a holy God.' },
  Numbers:         { author: 'Moses',           period: 'c. 1446–1406 BC', theme: 'Israel\'s 40-year wilderness journey following the census at Sinai.' },
  Deuteronomy:     { author: 'Moses',           period: 'c. 1406 BC',      theme: 'Moses reviews the Law and renews the covenant before Israel enters Canaan.' },
  Joshua:          { author: 'Joshua',          period: 'c. 1400–1370 BC', theme: 'Israel conquers and settles the Promised Land under Joshua\'s leadership.' },
  Judges:          { author: 'Samuel (trad.)',  period: 'c. 1380–1050 BC', theme: 'Cycles of sin, oppression, and deliverance through God-appointed judges.' },
  Ruth:            { author: 'Samuel (trad.)',  period: 'c. 1100 BC',      theme: 'A story of loyalty, redemption, and God\'s grace across cultural boundaries.' },
  '1 Samuel':      { author: 'Samuel / Nathan', period: 'c. 1050–1000 BC', theme: 'Israel requests a king; the rise and fall of Saul and the rise of David.' },
  '2 Samuel':      { author: 'Nathan / Gad',    period: 'c. 1010–970 BC',  theme: 'David\'s reign over united Israel — triumphs, failures, and restoration.' },
  '1 Kings':       { author: 'Jeremiah (trad.)', period: 'c. 971–560 BC',  theme: 'Solomon\'s wisdom and the temple, followed by Israel\'s tragic division.' },
  '2 Kings':       { author: 'Jeremiah (trad.)', period: 'c. 853–560 BC',  theme: 'The fall of Israel (722 BC) and Judah (586 BC) through persistent unfaithfulness.' },
  '1 Chronicles':  { author: 'Ezra (trad.)',    period: 'c. 450–400 BC',   theme: 'Genealogies and David\'s reign from a priestly, temple-focused perspective.' },
  '2 Chronicles':  { author: 'Ezra (trad.)',    period: 'c. 450–400 BC',   theme: 'Solomon through Judah\'s fall, emphasising worship, reform, and covenant.' },
  Ezra:            { author: 'Ezra',            period: 'c. 458 BC',       theme: 'Return from Babylon and rebuilding of the temple in Jerusalem.' },
  Nehemiah:        { author: 'Nehemiah',        period: 'c. 445 BC',       theme: 'Nehemiah leads the rebuilding of Jerusalem\'s walls and revival of the people.' },
  Esther:          { author: 'Unknown',         period: 'c. 480 BC',       theme: 'God\'s hidden providence protecting the Jewish people in the Persian empire.' },
  Job:             { author: 'Unknown',         period: 'Unknown',         theme: 'Wrestling with suffering, divine sovereignty, and the limits of human wisdom.' },
  Psalms:          { author: 'David & others',  period: 'c. 1000–400 BC',  theme: '150 poems of praise, lament, and wisdom — the hymn book of ancient Israel.' },
  Proverbs:        { author: 'Solomon & others', period: 'c. 950–700 BC',  theme: 'Practical wisdom for everyday godly living.' },
  Ecclesiastes:    { author: 'Solomon (trad.)', period: 'c. 935 BC',       theme: 'Searching for meaning; life is empty apart from fearing God and keeping His commands.' },
  'Song of Solomon': { author: 'Solomon',       period: 'c. 970–930 BC',   theme: 'A celebration of romantic love and intimacy within the covenant of marriage.' },
  Isaiah:          { author: 'Isaiah',          period: 'c. 740–680 BC',   theme: 'Judgment and salvation; messianic prophecies of the Suffering Servant and coming King.' },
  Jeremiah:        { author: 'Jeremiah',        period: 'c. 627–586 BC',   theme: 'Warning of Babylon\'s conquest and the promise of a new covenant with Israel.' },
  Lamentations:    { author: 'Jeremiah',        period: 'c. 586 BC',       theme: 'Mourning and raw grief over the destruction of Jerusalem by Babylon.' },
  Ezekiel:         { author: 'Ezekiel',         period: 'c. 593–573 BC',   theme: 'Visions of divine judgment, the glory of God, and the future restoration of Israel.' },
  Daniel:          { author: 'Daniel',          period: 'c. 605–536 BC',   theme: 'Faithfulness in exile; apocalyptic visions of world empires and God\'s eternal kingdom.' },
  Hosea:           { author: 'Hosea',           period: 'c. 755–715 BC',   theme: 'God\'s relentless faithful love despite Israel\'s spiritual adultery.' },
  Joel:            { author: 'Joel',            period: 'c. 830 BC',       theme: 'Locust plague as divine judgment; call to repentance and promise of the Spirit.' },
  Amos:            { author: 'Amos',            period: 'c. 760–750 BC',   theme: 'God\'s judgment on social injustice and empty religion without righteous living.' },
  Obadiah:         { author: 'Obadiah',         period: 'c. 845 or 586 BC', theme: 'Judgment against Edom for gloating over Jerusalem\'s destruction.' },
  Jonah:           { author: 'Jonah',           period: 'c. 785–775 BC',   theme: 'God\'s mercy extends beyond Israel — even to Israel\'s greatest enemies.' },
  Micah:           { author: 'Micah',           period: 'c. 740–700 BC',   theme: 'Justice, humility, and the prophecy of the coming ruler born in Bethlehem.' },
  Nahum:           { author: 'Nahum',           period: 'c. 663–612 BC',   theme: 'The fall of Nineveh; God\'s justice ultimately avenges His people.' },
  Habakkuk:        { author: 'Habakkuk',        period: 'c. 609–605 BC',   theme: 'Wrestling with God\'s ways; the just shall live by faith despite circumstances.' },
  Zephaniah:       { author: 'Zephaniah',       period: 'c. 640–609 BC',   theme: 'The coming Day of the Lord brings judgment, then joyful restoration.' },
  Haggai:          { author: 'Haggai',          period: 'c. 520 BC',       theme: 'Challenging the returned exiles to prioritise rebuilding the temple of God.' },
  Zechariah:       { author: 'Zechariah',       period: 'c. 520–480 BC',   theme: 'Messianic visions and prophecies pointing to the coming King and Shepherd.' },
  Malachi:         { author: 'Malachi',         period: 'c. 430 BC',       theme: 'A call to covenant faithfulness and the promise of the forerunner before the Messiah.' },
  Matthew:         { author: 'Matthew',         period: 'c. AD 50–70',     theme: 'Jesus as the Messiah-King who fulfils the Law and Prophets and establishes His kingdom.' },
  Mark:            { author: 'Mark',            period: 'c. AD 50–65',     theme: 'Jesus the active Servant — the shortest gospel, fast-paced, full of action.' },
  Luke:            { author: 'Luke',            period: 'c. AD 60–62',     theme: 'Jesus the perfect Son of Man; the Saviour of all people — especially the marginalised.' },
  John:            { author: 'John',            period: 'c. AD 85–95',     theme: 'Jesus the divine Son of God — believe in Him and receive eternal life.' },
  Acts:            { author: 'Luke',            period: 'c. AD 62',        theme: 'The Holy Spirit empowers the church to spread the gospel from Jerusalem to Rome.' },
  Romans:          { author: 'Paul',            period: 'c. AD 57',        theme: 'God\'s righteousness revealed in the gospel — justification by faith alone.' },
  '1 Corinthians': { author: 'Paul',            period: 'c. AD 54–55',     theme: 'Practical church issues: unity, gifts of the Spirit, and the resurrection.' },
  '2 Corinthians': { author: 'Paul',            period: 'c. AD 55–56',     theme: 'Paul\'s defence of his ministry; God\'s strength is perfected in weakness.' },
  Galatians:       { author: 'Paul',            period: 'c. AD 48–49',     theme: 'Freedom from the law; justification is by faith in Christ alone, not works.' },
  Ephesians:       { author: 'Paul',            period: 'c. AD 60–62',     theme: 'The church as Christ\'s body; spiritual blessings and walking worthy of the calling.' },
  Philippians:     { author: 'Paul',            period: 'c. AD 61',        theme: 'Joy in Christ even in imprisonment; pressing on toward the goal.' },
  Colossians:      { author: 'Paul',            period: 'c. AD 60–62',     theme: 'Christ\'s supremacy over all creation and as the head of the church.' },
  '1 Thessalonians': { author: 'Paul',          period: 'c. AD 50–51',     theme: 'Encouragement for a young church; readiness for the return of Christ.' },
  '2 Thessalonians': { author: 'Paul',          period: 'c. AD 51',        theme: 'Clarifying end-times confusion; standing firm and working faithfully.' },
  '1 Timothy':     { author: 'Paul',            period: 'c. AD 63–65',     theme: 'Pastoral instructions for church order, leadership, and sound doctrine.' },
  '2 Timothy':     { author: 'Paul',            period: 'c. AD 66–67',     theme: 'Paul\'s final charge to Timothy: guard the gospel, endure hardship.' },
  Titus:           { author: 'Paul',            period: 'c. AD 63–65',     theme: 'Instructions for church leadership and godly living in a pagan culture.' },
  Philemon:        { author: 'Paul',            period: 'c. AD 60–62',     theme: 'A plea for forgiveness and reconciliation — a slave received as a brother.' },
  Hebrews:         { author: 'Unknown',         period: 'c. AD 64–70',     theme: 'Jesus is the ultimate high priest; the new covenant far surpasses the old.' },
  James:           { author: 'James',           period: 'c. AD 44–49',     theme: 'Genuine faith produces good works; practical Christian ethics for daily life.' },
  '1 Peter':       { author: 'Peter',           period: 'c. AD 62–64',     theme: 'Hope and holy living for believers suffering in a hostile world.' },
  '2 Peter':       { author: 'Peter',           period: 'c. AD 65–68',     theme: 'Warning against false teachers; the Lord\'s return is certain.' },
  '1 John':        { author: 'John',            period: 'c. AD 85–95',     theme: 'Assurance of salvation through love, truth, and fellowship with God.' },
  '2 John':        { author: 'John',            period: 'c. AD 85–95',     theme: 'Walking in truth and love; guarding the church against false teachers.' },
  '3 John':        { author: 'John',            period: 'c. AD 85–95',     theme: 'Commending hospitality in ministry and faithful workers like Gaius.' },
  Jude:            { author: 'Jude',            period: 'c. AD 65–80',     theme: 'Contending earnestly for the faith against infiltrating false teachers.' },
  Revelation:      { author: 'John',            period: 'c. AD 94–96',     theme: 'Christ\'s ultimate victory over evil and the vision of the glorious new creation.' },
};

/* ── OT / NT classification ────────────────────────────────────────────── */
const NT_BOOKS = new Set([
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
]);

/* ── Study panel tab definitions ───────────────────────────────────────── */
const STUDY_TABS = [
  { id: 'compare',      label: 'Compare',       Icon: FaColumns },
  { id: 'translations', label: 'Translations',  Icon: FaGlobe },
  { id: 'concordance',  label: 'Concordance',   Icon: FaList },
  { id: 'similar',      label: 'Cross Refs',    Icon: FaLink },
  { id: 'commentary',   label: 'Commentary',    Icon: FaAlignLeft },
  { id: 'lexicon',      label: 'Lexicon',       Icon: FaLanguage },
  { id: 'about',        label: 'About Book',    Icon: FaInfoCircle },
  { id: 'ai',           label: 'AI Insights',   Icon: FaMagic },
];

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
  const studyVerseListRef = useRef(null);
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
  const [studyActiveTab, setStudyActiveTab] = useState('compare');
  const [aiInsightText, setAiInsightText] = useState('');
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [compareVersion, setCompareVersion] = useState('TSV');
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.46);
  const studyPanelRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, ratio: 0.46 });

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
    const hasAny = studyPanelOpen || quickSelectOpen || drawerOpen || verseSheetOpen || chapterSheetOpen || bookSheetOpen || compareSheetOpen;
    if (hasAny) {
      registerBibleBackHandler(() => {
        const s = sheetStateRef.current;
        if (s.studyPanelOpen) { setStudyPanelOpen(false); return true; }
        if (s.quickSelectOpen) { closeQuickSelect(); return true; }
        if (s.drawerOpen) { setDrawerOpen(false); return true; }
        if (s.verseSheetOpen) { setVerseSheetOpen(false); return true; }
        if (s.chapterSheetOpen) { setChapterSheetOpen(false); return true; }
        if (s.bookSheetOpen) { setBookSheetOpen(false); return true; }
        if (compareSheetOpen) { setCompareSheetOpen(false); return true; }
        return false;
      });
    } else {
      registerBibleBackHandler(null);
    }
  }, [registerBibleBackHandler, studyPanelOpen, quickSelectOpen, drawerOpen, verseSheetOpen, chapterSheetOpen, bookSheetOpen, compareSheetOpen]);

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

  /* Concordance: find verses in the current book sharing words with the study verse */
  const concordanceData = useMemo(() => {
    if (!studyVerseData || !selectedBibleBook?.chapters) return [];
    const sourceWords = new Set(
      (studyVerseData.text || '').split(/\s+/).filter(w => w.length > 2)
    );
    if (sourceWords.size === 0) return [];

    const results = [];
    selectedBibleBook.chapters.forEach((ch, chIdx) => {
      const chNum = chIdx + 1;
      (ch.verses || []).forEach(v => {
        if (chNum === studyVerseData.chapterNum && String(v.verse) === String(studyVerseData.verseNo)) return;
        const vWords = (v.text || '').split(/\s+/);
        const matched = vWords.filter(w => sourceWords.has(w));
        if (matched.length >= 1) {
          results.push({
            ref: `${studyVerseData.bookEnglish} ${chNum}:${v.verse}`,
            text: v.text || '',
            matchCount: matched.length,
            matchedWords: [...new Set(matched)].slice(0, 4),
          });
        }
      });
    });

    return results.sort((a, b) => b.matchCount - a.matchCount).slice(0, 30);
  }, [studyVerseData, selectedBibleBook]);

  /* Context verses: surrounding verses for "Similar" tab */
  const contextVerses = useMemo(() => {
    if (!studyVerseData || !selectedBibleBook?.chapters) return { before: [], after: [] };
    const chIdx = studyVerseData.chapterNum - 1;
    const ch = selectedBibleBook.chapters[chIdx];
    if (!ch?.verses) return { before: [], after: [] };

    const verseIdx = ch.verses.findIndex(v => String(v.verse) === String(studyVerseData.verseNo));
    if (verseIdx === -1) return { before: [], after: [] };

    const before = ch.verses.slice(Math.max(0, verseIdx - 4), verseIdx).map(v => ({
      ref: `${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${v.verse}`,
      verseNo: v.verse,
      text: v.text || '',
    }));
    const after = ch.verses.slice(verseIdx + 1, verseIdx + 5).map(v => ({
      ref: `${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${v.verse}`,
      verseNo: v.verse,
      text: v.text || '',
    }));
    return { before, after };
  }, [studyVerseData, selectedBibleBook]);

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

  /* Scroll the studying verse into view whenever studyVerseData changes */
  useEffect(() => {
    if (!studyVerseData) return;
    const frame = requestAnimationFrame(() => {
      const container = studyVerseListRef.current;
      if (!container) return;
      const key = `${studyVerseData.bookEnglish}-${studyVerseData.chapterNum}-${studyVerseData.verseNo}`;
      const target = container.querySelector(`[data-study-verse-key="${key}"]`);
      if (!target) return;
      scrollItemIntoList(container, target);
    });
    return () => cancelAnimationFrame(frame);
  }, [studyVerseData]);

  /* Drag-to-resize: attach to document so fast drags don't lose the handle */
  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingRef.current) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const panel = studyPanelRef.current;
      if (!panel) return;
      const { top, height } = panel.getBoundingClientRect();
      const delta = clientY - dragStartRef.current.y;
      const raw = dragStartRef.current.ratio + delta / height;
      setSplitRatio(Math.min(0.82, Math.max(0.15, raw)));
    };
    const onEnd = () => { isDraggingRef.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, []);

  const handleResizeDragStart = (e) => {
    isDraggingRef.current = true;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { y: clientY, ratio: splitRatio };
    e.preventDefault();
  };

  /* In study mode: present the verse AND update study tab data */
  const handleStudyVerseClick = (verseItem, verseNo) => {
    presentBibleVerse(verseItem?.text || '', verseNo);
    setStudyVerseData({
      text: verseItem?.text || '',
      verseNo: String(verseNo),
      bookEnglish: selectedBibleBook?.english || '',
      bookTamil: selectedBibleBook?.tamil || '',
      chapterNum: bibleChapterNumber,
    });
    setAiInsightText('');
    setAiInsightLoading(false);
  };

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
    setStudyActiveTab('compare');
    setAiInsightText('');
    setAiInsightLoading(false);
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

  /* AI Insights stub — replace with real API call as needed */
  const handleGenerateAiInsight = async () => {
    if (!studyVerseData || aiInsightLoading) return;
    setAiInsightLoading(true);
    setAiInsightText('');
    await new Promise(r => setTimeout(r, 1200));
    setAiInsightLoading(false);
    setAiInsightText(
      `This verse is from ${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${studyVerseData.verseNo}. ` +
      `Connect to the WorshipCast AI service to receive deep contextual insights, thematic analysis, application points, ` +
      `and cross-tradition commentary for this passage.`
    );
  };

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

      {!bibleLoading && !bibleError && selectedBibleBook && (
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

      {/* ── Verse Study Panel (split-screen overlay) ── */}
      {studyPanelOpen && selectedBibleBook && (
        <div className="verse-study-overlay">
          <div ref={studyPanelRef} className="verse-study-panel">

            {/* ── Header bar: book nav + exit ── */}
            <div className="study-header-bar">
              <button className="study-exit-btn" onClick={() => setStudyPanelOpen(false)}>
                <FaTimes size={13} />
              </button>

              <div className="study-header-nav">
                <button
                  className="study-header-nav-btn"
                  onClick={handlePrevChapter}
                  disabled={selectedBibleChapterIndex <= 0 && currentBookIdx <= 0}
                >
                  <FaChevronLeft size={11} />
                </button>
                <button className="study-header-book-btn" onClick={() => setBookSheetOpen(true)}>
                  <span className="study-header-book-name">{selectedBibleBook.tamil || selectedBibleBook.english}</span>
                  <span className="study-header-chapter">· {bibleChapterNumber}</span>
                </button>
                <button
                  className="study-header-nav-btn"
                  onClick={handleNextChapter}
                  disabled={selectedBibleChapterIndex >= totalChapters - 1 && currentBookIdx >= books.length - 1}
                >
                  <FaChevronRight size={11} />
                </button>
              </div>

              <div className="study-header-actions">
                <button className="study-header-icon-btn" onClick={() => setDrawerOpen(true)} title="Display settings">
                  <span className="pill-dots">•••</span>
                </button>
                <button className="study-header-icon-btn" onClick={openQuickSelect} title="Search">
                  <FaSearch size={13} />
                </button>
              </div>
            </div>

            {/* ── Top section: verse list (resizable) ── */}
            <div
              className="study-verse-list-area"
              style={{ flex: `0 0 ${(splitRatio * 100).toFixed(1)}%` }}
            >
              <div
                ref={studyVerseListRef}
                className="bible-verse-list"
                onTouchStart={handleBibleSwipeStart}
                onTouchEnd={handleBibleSwipeEnd}
              >
                <div style={{ height: '0.25rem' }} />
                {bibleVerses.map((verseItem, idx) => {
                  const verseNo = String(verseItem?.verse || idx + 1);
                  const verseKey = `${selectedBibleBook.english}-${selectedBibleChapterIndex + 1}-${verseNo}`;
                  const isActive = activeBibleVerseKey === verseKey;
                  const isStudying = studyVerseData?.verseNo === verseNo
                    && studyVerseData?.chapterNum === bibleChapterNumber
                    && studyVerseData?.bookEnglish === selectedBibleBook.english;

                  return (
                    <div
                      key={verseKey}
                      data-study-verse-key={verseKey}
                      className={`bible-verse-item${isActive ? ' active' : ''}${isStudying && !isActive ? ' studying' : ''}`}
                    >
                      <button
                        className="bible-verse-body"
                        onClick={() => handleStudyVerseClick(verseItem, verseNo)}
                      >
                        <span className="bible-verse-no">{verseNo}</span>
                        <span className="bible-verse-text">{verseItem?.text || ''}</span>
                      </button>
                    </div>
                  );
                })}
                <div style={{ height: '2rem' }} />
              </div>
            </div>

            {/* ── Drag-to-resize handle ── */}
            <div
              className="study-resize-handle"
              onMouseDown={handleResizeDragStart}
              onTouchStart={handleResizeDragStart}
            >
              <div className="study-resize-grip" />
            </div>

            {/* ── Tab bar ── */}
            <div className="study-tab-bar">
              {STUDY_TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`study-tab-btn${studyActiveTab === tab.id ? ' active' : ''}`}
                  onClick={() => setStudyActiveTab(tab.id)}
                >
                  <tab.Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── Bottom half: tab content ── */}
            <div className="study-tab-content">

              {!studyVerseData && (
                <div className="study-empty-state" style={{ marginTop: '2.5rem' }}>
                  Tap any verse above to load its study data.
                </div>
              )}

              {/* Translations tab */}
              {studyVerseData && studyActiveTab === 'translations' && (
                <div className="study-section">
                  <div className="study-translation-card study-translation-primary">
                    <div className="study-translation-lang-row">
                      <span className="study-translation-badge">Tamil — TSV</span>
                      <span className="study-translation-ref">{studyVerseData.bookEnglish} {studyVerseData.chapterNum}:{studyVerseData.verseNo}</span>
                    </div>
                    <p className="study-translation-text">{studyVerseData.text}</p>
                  </div>

                  <div className="study-section-divider">
                    <span>Other Translations</span>
                  </div>

                  {[
                    { code: 'KJV',  lang: 'English',    full: 'King James Version' },
                    { code: 'NIV',  lang: 'English',    full: 'New International Version' },
                    { code: 'ESV',  lang: 'English',    full: 'English Standard Version' },
                    { code: 'NLT',  lang: 'English',    full: 'New Living Translation' },
                    { code: 'NASB', lang: 'English',    full: 'New American Standard Bible' },
                    { code: 'GNT',  lang: 'Greek',      full: 'Greek New Testament' },
                    { code: 'LXX',  lang: 'Greek',      full: 'Septuagint (OT)' },
                    { code: 'VUL',  lang: 'Latin',      full: 'Vulgate' },
                    { code: 'HIN',  lang: 'Hindi',      full: 'Hindi Bible (BSI)' },
                    { code: 'TEL',  lang: 'Telugu',     full: 'Telugu Bible' },
                    { code: 'MAL',  lang: 'Malayalam',  full: 'Malayalam Bible' },
                  ].map(t => (
                    <div key={t.code} className="study-translation-card study-translation-locked">
                      <div className="study-translation-lang-row">
                        <span className="study-translation-badge study-translation-badge-dim">{t.code}</span>
                        <span className="study-translation-full">{t.full}</span>
                      </div>
                      <p className="study-translation-coming">Available in a future update</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Concordance tab */}
              {studyVerseData && studyActiveTab === 'concordance' && (
                <div className="study-section">
                  <div className="study-section-meta">
                    Word occurrences across {studyVerseData.bookEnglish}
                    {concordanceData.length > 0
                      ? ` · ${concordanceData.length} matching verse${concordanceData.length !== 1 ? 's' : ''}`
                      : ''}
                  </div>
                  {concordanceData.length === 0 ? (
                    <div className="study-empty-state">No matching verses found in this book.</div>
                  ) : (
                    concordanceData.map((item, i) => (
                      <div key={i} className="study-concordance-item">
                        <div className="study-concordance-header">
                          <span className="study-concordance-ref">{item.ref}</span>
                          <span className="study-concordance-count">{item.matchCount} match{item.matchCount !== 1 ? 'es' : ''}</span>
                        </div>
                        <p className="study-concordance-text">{item.text}</p>
                        <div className="study-concordance-words">
                          {item.matchedWords.map((w, wi) => (
                            <span key={wi} className="study-word-chip">{w}</span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Similar Verses tab */}
              {studyVerseData && studyActiveTab === 'similar' && (
                <div className="study-section">
                  <div className="study-section-meta">Surrounding context in {studyVerseData.bookEnglish} {studyVerseData.chapterNum}</div>

                  {contextVerses.before.length > 0 && (
                    <>
                      <div className="study-context-label">Before this verse</div>
                      {contextVerses.before.map((v, i) => (
                        <div key={i} className="study-context-verse">
                          <span className="study-context-ref">{v.verseNo}</span>
                          <p className="study-context-text">{v.text}</p>
                        </div>
                      ))}
                    </>
                  )}

                  <div className="study-context-verse study-context-verse-focal">
                    <span className="study-context-ref study-context-ref-focal">{studyVerseData.verseNo}</span>
                    <p className="study-context-text">{studyVerseData.text}</p>
                  </div>

                  {contextVerses.after.length > 0 && (
                    <>
                      <div className="study-context-label">After this verse</div>
                      {contextVerses.after.map((v, i) => (
                        <div key={i} className="study-context-verse">
                          <span className="study-context-ref">{v.verseNo}</span>
                          <p className="study-context-text">{v.text}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* About tab */}
              {/* Commentary tab */}
              {studyVerseData && studyActiveTab === 'commentary' && (() => {
                const info = BOOK_INFO[studyVerseData.bookEnglish];
                const ref = `${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${studyVerseData.verseNo}`;
                return (
                  <div className="study-section">
                    {/* Verse echo */}
                    <div className="commentary-verse-card">
                      <span className="commentary-verse-ref">{ref}</span>
                      <p className="commentary-verse-text">{studyVerseData.text}</p>
                    </div>

                    {/* Commentary sections */}
                    {[
                      {
                        label: 'Background',
                        icon: '🏛️',
                        body: info
                          ? `${studyVerseData.bookEnglish} was written by ${info.author} around ${info.period}. ${info.theme}`
                          : `This verse is from ${studyVerseData.bookEnglish} chapter ${studyVerseData.chapterNum}.`,
                      },
                      {
                        label: 'Meaning',
                        icon: '📖',
                        body: `Verse ${studyVerseData.verseNo} of chapter ${studyVerseData.chapterNum} contributes to the unfolding argument or narrative of this passage. Reading it alongside the surrounding verses reveals the flow of thought the author intended.`,
                      },
                      {
                        label: 'Key Words',
                        icon: '🔑',
                        body: `Study the significant words in this verse in their original language context. Each word carries weight shaped by its cultural and literary setting. The repetition or contrast of terms often signals theological emphasis.`,
                      },
                      {
                        label: 'Application',
                        icon: '💡',
                        body: `This verse speaks directly to the believer today. Consider how its truth challenges current thinking, calls for a response of faith, and shapes how we live, worship, and serve. Bring it before the congregation with that intent.`,
                      },
                    ].map(section => (
                      <div key={section.label} className="commentary-section">
                        <div className="commentary-section-header">
                          <span className="commentary-section-icon">{section.icon}</span>
                          <span className="commentary-section-label">{section.label}</span>
                        </div>
                        <p className="commentary-section-body">{section.body}</p>
                      </div>
                    ))}

                    <div className="commentary-note">
                      Full verse-by-verse commentary coming in a future update.
                    </div>
                  </div>
                );
              })()}

              {/* Lexicon tab */}
              {studyVerseData && studyActiveTab === 'lexicon' && (() => {
                const isNT = NT_BOOKS.has(studyVerseData.bookEnglish);
                const lang = isNT ? 'Greek' : 'Hebrew';
                const langShort = isNT ? 'GK' : 'HB';
                // Tokenise the verse into meaningful words (length > 2)
                const words = (studyVerseData.text || '')
                  .split(/\s+/)
                  .filter(w => w.replace(/[^஀-௿A-z]/g, '').length > 1);

                return (
                  <div className="study-section">
                    {/* Language badge */}
                    <div className="lexicon-lang-banner">
                      <span className="lexicon-lang-badge">{lang}</span>
                      <span className="lexicon-lang-desc">
                        Original language of {studyVerseData.bookEnglish} · {isNT ? 'New Testament' : 'Old Testament'}
                      </span>
                    </div>

                    {/* Word entries */}
                    {words.map((word, i) => {
                      const strongNum = isNT
                        ? `G${1000 + (word.length * 97 + i * 13) % 8000}`
                        : `H${100  + (word.length * 83 + i * 17) % 8700}`;
                      return (
                        <div key={i} className="lexicon-entry">
                          <div className="lexicon-entry-header">
                            <span className="lexicon-strong">{strongNum}</span>
                            <span className="lexicon-orig-word">
                              {isNT ? '—' : '—'}
                            </span>
                            <span className="lexicon-lang-tag">{langShort}</span>
                          </div>
                          <div className="lexicon-source-word">{word}</div>
                          <div className="lexicon-fields">
                            <div className="lexicon-field">
                              <span className="lexicon-field-key">Transliteration</span>
                              <span className="lexicon-field-val lexicon-coming">—</span>
                            </div>
                            <div className="lexicon-field">
                              <span className="lexicon-field-key">Part of speech</span>
                              <span className="lexicon-field-val lexicon-coming">—</span>
                            </div>
                            <div className="lexicon-field">
                              <span className="lexicon-field-key">Definition</span>
                              <span className="lexicon-field-val lexicon-coming">Full lexicon coming soon</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="commentary-note" style={{ marginTop: '0.5rem' }}>
                      Strong's numbers and definitions will be populated once lexicon data is integrated.
                    </div>
                  </div>
                );
              })()}

              {/* Compare tab — full chapter in selected version */}
              {studyActiveTab === 'compare' && (() => {
                const chIdx = selectedBibleChapterIndex;
                const chapterVerses = selectedBibleBook?.chapters?.[chIdx]?.verses || [];
                const focusVerseNo = studyVerseData?.chapterNum === bibleChapterNumber
                  ? studyVerseData?.verseNo : null;
                const VERSIONS = [
                  { code: 'TSV',  label: 'Tamil Standard Version',    lang: 'Tamil',    available: true },
                  { code: 'KJV',  label: 'King James Version',        lang: 'English',  available: false },
                  { code: 'NIV',  label: 'New International Version', lang: 'English',  available: false },
                  { code: 'ESV',  label: 'English Standard Version',  lang: 'English',  available: false },
                  { code: 'NASB', label: 'New American Standard',     lang: 'English',  available: false },
                  { code: 'NLT',  label: 'New Living Translation',    lang: 'English',  available: false },
                  { code: 'MSG',  label: 'The Message',               lang: 'English',  available: false },
                  { code: 'GNT',  label: 'Greek New Testament',       lang: 'Greek',    available: false },
                  { code: 'LXX',  label: 'Septuagint',                lang: 'Greek',    available: false },
                  { code: 'VUL',  label: 'Vulgate',                   lang: 'Latin',    available: false },
                  { code: 'HIN',  label: 'Hindi Bible (BSI)',         lang: 'Hindi',    available: false },
                  { code: 'TEL',  label: 'Telugu Bible',              lang: 'Telugu',   available: false },
                  { code: 'MAL',  label: 'Malayalam Bible',           lang: 'Malayalam', available: false },
                ];
                const active = VERSIONS.find(v => v.code === compareVersion) || VERSIONS[0];

                return (
                  <div className="study-section study-compare-section">
                    {/* Version selector + chapter name in one row */}
                    <div className="compare-tab-header">
                      <button
                        className="compare-version-selector"
                        onClick={() => setCompareSheetOpen(true)}
                      >
                        <span className="compare-version-name">{active.label}</span>
                        <FaChevronDown size={10} className="compare-version-chevron" />
                      </button>
                      <span className="compare-chapter-ref">
                        {selectedBibleBook?.english} {bibleChapterNumber}
                      </span>
                    </div>

                    {/* Full chapter verses */}
                    <div className="compare-chapter-body">
                      {chapterVerses.length === 0 && (
                        <div className="study-empty-state">No chapter data available.</div>
                      )}
                      {chapterVerses.map((v) => {
                        const vNo = String(v.verse);
                        const isFocus = vNo === focusVerseNo;
                        return (
                          <div
                            key={vNo}
                            className={`compare-verse-row${isFocus ? ' compare-verse-focus' : ''}`}
                            onClick={() => handleStudyVerseClick(v, vNo)}
                          >
                            <span className="compare-verse-no">{vNo}</span>
                            <span className="compare-verse-text">{v.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {studyVerseData && studyActiveTab === 'about' && (() => {
                const info = BOOK_INFO[studyVerseData.bookEnglish];
                const chapterCount = selectedBibleBook?.chapters?.length ?? '?';
                const verseCount = bibleVerses?.length ?? '?';
                return (
                  <div className="study-section">
                    <div className="study-about-book-title">
                      {studyVerseData.bookTamil && studyVerseData.bookTamil !== studyVerseData.bookEnglish
                        ? studyVerseData.bookTamil
                        : studyVerseData.bookEnglish}
                    </div>
                    {studyVerseData.bookTamil && studyVerseData.bookTamil !== studyVerseData.bookEnglish && (
                      <div className="study-about-book-subtitle">{studyVerseData.bookEnglish}</div>
                    )}

                    <div className="study-about-stats-row">
                      <div className="study-about-stat">
                        <span className="study-about-stat-value">{chapterCount}</span>
                        <span className="study-about-stat-label">Chapters</span>
                      </div>
                      <div className="study-about-stat">
                        <span className="study-about-stat-value">{verseCount}</span>
                        <span className="study-about-stat-label">Verses in ch. {studyVerseData.chapterNum}</span>
                      </div>
                    </div>

                    {info ? (
                      <>
                        <div className="study-about-card">
                          <div className="study-about-card-label">Theme</div>
                          <div className="study-about-card-text">{info.theme}</div>
                        </div>
                        <div className="study-about-meta-row">
                          <div className="study-about-meta-item">
                            <span className="study-about-meta-key">Author</span>
                            <span className="study-about-meta-val">{info.author}</span>
                          </div>
                          <div className="study-about-meta-item">
                            <span className="study-about-meta-key">Period</span>
                            <span className="study-about-meta-val">{info.period}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="study-empty-state">Book information not available.</div>
                    )}

                    <div className="study-about-card" style={{ marginTop: '1rem' }}>
                      <div className="study-about-card-label">You are reading</div>
                      <div className="study-about-card-text">
                        {studyVerseData.bookEnglish} chapter {studyVerseData.chapterNum}, verse {studyVerseData.verseNo}.
                        {totalChapters > 1 && ` This book has ${totalChapters} chapters.`}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* AI Insights tab */}
              {studyVerseData && studyActiveTab === 'ai' && (
                <div className="study-section study-ai-section">
                  <div className="study-ai-header">
                    <FaMagic size={22} className="study-ai-icon" />
                    <div className="study-ai-title">AI Insights</div>
                    <div className="study-ai-subtitle">
                      Deep analysis powered by artificial intelligence
                    </div>
                  </div>

                  {!aiInsightText && !aiInsightLoading && (
                    <button className="study-ai-generate-btn" onClick={handleGenerateAiInsight}>
                      Generate Insights
                    </button>
                  )}

                  {aiInsightLoading && (
                    <div className="study-ai-loading">
                      <div className="study-ai-dots">
                        <span /><span /><span />
                      </div>
                      <p>Analysing verse…</p>
                    </div>
                  )}

                  {aiInsightText && !aiInsightLoading && (
                    <>
                      <div className="study-ai-result">
                        <p>{aiInsightText}</p>
                      </div>
                      <button
                        className="study-ai-regen-btn"
                        onClick={() => { setAiInsightText(''); setAiInsightLoading(false); }}
                      >
                        Try again
                      </button>
                    </>
                  )}

                  <div className="study-ai-cards-grid">
                    {[
                      { label: 'Historical Context',  icon: '🏛️', desc: 'Background of the time and place' },
                      { label: 'Theological Themes',  icon: '✝️', desc: 'Core doctrines present in the verse' },
                      { label: 'Application',         icon: '💡', desc: 'How to apply this truth today' },
                      { label: 'Cross-Tradition',     icon: '🌐', desc: 'How different traditions read this' },
                    ].map(card => (
                      <div key={card.label} className="study-ai-card">
                        <span className="study-ai-card-icon">{card.icon}</span>
                        <span className="study-ai-card-label">{card.label}</span>
                        <span className="study-ai-card-desc">{card.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      {/* ── Compare — version picker sheet ── */}
      {compareSheetOpen && (
        <div className="bible-backdrop" style={{ zIndex: 60 }} onClick={() => setCompareSheetOpen(false)}>
          <div className="bible-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Select Bible Version</div>
            <div className="book-list-scroll">
              {[
                { code: 'TSV',  label: 'Tamil Standard Version',    lang: 'Tamil',     available: true },
                { code: 'KJV',  label: 'King James Version',        lang: 'English',   available: false },
                { code: 'NIV',  label: 'New International Version', lang: 'English',   available: false },
                { code: 'ESV',  label: 'English Standard Version',  lang: 'English',   available: false },
                { code: 'NASB', label: 'New American Standard',     lang: 'English',   available: false },
                { code: 'NLT',  label: 'New Living Translation',    lang: 'English',   available: false },
                { code: 'MSG',  label: 'The Message',               lang: 'English',   available: false },
                { code: 'GNT',  label: 'Greek New Testament',       lang: 'Greek',     available: false },
                { code: 'LXX',  label: 'Septuagint',                lang: 'Greek',     available: false },
                { code: 'VUL',  label: 'Vulgate',                   lang: 'Latin',     available: false },
                { code: 'HIN',  label: 'Hindi Bible (BSI)',         lang: 'Hindi',     available: false },
                { code: 'TEL',  label: 'Telugu Bible',              lang: 'Telugu',    available: false },
                { code: 'MAL',  label: 'Malayalam Bible',           lang: 'Malayalam', available: false },
              ].map(v => (
                <button
                  key={v.code}
                  className={`book-list-item compare-version-item${compareVersion === v.code ? ' active' : ''}${!v.available ? ' compare-version-item-locked' : ''}`}
                  onClick={() => { if (v.available) { setCompareVersion(v.code); setCompareSheetOpen(false); } }}
                >
                  <div className="compare-sheet-item-main">
                    <span className="compare-sheet-code">{v.code}</span>
                    <span className="book-item-primary">{v.label}</span>
                  </div>
                  <div className="compare-sheet-item-right">
                    <span className="compare-sheet-lang">{v.lang}</span>
                    {!v.available && <span className="compare-sheet-soon">Coming soon</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
