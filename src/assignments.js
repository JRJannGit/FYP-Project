// =========================================
// src/assignments.js
// =========================================

function initAssignments() {
  const list = document.getElementById('assignments-list');
  const emptyState = document.getElementById('assignments-empty');
  const addBtn = document.getElementById('open-add-modal');

  const modal = document.getElementById('assignment-modal');
  const modalTitle = document.getElementById('assignment-modal-title');
  const form = document.getElementById('assignment-form');
  const closeBtn = document.getElementById('assignment-modal-close');
  const cancelBtn = document.getElementById('assignment-modal-cancel');
  const saveBtn = document.getElementById('assignment-modal-save');

  const inputId = document.getElementById('assignment-id');
  const inputSubject = document.getElementById('assignment-subject');
  const inputDesc = document.getElementById('assignment-desc');
  const inputDue = document.getElementById('assignment-due');
  const inputExam = document.getElementById('assignment-exam');

  let currentFilter = 'all';
  let allAssignments = [];
  let studentId = AppStorage.getUser()?.student_id;

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysUntil(d) {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / 86400000);
  }

  function badgeClass(days) {
    if (days === null) return '';
    if (days < 0 || days <= 3) return 'due-soon';
    if (days <= 7) return 'due-medium';
    return 'due-normal';
  }

  function render() {
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
          const comp = !!a.completed;
          const badge = comp ? '' :
            (days !== null && days >= 0
              ? `<span class="badge ${badgeClass(days)}">${days} day${days === 1 ? '' : 's'} left</span>`
              : (days !== null ? `<span class="badge due-soon">overdue</span>` : ''));
          return `
            <div class="assignment-row ${comp ? 'completed' : ''}">
              <div class="assignment-subject">
                <input type="checkbox" ${comp ? 'checked' : ''} data-action="toggle" data-id="${a.id}">
                <div>
                  <h4>${a.subject}${a.is_exam ? '<span class="exam-tag">EXAM</span>' : ''}</h4>
                  <p>${a.description || ''}</p>
                </div>
              </div>
              <div class="assignment-due">${formatDate(a.due_date)}${badge ? `<small>${badge}</small>` : ''}</div>
              <div class="assignment-actions">
                <button class="icon-btn" data-action="edit" data-id="${a.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn danger" data-action="delete" data-id="${a.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function load() {
    if (!studentId) {
      list.innerHTML = '<p style="padding:20px;color:var(--text-muted);">Please log in to view assignments.</p>';
      return;
    }
    const res = await API.get(`/api/assignments/student/${studentId}`);
    if (!res.success) {
      list.innerHTML = `<p style="padding:20px;color:#f87171;">Failed: ${res.error}</p>`;
      return;
    }
    allAssignments = res.data;
    render();
  }

  function openModal(mode, a) {
    if (mode === 'edit' && a) {
      modalTitle.innerText = 'Edit Assignment';
      inputId.value = a.id;
      inputSubject.value = a.subject;
      inputDesc.value = a.description || '';
      inputDue.value = a.due_date ? a.due_date.slice(0, 10) : '';
      inputExam.checked = !!a.is_exam;
    } else {
      modalTitle.innerText = 'Add Assignment';
      form.reset();
      inputId.value = '';
    }
    modal.style.display = 'flex';
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
    const res = inputId.value
      ? await API.put(`/api/assignments/${inputId.value}`, payload)
      : await API.post('/api/assignments', payload);
    saveBtn.disabled = false;
    saveBtn.innerText = 'Save';

    if (!res.success) { alert('Save failed: ' + res.error); return; }
    closeModal();
    load();
  });

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit') {
      const a = allAssignments.find(x => String(x.id) === String(id));
      if (a) openModal('edit', a);
    } else if (action === 'delete') {
      if (!confirm('Delete this assignment?')) return;
      const res = await API.delete(`/api/assignments/${id}`);
      if (res.success) load();
      else alert('Delete failed: ' + res.error);
    }
  });

  list.addEventListener('change', async (e) => {
    const chk = e.target.closest('input[data-action="toggle"]');
    if (!chk) return;
    const res = await API.post(`/api/assignments/${chk.dataset.id}/toggle`, {
      student_id: studentId, completed: chk.checked
    });
    if (res.success) load();
    else alert('Toggle failed: ' + res.error);
  });

  addBtn.addEventListener('click', () => openModal('add'));
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeModal(); });

  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  studentId = AppStorage.getUser()?.student_id;
  load();
}

window.initAssignments = initAssignments;