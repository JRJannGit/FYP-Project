// =========================================
// src/auth.js — shared session helper
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

    // Normalize: alias identifier → role-specific id
    const u = { ...s.user };
    if (u.identifier) {
      if (s.role === 'student'  && !u.student_id)  u.student_id  = u.identifier;
      if (s.role === 'lecturer' && !u.lecturer_id) u.lecturer_id = u.identifier;
      if (s.role === 'admin'    && !u.admin_id)    u.admin_id    = u.identifier;
    }
    // Also copy the other direction — if backend returns student_id but not identifier
    if (s.role === 'student' && !u.identifier && u.student_id) u.identifier = u.student_id;
    if (s.role === 'lecturer' && !u.identifier && u.lecturer_id) u.identifier = u.lecturer_id;
    if (s.role === 'admin' && !u.identifier && u.admin_id) u.identifier = u.admin_id;

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
  }
};

window.Auth = Auth;