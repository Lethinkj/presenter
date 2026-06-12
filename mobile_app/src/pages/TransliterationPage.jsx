import { useState, useCallback } from 'react';
import { FaCopy, FaSave, FaExchangeAlt, FaRobot, FaEdit } from 'react-icons/fa';

const LANGUAGES = [
  { key: 'tamil',      label: 'Tamil',     nativeLabel: 'தமிழ்' },
  { key: 'malayalam',  label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { key: 'telugu',     label: 'Telugu',    nativeLabel: 'తెలుగు' },
  { key: 'kannada',    label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ' },
  { key: 'devanagari', label: 'Hindi',     nativeLabel: 'हिंदी' },
];

function buildAiPrompt(language, direction, text) {
  const lang = LANGUAGES.find(l => l.key === language);
  const langName = lang?.label ?? language;
  const romanName = language === 'tamil' ? 'Tanglish' : language === 'malayalam' ? 'Manglish' : `${langName} romanization`;

  if (direction === 'roman-to-native') {
    return `Convert these ${langName} song lyrics written in English letters (${romanName}) to ${langName} script.\nUse colloquial, singer-friendly ${langName} — not technical transliteration marks.\nReturn only the converted lyrics, preserving line breaks. No explanations.\n\nLyrics:\n${text}`;
  }
  return `Transliterate these ${langName} song lyrics into English letters (${romanName}).\nUse singer-friendly romanization — e.g. "naan", "kaadhal", "unnai" — not academic notation like ā or ṭ.\nReturn only the transliteration, preserving line breaks. No explanations.\n\nLyrics:\n${text}`;
}

export default function TransliterationPage({ openHomeCard }) {
  const [language, setLanguage]     = useState('tamil');
  const [direction, setDirection]   = useState('roman-to-native');
  const [inputText, setInputText]   = useState('');
  const [outputText, setOutputText] = useState('');
  const [copyMsg, setCopyMsg]       = useState('');
  const [showPaste, setShowPaste]   = useState(false);
  const [pasteText, setPasteText]   = useState('');
  const [error, setError]           = useState('');

  const selectedLang = LANGUAGES.find(l => l.key === language);
  const hasOutput = !!outputText && !showPaste;

  const toggleDirection = () => {
    setDirection(d => d === 'roman-to-native' ? 'native-to-roman' : 'roman-to-native');
    setInputText(outputText);
    setOutputText(inputText);
  };

  const openAI = useCallback((app) => {
    if (!inputText.trim()) { setError('Paste some lyrics first.'); return; }
    setError('');
    const prompt = buildAiPrompt(language, direction, inputText);
    const encoded = encodeURIComponent(prompt);
    const url = app === 'claude'
      ? `https://claude.ai/new?q=${encoded}`
      : `https://chatgpt.com/?prompt=${encoded}`;
    window.open(url, '_blank');
    setShowPaste(true);
  }, [inputText, language, direction]);

  const applyPaste = () => {
    setOutputText(pasteText);
    setPasteText('');
    setShowPaste(false);
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 1800);
    });
  };

  const handleSave = () => {
    if (!outputText.trim()) return;
    sessionStorage.setItem('addSongPrefill', outputText.trim());
    openHomeCard('db');
  };

  const reset = () => {
    setOutputText('');
    setShowPaste(false);
    setPasteText('');
    setError('');
  };

  const dirLabel = direction === 'roman-to-native'
    ? `Roman → ${selectedLang?.nativeLabel}`
    : `${selectedLang?.nativeLabel} → Roman`;

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'calc(var(--safe-top) + 4rem)',
    }}>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px' }}>

        {/* Input phase — hidden once output is ready */}
        {!hasOutput && (
          <>
            {/* Language + direction */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select
                id="lyrics-language"
                value={language}
                onChange={e => setLanguage(e.target.value)}
                style={{
                  flex: 1, padding: '9px 10px',
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)', borderRadius: 10,
                  fontSize: '0.88rem',
                }}
              >
                {LANGUAGES.map(l => (
                  <option key={l.key} value={l.key}>{l.label} ({l.nativeLabel})</option>
                ))}
              </select>
              <button
                onClick={toggleDirection}
                style={{
                  flexShrink: 0, padding: '9px 11px',
                  background: 'var(--bg-card)', color: 'var(--accent-color)',
                  border: '1px solid var(--border-color)', borderRadius: 10,
                  fontSize: '0.78rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                }}
              >
                <FaExchangeAlt size={11} /> {dirLabel}
              </button>
            </div>

            {/* Input textarea */}
            <textarea
              id="lyrics-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={direction === 'roman-to-native'
                ? 'Paste Manglish / Tanglish lyrics here...'
                : 'Paste native script lyrics here...'}
              rows={7}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 12px',
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: 10,
                fontSize: '0.92rem', lineHeight: 1.65,
                resize: 'vertical', fontFamily: 'inherit', marginBottom: 12,
              }}
            />

            {error && <p style={{ color: 'var(--error-color)', fontSize: '0.82rem', margin: '0 0 10px' }}>{error}</p>}

            {/* Convert buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => openAI('claude')}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10, border: 'none',
                  background: '#7c3aed', color: '#fff', cursor: 'pointer',
                  fontSize: '0.88rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <FaRobot size={14} /> Claude AI
              </button>
              <button
                onClick={() => openAI('chatgpt')}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10, border: 'none',
                  background: '#10a37f', color: '#fff', cursor: 'pointer',
                  fontSize: '0.88rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <FaRobot size={14} /> ChatGPT
              </button>
            </div>
          </>
        )}

        {/* AI paste-back panel */}
        {showPaste && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid #7c3aed',
            borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
              Copy the AI result and paste it below:
            </p>
            <textarea
              id="lyrics-paste-result"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste AI result here..."
              rows={8}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: 8,
                fontSize: '0.9rem', lineHeight: 1.65, resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={applyPaste}
                disabled={!pasteText.trim()}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                  background: '#7c3aed', color: '#fff', cursor: 'pointer',
                  fontSize: '0.88rem', fontWeight: 600, opacity: pasteText.trim() ? 1 : 0.4,
                }}
              >
                Apply Result
              </button>
              <button
                onClick={() => { setShowPaste(false); setPasteText(''); }}
                style={{
                  padding: '11px 16px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.88rem',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Side-by-side comparison — shown when output is ready */}
        {hasOutput && (
          <>
            {/* Re-edit link */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={reset}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <FaEdit size={11} /> Edit / Re-convert
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {/* Original */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{
                  fontSize: '0.68rem', color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
                }}>Original</span>
                <div style={{
                  padding: '10px 11px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  borderRadius: 10, fontSize: '0.85rem', lineHeight: 1.75,
                  whiteSpace: 'pre-wrap', color: 'var(--text-secondary)',
                }}>
                  {inputText || '—'}
                </div>
              </div>

              {/* Converted */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{
                  fontSize: '0.68rem', color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
                }}>Converted</span>
                <textarea
                  id="lyrics-output"
                  value={outputText}
                  onChange={e => setOutputText(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 11px', background: 'var(--bg-card)',
                    border: '1px solid var(--accent-color)',
                    borderRadius: 10, fontSize: '0.85rem', lineHeight: 1.75,
                    color: 'var(--text-primary)', fontFamily: 'inherit',
                    resize: 'none', minHeight: 200,
                    overflowY: 'auto', height: 'auto',
                  }}
                  ref={el => {
                    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                  }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Fixed bottom action bar ── */}
      {hasOutput && (
        <div style={{
          flexShrink: 0,
          padding: '10px 14px',
          paddingBottom: 'calc(var(--safe-bottom) + 10px)',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1, padding: '13px', borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <FaCopy size={14} /> {copyMsg || 'Copy'}
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1, padding: '13px', borderRadius: 10, border: 'none',
              background: 'var(--accent-color)', color: '#fff',
              cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <FaSave size={14} /> Save as Song
          </button>
        </div>
      )}
    </div>
  );
}
