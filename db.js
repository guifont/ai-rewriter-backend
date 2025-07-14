// db.js
import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./db.sqlite');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT
      rewriteCount INTEGER DEFAULT 0
    )
  `);
});

export default db;