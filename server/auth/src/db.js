require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const DB_PATH = process.env.DB_PATH || '/mnt/MolStar/db/molstar.db';
let db;

function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function initDb() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sessions (
      user_id INTEGER PRIMARY KEY,
      snapshot_json TEXT,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  const count = d.prepare('SELECT COUNT(*) as c FROM users').get();
  if (count.c === 0) {
    const adminUser = process.env.ADMIN_USERNAME || 'AdminMolstar';
    const adminPass = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPass) {
      console.error('ERROR: ADMIN_INITIAL_PASSWORD env var not set. Cannot seed admin user.');
      process.exit(1);
    }
    const hash = bcrypt.hashSync(adminPass, 12);
    d.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(adminUser, hash);
    console.log('Seeded admin user:', adminUser);
  }
}

module.exports = { getDb, initDb };
