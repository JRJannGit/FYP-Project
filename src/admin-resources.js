// =========================================
// src/admin-resources.js
// Admin can CRUD all resources (system + user)
// =========================================

function initAdminResources() {
  console.log('[Admin Resources] init');

  const grid = document.getElementById('resources-grid');
  const addBtn = document.getElementById('btn-add-resource');

  const modal       = document.getElementById('resource-modal');
  const modalTitle  = document.getElementById('resource-modal-title');
  const form        = document.getElementById('resource-form');
  const closeBtn    = document.getElementById('resource-modal-close');
  const cancelBtn   = document.getElementById('resource-modal-cancel');
  const saveBtn     = document.getElementById('resource-modal-save');

  const inputId      = document.getElementById('resource-id');
  const inputTitle   = document.getElementById('resource-title');
  const inputCaption = document.getElementById('resource-caption');
  const inputUrl     = document.getElementById('resource-url');
  const inputSystem  = document.getElementById('resource-system');

  const deleteModal = document.getElementById('delete-resource-modal');
  const deleteName  = document.getElementById('delete-resource-name');
  const deleteYes   = document.getElementById('delete-resource-yes');
  const deleteNo    = document.getElementById('delete-resource-no');
  const deleteClose = document.getElementById('delete-resource-close');

  const user = window.Auth?.getUser?.();
  const userId = user?.admin_id || user?.identifier || 'ADMIN001';

  let resources = [];
  let pendingDeleteId = null;

  // ============ Helpers ============
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function getIconClass(url) {
    if (!url) return 'fa-link';
    const u = url.toLowerCase();
    if (u.includes('ucam')) return 'fa-graduation-cap';
    if (u.includes('openlearning')) return 'fa-book-open';
    if (u.includes('mail') || u.includes('gmail')) return 'fa-envelope';
    if (u.includes('uptm.edu')) return 'fa-globe';
    return 'fa-link';
  }

  function openInElectron(url) {
    if (!url) return;
    window.open(url, '_blank');
  }

  // ============ Render ============
  function render() {
    if (!grid) return;

    if (resources.length === 0) {
      grid.innerHTML = `
        <div class="resources-empty">
          <i class="fa-solid fa-link"></i>
          No resources yet. Click <strong>Add url-link</strong> to create one.
        </div>
      `;
      return;
    }

    grid.innerHTML = resources.map(r => {
      const url = r.url_link || r.url || '#';
      const caption = r.caption || r.description || 'Text...';
      const icon = r.icon || getIconClass(url);
      const isSystem = r.is_system === true || r.is_system === 1;

      const badge = isSystem
        ? '<span class="system-badge">System</span>'
        : '<span class="owner-badge">Custom</span>';

      return `
        <div class="resource-card ${isSystem ? 'system' : ''}" data-id="${r.id}" data-url="${escapeHtml(url)}">
          <div class="card-brand">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="card-info">
            <h4>${escapeHtml(r.title)} ${badge}</h4>
            <p>${escapeHtml(caption)}</p>
          </div>
          <div class="card-actions">
            <button class="icon-btn-sm" data-action="edit" data-id="${r.id}" title="Edit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="icon-btn-sm danger" data-action="delete" data-id="${r.id}" title="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
            <button class="icon-btn-sm" data-action="open" data-id="${r.id}" title="Open">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============ Load ============
  async function load() {
    const res = await API.get('/api/resources');
    if (!res.success) {
      grid.innerHTML = `<div class="resources-empty" style="color:#f87171;">Failed: ${res.error}</div>`;
      return;
    }
    resources = res.data;
    render();
  }

  // ============ Modal ============
  function openModal(mode = 'add', r = null) {
    if (mode === 'edit' && r) {
      modalTitle.innerText = 'Edit Resource';
      saveBtn.innerText = 'Save';
      inputId.value      = r.id;
      inputTitle.value   = r.title || '';
      inputCaption.value = r.caption || r.description || '';
      inputUrl.value     = r.url_link || r.url || '';
      inputSystem.checked = (r.is_system === true || r.is_system === 1);
    } else {
      modalTitle.innerText = 'Add Resource';
      saveBtn.innerText = 'Add';
      form.reset();
      inputId.value = '';
      inputSystem.checked = false;
    }
    modal.style.display = 'flex';
    setTimeout(() => inputTitle.focus(), 60);
  }

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
    inputId.value = '';
  }

  // ============ Save ============
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: inputTitle.value.trim(),
      caption: inputCaption.value.trim(),
      url_link: inputUrl.value.trim(),
      icon: getIconClass(inputUrl.value.trim()),
      created_by: userId,
      is_system: inputSystem.checked
    };
    if (!payload.title || !payload.url_link) return;

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    const res = inputId.value
      ? await API.put(`/api/resources/${inputId.value}`, payload)
      : await API.post('/api/resources', payload);

    saveBtn.disabled = false;
    saveBtn.innerText = inputId.value ? 'Save' : 'Add';

    if (!res.success) {
      alert('Save failed: ' + res.error);
      return;
    }
    closeModal();
    load();
  });

  // ============ Grid click ============
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const r = resources.find(x => String(x.id) === String(id));
      if (!r) return;

      if (action === 'edit') {
        openModal('edit', r);
      } else if (action === 'delete') {
        openDeleteModal(id);
      } else if (action === 'open') {
        openInElectron(r.url_link || r.url);
      }
      return;
    }

    // Card body → open URL
    const card = e.target.closest('.resource-card');
    if (card) {
      openInElectron(card.dataset.url);
    }
  });

  // ============ Delete flow ============
  function openDeleteModal(id) {
    const r = resources.find(x => String(x.id) === String(id));
    if (!r) return;
    pendingDeleteId = id;
    deleteName.innerText = `"${r.title}" will be permanently deleted.`;
    deleteModal.style.display = 'flex';
  }

  function closeDeleteModal() {
    deleteModal.style.display = 'none';
    pendingDeleteId = null;
  }

  deleteYes.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const res = await API.delete(`/api/resources/${pendingDeleteId}`);
    if (res.success) {
      closeDeleteModal();
      load();
    } else {
      alert('Delete failed: ' + res.error);
    }
  });

  deleteNo.addEventListener('click', closeDeleteModal);
  deleteClose.addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  // ============ Buttons ============
  if (addBtn) addBtn.addEventListener('click', () => openModal('add'));
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (deleteModal.style.display === 'flex') { closeDeleteModal(); return; }
    if (modal.style.display === 'flex') closeModal();
  });

  // ============ Init ============
  load();
}

window.initAdminResources = initAdminResources;