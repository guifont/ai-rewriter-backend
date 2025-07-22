// routes/admin.js
import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import dotenv from 'dotenv';

const router = express.Router();

dotenv.config();

// TEMPORARY: Debug endpoint to see what's in the database
router.get('/api/debug', async (req, res) => {
  try {
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const rewrites = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM rewrites', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ users, rewrites });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/promote', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid secret' });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  db.run('UPDATE users SET role = "admin" WHERE email = ?', [email], function(err) {
    if (err) return res.status(500).json({ error: 'Update failed' });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  });
});

router.get('/admin', (req, res) => {
    db.all('SELECT email, rewriteCount, id, created_at, theme, role, pro FROM users ORDER BY id ASC', [], (err, rows) => {
      if (err) {
        console.error('Database error:', err); // <--- Add this line
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

  router.get('/api/admin/stats', requireAuth, async (req, res) => {
    try {
      // Only allow admins
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
  
      const users = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM users', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
  
      // Helper to get start of week/month
      function getStartOf(period) {
        const now = new Date();
        if (period === 'week') {
          const day = now.getDay();
          now.setDate(now.getDate() - day);
          now.setHours(0,0,0,0);
        } else if (period === 'month') {
          now.setDate(1);
          now.setHours(0,0,0,0);
        }
        return now.toISOString();
      }
  
      const weekStart = getStartOf('week');
      const monthStart = getStartOf('month');
      // For each user, get rewrite stats
      const stats = await Promise.all(users.map(async user => {
        const rewritesWeek = await new Promise((resolve, reject) => {
        console.log('Checking rewrites for user:', user.id, 'weekStart:', weekStart);
          db.get(
            'SELECT COUNT(*) as count FROM rewrites WHERE user_id = ? AND created_at >= ?',
            [user.id, weekStart],
            (err, row) => err ? reject(err) : resolve(row.count)
          );
        });
    
        const rewritesMonth = await new Promise((resolve, reject) => {
        console.log('Checking rewrites for user:', user.id, 'monthStart:', monthStart);
          db.get(
            'SELECT COUNT(*) as count FROM rewrites WHERE user_id = ? AND created_at >= ?',
            [user.id, monthStart],
            (err, row) => err ? reject(err) : resolve(row.count)
          );
        });
        return {
          email: user.email,
          created_at: user.created_at,
          rewriteCount: user.rewriteCount,
          pro: user.pro,
          role: user.role,
          rewritesWeek,
          rewritesMonth,
        };
      }));
  
      res.json(stats);
    } catch (err) {
      console.error('Admin stats error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

// TEMPORARY: Debug endpoint to see what's in the database
router.get('/api/debug', async (req, res) => {
  try {
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const rewrites = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM rewrites', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ users, rewrites });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;