// =========================================
// src/reminder-scheduler.js
// Check every 30s for upcoming reminders
// Trigger desktop popup via IPC
// =========================================

(function () {
  const CHECK_INTERVAL_MS = 30 * 1000;   // 30s
  const DUE_WINDOW_MIN    = 5;           // within next 5 minutes
  const triggeredIds = new Set();

  // Electron : popup via IPC → native BrowserWindow
  // Browser  : no Electron — in-page DOM toast popup instead
  let ipcRenderer = null;
  if (window.require) {
    try {
      ipcRenderer = window.require('electron').ipcRenderer;
    } catch (err) {
      console.warn('[scheduler] electron IPC unavailable — using in-page popup');
    }
  }

  const PRIORITY_STYLES = {
    urgent: { label: 'URGENT', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.16)' },
    high:   { label: 'HIGH',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' },
    normal: { label: 'NORMAL', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.16)' }
  };

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}.${String(m).padStart(2, '0')} ${ampm}`;
  }

  // =========================================
  // Browser-mode DOM toast (same look as notification.html)
  // =========================================
  const TOAST_CSS = `
    .uptm-toast-host { position: fixed; right: 20px; bottom: 20px; z-index: 99999;
      display: flex; flex-direction: column; gap: 12px; }
    .uptm-toast { width: 360px; max-width: calc(100vw - 40px); padding: 16px 18px 16px 22px;
      background: linear-gradient(180deg, #1a2236 0%, #151c2e 100%); color: #e2e8f0;
      border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 16px; position: relative;
      overflow: hidden; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      animation: uptmToastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
    .uptm-toast::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
      background: linear-gradient(180deg, var(--primary-blue, #3b82f6), var(--primary-accent, #2563eb)); }
    .uptm-toast__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .uptm-toast__brand { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.3px;
      text-transform: uppercase; color: #94a3b8; }
    .uptm-toast__close { background: transparent; border: none; color: #64748b; cursor: pointer;
      font-size: 1rem; line-height: 1; padding: 2px 6px; border-radius: 6px; }
    .uptm-toast__close:hover { color: #fff; background: rgba(239, 68, 68, 0.15); }
    .uptm-toast__badge { display: inline-block; font-size: 0.65rem; font-weight: 700;
      padding: 3px 10px; border-radius: 20px; margin-bottom: 6px; }
    .uptm-toast__title { font-size: 0.95rem; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
    .uptm-toast__desc { font-size: 0.8rem; color: #94a3b8; margin-bottom: 8px; white-space: pre-wrap; }
    .uptm-toast__time { font-size: 0.72rem; color: #64748b; margin-bottom: 12px; }
    .uptm-toast__footer { display: flex; gap: 8px; }
    .uptm-toast__btn { flex: 1; padding: 8px 12px; border-radius: 8px; font-size: 0.78rem;
      font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
    .uptm-toast__btn--primary { background: linear-gradient(135deg, var(--primary-blue, #3b82f6) 0%, var(--primary-accent, #2563eb) 100%); color: #fff; }
    .uptm-toast__btn--primary:hover { filter: brightness(1.1); }
    .uptm-toast__btn--secondary { background: rgba(255, 255, 255, 0.04); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.08); }
    .uptm-toast__btn--secondary:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
    @keyframes uptmToastIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `;

  function showDomToast(data) {
    let host = document.getElementById('uptm-toast-host');
    if (!host) {
      const style = document.createElement('style');
      style.textContent = TOAST_CSS;
      document.head.appendChild(style);
      host = document.createElement('div');
      host.id = 'uptm-toast-host';
      host.className = 'uptm-toast-host';
      document.body.appendChild(host);
    }

    const p = PRIORITY_STYLES[(data.priority || 'normal').toLowerCase()] || PRIORITY_STYLES.normal;
    const el = document.createElement('div');
    el.className = 'uptm-toast';
    el.innerHTML = `
      <div class="uptm-toast__header">
        <span class="uptm-toast__brand">&#128276; UPTM Buddy &middot; Reminder</span>
        <button class="uptm-toast__close" title="Close">&#10005;</button>
      </div>
      <div class="uptm-toast__badge" style="color:${p.color};background:${p.bg};">${p.label}</div>
      <div class="uptm-toast__title"></div>
      <div class="uptm-toast__desc"></div>
      <div class="uptm-toast__time"></div>
      <div class="uptm-toast__footer">
        <button class="uptm-toast__btn uptm-toast__btn--primary">View Now</button>
        <button class="uptm-toast__btn uptm-toast__btn--secondary">Dismiss</button>
      </div>
    `;
    el.querySelector('.uptm-toast__title').textContent = data.title || 'Reminder';
    el.querySelector('.uptm-toast__desc').textContent = data.description || '';
    el.querySelector('.uptm-toast__time').textContent = data.time || '';

    const remove = () => el.remove();
    el.querySelector('.uptm-toast__close').addEventListener('click', remove);
    el.querySelector('.uptm-toast__btn--secondary').addEventListener('click', remove);
    el.querySelector('.uptm-toast__btn--primary').addEventListener('click', () => { remove(); goToReminders(); });

    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild.remove();
    setTimeout(remove, 60000); // same 60s auto-close as the Electron popup
  }

  function goToReminders() {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-view="reminders"]')?.classList.add('active');
    if (window.loadView) window.loadView('reminders');
  }

  function showNotification(data) {
    if (ipcRenderer) {
      ipcRenderer.send('trigger-notification', data);   // native Electron popup
    } else {
      showDomToast(data);                               // browser / no-Electron popup
    }
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

    try {
      const res = await API.get(`/api/reminders/${studentId}/due?minutes=${DUE_WINDOW_MIN}`);
      if (!res.success || !res.data || res.data.length === 0) return;

      for (const r of res.data) {
        const key = `${r.id}@${r.remind_date}T${r.remind_time}`;
        if (triggeredIds.has(key)) continue;
        triggeredIds.add(key);

        console.log('[scheduler] Triggering popup for:', r.title);
        showNotification({
          id: r.id,
          title: r.title,
          description: r.description,
          priority: r.priority,
          time: `${new Date(r.remind_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${formatTime(r.remind_time)}`
        });
      }
    } catch (err) {
      console.warn('[scheduler] check failed:', err);
    }
  }

  // Electron only: main process asks to open reminders view
  if (ipcRenderer) {
    ipcRenderer.on('open-view', (event, viewName) => {
      goToReminders();
      triggeredIds.clear();
    });
  }

  // Start checking
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkReminders, 5000);
    setInterval(checkReminders, CHECK_INTERVAL_MS);
  });

  // Manual trigger — works in Electron AND in a plain browser
  window.testReminderPopup = function (data = {}) {
    console.log('[scheduler] Manual test trigger');
    showNotification({
      title: 'Test Reminder',
      description: 'This is a test notification popup.',
      priority: 'urgent',
      time: new Date().toLocaleString('en-GB'),
      ...data
    });
  };

  console.log('[scheduler] Loaded in', ipcRenderer ? 'Electron mode' : 'browser mode (no Electron — in-page popup). Test with: window.testReminderPopup()');
})();