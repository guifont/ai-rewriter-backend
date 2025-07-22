import express from 'express';
import { requireAuth } from '../middleware/auth.js'; // Your JWT middleware
import db from '../db.js';
import fetch from 'node-fetch'; // If not already imported
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

router.post('/rewrite', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Set by requireAuth middleware
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // 1. Increment rewriteCount
    db.run(
      'UPDATE users SET rewriteCount = rewriteCount + 1 WHERE id = ?',
      [userId],
      function (err) {
        if (err) {
          console.error('Failed to update rewrite count:', err);
          // Not a fatal error, continue
        }
      }
    );

    // Fetch user info
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user.pro) {
      // Count rewrites this month
      const { count } = await db.get(
        `SELECT COUNT(*) as count FROM rewrites WHERE user_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
        [userId]
      );
      const MONTHLY_CAP = 50; // Set your free user cap here

      if (count >= MONTHLY_CAP) {
        return res.status(403).json({ error: 'Free plan limit reached. Upgrade to Pro for unlimited rewrites.' });
      }
    }

    // 2. Call OpenAI API
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!openaiRes.ok) {
      const errorData = await openaiRes.json();
      return res.status(500).json({ error: errorData.error?.message || 'OpenAI API error' });
    }

    const data = await openaiRes.json();
    const rewrittenText = data.choices[0].message.content.trim();

    console.log('Logging rewrite for userId:', userId);
    db.run(
      'INSERT INTO rewrites (user_id) VALUES (?)',
      [userId],
      function (err) {
        if (err) {
          console.error('Failed to log rewrite event:', err);
        } else {
          console.log('Rewrite logged in DB for userId:', userId);
        }
      }
    );

    // 3. Return the rewritten text
    res.json({ rewrittenText });

  } catch (err) {
    console.error('Rewrite error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/detect-language', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required.' });
    }

    // Call OpenAI API securely
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Detect the language of the following text and only reply with one word like: English, French, Spanish, German, Italian.\n\n"${text}"`
        }]
      }),
    });

    if (!openaiRes.ok) {
      const errorData = await openaiRes.json();
      return res.status(500).json({ error: errorData.error?.message || 'OpenAI API error' });
    }

    const data = await openaiRes.json();
    const language = data.choices[0].message.content.trim().toLowerCase();

    res.json({ language });
  } catch (err) {
    console.error('Detect language error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;