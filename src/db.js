const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost',
  port: '3307',
  user: 'root',
  password: '',
  database: 'uptm_buddy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection()
  .then(conn => {
    console.log('✅ Connected to MySQL (uptm_buddy)');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
  });

module.exports = db;