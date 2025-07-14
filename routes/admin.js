// routes/admin.js
import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/admin', (req, res) => {
  db.all('SELECT email, rewriteCount, id, created_at, theme FROM users ORDER BY id ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).send('Database error');
    }

    // Build HTML table
    let html = `
      <html>
      <head>
        <title>AI Rewriter Admin Dashboard</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #f8f8f8; margin: 0; padding: 40px; }
          table { border-collapse: collapse; width: 100%; background: #fff; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #0a2540; color: #fff; }
          tr:nth-child(even) { background: #f2f2f2; }
          h1 { color: #0a2540; }
        </style>
      </head>
      <body>
        <h1>AI Rewriter Admin Dashboard</h1>
        <table>
          <tr>
            <th>Email</th>
            <th>Rewrite Count</th>
            <th>Registration Date</th>
            <th>Theme</th>
          </tr>
    `;

    for (const user of rows) {
      html += `
        <tr>
          <td>${user.email}</td>
          <td>${user.rewriteCount ?? 0}</td>
          <td>${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}</td>
          <td>${user.theme || ''}</td>
        </tr>
      `;
    }

    html += `
        </table>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// Get all users as JSON
router.get('/api/admin/users', (req, res) => {
    db.all('SELECT * FROM users ORDER BY id ASC', [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    });
  });
  
  // Update user (role, pro, reset usage)
  router.post('/api/admin/user/:id', (req, res) => {
    const { id } = req.params;
    const { role, pro, resetUsage } = req.body;
    let updates = [];
    let params = [];
    if (role) { updates.push('role = ?'); params.push(role); }
    if (typeof pro !== 'undefined') { updates.push('pro = ?'); params.push(pro ? 1 : 0); }
    if (resetUsage) { updates.push('rewriteCount = 0'); }
    if (updates.length === 0) return res.json({ success: true });
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...params, id], function(err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      res.json({ success: true });
    });
  });
  
  // Export users as CSV
  router.get('/api/admin/export', (req, res) => {
    db.all('SELECT * FROM users ORDER BY id ASC', [], (err, rows) => {
      if (err) return res.status(500).send('Database error');
      let csv = 'id,email,rewriteCount,created_at,theme,role,pro\n';
      for (const u of rows) {
        csv += `${u.id},"${u.email}",${u.rewriteCount},"${u.created_at || ''}","${u.theme || ''}","${u.role || ''}",${u.pro || 0}\n`;
      }
      res.header('Content-Type', 'text/csv');
      res.attachment('users.csv');
      res.send(csv);
    });
  });

export default router;