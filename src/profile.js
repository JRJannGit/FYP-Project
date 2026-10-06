
/* [A6] Escape-close bound once at module scope; initProfile() re-runs on
   every visit to the view and previously stacked one document listener
   per visit. */
if (!window.__profileEscapeBound) {
  window.__profileEscapeBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const logoutModal = document.getElementById('logout-modal');
    if (logoutModal?.style.display === 'flex') logoutModal.style.display = 'none';
  });
}

function updateSidebarProfile(user) {
  const name = document.querySelector('.user-name');
  const sid  = document.querySelector('.student-id');
  if (!name || !sid) return;
  if (user) {
    name.innerText = user.full_name;
    const role = Auth.getRole();
    const id = user.student_id || user.lecturer_id || user.admin_id || user.identifier || '';
    const label = role === 'lecturer' ? 'Lecturer ID'
                : role === 'admin'    ? 'Admin ID'
                : 'Student ID';
    sid.innerText = `${label}: ${id}`;
  } else {
    name.innerText = 'Guest User';
    sid.innerText  = 'Click to Login';
  }
}

function switchTab(tab) {
  const login  = document.getElementById('login-form');
  const signup = document.getElementById('signup-form');
  const btnLogin  = document.getElementById('tab-login-btn');
  const btnSignup = document.getElementById('tab-signup-btn');
  if (!login || !signup) return;

  if (tab === 'signup') {
    login.style.display = 'none';
    signup.style.display = 'block';
    btnSignup.className = 'tab-btn active';
    btnLogin.className  = 'tab-btn inactive';
  } else {
    login.style.display = 'block';
    signup.style.display = 'none';
    btnLogin.className  = 'tab-btn active';
    btnSignup.className = 'tab-btn inactive';
  }
  clearBanner(login);
  clearBanner(signup);
}

function showBanner(formEl, message, type = 'error') {
  if (!formEl) return;
  clearBanner(formEl);

  const banner = document.createElement('div');
  banner.className = `form-banner form-banner--${type}`;
  banner.innerHTML = `
    <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
    <span>${message}</span>
  `;
  formEl.insertBefore(banner, formEl.firstChild);

  if (type === 'success') {
    setTimeout(() => banner.remove(), 3000);
  }
}

function clearBanner(formEl) {
  if (!formEl) return;
  const b = formEl.querySelector('.form-banner');
  if (b) b.remove();
}

function setLoading(btn, loading, text = 'Loading...') {
  if (!btn) return;
  if (loading) {
    btn.dataset.original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.original || btn.innerHTML;
  }
}

function initProfile() {
  const authSection    = document.getElementById('auth-section');
  const profileSection = document.getElementById('profile-section');
  const user           = AppStorage.getUser();

  if (user) {
    if (authSection)    authSection.style.display    = 'none';
    if (profileSection) profileSection.style.display = 'block';

    const role = Auth.getRole();
    const label = role === 'lecturer' ? 'Lecturer ID'
                : role === 'admin'    ? 'Admin ID'
                : 'Student ID';

    const n = document.getElementById('profile-name');
    const i = document.getElementById('profile-id');
    const e = document.getElementById('profile-email');
    if (n) n.innerText = user.full_name;
    if (i) {
      const id = user.student_id || user.lecturer_id || user.admin_id || user.identifier || '';
      i.innerText = `${label}: ${id}`;
    }
    if (e) e.innerText = user.email || '-';
  } else {
    if (authSection)    authSection.style.display    = 'block';
    if (profileSection) profileSection.style.display = 'none';
    switchTab('login');
  }

  setupFormEvents();
}

