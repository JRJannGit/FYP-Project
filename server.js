const express = require('express');
const cors = require('cors');
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
// AUTH — STUDENT
// =========================================
app.post('/api/auth/student/login', async (req, res) => {
  const { student_id, password } = req.body || {};
  console.log(`[LOGIN] attempt: ${student_id}`);
  try {
    if (!student_id || !password) return fail(res, 'Student ID and password are required', 400);
    const [rows] = await db.query(
      'SELECT id, student_id, full_name, email FROM students WHERE student_id = ? AND password = ?',
      [student_id, password]
    );
    console.log(`[LOGIN] returned ${rows.length} row(s)`);
    if (rows.length === 0) return fail(res, 'Invalid Student ID or Password', 401);
    console.log(`[LOGIN] success: ${rows[0].full_name}`);
    ok(res, rows[0]);
  } catch (err) {
    console.error('[LOGIN] error:', err);
    fail(res, err.message);
  }
});

app.post('/api/auth/student/signup', async (req, res) => {
  const { student_id, full_name, email, password } = req.body || {};
  console.log(`[SIGNUP] attempt: ${student_id}`);
  try {
    if (!student_id || !full_name || !email || !password) return fail(res, 'All fields are required', 400);
    const [result] = await db.query(
      'INSERT INTO students (student_id, full_name, email, password) VALUES (?, ?, ?, ?)',
      [student_id, full_name, email, password]
    );
    console.log(`[SIGNUP] success: id=${result.insertId}`);
    ok(res, { id: result.insertId, student_id, full_name, email });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'This Student ID is already registered', 400);
    console.error('[SIGNUP] error:', err);
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
    const { subject, description, due_date, is_exam } = req.body;
    const [result] = await db.query(
      'INSERT INTO assignments (subject, description, due_date, is_exam) VALUES (?, ?, ?, ?)',
      [subject, description || '', due_date, is_exam ? 1 : 0]
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
// TIMETABLE
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

// Reminders due soon (within next N minutes)
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
app.get('/api/resources', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM resources ORDER BY title ASC');
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/resources', async (req, res) => {
  try {
    const { title, url, description, icon } = req.body;
    const [result] = await db.query(
      'INSERT INTO resources (title, url, description, icon) VALUES (?, ?, ?, ?)',
      [title, url, description || '', icon || 'fa-link']
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/resources/:id', async (req, res) => {
  try {
    const { title, url, description, icon } = req.body;
    await db.query(
      'UPDATE resources SET title=?, url=?, description=?, icon=? WHERE id=?',
      [title, url, description, icon, req.params.id]
    );
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/resources/:id', async (req, res) => {
  try {
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
// ACADEMIC CALENDAR (admin upload, public get)
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
    // Replace old one — one global academic calendar
    await db.query('DELETE FROM academic_calendar');
    await db.query(
      'INSERT INTO academic_calendar (file_data, file_type) VALUES (?, ?)',
      [file_data, file_type || 'image']
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
// TIMETABLE ENTRIES (read-only for student)
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
// DASHBOARD COMBINED — upcoming items
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
// START
// =========================================
app.listen(3000, () => {
  console.log('🚀 UPTM Buddy API running at http://localhost:3000');
});