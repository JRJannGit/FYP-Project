function initNotes() {
  const notesList = document.querySelector('.notes-list');
  const titleInput = document.querySelector('.note-title-input');
  const contentArea = document.querySelector('.editor-content');
  const newNoteBtn = document.querySelector('.new-note-btn');
  let activeNoteId = null;

  function renderNotesList() {
    const notes = AppStorage.get('notes');
    if (!notesList) return;

    notesList.innerHTML = '';
    notes.forEach((note, index) => {
      if (index === 0 && !activeNoteId) activeNoteId = note.id;

      const item = document.createElement('div');
      item.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
      item.innerHTML = `
        <h5>${note.title}</h5>
        <span class="note-date">${note.date}</span>
      `;
      item.onclick = () => loadNote(note.id);
      notesList.appendChild(item);
    });

    if (activeNoteId) loadNote(activeNoteId);
  }

  function loadNote(id) {
    activeNoteId = id;
    const notes = AppStorage.get('notes');
    const note = notes.find(n => n.id === id);
    
    if (note) {
      if (titleInput) titleInput.value = note.title;
      if (contentArea) contentArea.innerHTML = note.content;
    }
    
    document.querySelectorAll('.note-item').forEach(el => el.classList.remove('active'));
    renderNotesList();
  }

  // Auto-save Catatan saat Mengetik
  function saveCurrentNote() {
    if (!activeNoteId) return;
    const notes = AppStorage.get('notes');
    const note = notes.find(n => n.id === activeNoteId);
    if (note) {
      note.title = titleInput.value;
      note.content = contentArea.innerHTML;
      AppStorage.set('notes', notes);
    }
  }

  if (titleInput) titleInput.oninput = saveCurrentNote;
  if (contentArea) contentArea.oninput = saveCurrentNote;

  // Tambah Catatan Baru
  if (newNoteBtn) {
    newNoteBtn.onclick = () => {
      const notes = AppStorage.get('notes');
      const newNote = {
        id: Date.now(),
        title: 'Catatan Baru',
        content: 'Tulis isi catatan di sini...',
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      };
      notes.unshift(newNote);
      AppStorage.set('notes', notes);
      activeNoteId = newNote.id;
      renderNotesList();
    };
  }

  renderNotesList();
}