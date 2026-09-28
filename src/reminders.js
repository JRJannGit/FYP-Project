function initReminders() {
  if (!localStorage.getItem('uptm_buddy_reminders')) {
    AppStorage.set('reminders', [
      { id: 1, title: 'Database Assignment Due Date', desc: 'Submit final report and ERD model', date: '2026-08-22', priority: 'urgent' },
      { id: 2, title: 'OOP Quiz Preparation', desc: 'Review Chapter 4 - 6 slides', date: '2026-09-01', priority: 'warning' }
    ]);
  }

  renderReminders();

  const addBtn = document.querySelector('.add-reminder-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      const title = prompt("Tajuk Peringatan:");
      const desc = prompt("Keterangan Ringkas:");
      const date = prompt("Tarikh (YYYY-MM-DD):");

      if (title) {
        const reminders = AppStorage.get('reminders');
        reminders.push({ id: Date.now(), title, desc: desc || '', date: date || 'Soon', priority: 'normal' });
        AppStorage.set('reminders', reminders);
        renderReminders();
      }
    };
  }
}

function renderReminders() {
  const container = document.querySelector('.reminders-list');
  const reminders = AppStorage.get('reminders');
  if (!container) return;

  container.innerHTML = reminders.length ? '' : '<p style="color:var(--text-muted);">Tiada peringatan aktif.</p>';

  reminders.forEach(r => {
    container.innerHTML += `
      <div class="reminder-card ${r.priority}">
        <div class="reminder-icon"><i class="fa-solid fa-bell"></i></div>
        <div class="reminder-details">
          <h4>${r.title}</h4>
          <p>${r.desc}</p>
          <span class="reminder-time"><i class="fa-regular fa-clock"></i> ${r.date}</span>
        </div>
        <div class="reminder-actions">
          <button class="icon-btn-danger" onclick="deleteReminder(${r.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });
}

function deleteReminder(id) {
  let reminders = AppStorage.get('reminders');
  reminders = reminders.filter(r => r.id !== id);
  AppStorage.set('reminders', reminders);
  renderReminders();
}

document.addEventListener('DOMContentLoaded', initReminders);