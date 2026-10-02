// =========================================
// src/settings.js — with MySQL persistence
// =========================================

function initSettings() {
  const notifToggle = document.getElementById('toggle-notifications');
  const animToggle  = document.getElementById('toggle-animations');
  const darkToggle  = document.getElementById('toggle-darkmode');

  const user = window.Auth?.getUser?.();
  const role = window.Auth?.getRole?.();
  const userId = user?.student_id || user?.lecturer_id || user?.admin_id || user?.identifier || '';

  // ============ Load settings dari DB ============
  async function loadSettings() {
    if (!userId || !role) {
      console.warn('[Settings] No logged-in user — using defaults');
      applySettings({ show_notifications: true, play_animations: true, dark_mode: true });
      return;
    }

    const res = await API.get(`/api/settings/${userId}/${role}`);
    if (!res.success) {
      console.error('[Settings] Load failed:', res.error);
      applySettings({ show_notifications: true, play_animations: true, dark_mode: true });
      return;
    }

    applySettings(res.data);
  }

  // ============ Apply settings ke UI + system ============
  function applySettings(s) {
    // Normalize (MySQL BOOLEAN come as 0/1)
    const showNotif = s.show_notifications === true || s.show_notifications === 1;
    const playAnim  = s.play_animations === true || s.play_animations === 1;
    const darkMode  = s.dark_mode === true || s.dark_mode === 1;

    // Set toggle states
    if (notifToggle) notifToggle.checked = showNotif;
    if (animToggle)  animToggle.checked  = playAnim;
    if (darkToggle)  darkToggle.checked  = darkMode;

    // Apply to system
    applyNotificationSetting(showNotif);
    applyAnimationSetting(playAnim);
    applyThemeSetting(darkMode);
  }

  function applyNotificationSetting(enabled) {
    // Simpan dalam window object supaya reminder-scheduler boleh baca
    window.__showNotifications = enabled;
    console.log('[Settings] Notifications:', enabled ? 'ON' : 'OFF');
  }

  function applyAnimationSetting(enabled) {
    // Toggle body class → CSS akan freeze/hide animation
    if (enabled) {
      document.body.classList.remove('no-buddy-anim');
    } else {
      document.body.classList.add('no-buddy-anim');
    }
    window.__playAnimations = enabled;
    console.log('[Settings] Animations:', enabled ? 'ON' : 'OFF');
  }

  function applyThemeSetting(dark) {
    if (dark) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
    window.__darkMode = dark;
  }

  // ============ Save settings ke DB ============
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
    if (!res.success) {
      console.error('[Settings] Save failed:', res.error);
    }
  }

  // ============ Event listeners ============
  if (notifToggle) {
    notifToggle.addEventListener('change', () => {
      applyNotificationSetting(notifToggle.checked);
      saveSettings();
    });
  }

  if (animToggle) {
    animToggle.addEventListener('change', () => {
      applyAnimationSetting(animToggle.checked);
      saveSettings();
    });
  }

  if (darkToggle) {
    darkToggle.addEventListener('change', () => {
      applyThemeSetting(darkToggle.checked);
      saveSettings();
    });
  }

  // ============ Init ============
  loadSettings();
}

window.initSettings = initSettings;