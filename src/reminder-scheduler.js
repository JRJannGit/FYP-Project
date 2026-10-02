// =========================================
// src/reminder-scheduler.js
// Checks every 30s for upcoming reminders
// and triggers desktop popup
// =========================================

(function () {
  if (!window.require) return;
  const { ipcRenderer } = window.require('electron');

  const CHECK_INTERVAL_MS = 30 * 1000;   // every 30s
  const DUE_WINDOW_MIN    = 5;            // within next 5 minutes
  const triggeredIds = new Set();

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}.${String(m).padStart(2, '0')} ${ampm}`;
  }

  async function checkReminders() {
    const user = AppStorage.getUser();
    if (!user) return;

    const res = await API.get(`/api/reminders/${user.student_id}/due?minutes=${DUE_WINDOW_MIN}`);
    if (!res.success || !res.data || res.data.length === 0) return;

    for (const r of res.data) {
      // Use date+time as unique key so same reminder doesn't fire twice
      const key = `${r.id}@${r.remind_date}T${r.remind_time}`;
      if (triggeredIds.has(key)) continue;

      triggeredIds.add(key);

      ipcRenderer.send('trigger-notification', {
        id: r.id,
        title: r.title,
        description: r.description,
        priority: r.priority,
        time: `${new Date(r.remind_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${formatTime(r.remind_time)}`
      });
    }
  }

  // Listen for main process asking to open reminders view
  ipcRenderer.on('open-view', (event, viewName) => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
    if (window.loadView) window.loadView(viewName);
    // Clear triggered set so re-notification works next time
    triggeredIds.clear();
  });

  // Start checking
  document.addEventListener('DOMContentLoaded', () => {
    // First check after 5 seconds (let app fully load)
    setTimeout(checkReminders, 5000);
    // Then every 30s
    setInterval(checkReminders, CHECK_INTERVAL_MS);
  });

  // Manual trigger for testing
  window.testReminderPopup = () => {
    ipcRenderer.send('trigger-notification', {
      title: 'Test Reminder',
      description: 'This is a test notification popup.',
      priority: 'urgent',
      time: new Date().toLocaleString('en-GB')
    });
  };
})();