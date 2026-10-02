// =========================================
// src/api.js — with role + userId headers
// =========================================

const BASE = 'http://localhost:3000';

async function request(method, path, body) {
  const url = BASE + path;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const user = window.Auth?.getUser?.();
  const role = window.Auth?.getRole?.();
  const userId = user?.student_id || user?.lecturer_id || user?.admin_id || user?.identifier || '';

  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': role || '',
    'x-user-id': userId
  };

  try {
    const opts = { method, headers, signal: controller.signal };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    clearTimeout(timeoutId);
    const json = await res.json();

    if (!json.success) return { success: false, error: json.error || 'Unknown error' };
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return { success: false, error: 'Server timeout.' };
    return { success: false, error: 'Server offline.' };
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