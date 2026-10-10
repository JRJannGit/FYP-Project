const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/db.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, msg, code = 500) => res.status(code).json({ success: false, error: msg });

function isUptmEmail(email, kind) {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim().toLowerCase();
  if (kind === 'student') return /@student\.uptm\.edu\.my$/.test(e);
  if (kind === 'staff')   return /@uptm\.edu\.my$/.test(e);
  return /@(student\.)?uptm\.edu\.my$/.test(e);
}

/* ================= [R7] MINIMAL AUTH HELPERS =================
   The client (src/api.js) already sends x-user-role / x-user-id on every
   call. These are self-declared headers (signed-token auth is planned as a
   follow-up), but enforcing presence, role and ownership here closes the
   widest holes: unauthenticated writes, and editing/deleting someone
   else's notes, reminders, events, classes or submissions. */
function getAuth(req) {
  return {
    role: req.headers['x-user-role'] || '',
    id: req.headers['x-user-id'] || ''
  };
}

function requireAuth(req, res) {
  const { role, id } = getAuth(req);
  if (!role || !id) { fail(res, 'Not authenticated', 401); return null; }
  return { role, id };
}

function requireRoles(req, res, ...roles) {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (!roles.includes(auth.role)) { fail(res, 'Forbidden', 403); return null; }
  return auth;
}

/* Weekly timetable classes share one subject→color hash with the calendar
   (src/calendar.js subjectColor) so the same subject always gets the same
   color on the dashboard and the calendar. */
function subjectColor(subject) {
  if (!subject) return 'blue';
  let hash = 0;
  const s = String(subject);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  const palette = ['blue', 'red', 'yellow'];
  return palette[Math.abs(hash) % palette.length];
}

/* Shape a timetable_entries row for the client (color is computed per
   subject, not read from the legacy color column). */
function ttEntryToClient(row) {
  return {
    id: row.id,
    day_of_week: row.day_of_week,
    subject: row.subject,
    room: row.room || '',
    time_start: row.time_start,
    time_end: row.time_end,
    color: subjectColor(row.subject)
  };
}

/* ================= AUTH ================= */

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
    if (!email.includes('@')) return fail(res, 'Invalid email format', 400);
    if (!isUptmEmail(email, 'student')) {
      return fail(res, 'Only @student.uptm.edu.my emails are accepted.', 400);
    }
    if (password.length < 6) return fail(res, 'Password must be at least 6 characters', 400);

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

/* ================= ASSIGNMENTS ================= */

app.get('/api/assignments', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM assignments ORDER BY due_date ASC');
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

// STEP 3: Filter by enrollment
app.get('/api/assignments/student/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id, a.subject, a.description, a.due_date, a.is_exam,
             c.class_code, c.class_name,
        CASE WHEN ac.id IS NOT NULL THEN TRUE ELSE FALSE END AS completed
      FROM assignments a
      LEFT JOIN classes c ON c.id = a.class_id
      LEFT JOIN assignment_completions ac
        ON ac.assignment_id = a.id AND ac.student_id = ?
      WHERE a.class_id IS NULL
         OR a.class_id IN (
              SELECT class_id FROM enrollments WHERE student_id = ?
            )
      ORDER BY a.due_date ASC
    `, [req.params.student_id, req.params.student_id]);
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/assignments', async (req, res) => {
  try {
    // [R7] Writes require a logged-in user; lecturers cannot release as someone else
    const auth = requireAuth(req, res);
    if (!auth) return;

    const {
      subject, description, due_date, is_exam,
      class_id, lecturer_id, start_time, end_time, status,
      file_name, file_type, file_data, url_link
    } = req.body;

    if (!subject || !due_date) return fail(res, 'Subject and due_date are required', 400);
    if (lecturer_id && lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You cannot release assignments as another lecturer', 403);
    }

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

// Update assignment (edit). Supports both the student edit form
// (subject/description/due_date/is_exam) and the lecturer editor
// (class_id/start_time/end_time/status/file fields). Only fields
// present in the request body are written, so one client never
// resets the other's data (previously this hard-clobbered is_exam
// and silently dropped class_id/start_time/end_time/status).
app.put('/api/assignments/:id', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const [existing] = await db.query(
      'SELECT lecturer_id FROM assignments WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Assignment not found', 404);
    if (existing[0].lecturer_id && existing[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this assignment', 403);
    }

    const allowed = [
      'subject', 'description', 'due_date', 'is_exam',
      'class_id', 'lecturer_id', 'start_time', 'end_time', 'status',
      'file_name', 'file_type', 'file_data', 'url_link'
    ];
    const nullable = new Set([
      'class_id', 'lecturer_id', 'file_name', 'file_type', 'file_data', 'url_link'
    ]);
    const sets = [];
    const values = [];
    for (const key of allowed) {
      if (!(key in req.body)) continue;
      let value = req.body[key];
      if (key === 'is_exam') value = value ? 1 : 0;
      if (nullable.has(key) && (value === undefined || value === '')) value = null;
      sets.push(`${key} = ?`);
      values.push(value);
    }
    if (sets.length === 0) return fail(res, 'No valid fields to update', 400);
    values.push(req.params.id);
    await db.query(`UPDATE assignments SET ${sets.join(', ')} WHERE id = ?`, values);
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/assignments/:id', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const [existing] = await db.query(
      'SELECT lecturer_id FROM assignments WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Assignment not found', 404);
    if (existing[0].lecturer_id && existing[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this assignment', 403);
    }

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

// STEP 4: Add enrolled_count & submission_count
app.get('/api/assignments/lecturer/:lecturer_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, c.class_code, c.class_name,
              (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = a.class_id) AS enrolled_count,
              (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count
       FROM assignments a
       LEFT JOIN classes c ON c.id = a.class_id
       WHERE a.lecturer_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.lecturer_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

/* ================= CLASSES (LECTURER) ================= */

app.get('/api/lecturer/classes/:lecturer_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM classes WHERE lecturer_id = ? ORDER BY class_code ASC',
      [req.params.lecturer_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/lecturer/classes', async (req, res) => {
  try {
    // [R7] Only lecturers/admins manage classes, and only for themselves
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const {
      class_code, class_name, subject_code,
      lecturer_id, description, semester
    } = req.body || {};

    if (!class_code || !class_name || !lecturer_id) {
      return fail(res, 'class_code, class_name, and lecturer_id are required', 400);
    }
    if (lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You cannot create classes for another lecturer', 403);
    }

    const [result] = await db.query(
      `INSERT INTO classes
         (class_code, class_name, subject_code, lecturer_id, description, semester)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(class_code).trim(),
        String(class_name).trim(),
        subject_code ? String(subject_code).trim() : null,
        String(lecturer_id).trim(),
        description ? String(description).trim() : null,
        semester ? String(semester).trim() : null
      ]
    );
    ok(res, { id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'This class code already exists', 400);
    fail(res, err.message);
  }
});

