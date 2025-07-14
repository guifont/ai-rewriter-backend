import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { incrementRewriteCount } from '../models/User.js';

const router = express.Router();

router.post('/rewrite', requireAuth, async (req, res) => {
  const userId = req.user.userId;

  // Increment the rewrite count
  let newCount;
  try {
    newCount = await incrementRewriteCount(userId);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update rewrite count' });
  }

  res.json({
    userId,
    input: req.body.text,
    message: 'Rewrite endpoint works!',
    rewriteCount: newCount   // <--- Make sure this line is here!
  });
});

export default router;