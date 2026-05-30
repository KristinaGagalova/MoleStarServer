const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware');

const router = express.Router();
const DATA_PATH = process.env.DATA_PATH || '/mnt/MolStar/data/users';
const UPLOAD_LIMIT_MB = parseInt(process.env.UPLOAD_LIMIT_MB || '500');
const ALLOWED_EXT = new Set(['.pdb','.cif','.mmcif','.mol2','.sdf','.xyz','.ply','.dcd','.bcif','.ent','.gro']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DATA_PATH, req.user.username, 'files');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, randomUUID() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_LIMIT_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

router.get('/', requireAuth, (req, res) => {
  const files = getDb().prepare(
    'SELECT id, original_name, size, uploaded_at FROM files WHERE user_id = ? ORDER BY uploaded_at DESC'
  ).all(req.user.id);
  res.json(files);
});

router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.filename);
  const id = path.basename(req.file.filename, ext);
  getDb().prepare('INSERT INTO files (id, user_id, filename, original_name, size) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, req.file.filename, req.file.originalname, req.file.size);
  res.json({ ok: true, file: { id, original_name: req.file.originalname, size: req.file.size } });
});

router.get('/:id', requireAuth, (req, res) => {
  const file = getDb().prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(DATA_PATH, req.user.username, 'files', file.filename);
  res.sendFile(filePath);
});

router.delete('/:id', requireAuth, (req, res) => {
  const file = getDb().prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  try { fs.unlinkSync(path.join(DATA_PATH, req.user.username, 'files', file.filename)); } catch {}
  getDb().prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
