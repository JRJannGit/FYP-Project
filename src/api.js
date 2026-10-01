const BASE = 'http://localhost:3000';

async function request(method, path, body) {
  const url = BASE + path;
  console.log(`[API] ${method} ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    clearTimeout(timeoutId);
    const json = await res.json();
    console.log(`[API] ← ${res.status}`);

    if (!json.success) return { success: false, error: json.error || 'Unknown error' };
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Server timeout. Make sure "node server.js" is running.' };
    }
    return { success: false, error: 'Server offline. Make sure "node server.js" is running.' };
  }
}

const API = {
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  put:    (path, body) => request('PUT',    path, body),
  delete: (path)       => request('DELETE', path),

  loginStudent:  (student_id, password) => request('POST', '/api/auth/student/login', { student_id, password }),
  signupStudent: (data)                 => request('POST', '/api/auth/student/signup', data),
  loginAdmin:    (admin_id, password)   => request('POST', '/api/auth/admin/login', { admin_id, password })
};

window.API = API;