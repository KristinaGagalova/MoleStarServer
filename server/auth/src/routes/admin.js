const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db');
const { requireAdmin } = require('../middleware');

const router = express.Router();

router.get('/users', requireAdmin, (req, res) => {
  res.json(getDb().prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at').all());
});

router.post('/users', requireAdmin, async (req, res) => {
  const { username, password, role = 'user' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!['user','admin'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const r = getDb().prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
    res.json({ ok: true, id: r.lastInsertRowid, username, role });
  } catch(e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
    throw e;
  }
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.username === req.user.username) return res.status(400).json({ error: 'Cannot delete yourself' });
  getDb().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
