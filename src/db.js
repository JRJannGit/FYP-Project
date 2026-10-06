const mysql = require('mysql2/promise');

/* [R13] Credentials were hardcoded. Read them from environment variables
   (DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME) with the previous local
   values as fallbacks so existing dev setups keep working. */
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3307',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'uptm_buddy',
  dateStrings: true,
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