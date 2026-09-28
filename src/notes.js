function initNotes() {
  const notesList = document.querySelector('.notes-list');
  const titleInput = document.querySelector('.note-title-input');
  const contentArea = document.querySelector('.editor-content');
  const newNoteBtn = document.querySelector('.new-note-btn');
  let activeNoteId = null;

  // 1. Memaparkan senarai nota tanpa memanggil loadNote() secara berulang
  function renderNotesList() {
    const notes = AppStorage.get('notes');
    if (!notesList) return;

    notesList.innerHTML = '';

    if (notes.length === 0) {
      notesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; padding: 10px;">Tiada catatan.</p>';
      return;
    }

    // Jika tiada nota aktif dipilih, pilih nota pertama secara automatik
    if (!activeNoteId && notes.length > 0) {
      activeNoteId = notes[0].id;
    }

    notes.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
      item.innerHTML = `
        <h5>${note.title || 'Tanpa Tajuk'}</h5>
        <span class="note-date">${note.date}</span>
      `;
      
      // Tukar nota aktif apabila diklik
      item.addEventListener('click', () => {
        activeNoteId = note.id;
        loadNoteContent(note.id);
        
        // Kemaskini status 'active' pada UI
        document.querySelectorAll('.note-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });

      notesList.appendChild(item);
    });

    // Muat kandungan nota aktif pertama kali
    if (activeNoteId) {
      loadNoteContent(activeNoteId);
    }
  }

  // 2. Hanya memuat kandungan ke dalam editor
  function loadNoteContent(id) {
    const notes = AppStorage.get('notes');
    const note = notes.find(n => n.id === id);
    
    if (note) {
      if (titleInput) titleInput.value = note.title;
      if (contentArea) contentArea.innerHTML = note.content;
    }
  }

  // 3. Simpan perubahan secara automatik semasa mengetik
  function saveCurrentNote() {
    if (!activeNoteId) return;
    
    const notes = AppStorage.get('notes');
    const note = notes.find(n => n.id === activeNoteId);
    
    if (note) {
      note.title = titleInput.value;
      note.content = contentArea.innerHTML;
      AppStorage.set('notes', notes);

      // Kemaskini tajuk pada senarai tanpa melukis semula seluruh senarai
      const activeItemHeading = document.querySelector('.note-item.active h5');
      if (activeItemHeading) {
        activeItemHeading.innerText = note.title || 'Tanpa Tajuk';
      }
    }
  }

  if (titleInput) titleInput.oninput = saveCurrentNote;
  if (contentArea) contentArea.oninput = saveCurrentNote;

  // 4. Tambah Nota Baru
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

document.addEventListener('DOMContentLoaded', initNotes);