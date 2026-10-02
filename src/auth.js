// =========================================
// src/auth.js — session helper + applyUserSettings
// =========================================

const Auth = {
  KEY: 'uptm_session',

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

  // =========================================
  // Apply user settings (theme, anim) on startup
  // =========================================
  async applyUserSettings() {
    const session = this.getSession();
    if (!session || !session.user) return;

    // ---------- Step 1: Apply cached settings instantly ----------
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

    const cachedNotif = localStorage.getItem('uptm_notif');
    if (cachedNotif === 'off') window.__showNotifications = false;
    else if (cachedNotif === 'on') window.__showNotifications = true;

    // ---------- Step 2: Sync with DB (authoritative) ----------
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

      // Apply theme
      if (darkMode) document.body.classList.remove('light-theme');
      else          document.body.classList.add('light-theme');

      // Apply animation
      if (playAnim) document.body.classList.remove('no-buddy-anim');
      else          document.body.classList.add('no-buddy-anim');

      // Cache to localStorage
      localStorage.setItem('uptm_theme', darkMode ? 'dark' : 'light');
      localStorage.setItem('uptm_anim', playAnim ? 'on' : 'off');
      localStorage.setItem('uptm_notif', showNotif ? 'on' : 'off');

      // Set window flags
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