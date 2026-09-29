const mysql = require('mysql2/promise');

// Tetapan sambungan ke XAMPP / Laragon MySQL
const db = mysql.createPool({
  host: 'localhost',
  port: '3307',
  user: 'root',      // Pengguna lalai XAMPP/Laragon
  password: '',      // Kata laluan lalai (biasanya kosong)
  database: 'uptm_buddy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Semak sambungan
db.getConnection()
  .then(conn => {
    console.log('✅ Successfully connected to MySQL Database (phpMyAdmin)!');
    conn.release();
  })
  .catch(err => {
    console.error('❌ ERROR cannot connect to MySQL Database. Make Sure XAMPP/MySQL are started:', err.message);
  });

module.exports = db;