// models/User.js
import db from '../db.js';

export function createUser(email, passwordHash, theme) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (email, password_hash, created_at, theme) VALUES (?, ?, datetime("now"), ?)',
      [email, passwordHash, theme || null],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, email });
      }
    );
  });
}

export function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export function incrementRewriteCount(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET rewriteCount = rewriteCount + 1 WHERE id = ?',
        [userId],
        function (err) {
          if (err) return reject(err);
          db.get('SELECT rewriteCount FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row.rewriteCount);
          });
        }
      );
    });
  }