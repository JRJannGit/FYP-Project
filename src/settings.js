
function initSettings() {
  function accentKey() {
    return window.Auth?.scopedKey?.('uptm_accent') || 'uptm_accent';
  }

  const notifToggle = document.getElementById('toggle-notifications');
  const animToggle  = document.getElementById('toggle-animations');
  const darkToggle  = document.getElementById('toggle-darkmode');

  const user = window.Auth?.getUser?.();
  const role = window.Auth?.getRole?.();
  const userId = user?.student_id || user?.lecturer_id || user?.admin_id || user?.identifier || '';

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

  async function saveSettings() {
    if (!userId || !role) return;
    const payload = {
      user_id: userId,
      user_role: role,
      show_notifications: notifToggle?.checked ?? true,
      play_animations:    animToggle?.checked  ?? true,
      dark_mode:          darkToggle?.checked  ?? true,
      accent_color: localStorage.getItem(accentKey()) || null
    };
    const res = await API.post('/api/settings', payload);
    if (!res.success) console.error('[Settings] Save failed:', res.error);
  }

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

  const swatchWrap  = document.getElementById('accent-swatches');
  const customInput = document.getElementById('accent-custom');
  const resetBtn    = document.getElementById('accent-reset');

  function getSavedAccent() {
    return localStorage.getItem(accentKey()) || window.Auth?.DEFAULT_ACCENT || '#3b82f6';
  }

  function markActiveSwatch(hex) {
    const glow = window.Auth?.deriveAccent?.(hex)?.glow || hex;
    swatchWrap?.querySelectorAll('.accent-swatch').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.glow || '').toLowerCase() === glow.toLowerCase());
    });
  }

  function applyAndSaveAccent(hex) {
    if (!window.Auth?.applyAccentColor?.(hex)) return;
    localStorage.setItem(accentKey(), String(hex).toLowerCase());
    saveSettings();
    markActiveSwatch(hex);
    if (customInput) customInput.value = String(hex).toLowerCase();
  }

  if (swatchWrap && window.Auth?.ACCENT_PRESETS) {
    window.Auth.ACCENT_PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accent-swatch';
      btn.dataset.glow = p.glow;
      btn.title = p.name;
      btn.style.background = `linear-gradient(135deg, ${p.glow} 0%, ${p.accent} 100%)`;
      btn.addEventListener('click', () => applyAndSaveAccent(p.glow));
      swatchWrap.appendChild(btn);
    });
  }

  if (customInput) {
    customInput.value = getSavedAccent();
    customInput.addEventListener('input', () => applyAndSaveAccent(customInput.value));
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(accentKey());
      window.Auth?.clearAccentColor?.();
      markActiveSwatch(window.Auth?.DEFAULT_ACCENT || '#3b82f6');
      if (customInput) customInput.value = window.Auth?.DEFAULT_ACCENT || '#3b82f6';
      saveSettings();
    });
  }

  markActiveSwatch(getSavedAccent());

  loadSettings();
}

window.initSettings = initSettings;