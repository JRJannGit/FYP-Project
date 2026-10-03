const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/db.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// =========================================
// HELPERS
// =========================================
const ok = (res, data) => res.json({ success: true, data });
const fail = (res, msg, code = 500) => res.status(code).json({ success: false, error: msg });

// =========================================
// UNIVERSAL LOGIN (detect role automatically)
// =========================================
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password, role } = req.body || {};
  console.log(`[LOGIN] role=${role} id=${identifier}`);

  try {
    if (!identifier || !password || !role) {
      return fail(res, 'Missing fields', 400);
    }

    if (role === 'student') {
      const [rows] = await db.query(
        'SELECT id, student_id AS identifier, full_name, email FROM students WHERE student_id = ? AND password = ?',
        [identifier, password]
      );
      if (rows.length === 0) return fail(res, 'Invalid Student ID or Password', 401);
      return ok(res, { role: 'student', user: rows[0] });
    }

    if (role === 'lecturer') {
      const [rows] = await db.query(
        'SELECT id, lecturer_id AS identifier, full_name, email, department FROM lecturers WHERE email = ? AND password = ?',
        [identifier, password]
      );
      if (rows.length === 0) return fail(res, 'Invalid Email or Password', 401);
      return ok(res, { role: 'lecturer', user: rows[0] });
    }

    if (role === 'admin') {
      const [rows] = await db.query(
        'SELECT id, admin_id AS identifier, full_name FROM admins WHERE admin_id = ? AND password = ?',
        [identifier, password]
      );
      if (rows.length === 0) return fail(res, 'Invalid Admin ID or Password', 401);
      return ok(res, { role: 'admin', user: rows[0] });
    }

    fail(res, 'Invalid role', 400);
  } catch (err) {
    console.error('[LOGIN] error:', err);
    fail(res, err.message);
  }
});

// =========================================
// AUTH — STUDENT (legacy)
// =========================================
app.post('/api/auth/student/login', async (req, res) => {
  const { student_id, password } = req.body || {};
  try {
    if (!student_id || !password) return fail(res, 'Student ID and password are required', 400);
    const [rows] = await db.query(
      'SELECT id, student_id, full_name, email FROM students WHERE student_id = ? AND password = ?',
      [student_id, password]
    );
    if (rows.length === 0) return fail(res, 'Invalid Student ID or Password', 401);
    ok(res, rows[0]);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/auth/student/signup', async (req, res) => {
  const { student_id, full_name, email, password } = req.body || {};
  try {
    if (!student_id || !full_name || !email || !password) return fail(res, 'All fields are required', 400);
    const [result] = await db.query(
      'INSERT INTO students (student_id, full_name, email, password) VALUES (?, ?, ?, ?)',
      [student_id, full_name, email, password]
    );
    ok(res, { id: result.insertId, student_id, full_name, email });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'This Student ID is already registered', 400);
    fail(res, err.message);
  }
});

// =========================================
// AUTH — ADMIN
// =========================================
app.post('/api/auth/admin/login', async (req, res) => {
  const { admin_id, password } = req.body || {};
  try {
    const [rows] = await db.query(
      'SELECT id, admin_id, full_name FROM admins WHERE admin_id = ? AND password = ?',
      [admin_id, password]
    );
    if (rows.length === 0) return fail(res, 'Invalid admin credentials', 401);
    ok(res, rows[0]);
  } catch (err) { fail(res, err.message); }
});

