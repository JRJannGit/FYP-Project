
function initAssignments() {
  const list       = document.getElementById('assignments-list');
  const emptyState = document.getElementById('assignments-empty');
  const addBtn     = document.getElementById('open-add-modal');

  const modal       = document.getElementById('assignment-modal');
  const modalTitle  = document.getElementById('assignment-modal-title');
  const form        = document.getElementById('assignment-form');
  const closeBtn    = document.getElementById('assignment-modal-close');
  const cancelBtn   = document.getElementById('assignment-modal-cancel');
  const saveBtn     = document.getElementById('assignment-modal-save');

  const inputId     = document.getElementById('assignment-id');
  const inputSubject= document.getElementById('assignment-subject');
  const inputDesc   = document.getElementById('assignment-desc');
  const inputDue    = document.getElementById('assignment-due');
  const inputExam   = document.getElementById('assignment-exam');

  let currentFilter = 'all';
  let allAssignments = [];

  function getUserId() {
    const user = AppStorage.getUser();
    if (!user) return null;
    return user.student_id || user.lecturer_id || user.admin_id || user.identifier || null;
  }

  let currentUserId = getUserId();

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function badgeClass(days) {
    if (days === null || days < 0) return 'due-soon';
    if (days <= 3) return 'due-soon';
    if (days <= 7) return 'due-medium';
    return 'due-normal';
  }

  function renderAssignments() {
    if (!list) return;

    let filtered = allAssignments;
    if (currentFilter === 'upcoming')  filtered = allAssignments.filter(a => !a.completed);
    if (currentFilter === 'completed') filtered = allAssignments.filter(a => a.completed);

    if (filtered.length === 0) {
      list.innerHTML = '';
      list.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    list.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    list.innerHTML = `
      <div class="assignments-table">
        <div class="assignments-table-header">
          <div>Subject</div>
          <div>Due Date</div>
          <div style="text-align:right;">Action</div>
        </div>
        ${filtered.map(a => {
          const days = daysUntil(a.due_date);
          const completed = !!a.completed;
          const badge = completed ? '' : (
            days !== null && days >= 0
              ? `<span class="badge ${badgeClass(days)}">${days} day${days === 1 ? '' : 's'} left</span>`
              : (days !== null && days < 0
                  ? `<span class="badge due-soon">overdue</span>`
                  : '')
          );

          return `
            <div class="assignment-row ${completed ? 'completed' : ''}" data-id="${a.id}">
              <div class="assignment-subject">
                <input type="checkbox" ${completed ? 'checked' : ''} data-action="toggle" data-id="${a.id}">
                <div>
                  <h4>
                    ${a.subject}
                    ${a.is_exam ? '<span class="exam-tag">EXAM</span>' : ''}
                  </h4>
                  <p>${a.description || ''}</p>
                </div>
              </div>
              <div class="assignment-due">
                ${formatDate(a.due_date)}
                ${badge ? `<small>${badge}</small>` : ''}
              </div>
              <div class="assignment-actions">
                <button class="icon-btn" data-action="edit" data-id="${a.id}" title="Edit">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="icon-btn danger" data-action="delete" data-id="${a.id}" title="Delete">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function loadAssignments() {
    if (!currentUserId) {
      list.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Please log in to view assignments.</p>';
      return;
    }
    const res = await API.get(`/api/assignments/student/${currentUserId}`);
    if (!res.success) {
      list.innerHTML = `<p style="padding:20px;color:#f87171;">Failed to load: ${res.error}</p>`;
      return;
    }
    allAssignments = res.data;
    renderAssignments();
  }

  function openModal(mode = 'add', assignment = null) {
    if (mode === 'edit' && assignment) {
      modalTitle.innerText = 'Edit Assignment';
      inputId.value      = assignment.id;
      inputSubject.value = assignment.subject;
      inputDesc.value    = assignment.description || '';
      inputDue.value     = assignment.due_date ? assignment.due_date.slice(0, 10) : '';
      inputExam.checked  = !!assignment.is_exam;
    } else {
      modalTitle.innerText = 'Add Assignment';
      form.reset();
      inputId.value = '';
    }
    modal.style.display = 'flex';
    setTimeout(() => inputSubject.focus(), 50);
  }

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
    inputId.value = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      subject: inputSubject.value.trim(),
      description: inputDesc.value.trim(),
      due_date: inputDue.value,
      is_exam: inputExam.checked
    };
    if (!payload.subject || !payload.due_date) return;

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    let res;
    if (inputId.value) {
      res = await API.put(`/api/assignments/${inputId.value}`, payload);
    } else {
      res = await API.post('/api/assignments', payload);
    }

    saveBtn.disabled = false;
    saveBtn.innerText = 'Save';

    if (!res.success) {
      alert('Save failed: ' + res.error);
      return;
    }
    closeModal();
    loadAssignments();
  });

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'edit') {
      const assignment = allAssignments.find(a => String(a.id) === String(id));
      if (assignment) openModal('edit', assignment);
    }
    else if (action === 'delete') {
      if (!confirm('Delete this assignment?')) return;
      const res = await API.delete(`/api/assignments/${id}`);
      if (res.success) loadAssignments();
      else alert('Delete failed: ' + res.error);
    }
  });

  list.addEventListener('change', async (e) => {
    const chk = e.target.closest('input[data-action="toggle"]');
    if (!chk) return;
    const id = chk.dataset.id;
    const completed = chk.checked;
    const res = await API.post(`/api/assignments/${id}/toggle`, {
      student_id: currentUserId,
      completed
    });
    if (res.success) loadAssignments();
    else alert('Toggle failed: ' + res.error);
  });

  if (addBtn) addBtn.addEventListener('click', () => openModal('add'));
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') closeModal();
  });

  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderAssignments();
    });
  });

  currentUserId = getUserId();
  loadAssignments();
}

window.initAssignments = initAssignments;