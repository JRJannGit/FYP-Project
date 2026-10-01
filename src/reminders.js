// =========================================
// src/reminders.js
// =========================================

function initReminders() {
  const container = document.querySelector('.reminders-list');
  const addBtn = document.querySelector('.add-reminder-btn');
  const studentId = AppStorage.getUser()?.student_id;

  let reminders = [];

  async function load() {
    if (!studentId) {
      if (container) container.innerHTML = '<p style="color:var(--text-muted);">Please log in.</p>';
      return;
    }
    const res = await API.get(`/api/reminders/${studentId}`);
    if (!res.success) {
      if (container) container.innerHTML = `<p style="color:#f87171;">Failed: ${res.error}</p>`;
      return;
    }
    reminders = res.data;
    render();
  }

  function render() {
    if (!container) return;
    if (reminders.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);padding:20px;">Tiada peringatan aktif.</p>';
      return;
    }
    container.innerHTML = reminders.map(r => `
      <div class="reminder-card ${r.priority}">
        <div class="reminder-icon"><i class="fa-solid fa-bell"></i></div>
        <div class="reminder-details">
          <h4>${r.title}</h4>
          <p>${r.description || ''}</p>
          <span class="reminder-time"><i class="fa-regular fa-clock"></i> ${r.remind_date}</span>
        </div>
        <div class="reminder-actions">
          <button class="icon-btn-danger" data-id="${r.id}" data-action="delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  container?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    if (!confirm('Delete this reminder?')) return;
    const res = await API.delete(`/api/reminders/${btn.dataset.id}`);
    if (res.success) load();
  });

  if (addBtn) {
    addBtn.onclick = async () => {
      const title = prompt('Tajuk Peringatan:');
      if (!title) return;
      const description = prompt('Keterangan:') || '';
      const remind_date = prompt('Tarikh (YYYY-MM-DD):');
      if (!remind_date) return;
      const priority = prompt('Priority (urgent/warning/normal):', 'normal') || 'normal';

      const res = await API.post('/api/reminders', {
        student_id: studentId, title, description, remind_date, priority
      });
      if (res.success) load();
      else alert('Save failed: ' + res.error);
    };
  }

  load();
}

window.initReminders = initReminders;