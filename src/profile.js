const db = require('./db.js');

// 1. Kemaskini kad profil di sidebar bawah
function updateSidebarProfile(user) {
  const sidebarName = document.querySelector('.user-name');
  const sidebarId = document.querySelector('.student-id');

  if (sidebarName && sidebarId) {
    if (user) {
      sidebarName.innerText = user.full_name;
      sidebarId.innerText = `Student ID: ${user.student_id}`;
    } else {
      sidebarName.innerText = 'Guest User';
      sidebarId.innerText = 'Click to Login';
    }
  }
}

// 2. Fungsi Tukar Tab (Login vs Sign Up)
function switchTab(targetTab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabSignupBtn = document.getElementById('tab-signup-btn');

  if (!loginForm || !signupForm || !tabLoginBtn || !tabSignupBtn) return;

  if (targetTab === 'signup') {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    tabSignupBtn.className = 'tab-btn active';
    tabLoginBtn.className = 'tab-btn inactive';
  } else {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    tabLoginBtn.className = 'tab-btn active';
    tabSignupBtn.className = 'tab-btn inactive';
  }
}

// 3. Inisialisasi Utama Profil & Auth
async function initProfile() {
  const authSection = document.getElementById('auth-section');
  const profileSection = document.getElementById('profile-section');

  // Semak sesi pengguna semasa
  let activeUser = null;
  try {
    activeUser = JSON.parse(localStorage.getItem('uptm_user'));
  } catch (e) {
    console.error('Error reading localStorage:', e);
  }

  // Tunjukkan skrin berdasarkan status Login
  if (activeUser) {
    if (authSection) authSection.style.display = 'none';
    if (profileSection) profileSection.style.display = 'block';

    const profileName = document.getElementById('profile-name');
    const profileId = document.getElementById('profile-id');
    const profileEmail = document.getElementById('profile-email');

    if (profileName) profileName.innerText = activeUser.full_name;
    if (profileId) profileId.innerText = `Student ID: ${activeUser.student_id}`;
    if (profileEmail) profileEmail.innerText = activeUser.email || '-';
  } else {
    if (authSection) authSection.style.display = 'block';
    if (profileSection) profileSection.style.display = 'none';
    switchTab('login'); // Set tab lalai ke Login
  }

  // Attach Form Submit Handlers
  setupFormEvents();
}

function setupFormEvents() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const btnLogout = document.getElementById('btn-logout');

  // Handle Login Submission
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const studentId = document.getElementById('login-student-id').value.trim();
      const password = document.getElementById('login-password').value.trim();

      try {
        const [rows] = await db.query(
          'SELECT * FROM student_users WHERE student_id = ? AND password = ?',
          [studentId, password]
        );

        if (rows.length > 0) {
          const user = rows[0];
          localStorage.setItem('uptm_user', JSON.stringify(user));
          updateSidebarProfile(user);
          initProfile();
        } else {
          alert('Invalid Student ID or Password.');
        }
      } catch (err) {
        console.error('Login Error:', err);
        alert('Database connection error. Ensure MySQL is running in XAMPP/Laragon.');
      }
    };
  }

  // Handle Sign Up Submission
  if (signupForm) {
    signupForm.onsubmit = async (e) => {
      e.preventDefault();
      const studentId = document.getElementById('signup-student-id').value.trim();
      const fullName = document.getElementById('signup-full-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value.trim();

      try {
        await db.query(
          'INSERT INTO student_users (student_id, full_name, email, password) VALUES (?, ?, ?, ?)',
          [studentId, fullName, email, password]
        );

        const newUser = { student_id: studentId, full_name: fullName, email: email };
        localStorage.setItem('uptm_user', JSON.stringify(newUser));
        updateSidebarProfile(newUser);
        alert('Account created successfully!');
        initProfile();
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          alert('Student ID already registered. Please login.');
        } else {
          console.error('Sign Up Error:', err);
          alert('Failed to register account in database.');
        }
      }
    };
  }

  // Handle Log Out
  if (btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem('uptm_user');
      updateSidebarProfile(null);
      initProfile();
    };
  }
}

// 4. Global Event Listener untuk Tab Switching (Penyelesaian Utama)
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'tab-login-btn') {
    switchTab('login');
  } else if (e.target && e.target.id === 'tab-signup-btn') {
    switchTab('signup');
  }
});

// Sync profil pada pembukaan pertama
document.addEventListener('DOMContentLoaded', () => {
  const savedUser = JSON.parse(localStorage.getItem('uptm_user'));
  updateSidebarProfile(savedUser);
  initProfile();
});

// Didedahkan untuk dipanggil oleh navigation.js
window.initProfile = initProfile;