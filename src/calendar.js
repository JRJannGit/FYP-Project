function initCalendar() {
  const eventsList = document.querySelector('.events-list');
  const assignments = AppStorage.get('assignments');
  const reminders = AppStorage.get('reminders');

  if (!eventsList) return;
  eventsList.innerHTML = '';

  // Gabungkan tugasan dan peringatan ke kalendar
  const allEvents = [
    ...assignments.map(a => ({ title: a.title, date: a.due, type: 'red' })),
    ...reminders.map(r => ({ title: r.title, date: r.date, type: 'blue' }))
  ];

  if (allEvents.length === 0) {
    eventsList.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem;">Tiada acara disimpan.</p>';
    return;
  }

  allEvents.forEach(e => {
    eventsList.innerHTML += `
      <div class="event-item">
        <div class="event-date-badge ${e.type}">
          <span class="day">${e.date ? e.date.split('-')[2] || '20' : '20'}</span>
          <span class="month">AUG</span>
        </div>
        <div class="event-info">
          <h5>${e.title}</h5>
          <p><i class="fa-regular fa-clock"></i> Simpanan Tetap</p>
        </div>
      </div>
    `;
  });
}

document.addEventListener('DOMContentLoaded', initCalendar);