// =========================================
// ASSIGNMENTS
// =========================================
app.get('/api/assignments', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM assignments ORDER BY due_date ASC');
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.get('/api/assignments/student/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id, a.subject, a.description, a.due_date, a.is_exam,
        CASE WHEN ac.id IS NOT NULL THEN TRUE ELSE FALSE END AS completed
      FROM assignments a
      LEFT JOIN assignment_completions ac
        ON ac.assignment_id = a.id AND ac.student_id = ?
      ORDER BY a.due_date ASC
    `, [req.params.student_id]);
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const {
      subject, description, due_date, is_exam,
      class_id, lecturer_id, start_time, end_time, status,
      file_name, file_type, file_data, url_link
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO assignments
         (subject, description, due_date, is_exam, class_id, lecturer_id,
          start_time, end_time, status, file_name, file_type, file_data, url_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subject, description || '', due_date, is_exam ? 1 : 0,
        class_id || null, lecturer_id || null,
        start_time || '00:00:00', end_time || '23:59:00', status || 'released',
        file_name || null, file_type || null, file_data || null, url_link || null
      ]
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/assignments/:id', async (req, res) => {
  try {
    const { subject, description, due_date, is_exam } = req.body;
    await db.query(
      'UPDATE assignments SET subject=?, description=?, due_date=?, is_exam=? WHERE id=?',
      [subject, description, due_date, is_exam ? 1 : 0, req.params.id]
    );
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/assignments/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM assignments WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

app.post('/api/assignments/:id/toggle', async (req, res) => {
  try {
    const { student_id, completed } = req.body;
    if (completed) {
      await db.query(
        'INSERT IGNORE INTO assignment_completions (student_id, assignment_id) VALUES (?, ?)',
        [student_id, req.params.id]
      );
    } else {
      await db.query(
        'DELETE FROM assignment_completions WHERE student_id = ? AND assignment_id = ?',
        [student_id, req.params.id]
      );
    }
    ok(res, { toggled: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// TIMETABLE (file upload)
// =========================================
app.get('/api/timetable/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM timetable WHERE student_id = ? ORDER BY uploaded_at DESC LIMIT 1',
      [req.params.student_id]
    );
    ok(res, rows[0] || null);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/timetable', async (req, res) => {
  try {
    const { student_id, file_data, file_type } = req.body;
    await db.query('DELETE FROM timetable WHERE student_id = ?', [student_id]);
    await db.query(
      'INSERT INTO timetable (student_id, file_data, file_type) VALUES (?, ?, ?)',
      [student_id, file_data, file_type]
    );
    ok(res, { uploaded: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/timetable/:student_id', async (req, res) => {
  try {
    await db.query('DELETE FROM timetable WHERE student_id = ?', [req.params.student_id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// TIMETABLE ENTRIES (class schedule)
// =========================================
app.get('/api/timetable-entries', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM timetable_entries ORDER BY FIELD(day_of_week, "Mon","Tue","Wed","Thu","Fri","Sat","Sun"), time_start ASC'
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.get('/api/timetable-entries/today', async (req, res) => {
  try {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = days[new Date().getDay()];
    const [rows] = await db.query(
      'SELECT * FROM timetable_entries WHERE day_of_week = ? ORDER BY time_start ASC',
      [today]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

// =========================================
// REMINDERS
// =========================================
app.get('/api/reminders/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM reminders WHERE student_id = ? ORDER BY remind_date ASC, remind_time ASC',
      [req.params.student_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.get('/api/reminders/:student_id/due', async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes || '5', 10);
    const [rows] = await db.query(
      `SELECT * FROM reminders
       WHERE student_id = ?
         AND CONCAT(remind_date, ' ', remind_time) BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? MINUTE)`,
      [req.params.student_id, minutes]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/reminders', async (req, res) => {
  try {
    const { student_id, title, description, remind_date, remind_time, priority } = req.body;
    const [result] = await db.query(
      `INSERT INTO reminders (student_id, title, description, remind_date, remind_time, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, title, description || '', remind_date, remind_time || '09:00:00', priority || 'normal']
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/reminders/:id', async (req, res) => {
  try {
    const { title, description, remind_date, remind_time, priority } = req.body;
    await db.query(
      `UPDATE reminders SET title=?, description=?, remind_date=?, remind_time=?, priority=? WHERE id=?`,
      [title, description, remind_date, remind_time, priority, req.params.id]
    );
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/reminders/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM reminders WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// NOTES
// =========================================
app.get('/api/notes/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notes WHERE student_id = ? ORDER BY updated_at DESC',
      [req.params.student_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/notes', async (req, res) => {
  try {
    const { student_id, title, content } = req.body;
    const [result] = await db.query(
      'INSERT INTO notes (student_id, title, content) VALUES (?, ?, ?)',
      [student_id, title || 'Untitled', content || '']
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/notes/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    await db.query('UPDATE notes SET title=?, content=? WHERE id=?', [title, content, req.params.id]);
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM notes WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// RESOURCES
// =========================================

// Helper: check if user can modify resource
function canModifyResource(role, userId, resource) {
  if (role === 'admin') return true;
  if (resource.is_system) return false;
  return resource.created_by === userId;
}

app.get('/api/resources', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM resources ORDER BY is_system DESC, title ASC');
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/resources', async (req, res) => {
  try {
    const { title, url_link, caption, icon, created_by, is_system } = req.body;
    const role = req.headers['x-user-role'];
    if (!role) return fail(res, 'Not authenticated', 401);

    // Only admin can create system resources
    const systemFlag = (role === 'admin' && is_system) ? 1 : 0;

    const [result] = await db.query(
      `INSERT INTO resources (title, url, url_link, caption, description, icon, created_by, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, url_link || '', url_link || '', caption || '', caption || '',
       icon || 'fa-link', created_by || null, systemFlag]
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/resources/:id', async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    if (!role) return fail(res, 'Not authenticated', 401);

    const [rows] = await db.query('SELECT * FROM resources WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, 'Resource not found', 404);

    // Admin can edit all; non-admin can only edit own resources
    if (role !== 'admin' && !canModifyResource(role, userId, rows[0])) {
      return fail(res, 'You cannot edit this resource', 403);
    }

    const { title, url_link, caption, icon, is_system } = req.body;

    // Only admin can toggle is_system; others keep original
    let systemFlag = rows[0].is_system;
    if (role === 'admin' && is_system !== undefined) {
      systemFlag = is_system ? 1 : 0;
    }

    await db.query(
      `UPDATE resources
       SET title=?, url=?, url_link=?, caption=?, description=?, icon=?, is_system=?
       WHERE id=?`,
      [title, url_link || '', url_link || '', caption || '', caption || '',
       icon || 'fa-link', systemFlag, req.params.id]
    );
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/resources/:id', async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    if (!role) return fail(res, 'Not authenticated', 401);

    const [rows] = await db.query('SELECT * FROM resources WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, 'Resource not found', 404);

    // Admin can delete all; non-admin only own resources
    if (role !== 'admin' && !canModifyResource(role, userId, rows[0])) {
      return fail(res, 'You cannot delete this resource', 403);
    }

    await db.query('DELETE FROM resources WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// EVENTS
// =========================================
app.get('/api/events/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM events WHERE student_id = ? OR student_id IS NULL ORDER BY event_date ASC, start_time ASC',
      [req.params.student_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/events', async (req, res) => {
  try {
    const { student_id, title, event_date, description, color, start_time, end_time } = req.body;
    const [result] = await db.query(
      `INSERT INTO events (student_id, title, event_date, description, color, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student_id || null, title, event_date, description || '', color || 'blue',
       start_time || '09:00:00', end_time || '10:00:00']
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { title, event_date, description, color, start_time, end_time } = req.body;
    await db.query(
      `UPDATE events SET title=?, event_date=?, description=?, color=?, start_time=?, end_time=? WHERE id=?`,
      [title, event_date, description, color, start_time, end_time, req.params.id]
    );
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// DASHBOARD — combined upcoming items
// =========================================
app.get('/api/dashboard/upcoming/:student_id', async (req, res) => {
  try {
    const sid = req.params.student_id;

    const [assignments] = await db.query(
      `SELECT id, subject AS title, description, due_date AS date, NULL AS time, 'assignment' AS type, is_exam
       FROM assignments WHERE due_date >= CURDATE() ORDER BY due_date ASC`
    );

    const [reminders] = await db.query(
      `SELECT id, title, description, remind_date AS date, remind_time AS time, 'reminder' AS type, priority
       FROM reminders WHERE student_id = ? AND remind_date >= CURDATE() ORDER BY remind_date ASC`,
      [sid]
    );

    const [events] = await db.query(
      `SELECT id, title, description, event_date AS date, start_time AS time, 'event' AS type, color
       FROM events WHERE (student_id = ? OR student_id IS NULL) AND event_date >= CURDATE() ORDER BY event_date ASC`,
      [sid]
    );

    const combined = [...assignments, ...reminders, ...events]
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    ok(res, combined);
  } catch (err) { fail(res, err.message); }
});

// =========================================
// ACADEMIC CALENDAR
// =========================================
app.get('/api/academic-calendar', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM academic_calendar ORDER BY uploaded_at DESC LIMIT 1'
    );
    ok(res, rows[0] || null);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/academic-calendar', async (req, res) => {
  try {
    const { file_data, file_type } = req.body;
    await db.query('DELETE FROM academic_calendar');
    await db.query(
      'INSERT INTO academic_calendar (file_data, file_type) VALUES (?, ?)',
      [file_data, file_type || 'image']
    );
    ok(res, { uploaded: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// USER SETTINGS
// =========================================
app.get('/api/settings/:user_id/:role', async (req, res) => {
  try {
    const { user_id, role } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM user_settings WHERE user_id = ? AND user_role = ?',
      [user_id, role]
    );
    if (rows.length === 0) {
      // Return defaults
      return ok(res, {
        show_notifications: true,
        play_animations: true,
        dark_mode: true,
        is_new: true
      });
    }
    ok(res, rows[0]);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { user_id, user_role, show_notifications, play_animations, dark_mode } = req.body;
    if (!user_id || !user_role) return fail(res, 'user_id and user_role are required', 400);

    // UPSERT: insert kalau belum ada, update kalau dah ada
    await db.query(
      `INSERT INTO user_settings (user_id, user_role, show_notifications, play_animations, dark_mode)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         show_notifications = VALUES(show_notifications),
         play_animations    = VALUES(play_animations),
         dark_mode          = VALUES(dark_mode)`,
      [user_id, user_role, show_notifications ? 1 : 0, play_animations ? 1 : 0, dark_mode ? 1 : 0]
    );
    ok(res, { saved: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// LECTURER
// =========================================
app.get('/api/lecturer/classes/:lecturer_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM classes WHERE lecturer_id = ? ORDER BY class_code ASC',
      [req.params.lecturer_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

// Get assignments created by this lecturer
app.get('/api/assignments/lecturer/:lecturer_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, c.class_code, c.class_name
       FROM assignments a
       LEFT JOIN classes c ON c.id = a.class_id
       WHERE a.lecturer_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.lecturer_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

// =========================================
// SUBMISSIONS
// =========================================
app.get('/api/submissions/:assignment_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.assignment_id, s.student_id, s.file_name, s.submitted_at,
              st.email AS student_email
       FROM submissions s
       LEFT JOIN students st ON st.student_id = s.student_id
       WHERE s.assignment_id = ?
       ORDER BY s.submitted_at ASC`,
      [req.params.assignment_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.get('/api/submissions/item/:submission_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM submissions WHERE id = ?',
      [req.params.submission_id]
    );
    ok(res, rows[0] || null);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/submissions', async (req, res) => {
  try {
    const { assignment_id, student_id, file_name, file_type, file_data } = req.body;
    await db.query(
      `INSERT INTO submissions (assignment_id, student_id, file_name, file_type, file_data)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         file_name=VALUES(file_name),
         file_type=VALUES(file_type),
         file_data=VALUES(file_data),
         submitted_at=CURRENT_TIMESTAMP`,
      [assignment_id, student_id, file_name, file_type, file_data]
    );
    ok(res, { uploaded: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// ADMIN STATS
// =========================================
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [[{ studentCount }]]    = await db.query('SELECT COUNT(*) AS studentCount FROM students');
    const [[{ assignmentCount }]] = await db.query('SELECT COUNT(*) AS assignmentCount FROM assignments');
    const [[{ resourceCount }]]   = await db.query('SELECT COUNT(*) AS resourceCount FROM resources');
    const [[{ timetableCount }]]  = await db.query('SELECT COUNT(*) AS timetableCount FROM timetable');
    const [recent] = await db.query('SELECT * FROM assignments ORDER BY created_at DESC LIMIT 5');
    ok(res, { studentCount, assignmentCount, resourceCount, timetableCount, recentAssignments: recent });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// ADMIN — delete academic calendar
// =========================================
app.delete('/api/academic-calendar', async (req, res) => {
  try {
    await db.query('DELETE FROM academic_calendar');
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

// =========================================
// NOTIFICATION TEST (works without Electron)
// =========================================
app.get('/api/health', (req, res) => {
  ok(res, { status: 'up', service: 'uptm-buddy-api', time: new Date().toISOString() });
});

// Simulated push payload — lets test-notification.html show a popup
// in any browser without needing the Electron shell.
app.get('/api/test-notification', (req, res) => {
  ok(res, {
    id: 'TEST-' + Date.now(),
    title: 'Server Test Reminder',
    description: 'This popup was delivered by the API — no Electron involved.',
    priority: 'high',
    remind_date: new Date().toISOString().slice(0, 10),
    remind_time: new Date().toTimeString().slice(0, 8)
  });
});

// Standalone browser test page
app.get('/test-notification.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-notification.html'));
});

// =========================================
// START
// =========================================
app.listen(3000, () => {
  console.log('🚀 UPTM Buddy API running at http://localhost:3000');
});