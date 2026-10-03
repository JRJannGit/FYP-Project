// =========================================
// src/settings.js — with localStorage cache
// =========================================

function initSettings() {
  const notifToggle = document.getElementById('toggle-notifications');
  const animToggle  = document.getElementById('toggle-animations');
  const darkToggle  = document.getElementById('toggle-darkmode');

  const user = window.Auth?.getUser?.();
  const role = window.Auth?.getRole?.();
  const userId = user?.student_id || user?.lecturer_id || user?.admin_id || user?.identifier || '';

  // ============ Load dari DB ============
  async function loadSettings() {
    if (!userId || !role) {
      applySettings({ show_notifications: true, play_animations: true, dark_mode: true });
      return;
    }

    const res = await API.get(`/api/settings/${userId}/${role}`);
    if (!res.success) {
      applySettings({ show_notifications: true, play_animations: true, dark_mode: true });
      return;
    }
    applySettings(res.data);
  }

  // ============ Apply + cache ============
  function applySettings(s) {
    const showNotif = s.show_notifications === true || s.show_notifications === 1;
    const playAnim  = s.play_animations === true || s.play_animations === 1;
    const darkMode  = s.dark_mode === true || s.dark_mode === 1;

    if (notifToggle) notifToggle.checked = showNotif;
    if (animToggle)  animToggle.checked  = playAnim;
    if (darkToggle)  darkToggle.checked  = darkMode;

    applyNotification(showNotif);
    applyAnimation(playAnim);
    applyTheme(darkMode);
  }

  function applyNotification(enabled) {
    window.__showNotifications = enabled;
    localStorage.setItem('uptm_notif', enabled ? 'on' : 'off');
  }

  function applyAnimation(enabled) {
    if (enabled) document.body.classList.remove('no-buddy-anim');
    else         document.body.classList.add('no-buddy-anim');

    window.__playAnimations = enabled;
    localStorage.setItem('uptm_anim', enabled ? 'on' : 'off');

    // Pause / play Rive mascot
    if (typeof window.setBuddyAnimation === 'function') {
      window.setBuddyAnimation(enabled);
    }
  }

  function applyTheme(dark) {
    if (dark) document.body.classList.remove('light-theme');
    else      document.body.classList.add('light-theme');
    window.__darkMode = dark;
    localStorage.setItem('uptm_theme', dark ? 'dark' : 'light');
  }

  // ============ Save ke DB ============
  async function saveSettings() {
    if (!userId || !role) return;
    const payload = {
      user_id: userId,
      user_role: role,
      show_notifications: notifToggle?.checked ?? true,
      play_animations:    animToggle?.checked  ?? true,
      dark_mode:          darkToggle?.checked  ?? true
    };
    const res = await API.post('/api/settings', payload);
    if (!res.success) console.error('[Settings] Save failed:', res.error);
  }

  // ============ Event listeners ============
  if (notifToggle) {
    notifToggle.addEventListener('change', () => {
      applyNotification(notifToggle.checked);
      saveSettings();
    });
  }

  if (animToggle) {
    animToggle.addEventListener('change', () => {
      applyAnimation(animToggle.checked);
      saveSettings();
    });
  }

  if (darkToggle) {
    darkToggle.addEventListener('change', () => {
      applyTheme(darkToggle.checked);
      saveSettings();
    });
  }

  // ============ Init ============
  loadSettings();
}

window.initSettings = initSettings;