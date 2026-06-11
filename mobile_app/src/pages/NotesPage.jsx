import { useState, useRef, useEffect } from 'react';
import { FaArrowLeft, FaTrash, FaStickyNote, FaPlus } from 'react-icons/fa';
import { getNotes, saveNote, deleteNote, createNote } from '../utils/notes';

export default function NotesPage() {
  const [view, setView] = useState('list');
  const [notes, setNotes] = useState(() =>
    getNotes().sort((a, b) => b.updatedAt - a.updatedAt)
  );
  const [activeNote, setActiveNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [savedIndicator, setSavedIndicator] = useState(false);
  const autoSaveRef = useRef(null);
  const savedTimerRef = useRef(null);
  const activeNoteRef = useRef(null);

  const refreshNotes = () =>
    setNotes(getNotes().sort((a, b) => b.updatedAt - a.updatedAt));

  const openNote = (note) => {
    activeNoteRef.current = note;
    setActiveNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSavedIndicator(false);
    setView('edit');
  };

  const openNew = () => {
    const n = createNote();
    saveNote(n);
    openNote(n);
    refreshNotes();
  };

  const doSave = (newTitle, newContent) => {
    const note = activeNoteRef.current;
    if (!note) return;
    const updated = saveNote({ ...note, title: newTitle, content: newContent });
    activeNoteRef.current = updated;
    setActiveNote(updated);
    refreshNotes();
    setSavedIndicator(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedIndicator(false), 1500);
  };

  const triggerAutoSave = (newTitle, newContent) => {
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => doSave(newTitle, newContent), 800);
  };

  const handleDelete = () => {
    if (!activeNoteRef.current) return;
    clearTimeout(autoSaveRef.current);
    deleteNote(activeNoteRef.current.id);
    activeNoteRef.current = null;
    setActiveNote(null);
    refreshNotes();
    setView('list');
  };

  const handleBack = () => {
    clearTimeout(autoSaveRef.current);
    doSave(title, content);
    setView('list');
  };

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    clearTimeout(savedTimerRef.current);
  }, []);

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  if (view === 'edit') {
    return (
      <div className="notes-editor-page">
        <div className="notes-editor-topbar">
          <button className="notes-back-btn" onClick={handleBack}>
            <FaArrowLeft />
          </button>
          <span className={`notes-editor-saved${savedIndicator ? ' visible' : ''}`}>
            Saved ✓
          </span>
          <button className="notes-delete-btn" onClick={handleDelete}>
            <FaTrash />
          </button>
        </div>
        {activeNote?.verseRef && (
          <div className="notes-verse-ref-badge">{activeNote.verseRef}</div>
        )}
        <input
          className="notes-title-input"
          placeholder="Note title…"
          value={title}
          onChange={e => { setTitle(e.target.value); triggerAutoSave(e.target.value, content); }}
        />
        <textarea
          className="notes-content-area"
          placeholder="Write your notes here…"
          value={content}
          onChange={e => { setContent(e.target.value); triggerAutoSave(title, e.target.value); }}
        />
      </div>
    );
  }

  return (
    <div className="notes-list-page">
      {notes.length === 0 ? (
        <div className="notes-empty-state">
          <FaStickyNote className="notes-empty-icon" />
          <p className="notes-empty-title">No notes yet</p>
          <p className="notes-empty-sub">Tap + to write your first note</p>
        </div>
      ) : (
        <div className="notes-list">
          {notes.map(note => (
            <button key={note.id} className="note-card" onClick={() => openNote(note)}>
              <div className="note-card-header">
                <span className="note-card-title">
                  {note.title || note.verseRef || 'Untitled'}
                </span>
                {note.verseRef && note.title && (
                  <span className="note-card-ref">{note.verseRef}</span>
                )}
              </div>
              <p className="note-card-preview">
                {note.content
                  ? note.content.slice(0, 90) + (note.content.length > 90 ? '…' : '')
                  : 'No content'}
              </p>
              <span className="note-card-date">{formatDate(note.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
      <button className="notes-fab" onClick={openNew}>
        <FaPlus />
      </button>
    </div>
  );
}
