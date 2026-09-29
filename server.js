const express = require('express');
const cors = require('cors');
const db = require('./src/db.js'); // Menggunakan db.js dari folder src/

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint untuk Tugasan
app.get('/api/tasks', async (req, res) => {
  try {
    const [tasks] = await db.query('SELECT * FROM assignments WHERE completed = FALSE ORDER BY due_date ASC');
    res.json(tasks);
  } catch (err) {
    console.error('Ralat Database (Tasks):', err);
    res.status(500).json([]);
  }
});

// Endpoint untuk Jadual Waktu
app.get('/api/timetable', async (req, res) => {
  try {
    const [timetable] = await db.query('SELECT * FROM timetable');
    res.json(timetable);
  } catch (err) {
    console.error('Ralat Database (Timetable):', err);
    res.status(500).json([]);
  }
});

app.listen(3000, () => {
  console.log('Server MySQL berjalan di http://localhost:3000');
});