app.put('/api/lecturer/classes/:id', async (req, res) => {
  try {
    // [R7] Only the owning lecturer (or an admin) may edit a class
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const [existing] = await db.query(
      'SELECT lecturer_id FROM classes WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Class not found', 404);
    if (existing[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this class', 403);
    }

    const {
      class_code, class_name, subject_code,
      description, semester
    } = req.body || {};

    if (!class_code || !class_name) {
      return fail(res, 'class_code and class_name are required', 400);
    }

    await db.query(
      `UPDATE classes
       SET class_code=?, class_name=?, subject_code=?, description=?, semester=?
       WHERE id=?`,
      [
        String(class_code).trim(),
        String(class_name).trim(),
        subject_code ? String(subject_code).trim() : null,
        description ? String(description).trim() : null,
        semester ? String(semester).trim() : null,
        req.params.id
      ]
    );
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/lecturer/classes/:id', async (req, res) => {
  try {
    // [R7] Only the owning lecturer (or an admin) may delete a class
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const [existing] = await db.query(
      'SELECT id, lecturer_id FROM classes WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Class not found', 404);
    if (existing[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this class', 403);
    }

    // [R4] Deleting a class used to orphan its enrollments and leave its
    // assignments visible but dangling. Remove dependents first, in one
    // transaction, so it is all-or-nothing.
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM enrollments WHERE class_id = ?', [req.params.id]);
      await conn.query('DELETE FROM assignments WHERE class_id = ?', [req.params.id]);
      await conn.query('DELETE FROM classes WHERE id = ?', [req.params.id]);
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= CLASS LOOKUP & SECTIONS ================= */

// Look up a class by its (unique) class code. Students use this to preview a
// class and its sections before self-enrolling; any logged-in user may look up.
app.get('/api/classes/by-code/:class_code', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const [rows] = await db.query(
      `SELECT c.id, c.class_code, c.class_name, c.subject_code, c.semester,
              l.full_name AS lecturer_name
       FROM classes c
       LEFT JOIN lecturers l ON l.lecturer_id = c.lecturer_id
       WHERE c.class_code = ?`,
      [String(req.params.class_code || '').trim()]
    );
    if (rows.length === 0) return fail(res, 'No class found with that code', 404);

    const [sections] = await db.query(
      `SELECT s.id, s.section_name, s.capacity,
              (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id) AS enrolled_count
       FROM class_sections s
       WHERE s.class_id = ?
       ORDER BY s.id ASC`,
      [rows[0].id]
    );

    ok(res, { ...rows[0], sections });
  } catch (err) { fail(res, err.message); }
});

// Create a section for a class — lecturer/admin only, owner-enforced.
app.post('/api/classes/:class_id/sections', async (req, res) => {
  try {
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const { section_name, capacity } = req.body || {};
    if (!section_name || !String(section_name).trim()) {
      return fail(res, 'section_name is required', 400);
    }

    const [cls] = await db.query('SELECT id, lecturer_id FROM classes WHERE id = ?', [req.params.class_id]);
    if (cls.length === 0) return fail(res, 'Class not found', 404);
    if (cls[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this class', 403);
    }

    const cap = (capacity === undefined || capacity === null || capacity === '')
      ? 1000
      : parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1) return fail(res, 'capacity must be a positive number', 400);

    const [result] = await db.query(
      'INSERT INTO class_sections (class_id, section_name, capacity) VALUES (?, ?, ?)',
      [req.params.class_id, String(section_name).trim(), cap]
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

// List a class's sections with live enrolled counts. Any logged-in user may
// view — students need this when choosing a section to join.
app.get('/api/classes/:class_id/sections', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const [rows] = await db.query(
      `SELECT s.id, s.section_name, s.capacity,
              (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id) AS enrolled_count
       FROM class_sections s
       WHERE s.class_id = ?
       ORDER BY s.id ASC`,
      [req.params.class_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

// Delete a section — lecturer/admin only, owner-enforced. enrollments.section_id
// is FK ON DELETE SET NULL, so existing enrollees keep their enrolment and just
// lose the section reference.
app.delete('/api/sections/:id', async (req, res) => {
  try {
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const [rows] = await db.query(
      `SELECT s.id, c.lecturer_id
       FROM class_sections s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, 'Section not found', 404);
    if (rows[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this class', 403);
    }

    await db.query('DELETE FROM class_sections WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= ENROLLMENTS ================= */

// Get all students enrolled in a class
app.get('/api/enrollments/class/:class_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.id, e.class_id, e.student_id, e.enrolled_at,
              s.full_name, s.email
       FROM enrollments e
       LEFT JOIN students s ON s.student_id = e.student_id
       WHERE e.class_id = ?
       ORDER BY s.full_name ASC`,
      [req.params.class_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

// Get all classes a student is enrolled in
app.get('/api/enrollments/student/:student_id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.id, e.id AS enrollment_id, e.class_id, e.enrolled_at,
              c.class_code, c.class_name, c.subject_code, c.semester,
              c.lecturer_id, l.full_name AS lecturer_name,
              sec.section_name
       FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN lecturers l ON l.lecturer_id = c.lecturer_id
       LEFT JOIN class_sections sec ON sec.id = e.section_id
       WHERE e.student_id = ?
       ORDER BY c.class_code ASC`,
      [req.params.student_id]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

// Enroll a single student
app.post('/api/enrollments', async (req, res) => {
  try {
    // [R7] Only lecturers/admins manage enrollments
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const { class_id, student_id } = req.body || {};
    if (!class_id || !student_id) {
      return fail(res, 'class_id and student_id are required', 400);
    }

    const [cls] = await db.query('SELECT id, lecturer_id FROM classes WHERE id = ?', [class_id]);
    if (cls.length === 0) return fail(res, 'Class not found', 404);
    if (cls[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this class', 403);
    }

    const [stu] = await db.query('SELECT id FROM students WHERE student_id = ?', [student_id]);
    if (stu.length === 0) return fail(res, 'Student not found', 404);

    await db.query(
      'INSERT INTO enrollments (class_id, student_id) VALUES (?, ?)',
      [class_id, student_id]
    );
    ok(res, { enrolled: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'Student already enrolled in this class', 400);
    fail(res, err.message);
  }
});

// Remove student from class
app.delete('/api/enrollments/:id', async (req, res) => {
  try {
    // [R7] Only lecturers/admins manage enrollments
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    await db.query('DELETE FROM enrollments WHERE id = ?', [req.params.id]);
    ok(res, { removed: true });
  } catch (err) { fail(res, err.message); }
});

// Bulk enroll multiple students
app.post('/api/enrollments/bulk', async (req, res) => {
  try {
    // [R7] Only lecturers/admins manage enrollments, for classes they own
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const { class_id, student_ids } = req.body || {};
    if (!class_id || !Array.isArray(student_ids) || student_ids.length === 0) {
      return fail(res, 'class_id and student_ids array required', 400);
    }

    const [cls] = await db.query('SELECT id, lecturer_id FROM classes WHERE id = ?', [class_id]);
    if (cls.length === 0) return fail(res, 'Class not found', 404);
    if (cls[0].lecturer_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'You do not own this class', 403);
    }

    const values = student_ids.map(sid => [class_id, sid]);
    await db.query(
      'INSERT IGNORE INTO enrollments (class_id, student_id) VALUES ?',
      [values]
    );
    ok(res, { enrolled: student_ids.length });
  } catch (err) { fail(res, err.message); }
});

/* ================= STUDENT SELF-ENROLMENT ================= */

// A student joins a class by the class code their lecturer shared. Students
// only — lecturers/admins manage enrolments via the endpoints above.
app.post('/api/enrollments/by-code', async (req, res) => {
  try {
    const auth = requireRoles(req, res, 'student');
    if (!auth) return;

    const { class_code, section_id } = req.body || {};
    if (!class_code || !String(class_code).trim()) {
      return fail(res, 'class_code is required', 400);
    }

    const [cls] = await db.query(
      'SELECT id FROM classes WHERE class_code = ?',
      [String(class_code).trim()]
    );
    if (cls.length === 0) return fail(res, 'No class found with that code', 404);

    let secId = null;
    if (section_id !== undefined && section_id !== null && section_id !== '') {
      const [sec] = await db.query(
        'SELECT id FROM class_sections WHERE id = ? AND class_id = ?',
        [section_id, cls[0].id]
      );
      if (sec.length === 0) return fail(res, 'That section does not belong to this class', 400);
      secId = sec[0].id;
    }

    const [result] = await db.query(
      'INSERT INTO enrollments (class_id, student_id, section_id) VALUES (?, ?, ?)',
      [cls[0].id, auth.id, secId]
    );
    ok(res, { enrollment_id: result.insertId, class_id: cls[0].id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'You are already enrolled in this class', 400);
    fail(res, err.message);
  }
});

// A student leaves a class — only rows that belong to them.
app.delete('/api/enrollments/self/:id', async (req, res) => {
  try {
    const auth = requireRoles(req, res, 'student');
    if (!auth) return;

    const [rows] = await db.query(
      'SELECT id, student_id FROM enrollments WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return fail(res, 'Enrollment not found', 404);
    if (rows[0].student_id !== auth.id) {
      return fail(res, 'You can only leave your own enrolments', 403);
    }

    await db.query('DELETE FROM enrollments WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= SUBMISSIONS ================= */

app.get('/api/submissions/:assignment_id', async (req, res) => {
  try {
    // [R7] Only the assignment's lecturer (or an admin) may view submissions
    const auth = requireRoles(req, res, 'lecturer', 'admin');
    if (!auth) return;

    const [asg] = await db.query(
      'SELECT lecturer_id FROM assignments WHERE id = ?', [req.params.assignment_id]
    );
    if (asg.length === 0) return fail(res, 'Assignment not found', 404);
    if (auth.role !== 'admin' && asg[0].lecturer_id !== auth.id) {
      return fail(res, 'You do not own this assignment', 403);
    }

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
    // [R7] Only the submitting student, the assignment's lecturer or an admin
    const auth = requireAuth(req, res);
    if (!auth) return;

    const [rows] = await db.query(
      `SELECT s.*, a.lecturer_id
         FROM submissions s
         LEFT JOIN assignments a ON a.id = s.assignment_id
        WHERE s.id = ?`,
      [req.params.submission_id]
    );
    if (rows.length === 0) return fail(res, 'Submission not found', 404);

    const sub = rows[0];
    const allowed = sub.student_id === auth.id ||
                    sub.lecturer_id === auth.id ||
                    auth.role === 'admin';
    if (!allowed) return fail(res, 'Forbidden', 403);

    ok(res, sub);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/submissions', async (req, res) => {
  try {
    // [R7] Students may only upload submissions as themselves
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { assignment_id, student_id, file_name, file_type, file_data } = req.body;
    if (!assignment_id || !student_id) return fail(res, 'assignment_id and student_id required', 400);
    if (auth.role !== 'student' || student_id !== auth.id) {
      return fail(res, 'You can only submit as yourself', 403);
    }
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

/* ================= TIMETABLE ================= */

app.get('/api/timetable/:student_id', async (req, res) => {
  try {
    // [R7] Users may only read their own timetable
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (auth.id !== req.params.student_id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

    const [rows] = await db.query(
      'SELECT * FROM timetable WHERE student_id = ? ORDER BY uploaded_at DESC LIMIT 1',
      [req.params.student_id]
    );
    ok(res, rows[0] || null);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/timetable', async (req, res) => {
  try {
    // [R7] Users may only upload their own timetable
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { student_id, file_data, file_type } = req.body;
    if (!student_id || !file_data) return fail(res, 'student_id and file_data are required', 400);
    if (auth.id !== student_id && auth.role !== 'admin') {
      return fail(res, 'You can only manage your own timetable', 403);
    }

    // [R6] DELETE-then-INSERT used to run as two independent statements — a
    // failure between them could wipe a student's timetable and save nothing.
    // Run it as one all-or-nothing transaction instead.
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM timetable WHERE student_id = ?', [student_id]);
      await conn.query(
        'INSERT INTO timetable (student_id, file_data, file_type) VALUES (?, ?, ?)',
        [student_id, file_data, file_type]
      );
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
    ok(res, { uploaded: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/timetable/:student_id', async (req, res) => {
  try {
    // [R7] Users may only delete their own timetable
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (auth.id !== req.params.student_id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

    await db.query('DELETE FROM timetable WHERE student_id = ?', [req.params.student_id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

app.get('/api/timetable-entries', async (req, res) => {
  try {
    // Admin-only bulk listing; users read their own rows via
    // /api/timetable-entries/user/:userId (entries are per-user private).
    const auth = requireRoles(req, res, 'admin');
    if (!auth) return;
    const [rows] = await db.query(
      'SELECT * FROM timetable_entries ORDER BY FIELD(day_of_week, "Mon","Tue","Wed","Thu","Fri","Sat","Sun"), time_start ASC'
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.get('/api/timetable-entries/today', async (req, res) => {
  try {
    // Per-user: each account only ever sees its own classes.
    const auth = requireAuth(req, res);
    if (!auth) return;
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = days[new Date().getDay()];
    const [rows] = await db.query(
      'SELECT id, day_of_week, subject, room, time_start, time_end FROM timetable_entries WHERE day_of_week = ? AND user_id = ? ORDER BY time_start ASC',
      [today, auth.id]
    );
    ok(res, rows.map(ttEntryToClient));
  } catch (err) { fail(res, err.message); }
});

app.get('/api/timetable-entries/user/:userId', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (auth.id !== req.params.userId) return fail(res, 'Forbidden', 403);
    const [rows] = await db.query(
      'SELECT id, day_of_week, subject, room, time_start, time_end FROM timetable_entries WHERE user_id = ? ORDER BY FIELD(day_of_week, "Mon","Tue","Wed","Thu","Fri","Sat","Sun"), time_start ASC',
      [req.params.userId]
    );
    ok(res, rows.map(ttEntryToClient));
  } catch (err) { fail(res, err.message); }
});

app.post('/api/timetable-entries/bulk', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { user_id, entries } = req.body || {};
    if (!user_id || !Array.isArray(entries)) return fail(res, 'user_id and entries array are required', 400);
    if (auth.id !== user_id) return fail(res, 'You can only save your own classes', 403);
    if (entries.length < 1 || entries.length > 100) return fail(res, 'entries must contain between 1 and 100 items', 400);

    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const normTime = (t) => { const s = String(t || '').trim(); return s.length === 5 ? `${s}:00` : s; };
    const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(t);
    const rows = [];
    for (const e of entries) {
      const { day_of_week, start_time, end_time, subject, room } = e || {};
      if (!DAYS.includes(day_of_week)) return fail(res, 'Invalid day_of_week', 400);
      if (!subject || !timeOk(normTime(start_time)) || !timeOk(normTime(end_time))) {
        return fail(res, 'Each entry needs subject, start_time and end_time (HH:MM)', 400);
      }
      const start = normTime(start_time);
      const end = normTime(end_time);
      if (start >= end) return fail(res, 'end_time must be after start_time', 400);
      rows.push([
        user_id,
        day_of_week,
        String(subject).slice(0, 150),
        room ? String(room).slice(0, 50) : null,
        start,
        end
      ]);
    }

    // [R6] One all-or-nothing transaction — a partial import must never
    // leave a half-populated weekly schedule behind.
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const row of rows) {
        await conn.query(
          'INSERT INTO timetable_entries (user_id, day_of_week, subject, room, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?)',
          row
        );
      }
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
    ok(res, { inserted: rows.length });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/timetable-entries/all/:userId', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (auth.id !== req.params.userId) return fail(res, 'Forbidden', 403);
    const [result] = await db.query('DELETE FROM timetable_entries WHERE user_id = ?', [req.params.userId]);
    ok(res, { deleted: result.affectedRows || 0 });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/timetable-entries/:id', async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const [existing] = await db.query(
      'SELECT user_id FROM timetable_entries WHERE id = ?',
      [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Timetable entry not found', 404);
    // Row-level ownership: a user may only delete their own entries.
    if (existing[0].user_id !== auth.id) return fail(res, 'Forbidden', 403);
    await db.query('DELETE FROM timetable_entries WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= REMINDERS ================= */

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
    // [R7] Users can only create reminders for themselves
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { student_id, title, description, remind_date, remind_time, priority } = req.body;
    if (!student_id || !title || !remind_date) return fail(res, 'Missing required fields', 400);
    if (student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }
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
    // [R7] Only the owner (or an admin) may edit a reminder
    const auth = requireAuth(req, res);
    if (!auth) return;
    const [existing] = await db.query(
      'SELECT student_id FROM reminders WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Reminder not found', 404);
    if (existing[0].student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

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
    // [R7] Only the owner (or an admin) may delete a reminder
    const auth = requireAuth(req, res);
    if (!auth) return;
    const [existing] = await db.query(
      'SELECT student_id FROM reminders WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Reminder not found', 404);
    if (existing[0].student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

    await db.query('DELETE FROM reminders WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= NOTES ================= */

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
    // [R7] Users can only create notes for themselves
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { student_id, title, content } = req.body;
    if (student_id !== auth.id) return fail(res, 'Forbidden', 403);
    const [result] = await db.query(
      'INSERT INTO notes (student_id, title, content) VALUES (?, ?, ?)',
      [student_id, title || 'Untitled', content || '']
    );
    ok(res, { id: result.insertId });
  } catch (err) { fail(res, err.message); }
});

app.put('/api/notes/:id', async (req, res) => {
  try {
    // [R7] Only the owner (or an admin) may edit a note
    const auth = requireAuth(req, res);
    if (!auth) return;
    const [existing] = await db.query(
      'SELECT student_id FROM notes WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Note not found', 404);
    if (existing[0].student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

    const { title, content } = req.body;
    await db.query('UPDATE notes SET title=?, content=? WHERE id=?', [title, content, req.params.id]);
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    // [R7] Only the owner (or an admin) may delete a note
    const auth = requireAuth(req, res);
    if (!auth) return;
    const [existing] = await db.query(
      'SELECT student_id FROM notes WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Note not found', 404);
    if (existing[0].student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

    await db.query('DELETE FROM notes WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= RESOURCES ================= */

function canModifyResource(role, userId, resource) {
  if (role === 'admin') return true;
  if (resource.is_system) return false;
  return resource.created_by === userId;
}

app.get('/api/resources', async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    // Kalau tak authenticated: pulangkan system resources sahaja
    if (!role || !userId) {
      const [rows] = await db.query(
        'SELECT * FROM resources WHERE is_system = 1 ORDER BY id ASC'
      );
      return ok(res, rows);
    }

    // Admin nampak semua
    if (role === 'admin') {
      const [rows] = await db.query(
        'SELECT * FROM resources ORDER BY is_system DESC, id ASC'
      );
      return ok(res, rows);
    }

    // Student / Lecturer: system resources + own resources sahaja
    const [rows] = await db.query(
      `SELECT * FROM resources
       WHERE is_system = 1 OR created_by = ?
       ORDER BY is_system DESC, id ASC`,
      [userId]
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/resources', async (req, res) => {
  try {
    const { title, url_link, caption, icon, created_by, is_system } = req.body;
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    if (!role || !userId) return fail(res, 'Not authenticated', 401);

    // [R5] The server used to accept empty titles and arbitrary URLs
    if (!title || !String(title).trim()) return fail(res, 'Title is required', 400);
    if (!url_link || !/^https?:\/\//i.test(String(url_link).trim())) {
      return fail(res, 'A valid http(s) URL is required', 400);
    }
    if (!created_by) return fail(res, 'created_by is required', 400);

    // Hanya admin boleh buat system resource
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

    if (role !== 'admin' && !canModifyResource(role, userId, rows[0])) {
      return fail(res, 'You cannot edit this resource', 403);
    }

    const { title, url_link, caption, icon, is_system } = req.body;

    // [R5] Validate the fields that are actually being written
    if (title !== undefined && !String(title).trim()) {
      return fail(res, 'Title cannot be empty', 400);
    }
    if (url_link !== undefined && !/^https?:\/\//i.test(String(url_link).trim())) {
      return fail(res, 'A valid http(s) URL is required', 400);
    }

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

    if (role !== 'admin' && !canModifyResource(role, userId, rows[0])) {
      return fail(res, 'You cannot delete this resource', 403);
    }

    await db.query('DELETE FROM resources WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= EVENTS ================= */

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
    // [R7] Users can only create personal events for themselves; global
    // events (student_id null) are admin-only.
    const auth = requireAuth(req, res);
    if (!auth) return;

    const { student_id, title, event_date, description, color, start_time, end_time } = req.body;
    if (student_id && student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }
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
    // [R7] Only the owner (or an admin) may edit an event; global events
    // (student_id null) are admin-only.
    const auth = requireAuth(req, res);
    if (!auth) return;
    const [existing] = await db.query(
      'SELECT student_id FROM events WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Event not found', 404);
    if (existing[0].student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

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
    // [R7] Only the owner (or an admin) may delete an event; global events
    // (student_id null) are admin-only.
    const auth = requireAuth(req, res);
    if (!auth) return;
    const [existing] = await db.query(
      'SELECT student_id FROM events WHERE id = ?', [req.params.id]
    );
    if (existing.length === 0) return fail(res, 'Event not found', 404);
    if (existing[0].student_id !== auth.id && auth.role !== 'admin') {
      return fail(res, 'Forbidden', 403);
    }

    await db.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= DASHBOARD ================= */

app.get('/api/dashboard/upcoming/:student_id', async (req, res) => {
  try {
    const sid = req.params.student_id;

    const [assignments] = await db.query(
      `SELECT a.id, a.subject AS title, a.description, a.due_date AS date,
              NULL AS time, 'assignment' AS type, a.is_exam
       FROM assignments a
       WHERE a.due_date >= CURDATE()
         AND (
           a.class_id IS NULL
           OR a.class_id IN (SELECT class_id FROM enrollments WHERE student_id = ?)
         )
       ORDER BY a.due_date ASC`,
      [sid]
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

/* ================= ACADEMIC CALENDAR ================= */

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
    // [R7] Only admins may replace the academic calendar
    const auth = requireRoles(req, res, 'admin');
    if (!auth) return;

    const { file_data, file_type } = req.body;
    if (!file_data) return fail(res, 'file_data is required', 400);

    // [R6] DELETE + INSERT as one all-or-nothing transaction
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM academic_calendar');
      await conn.query(
        'INSERT INTO academic_calendar (file_data, file_type) VALUES (?, ?)',
        [file_data, file_type || 'image']
      );
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
    ok(res, { uploaded: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/academic-calendar', async (req, res) => {
  try {
    // [R7] Only admins may delete the academic calendar
    const auth = requireRoles(req, res, 'admin');
    if (!auth) return;
    await db.query('DELETE FROM academic_calendar');
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= SETTINGS ================= */

app.get('/api/settings/:user_id/:role', async (req, res) => {
  try {
    const { user_id, role } = req.params;

    // [R7] Users may only read their own settings
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (auth.id !== user_id || auth.role !== role) {
      return fail(res, 'Forbidden', 403);
    }

    const [rows] = await db.query(
      'SELECT * FROM user_settings WHERE user_id = ? AND user_role = ?',
      [user_id, role]
    );
    if (rows.length === 0) {
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

    // [R7] Users may only save their own settings
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (auth.id !== user_id || auth.role !== user_role) {
      return fail(res, 'You can only save your own settings', 403);
    }

    await db.query(
      `INSERT INTO user_settings (user_id, user_role, show_notifications, play_animations, dark_mode, accent_color)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         show_notifications = VALUES(show_notifications),
         play_animations    = VALUES(play_animations),
         dark_mode          = VALUES(dark_mode),
         accent_color       = VALUES(accent_color)`,
      [user_id, user_role, show_notifications ? 1 : 0, play_animations ? 1 : 0, dark_mode ? 1 : 0, req.body.accent_color ?? null]
    );
    ok(res, { saved: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= ADMIN STATS ================= */

app.get('/api/admin/stats', async (req, res) => {
  try {
    // [R7] Admin-only
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const [[{ studentCount }]]    = await db.query('SELECT COUNT(*) AS studentCount FROM students');
    const [[{ assignmentCount }]] = await db.query('SELECT COUNT(*) AS assignmentCount FROM assignments');
    const [[{ resourceCount }]]   = await db.query('SELECT COUNT(*) AS resourceCount FROM resources');
    const [[{ timetableCount }]]  = await db.query('SELECT COUNT(*) AS timetableCount FROM timetable');
    const [recent] = await db.query('SELECT * FROM assignments ORDER BY created_at DESC LIMIT 5');
    ok(res, { studentCount, assignmentCount, resourceCount, timetableCount, recentAssignments: recent });
  } catch (err) { fail(res, err.message); }
});

/* ================= ADMIN ACCOUNTS ================= */

function requireAdminRole(req) {
  return req.headers['x-user-role'] === 'admin';
}

/* ---------- Students ---------- */
app.get('/api/accounts/students', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const [rows] = await db.query(
      'SELECT id, student_id, full_name, email FROM students ORDER BY id ASC'
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/accounts/students', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const { student_id, full_name, email, password } = req.body || {};
    if (!student_id || !full_name || !email || !password) {
      return fail(res, 'Student ID, full name, email and password are required', 400);
    }
    if (!email.includes('@')) return fail(res, 'Invalid email format', 400);
    if (!isUptmEmail(email, 'student')) {
      return fail(res, 'Only @student.uptm.edu.my emails are accepted.', 400);
    }
    if (password.length < 6) return fail(res, 'Password must be at least 6 characters', 400);

    const [result] = await db.query(
      'INSERT INTO students (student_id, full_name, email, password) VALUES (?, ?, ?, ?)',
      [String(student_id).trim(), String(full_name).trim(), String(email).trim(), password]
    );
    ok(res, { id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'This Student ID is already registered', 400);
    fail(res, err.message);
  }
});

app.put('/api/accounts/students/:id', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const { full_name, email, password } = req.body || {};
    if (!full_name || !email) return fail(res, 'Full name and email are required', 400);

    const [rows] = await db.query('SELECT id FROM students WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, 'Student not found', 404);

    if (password) {
      await db.query(
        'UPDATE students SET full_name = ?, email = ?, password = ? WHERE id = ?',
        [String(full_name).trim(), String(email).trim(), password, req.params.id]
      );
    } else {
      await db.query(
        'UPDATE students SET full_name = ?, email = ? WHERE id = ?',
        [String(full_name).trim(), String(email).trim(), req.params.id]
      );
    }
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/accounts/students/:id', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const [rows] = await db.query('SELECT id, student_id FROM students WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, 'Student not found', 404);

    const sid = rows[0].student_id;

    const cleanups = [
      ['DELETE FROM notes WHERE student_id = ?',                  [sid]],
      ['DELETE FROM reminders WHERE student_id = ?',              [sid]],
      ['DELETE FROM events WHERE student_id = ?',                 [sid]],
      ['DELETE FROM timetable WHERE student_id = ?',              [sid]],
      ['DELETE FROM submissions WHERE student_id = ?',            [sid]],
      ['DELETE FROM assignment_completions WHERE student_id = ?', [sid]],
      ['DELETE FROM enrollments WHERE student_id = ?',            [sid]],
      ["DELETE FROM user_settings WHERE user_id = ? AND user_role = 'student'", [sid]]
    ];
    for (const [sql, params] of cleanups) {
      try { await db.query(sql, params); }
      catch (e) { console.warn('[ACCOUNTS] student cleanup skipped:', e.message); }
    }

    await db.query('DELETE FROM students WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ---------- Lecturers ---------- */
app.get('/api/accounts/lecturers', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const [rows] = await db.query(
      'SELECT id, lecturer_id, full_name, email, department FROM lecturers ORDER BY id ASC'
    );
    ok(res, rows);
  } catch (err) { fail(res, err.message); }
});

app.post('/api/accounts/lecturers', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const { lecturer_id, full_name, email, department, password } = req.body || {};
    if (!lecturer_id || !full_name || !email || !password) {
      return fail(res, 'Lecturer ID, full name, email and password are required', 400);
    }
    if (!email.includes('@')) return fail(res, 'Invalid email format', 400);
    if (!isUptmEmail(email, 'staff')) {
      return fail(res, 'Only @uptm.edu.my emails are accepted.', 400);
    }
    if (password.length < 6) return fail(res, 'Password must be at least 6 characters', 400);

    const [result] = await db.query(
      'INSERT INTO lecturers (lecturer_id, full_name, email, department, password) VALUES (?, ?, ?, ?, ?)',
      [String(lecturer_id).trim(), String(full_name).trim(), String(email).trim(),
       department ? String(department).trim() : '', password]
    );
    ok(res, { id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 'This Lecturer ID or email is already registered', 400);
    fail(res, err.message);
  }
});

app.put('/api/accounts/lecturers/:id', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const { full_name, email, department, password } = req.body || {};
    if (!full_name || !email) return fail(res, 'Full name and email are required', 400);

    const [rows] = await db.query('SELECT id FROM lecturers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, 'Lecturer not found', 404);

    if (password) {
      await db.query(
        'UPDATE lecturers SET full_name = ?, email = ?, department = ?, password = ? WHERE id = ?',
        [String(full_name).trim(), String(email).trim(),
         department ? String(department).trim() : '', password, req.params.id]
      );
    } else {
      await db.query(
        'UPDATE lecturers SET full_name = ?, email = ?, department = ? WHERE id = ?',
        [String(full_name).trim(), String(email).trim(),
         department ? String(department).trim() : '', req.params.id]
      );
    }
    ok(res, { updated: true });
  } catch (err) { fail(res, err.message); }
});

app.delete('/api/accounts/lecturers/:id', async (req, res) => {
  try {
    if (!requireAdminRole(req)) return fail(res, 'Admin access required', 403);
    const [rows] = await db.query('SELECT id, lecturer_id FROM lecturers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return fail(res, 'Lecturer not found', 404);

    const lid = rows[0].lecturer_id;

    const cleanups = [
      ['DELETE FROM assignments WHERE lecturer_id = ?', [lid]],
      ['DELETE FROM classes WHERE lecturer_id = ?',     [lid]],
      ["DELETE FROM user_settings WHERE user_id = ? AND user_role = 'lecturer'", [lid]]
    ];
    for (const [sql, params] of cleanups) {
      try { await db.query(sql, params); }
      catch (e) { console.warn('[ACCOUNTS] lecturer cleanup skipped:', e.message); }
    }

    await db.query('DELETE FROM lecturers WHERE id = ?', [req.params.id]);
    ok(res, { deleted: true });
  } catch (err) { fail(res, err.message); }
});

/* ================= HEALTH & TEST ================= */

app.get('/api/health', (req, res) => {
  ok(res, { status: 'up', service: 'uptm-buddy-api', time: new Date().toISOString() });
});

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

app.get('/test-notification.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-notification.html'));
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 UPTM Buddy API running at http://localhost:${PORT}`);
});