function setupFormEvents() {
  const loginForm  = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const btnLogout  = document.getElementById('btn-logout');

  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      clearBanner(loginForm);

      const sidEl = document.getElementById('login-student-id');
      const pwEl  = document.getElementById('login-password');
      const btn   = loginForm.querySelector('button[type="submit"]');

      const sid = sidEl.value.trim();
      const pw  = pwEl.value.trim();

      if (!sid) { showBanner(loginForm, 'Please enter your Student ID'); sidEl.focus(); return; }
      if (!pw)  { showBanner(loginForm, 'Please enter your password');   pwEl.focus();  return; }

      setLoading(btn, true, 'Logging in...');
      const res = await API.loginStudent(sid, pw);
      setLoading(btn, false);

      if (!res.success) {
        let msg = res.error || 'Login failed';
        if (/invalid|credentials/i.test(msg)) msg = 'Invalid Student ID or Password. Please try again.';
        if (/offline|network/i.test(msg))     msg = 'Cannot reach server. Make sure "node server.js" is running.';
        showBanner(loginForm, msg, 'error');
        return;
      }

      Auth.setSession('student', res.data);
      updateSidebarProfile(res.data);
      showBanner(loginForm, `Welcome, ${res.data.full_name}!`, 'success');

      setTimeout(() => {
        initProfile();
        if (window.loadView) window.loadView('dashboard');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('[data-view="dashboard"]')?.classList.add('active');
      }, 700);
    };
  }

  if (signupForm) {
    signupForm.onsubmit = async (e) => {
      e.preventDefault();
      clearBanner(signupForm);

      const sidEl   = document.getElementById('signup-student-id');
      const nameEl  = document.getElementById('signup-full-name');
      const emailEl = document.getElementById('signup-email');
      const pwEl    = document.getElementById('signup-password');
      const btn     = signupForm.querySelector('button[type="submit"]');

      const data = {
        student_id: sidEl.value.trim(),
        full_name:  nameEl.value.trim(),
        email:      emailEl.value.trim(),
        password:   pwEl.value.trim()
      };

      if (!data.student_id) { showBanner(signupForm, 'Please enter a Student ID');  sidEl.focus();   return; }
      if (!data.full_name)  { showBanner(signupForm, 'Please enter your full name'); nameEl.focus();  return; }
      if (!data.email || !data.email.includes('@')) { showBanner(signupForm, 'Please enter a valid email'); emailEl.focus(); return; }
      if (data.password.length < 6) { showBanner(signupForm, 'Password must be at least 6 characters'); pwEl.focus(); return; }

      setLoading(btn, true, 'Creating account...');
      const res = await API.signupStudent(data);
      setLoading(btn, false);

      if (!res.success) {
        let msg = res.error || 'Sign up failed';
        if (/duplicate|already exists/i.test(msg)) msg = 'This Student ID is already registered. Try logging in.';
        if (/offline|network/i.test(msg))          msg = 'Cannot reach server. Make sure "node server.js" is running.';
        showBanner(signupForm, msg, 'error');
        return;
      }

      Auth.setSession('student', res.data);
      updateSidebarProfile(res.data);
      showBanner(signupForm, 'Account created! Welcome.', 'success');

      setTimeout(() => {
        initProfile();
        if (window.loadView) window.loadView('dashboard');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('[data-view="dashboard"]')?.classList.add('active');
      }, 800);
    };
  }

  const logoutModal = document.getElementById('logout-modal');
  const logoutYes   = document.getElementById('logout-yes');
  const logoutNo    = document.getElementById('logout-no');

  if (btnLogout && logoutModal) {
    btnLogout.onclick = () => {
      logoutModal.style.display = 'flex';
    };

    logoutYes.onclick = () => {
      localStorage.removeItem('uptm_session');
      window.location.href = 'login.html';
    };

    logoutNo.onclick = () => {
      logoutModal.style.display = 'none';
    };

    logoutModal.addEventListener('click', (e) => {
      if (e.target === logoutModal) logoutModal.style.display = 'none';
    });
  } else if (btnLogout) {
    btnLogout.onclick = () => {
      if (!confirm('Log out?')) return;
      localStorage.removeItem('uptm_session');
      window.location.href = 'login.html';
    };
  }
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'tab-login-btn')  switchTab('login');
  if (e.target.id === 'tab-signup-btn') switchTab('signup');
});

document.addEventListener('DOMContentLoaded', () => {
  updateSidebarProfile(AppStorage.getUser());
});

window.initProfile = initProfile;
window.switchTab   = switchTab;