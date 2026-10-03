// =========================================
// src/reminder-scheduler.js
// Check every 30s for upcoming reminders
// Trigger desktop popup via IPC
// =========================================

(function () {
  if (!window.require) {
    console.warn('[scheduler] electron not available');
    return;
  }

  const { ipcRenderer } = window.require('electron');

  const CHECK_INTERVAL_MS = 30 * 1000;   // 30s
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
    if (typeof API === 'undefined') return;

    // Respect "Show Notifications" toggle
    const showNotif = window.__showNotifications !== false &&
                      localStorage.getItem('uptm_notif') !== 'off';
    if (!showNotif) {
      console.log('[scheduler] Notifications disabled — skipping');
      return;
    }

    const user = AppStorage.getUser();
    if (!user) return;

    const studentId = user.student_id || user.identifier;
    if (!studentId) return;

    const res = await API.get(`/api/reminders/${studentId}/due?minutes=${DUE_WINDOW_MIN}`);
    if (!res.success || !res.data || res.data.length === 0) return;

    for (const r of res.data) {
      const key = `${r.id}@${r.remind_date}T${r.remind_time}`;
      if (triggeredIds.has(key)) continue;
      triggeredIds.add(key);

      console.log('[scheduler] Triggering popup for:', r.title);
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
    triggeredIds.clear();
  });

  // Start checking
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkReminders, 5000);
    setInterval(checkReminders, CHECK_INTERVAL_MS);
  });

  // Manual trigger (for testing in DevTools)
  window.testReminderPopup = function () {
    console.log('[scheduler] Manual test trigger');
    ipcRenderer.send('trigger-notification', {
      title: 'Test Reminder',
      description: 'This is a test notification popup.',
      priority: 'urgent',
      time: new Date().toLocaleString('en-GB')
    });
  };

  console.log('[scheduler] Loaded. Test with: window.testReminderPopup()');
})();