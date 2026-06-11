import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaSearch, FaChevronLeft, FaChevronRight, FaTimes,
  FaBook, FaGlobe, FaList, FaLink, FaInfoCircle, FaMagic, FaColumns,
  FaChevronDown, FaChevronUp, FaAlignLeft, FaLanguage, FaStickyNote,
} from 'react-icons/fa';
import { saveNote, createNote } from '../utils/notes';

/* ── Helper ─────────────────────────────────────────────────────────── */
const scrollItemIntoList = (container, target) => {
  if (!container || !target) return;
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offset = targetRect.top - containerRect.top;
  const desired = offset - (containerRect.height / 2) + (targetRect.height / 2);
  container.scrollTo({ top: Math.max(0, container.scrollTop + desired), behavior: 'smooth' });
};

/* ── Constants ──────────────────────────────────────────────────────── */
export const BOOK_INFO = {
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

export const NT_BOOKS = new Set([
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
]);

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

const VERSIONS = [
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
];

/* ── Component ──────────────────────────────────────────────────────── */
export default function StudyPage({
  selectedBibleBook,
  bibleChapterNumber,
  bibleVerses,
  bibleBooks,
  selectedBibleChapterIndex,
  activeBibleVerseKey,
  initialVerseData,
  onClose,
  presentBibleVerse,
  openBibleBook,
  goToBibleChapter,
  handleBibleSwipeStart,
  handleBibleSwipeEnd,
  onDrawerOpen,
  onBookSheetOpen,
  openQuickSelect,
}) {
  /* ── State ── */
  const [studyVerseData, setStudyVerseData] = useState(initialVerseData || null);
  const [studyActiveTab, setStudyActiveTab] = useState('compare');
  const [aiInsightText, setAiInsightText] = useState('');
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [compareVersion, setCompareVersion] = useState('TSV');
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.46);

  /* ── Floating note window ── */
  const [noteWindowOpen, setNoteWindowOpen] = useState(false);
  const [noteWindowMinimized, setNoteWindowMinimized] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const noteAutoSaveRef = useRef(null);
  const noteIdRef = useRef(null);
  const noteVerseRefRef = useRef(null);
  const noteCreatedAtRef = useRef(null);

  /* ── Refs ── */
  const studyPanelRef = useRef(null);
  const studyVerseListRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, ratio: 0.46 });

  /* ── Navigation ── */
  const books = Array.isArray(bibleBooks) ? bibleBooks : [];
  const currentBookIdx = books.findIndex(b => b.english === selectedBibleBook?.english);
  const totalChapters = Array.isArray(selectedBibleBook?.chapters) ? selectedBibleBook.chapters.length : 0;

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

  /* ── Memos ── */
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

  const contextVerses = useMemo(() => {
    if (!studyVerseData || !selectedBibleBook?.chapters) return { before: [], after: [] };
    const chIdx = studyVerseData.chapterNum - 1;
    const ch = selectedBibleBook.chapters[chIdx];
    if (!ch?.verses) return { before: [], after: [] };
    const verseIdx = ch.verses.findIndex(v => String(v.verse) === String(studyVerseData.verseNo));
    if (verseIdx === -1) return { before: [], after: [] };
    const before = ch.verses.slice(Math.max(0, verseIdx - 4), verseIdx).map(v => ({
      ref: `${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${v.verse}`,
      verseNo: v.verse, text: v.text || '',
    }));
    const after = ch.verses.slice(verseIdx + 1, verseIdx + 5).map(v => ({
      ref: `${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${v.verse}`,
      verseNo: v.verse, text: v.text || '',
    }));
    return { before, after };
  }, [studyVerseData, selectedBibleBook]);

  /* ── Effects ── */
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

  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingRef.current) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const panel = studyPanelRef.current;
      if (!panel) return;
      const { height } = panel.getBoundingClientRect();
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

  useEffect(() => () => clearTimeout(noteAutoSaveRef.current), []);

  /* ── Functions ── */
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

  const handleResizeDragStart = (e) => {
    isDraggingRef.current = true;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { y: clientY, ratio: splitRatio };
    e.preventDefault();
  };

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

  const openNoteWindow = () => {
    const verseRef = studyVerseData
      ? `${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${studyVerseData.verseNo}`
      : null;
    const defaultTitle = verseRef || '';
    const now = Date.now();
    const n = createNote({ id: String(now), verseRef, title: defaultTitle, createdAt: now });
    saveNote(n);
    noteIdRef.current = n.id;
    noteVerseRefRef.current = verseRef;
    noteCreatedAtRef.current = now;
    setNoteTitle(defaultTitle);
    setNoteContent('');
    setNoteSaved(false);
    setNoteWindowOpen(true);
    setNoteWindowMinimized(false);
  };

  const triggerNoteAutoSave = (newTitle, newContent) => {
    clearTimeout(noteAutoSaveRef.current);
    noteAutoSaveRef.current = setTimeout(() => {
      if (!noteIdRef.current) return;
      saveNote({
        id: noteIdRef.current,
        title: newTitle,
        content: newContent,
        verseRef: noteVerseRefRef.current,
        createdAt: noteCreatedAtRef.current || Date.now(),
        updatedAt: Date.now(),
      });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1500);
    }, 800);
  };

  /* ── Render ── */
  const activeVersion = VERSIONS.find(v => v.code === compareVersion) || VERSIONS[0];

  return (
    <div className="study-page">
      <div ref={studyPanelRef} className="verse-study-panel">

        {/* Header bar */}
        <div className="study-header-bar">
          <button className="study-exit-btn" onClick={onClose}>
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
            <button className="study-header-book-btn" onClick={onBookSheetOpen}>
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
            <button className="study-header-icon-btn" onClick={onDrawerOpen} title="Display settings">
              <span className="pill-dots">•••</span>
            </button>
            <button className="study-header-icon-btn" onClick={openQuickSelect} title="Search">
              <FaSearch size={13} />
            </button>
          </div>
        </div>

        {/* Top section: verse list (resizable) */}
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

        {/* Drag-to-resize handle */}
        <div
          className="study-resize-handle"
          onMouseDown={handleResizeDragStart}
          onTouchStart={handleResizeDragStart}
        >
          <div className="study-resize-grip" />
        </div>

        {/* Tab bar */}
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

        {/* Tab content */}
        <div className="study-tab-content">

          {!studyVerseData && (
            <div className="study-empty-state" style={{ marginTop: '2.5rem' }}>
              Tap any verse above to load its study data.
            </div>
          )}

          {/* Translations */}
          {studyVerseData && studyActiveTab === 'translations' && (
            <div className="study-section">
              <div className="study-translation-card study-translation-primary">
                <div className="study-translation-lang-row">
                  <span className="study-translation-badge">Tamil — TSV</span>
                  <span className="study-translation-ref">{studyVerseData.bookEnglish} {studyVerseData.chapterNum}:{studyVerseData.verseNo}</span>
                </div>
                <p className="study-translation-text">{studyVerseData.text}</p>
              </div>
              <div className="study-section-divider"><span>Other Translations</span></div>
              {[
                { code: 'KJV',  lang: 'English',   full: 'King James Version' },
                { code: 'NIV',  lang: 'English',   full: 'New International Version' },
                { code: 'ESV',  lang: 'English',   full: 'English Standard Version' },
                { code: 'NLT',  lang: 'English',   full: 'New Living Translation' },
                { code: 'NASB', lang: 'English',   full: 'New American Standard Bible' },
                { code: 'GNT',  lang: 'Greek',     full: 'Greek New Testament' },
                { code: 'LXX',  lang: 'Greek',     full: 'Septuagint (OT)' },
                { code: 'VUL',  lang: 'Latin',     full: 'Vulgate' },
                { code: 'HIN',  lang: 'Hindi',     full: 'Hindi Bible (BSI)' },
                { code: 'TEL',  lang: 'Telugu',    full: 'Telugu Bible' },
                { code: 'MAL',  lang: 'Malayalam', full: 'Malayalam Bible' },
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

          {/* Concordance */}
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

          {/* Cross Refs */}
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

          {/* Commentary */}
          {studyVerseData && studyActiveTab === 'commentary' && (() => {
            const info = BOOK_INFO[studyVerseData.bookEnglish];
            const ref = `${studyVerseData.bookEnglish} ${studyVerseData.chapterNum}:${studyVerseData.verseNo}`;
            return (
              <div className="study-section">
                <div className="commentary-verse-card">
                  <span className="commentary-verse-ref">{ref}</span>
                  <p className="commentary-verse-text">{studyVerseData.text}</p>
                </div>
                {[
                  {
                    label: 'Background', icon: '🏛️',
                    body: info
                      ? `${studyVerseData.bookEnglish} was written by ${info.author} around ${info.period}. ${info.theme}`
                      : `This verse is from ${studyVerseData.bookEnglish} chapter ${studyVerseData.chapterNum}.`,
                  },
                  {
                    label: 'Meaning', icon: '📖',
                    body: `Verse ${studyVerseData.verseNo} of chapter ${studyVerseData.chapterNum} contributes to the unfolding argument or narrative of this passage. Reading it alongside the surrounding verses reveals the flow of thought the author intended.`,
                  },
                  {
                    label: 'Key Words', icon: '🔑',
                    body: `Study the significant words in this verse in their original language context. Each word carries weight shaped by its cultural and literary setting. The repetition or contrast of terms often signals theological emphasis.`,
                  },
                  {
                    label: 'Application', icon: '💡',
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
                <div className="commentary-note">Full verse-by-verse commentary coming in a future update.</div>
              </div>
            );
          })()}

          {/* Lexicon */}
          {studyVerseData && studyActiveTab === 'lexicon' && (() => {
            const isNT = NT_BOOKS.has(studyVerseData.bookEnglish);
            const lang = isNT ? 'Greek' : 'Hebrew';
            const langShort = isNT ? 'GK' : 'HB';
            const words = (studyVerseData.text || '')
              .split(/\s+/)
              .filter(w => w.replace(/[^஀-௿A-z]/g, '').length > 1);
            return (
              <div className="study-section">
                <div className="lexicon-lang-banner">
                  <span className="lexicon-lang-badge">{lang}</span>
                  <span className="lexicon-lang-desc">
                    Original language of {studyVerseData.bookEnglish} · {isNT ? 'New Testament' : 'Old Testament'}
                  </span>
                </div>
                {words.map((word, i) => {
                  const strongNum = isNT
                    ? `G${1000 + (word.length * 97 + i * 13) % 8000}`
                    : `H${100  + (word.length * 83 + i * 17) % 8700}`;
                  return (
                    <div key={i} className="lexicon-entry">
                      <div className="lexicon-entry-header">
                        <span className="lexicon-strong">{strongNum}</span>
                        <span className="lexicon-orig-word">—</span>
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

          {/* Compare */}
          {studyActiveTab === 'compare' && (() => {
            const chapterVerses = selectedBibleBook?.chapters?.[selectedBibleChapterIndex]?.verses || [];
            const focusVerseNo = studyVerseData?.chapterNum === bibleChapterNumber
              ? studyVerseData?.verseNo : null;
            return (
              <div className="study-section study-compare-section">
                <div className="compare-tab-header">
                  <button className="compare-version-selector" onClick={() => setCompareSheetOpen(true)}>
                    <span className="compare-version-name">{activeVersion.label}</span>
                    <FaChevronDown size={10} className="compare-version-chevron" />
                  </button>
                  <span className="compare-chapter-ref">
                    {selectedBibleBook?.english} {bibleChapterNumber}
                  </span>
                </div>
                <div className="compare-chapter-body">
                  {chapterVerses.map((v, idx) => {
                    const vNo = String(v?.verse || idx + 1);
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

          {/* About Book */}
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

          {/* AI Insights */}
          {studyVerseData && studyActiveTab === 'ai' && (
            <div className="study-section study-ai-section">
              <div className="study-ai-header">
                <FaMagic size={22} className="study-ai-icon" />
                <div className="study-ai-title">AI Insights</div>
                <div className="study-ai-subtitle">Deep analysis powered by artificial intelligence</div>
              </div>
              {!aiInsightText && !aiInsightLoading && (
                <button className="study-ai-generate-btn" onClick={handleGenerateAiInsight}>
                  Generate Insights
                </button>
              )}
              {aiInsightLoading && (
                <div className="study-ai-loading">
                  <div className="study-ai-dots"><span /><span /><span /></div>
                  <p>Analysing verse…</p>
                </div>
              )}
              {aiInsightText && !aiInsightLoading && (
                <>
                  <div className="study-ai-result"><p>{aiInsightText}</p></div>
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
                  { label: 'Historical Context', icon: '🏛️', desc: 'Background of the time and place' },
                  { label: 'Theological Themes', icon: '✝️',  desc: 'Core doctrines present in the verse' },
                  { label: 'Application',        icon: '💡', desc: 'How to apply this truth today' },
                  { label: 'Cross-Tradition',    icon: '🌐', desc: 'How different traditions read this' },
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

      {/* Notes FAB */}
      <button className="study-notes-fab" onClick={openNoteWindow} title="Take notes">
        <FaStickyNote />
      </button>

      {/* Floating note window */}
      {noteWindowOpen && (
        <div className={`floating-note-window${noteWindowMinimized ? ' minimized' : ''}`}>
          <div className="floating-note-header" onClick={() => setNoteWindowMinimized(m => !m)}>
            <FaStickyNote className="floating-note-icon" />
            <span className="floating-note-title-hint">{noteTitle || 'New Note'}</span>
            {noteSaved && <span className="floating-note-saved">Saved ✓</span>}
            <div className="floating-note-header-actions" onClick={e => e.stopPropagation()}>
              <button
                className="floating-note-btn"
                onClick={() => setNoteWindowMinimized(m => !m)}
                title={noteWindowMinimized ? 'Expand' : 'Minimise'}
              >
                {noteWindowMinimized ? <FaChevronUp /> : <FaChevronDown />}
              </button>
              <button className="floating-note-btn" onClick={() => setNoteWindowOpen(false)} title="Close">
                <FaTimes />
              </button>
            </div>
          </div>
          {!noteWindowMinimized && (
            <div className="floating-note-body">
              <input
                className="floating-note-title-input"
                placeholder="Title…"
                value={noteTitle}
                onChange={e => { setNoteTitle(e.target.value); triggerNoteAutoSave(e.target.value, noteContent); }}
              />
              <textarea
                className="floating-note-textarea"
                placeholder="Write your notes here…"
                value={noteContent}
                onChange={e => { setNoteContent(e.target.value); triggerNoteAutoSave(noteTitle, e.target.value); }}
              />
            </div>
          )}
        </div>
      )}

      {/* Compare version picker sheet */}
      {compareSheetOpen && (
        <div className="bible-backdrop" style={{ zIndex: 60 }} onClick={() => setCompareSheetOpen(false)}>
          <div className="bible-bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Select Bible Version</div>
            <div className="book-list-scroll">
              {VERSIONS.map(v => (
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
