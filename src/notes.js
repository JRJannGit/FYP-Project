
function initNotes() {
  const notesList   = document.getElementById('notes-list');
  const searchInput = document.getElementById('search-notes');
  const newBtn      = document.getElementById('btn-new-note');

  const noteModal   = document.getElementById('note-modal');
  const modalTitle  = document.getElementById('modal-title-input');
  const modalToolbar= document.getElementById('modal-toolbar');
  const modalContent= document.getElementById('modal-content');
  const modalFile   = document.getElementById('modal-file-input');
  const modalClose  = document.getElementById('modal-close-btn');

  const btnEdit     = document.getElementById('modal-btn-edit');
  const btnDiscard  = document.getElementById('modal-btn-discard');
  const btnDelete   = document.getElementById('modal-btn-delete');

  const zoomOutBtn  = document.getElementById('zoom-out-btn');
  const zoomInBtn   = document.getElementById('zoom-in-btn');
  const zoomValueBtn= document.getElementById('zoom-value-btn');

  const discardModal = document.getElementById('discard-modal');
  const discardYes   = document.getElementById('discard-yes');
  const discardNo    = document.getElementById('discard-no');
  const discardClose = document.getElementById('discard-close');

  const deleteModal  = document.getElementById('delete-modal');
  const deleteName   = document.getElementById('delete-note-name');
  const deleteYes    = document.getElementById('delete-yes');
  const deleteNo     = document.getElementById('delete-no');
  const deleteClose  = document.getElementById('delete-close');

  const _u = AppStorage.getUser();
  const studentId = _u
    ? (_u.student_id || _u.lecturer_id || _u.admin_id || _u.identifier)
    : null;
    
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;
  const ZOOM_STEP = 10;

  let notes = [];
  let activeId = null;
  let originalTitle = '';
  let originalContent = '';
  let isEditMode = false;
  let searchTerm = '';
  let currentZoom = 100;
  let isNewUnsaved = false; // true while a brand-new note (from "Add Note") has never been saved

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function formatSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
  function getFileKind(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc','docx'].includes(ext)) return 'doc';
    if (['ppt','pptx'].includes(ext)) return 'ppt';
    if (['xls','xlsx'].includes(ext)) return 'xls';
    return 'file';
  }
  function getFileIcon(kind) {
    return {
      pdf:'fa-file-pdf', doc:'fa-file-word',
      ppt:'fa-file-powerpoint', xls:'fa-file-excel', file:'fa-file'
    }[kind] || 'fa-file';
  }

  function refreshEditorState() {
    if (!modalContent) return;
    if (isEditMode) modalContent.setAttribute('contenteditable', 'true');
    else            modalContent.setAttribute('contenteditable', 'false');

    try {
      const range = document.createRange();
      range.selectNodeContents(modalContent);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}

    if (isEditMode) modalContent.focus();
  }

  function applyZoom() {
    modalContent.style.zoom = (currentZoom / 100);

    zoomValueBtn.innerText = currentZoom + '%';
    zoomOutBtn.disabled = currentZoom <= ZOOM_MIN;
    zoomInBtn.disabled  = currentZoom >= ZOOM_MAX;
  }

  function zoomIn()    { currentZoom = Math.min(ZOOM_MAX, currentZoom + ZOOM_STEP); applyZoom(); }
  function zoomOut()   { currentZoom = Math.max(ZOOM_MIN, currentZoom - ZOOM_STEP); applyZoom(); }
  function zoomReset() { currentZoom = 100; applyZoom(); }

  zoomInBtn.addEventListener('click', zoomIn);
  zoomOutBtn.addEventListener('click', zoomOut);
  zoomValueBtn.addEventListener('click', zoomReset);

  modalContent.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || noteModal.style.display !== 'flex') return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); }
    if (e.key === '-')                   { e.preventDefault(); zoomOut(); }
    if (e.key === '0')                   { e.preventDefault(); zoomReset(); }
  });

  function enterViewMode() {
    isEditMode = false;
    modalTitle.readOnly = true;
    modalContent.setAttribute('contenteditable', 'false');
    modalToolbar.style.display = 'none';
    btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
    btnEdit.classList.remove('btn-save-mode');
    document.body.classList.remove('notes-edit-mode');
  }

  function enterEditMode() {
    isEditMode = true;
    modalTitle.readOnly = false;
    modalContent.setAttribute('contenteditable', 'true');
    modalToolbar.style.display = 'flex';
    btnEdit.innerHTML = '<i class="fa-solid fa-check"></i> Save';
    btnEdit.classList.add('btn-save-mode');
    document.body.classList.add('notes-edit-mode');
    refreshEditorState();
    modalTitle.focus();
  }

  async function load() {
    if (!studentId) {
      notesList.innerHTML = '<p class="notes-empty">Please log in.</p>';
      return;
    }
    const res = await API.get(`/api/notes/${studentId}`);
    if (!res.success) {
      notesList.innerHTML = `<p class="notes-empty" style="color:#f87171;">Failed: ${res.error}</p>`;
      return;
    }
    notes = res.data;
    renderList();
  }

  function renderList() {
    if (!notesList) return;
    const filtered = notes.filter(n => {
      if (!searchTerm) return true;
      const t = (n.title || '').toLowerCase();
      const c = (n.content || '').toLowerCase();
      return t.includes(searchTerm) || c.includes(searchTerm);
    });

    if (filtered.length === 0) {
      notesList.innerHTML = '<p class="notes-empty">No notes found.</p>';
      return;
    }

    notesList.innerHTML = filtered.map(n => {
      const tmp = document.createElement('div');
      tmp.innerHTML = n.content || '';
      const preview = (tmp.textContent || '').trim().slice(0, 60);

      return `
        <div class="note-item ${n.id === activeId ? 'active' : ''}" data-id="${n.id}">
          <h5>${escapeHtml(n.title) || 'Untitled'}</h5>
          <span class="note-date">${new Date(n.updated_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          ${preview ? `<div class="note-item__preview">${escapeHtml(preview)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function openNoteModal(note) {
    activeId = note.id;
    originalTitle = note.title || '';
    originalContent = note.content || '';
    modalTitle.value = originalTitle;
    modalContent.innerHTML = originalContent;
    enterViewMode();
    zoomReset();
    noteModal.style.display = 'flex';
  }

  function closeNoteModal() {
    // A brand-new note that is closed without any edits is removed completely,
    // so an empty "New Note" is never left behind in the list.
    if (isNewUnsaved && activeId) {
      const note = notes.find(n => n.id === activeId);
      const titleNow = (modalTitle.value || '').trim();
      const hasText  = (modalContent.textContent || '').trim().length > 0;
      const hasMedia = modalContent.querySelector('.note-attachment, img');
      if (note && titleNow === 'New Note' && !hasText && !hasMedia) {
        const delId = activeId;
        notes = notes.filter(n => n.id !== delId);
        API.delete(`/api/notes/${delId}`);
        renderList();
      }
    }
    noteModal.style.display = 'none';
    activeId = null;
    isEditMode = false;
    isNewUnsaved = false;
    document.body.classList.remove('notes-edit-mode');
  }

  async function saveNow() {
    if (!activeId) return true;
    const note = notes.find(n => n.id === activeId);
    if (!note) return true;

    const newTitle = modalTitle.value.trim() || 'Untitled';
    const newContent = modalContent.innerHTML;

    if (newTitle === originalTitle && newContent === originalContent) return true;

    const res = await API.put(`/api/notes/${activeId}`, {
      title: newTitle, content: newContent
    });

    if (res.success) {
      note.title = newTitle;
      note.content = newContent;
      note.updated_at = new Date().toISOString();
      originalTitle = newTitle;
      originalContent = newContent;
      isNewUnsaved = false; // note is now persisted — it is no longer "brand new"
      renderList();
      return true;
    }
    console.error('Save failed:', res.error);
    return false;
  }

  notesList.addEventListener('click', (e) => {
    const item = e.target.closest('.note-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    const note = notes.find(n => n.id === id);
    if (note) {
      activeId = id;
      renderList();
      openNoteModal(note);
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderList();
    });
  }

  document.querySelectorAll('.tool-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isEditMode) return;
      modalContent.focus();

      const sel = window.getSelection();
      if (!sel.rangeCount || !modalContent.contains(sel.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(modalContent);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      try { document.execCommand(btn.dataset.cmd, false, null); }
      catch (err) { console.warn('execCommand failed:', err); }
    });
  });

  if (modalFile) {
    modalFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      if (!isEditMode) return;

      if (file.size > MAX_FILE_SIZE) {
        alert(`File too large. Max: 10MB. Yours: ${formatSize(file.size)}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const kind = getFileKind(file.name);

        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = dataUrl;
          img.alt = file.name;
          insertAtCursor(img);
        } else {
          insertAtCursor(buildAttachmentEl(file.name, file.size, kind, dataUrl));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function buildAttachmentEl(filename, size, kind, dataUrl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'note-attachment';
    wrapper.setAttribute('data-filename', filename);
    wrapper.setAttribute('data-kind', kind);
    wrapper.setAttribute('data-src', dataUrl);
    wrapper.setAttribute('contenteditable', 'false');

    wrapper.innerHTML = `
      <div class="note-attachment__icon ${kind}">
        <i class="fa-solid ${getFileIcon(kind)}"></i>
      </div>
      <div class="note-attachment__info">
        <div class="note-attachment__name">${escapeHtml(filename)}</div>
        <div class="note-attachment__size">${formatSize(size)}</div>
      </div>
      <div class="note-attachment__actions">
        <button class="note-attachment__btn" data-action="open" title="Download">
          <i class="fa-solid fa-download"></i>
        </button>
        <button class="note-attachment__btn danger" data-action="remove" title="Remove">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
    return wrapper;
  }

  function insertAtCursor(node) {
    modalContent.focus();
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && modalContent.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      const newRange = document.createRange();
      newRange.setStartAfter(node);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      modalContent.appendChild(node);
    }
  }

  modalContent.addEventListener('click', (e) => {
    const btn = e.target.closest('.note-attachment__btn');
    if (!btn) return;
    const wrapper = btn.closest('.note-attachment');
    if (!wrapper) return;

    if (btn.dataset.action === 'remove') {
      if (!isEditMode) return;
      wrapper.remove();
    } else if (btn.dataset.action === 'open') {
      const a = document.createElement('a');
      a.href = wrapper.getAttribute('data-src');
      a.download = wrapper.getAttribute('data-filename');
      a.click();
    }
  });

  modalClose.addEventListener('click', closeNoteModal);
  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) closeNoteModal();
  });

  btnEdit.addEventListener('click', async () => {
    if (!isEditMode) {
      enterEditMode();
    } else {
      const ok = await saveNow();
      if (ok) enterViewMode();
      else alert('Save failed. Please try again.');
    }
  });

  btnDiscard.addEventListener('click', () => {
    if (!isEditMode) {
      modalTitle.value = originalTitle;
      modalContent.innerHTML = originalContent;
      refreshEditorState();
      return;
    }
    discardModal.style.display = 'flex';
  });

  discardYes.addEventListener('click', async () => {
    discardModal.style.display = 'none';

    // Discarding a brand-new note removes it entirely instead of keeping it.
    if (isNewUnsaved && activeId) {
      const delId = activeId;
      isNewUnsaved = false;
      activeId = null;
      const res = await API.delete(`/api/notes/${delId}`);
      if (res.success) {
        notes = notes.filter(n => n.id !== delId);
      } else {
        alert('Could not discard note: ' + res.error);
      }
      closeNoteModal();
      renderList();
      return;
    }

    modalTitle.value = originalTitle;
    modalContent.innerHTML = originalContent;
    enterViewMode();
    refreshEditorState();
  });

  discardNo.addEventListener('click', () => { discardModal.style.display = 'none'; });
  discardClose.addEventListener('click', () => { discardModal.style.display = 'none'; });
  discardModal.addEventListener('click', (e) => {
    if (e.target === discardModal) discardModal.style.display = 'none';
  });

  btnDelete.addEventListener('click', () => {
    if (!activeId) return;
    const n = notes.find(x => x.id === activeId);
    if (n) deleteName.innerText = `"${n.title || 'Untitled'}" will be permanently deleted.`;
    deleteModal.style.display = 'flex';
  });

  deleteYes.addEventListener('click', async () => {
    if (!activeId) return;
    const res = await API.delete(`/api/notes/${activeId}`);
    if (res.success) {
      deleteModal.style.display = 'none';
      notes = notes.filter(n => n.id !== activeId);
      closeNoteModal();
      renderList();
    } else {
      alert('Delete failed: ' + res.error);
    }
  });
  deleteNo.addEventListener('click', () => { deleteModal.style.display = 'none'; });
  deleteClose.addEventListener('click', () => { deleteModal.style.display = 'none'; });
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) deleteModal.style.display = 'none';
  });

  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      const res = await API.post('/api/notes', {
        student_id: studentId, title: 'New Note', content: ''
      });
      if (res.success) {
        await load();
        const note = notes.find(n => n.id === res.data.id);
        if (note) {
          activeId = note.id;
          renderList();
          openNoteModal(note);
          enterEditMode();
          isNewUnsaved = true; // note only exists in DB as "New Note" until saved
        }
      } else {
        alert('Create failed: ' + res.error);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (discardModal.style.display === 'flex') { discardModal.style.display = 'none'; return; }
    if (deleteModal.style.display === 'flex')  { deleteModal.style.display = 'none';  return; }
    if (noteModal.style.display === 'flex')    closeNoteModal();
  });

  applyZoom();
  load();
}

window.initNotes = initNotes;