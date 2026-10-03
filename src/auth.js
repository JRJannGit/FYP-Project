
const Auth = {
  KEY: 'uptm_session',

  ACCENT_PRESETS: [
    { name: 'Ocean Blue',    glow: '#3b82f6', accent: '#2563eb' },
    { name: 'Royal Purple',  glow: '#8b5cf6', accent: '#7c3aed' },
    { name: 'Emerald',       glow: '#10b981', accent: '#059669' },
    { name: 'Sunset Orange', glow: '#f97316', accent: '#ea580c' },
    { name: 'Rose Pink',     glow: '#ec4899', accent: '#db2777' },
    { name: 'Teal',          glow: '#14b8a6', accent: '#0d9488' }
  ],
  DEFAULT_ACCENT: '#3b82f6',

  deriveAccent(hex) {
    let h = String(hex || '').trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(h)) {
      h = '#' + h.slice(1).split('').map(c => c + c).join('');
    }
    if (!/^#[0-9a-f]{6}$/.test(h)) return null;
    const n = parseInt(h.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const darken = c => Math.max(0, Math.round(c * 0.82));
    const toHex = (r, g, b) => '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    return { glow: h, accent: toHex(darken(r), darken(g), darken(b)) };
  },

  applyAccentColor(hex) {
    const pair = this.deriveAccent(hex);
    if (!pair) return false;
    const root = document.documentElement.style;
    root.setProperty('--primary-glow', pair.glow);
    root.setProperty('--primary-blue', pair.glow);
    root.setProperty('--primary-accent', pair.accent);
    root.setProperty('--primary-hover', pair.accent);
    return true;
  },

  clearAccentColor() {
    const root = document.documentElement.style;
    ['--primary-glow', '--primary-blue', '--primary-accent', '--primary-hover']
      .forEach(v => root.removeProperty(v));
  },

  setSession(role, user) {
    const session = {
      role,
      user,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(this.KEY, JSON.stringify(session));
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY));
    } catch {
      return null;
    }
  },

  getUser() {
    const s = this.getSession();
    if (!s || !s.user) return null;

    const u = { ...s.user };
    if (u.identifier) {
      if (s.role === 'student'  && !u.student_id)  u.student_id  = u.identifier;
      if (s.role === 'lecturer' && !u.lecturer_id) u.lecturer_id = u.identifier;
      if (s.role === 'admin'    && !u.admin_id)    u.admin_id    = u.identifier;
    }
    if (s.role === 'student'  && !u.identifier && u.student_id)  u.identifier = u.student_id;
    if (s.role === 'lecturer' && !u.identifier && u.lecturer_id) u.identifier = u.lecturer_id;
    if (s.role === 'admin'    && !u.identifier && u.admin_id)    u.identifier = u.admin_id;

    return u;
  },

  getRole() {
    const s = this.getSession();
    return s ? s.role : null;
  },

  isRole(role) {
    return this.getRole() === role;
  },

  logout() {
    localStorage.removeItem(this.KEY);
    window.location.href = 'login.html';
  },

  guard(expectedRole) {
    const s = this.getSession();
    if (!s) {
      window.location.href = 'login.html';
      return false;
    }
    if (expectedRole && s.role !== expectedRole) {
      console.warn(`Role mismatch: expected ${expectedRole}, got ${s.role}`);
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  async applyUserSettings() {
    const session = this.getSession();
    if (!session || !session.user) return;

    const cachedTheme = localStorage.getItem('uptm_theme');
    if (cachedTheme === 'light') {
      document.body.classList.add('light-theme');
    } else if (cachedTheme === 'dark') {
      document.body.classList.remove('light-theme');
    }

        const cachedAnim = localStorage.getItem('uptm_anim');
    if (cachedAnim === 'off') {
      document.body.classList.add('no-buddy-anim');
    } else if (cachedAnim === 'on') {
      document.body.classList.remove('no-buddy-anim');
    }

    setTimeout(() => {
      if (typeof window.setBuddyAnimation === 'function') {
        window.setBuddyAnimation(cachedAnim !== 'off');
      }
    }, 100);

    const cachedNotif = localStorage.getItem('uptm_notif');
    if (cachedNotif === 'off') window.__showNotifications = false;
    else if (cachedNotif === 'on') window.__showNotifications = true;

    const cachedAccent = localStorage.getItem('uptm_accent');
    if (cachedAccent) this.applyAccentColor(cachedAccent);

    const user = this.getUser();
    const userId = user?.student_id || user?.lecturer_id || user?.admin_id || user?.identifier;
    const role = session.role;

    if (!userId || !role) return;

    try {
      const res = await fetch(`http://localhost:3000/api/settings/${userId}/${role}`);
      const data = await res.json();
      if (!data.success) return;

      const s = data.data;
      const darkMode = s.dark_mode === true || s.dark_mode === 1;
      const playAnim = s.play_animations === true || s.play_animations === 1;
      const showNotif = s.show_notifications === true || s.show_notifications === 1;

      if (darkMode) document.body.classList.remove('light-theme');
      else          document.body.classList.add('light-theme');

      
      if (playAnim) document.body.classList.remove('no-buddy-anim');
      else          document.body.classList.add('no-buddy-anim');

      if (typeof window.setBuddyAnimation === 'function') {
        window.setBuddyAnimation(playAnim);
      }

      localStorage.setItem('uptm_theme', darkMode ? 'dark' : 'light');
      localStorage.setItem('uptm_anim', playAnim ? 'on' : 'off');
      localStorage.setItem('uptm_notif', showNotif ? 'on' : 'off');

      window.__darkMode = darkMode;
      window.__playAnimations = playAnim;
      window.__showNotifications = showNotif;

      console.log('[Auth] Settings synced from DB:', { darkMode, playAnim, showNotif });
    } catch (err) {
      console.warn('[Auth] applyUserSettings sync failed:', err);
    }
  }
};

window.Auth = Auth;