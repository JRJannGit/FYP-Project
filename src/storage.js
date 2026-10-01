const AppStorage = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('uptm_user')); }
    catch { return null; }
  },
  setUser(user) { localStorage.setItem('uptm_user', JSON.stringify(user)); },
  clearUser()   { localStorage.removeItem('uptm_user'); }
};

window.AppStorage = AppStorage;