(function () {
  const roleTabs      = document.querySelectorAll('.role-tab');
  const loginForm     = document.getElementById('login-form');
  const signupForm    = document.getElementById('signup-form');
  const signupHint    = document.getElementById('signup-hint');
  const loginLabel    = document.getElementById('login-label');
  const loginIcon     = document.getElementById('login-icon');
  const loginInput    = document.getElementById('login-identifier');
  const loginPassword = document.getElementById('login-password');
  const loginBtn      = document.getElementById('btn-login');
  const togglePw      = document.getElementById('toggle-pw');
  const errorBox      = document.getElementById('login-error');

  const btnGotoSignup = document.getElementById('btn-goto-signup');
  const btnGotoLogin  = document.getElementById('btn-goto-login');
  const signupBtn     = document.getElementById('btn-signup');

  let currentRole = 'student';

  function showError(msg) {
    errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${msg}</span>`;
    errorBox.style.display = 'flex';
  }

  function hideError() {
    errorBox.style.display = 'none';
    errorBox.innerHTML = '';
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

  function updateRoleTab(role) {
    currentRole = role;

    roleTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.role === role);
    });

    if (role === 'student') {
      loginLabel.innerText = 'Student ID';
      loginIcon.className = 'fa-solid fa-id-card';
      loginInput.placeholder = 'e.g. AM1234567890';
      signupHint.style.display = 'block';
    } else if (role === 'lecturer') {
      loginLabel.innerText = 'UPTM Email';
      loginIcon.className = 'fa-solid fa-envelope';
      loginInput.placeholder = 'e.g. ahmad@uptm.edu.my';
      signupHint.style.display = 'none';
    } else if (role === 'admin') {
      loginLabel.innerText = 'Admin ID';
      loginIcon.className = 'fa-solid fa-user-shield';
      loginInput.placeholder = 'e.g. ADMIN001';
      signupHint.style.display = 'none';
    }

    hideError();
    loginInput.value = '';
    loginPassword.value = '';
    loginInput.focus();
  }

  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => updateRoleTab(tab.dataset.role));
  });

  togglePw.addEventListener('click', () => {
    const isPw = loginPassword.type === 'password';
    loginPassword.type = isPw ? 'text' : 'password';
    togglePw.innerHTML = `<i class="fa-solid fa-eye${isPw ? '-slash' : ''}"></i>`;
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const identifier = loginInput.value.trim();
    const password = loginPassword.value.trim();

    if (!identifier || !password) {
      showError('Please fill in both fields');
      return;
    }

    setLoading(loginBtn, true, 'Signing in...');

    try {
      const res = await API.post('/api/auth/login', { identifier, password, role: currentRole });
      setLoading(loginBtn, false);

      if (!res.success) {
        showError(res.error || 'Login failed');
        return;
      }

      Auth.setSession(res.data.role, res.data.user);

      if (res.data.role === 'student')  window.location.href = 'index.html';
      if (res.data.role === 'lecturer') window.location.href = 'lecturer.html';
      if (res.data.role === 'admin')    window.location.href = 'admin.html';

    } catch (err) {
      setLoading(loginBtn, false);
      showError('Cannot reach server. Make sure "node server.js" is running.');
      console.error('[LOGIN] error:', err);
    }
  });

  btnGotoSignup.addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    hideError();
  });

  btnGotoLogin.addEventListener('click', () => {
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
    hideError();
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const data = {
      student_id: document.getElementById('su-student-id').value.trim(),
      full_name:  document.getElementById('su-full-name').value.trim(),
      email:      document.getElementById('su-email').value.trim(),
      password:   document.getElementById('su-password').value.trim()
    };

    if (!data.student_id || !data.full_name || !data.email || !data.password) {
      showError('Please fill in all fields');
      return;
    }
    if (data.password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    if (!data.email.includes('@')) {
      showError('Please enter a valid email');
      return;
    }

    setLoading(signupBtn, true, 'Creating account...');

    try {
      const res = await API.post('/api/auth/student/signup', data);
      setLoading(signupBtn, false);

      if (!res.success) {
        let msg = res.error || 'Sign up failed';
        if (/duplicate|already/i.test(msg)) msg = 'This Student ID is already registered.';
        showError(msg);
        return;
      }

      Auth.setSession('student', res.data);
      window.location.href = 'index.html';

    } catch (err) {
      setLoading(signupBtn, false);
      showError('Cannot reach server. Make sure "node server.js" is running.');
    }
  });

  document.querySelectorAll('.dev-shortcuts button').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.devRole;
      updateRoleTab(role);
      loginInput.value = btn.dataset.devId;
      loginPassword.value = btn.dataset.devPw;
      loginForm.dispatchEvent(new Event('submit'));
    });
  });

  const existing = Auth.getSession();
  if (existing) {
    if (existing.role === 'student')  window.location.href = 'index.html';
    if (existing.role === 'lecturer') window.location.href = 'lecturer.html';
    if (existing.role === 'admin')    window.location.href = 'admin.html';
  }

  updateRoleTab('student');
})();