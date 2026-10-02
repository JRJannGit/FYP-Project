// =========================================
// src/storage.js — session helper
// Delegates to Auth for normalization
// =========================================

const AppStorage = {
  getUser() {
    if (window.Auth && typeof window.Auth.getUser === 'function') {
      return window.Auth.getUser();
    }
    console.warn('[AppStorage] Auth not loaded yet');
    return null;
  },
  setUser(user) {
    console.warn('[AppStorage] setUser deprecated. Use Auth.setSession instead.');
  },
  clearUser() {
    if (window.Auth) window.Auth.logout();
  }
};

window.AppStorage = AppStorage;