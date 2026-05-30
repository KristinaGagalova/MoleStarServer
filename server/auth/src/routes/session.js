const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const session = getDb().prepare('SELECT snapshot_json FROM sessions WHERE user_id = ?').get(req.user.id);
  if (!session) return res.json(null);
  try { res.json({ snapshot: JSON.parse(session.snapshot_json) }); }
  catch { res.json(null); }
});

router.put('/', requireAuth, (req, res) => {
  const { snapshot } = req.body;
  if (!snapshot) return res.status(400).json({ error: 'snapshot required' });
  getDb().prepare('INSERT OR REPLACE INTO sessions (user_id, snapshot_json, saved_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
    .run(req.user.id, JSON.stringify(snapshot));
  res.json({ ok: true });
});

module.exports = router;
