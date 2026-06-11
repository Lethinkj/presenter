const NOTES_KEY = 'worshipcast_notes';

export const getNotes = () => {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); }
  catch { return []; }
};

export const saveNote = (note) => {
  const notes = getNotes();
  const idx = notes.findIndex(n => n.id === note.id);
  const updated = { ...note, updatedAt: Date.now() };
  if (idx >= 0) notes[idx] = updated;
  else notes.unshift(updated);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  return updated;
};

export const deleteNote = (id) => {
  const notes = getNotes().filter(n => n.id !== id);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const createNote = (initial = {}) => {
  const now = Date.now();
  return {
    id: String(now),
    title: '',
    content: '',
    verseRef: null,
    createdAt: now,
    updatedAt: now,
    ...initial,
  };
};
