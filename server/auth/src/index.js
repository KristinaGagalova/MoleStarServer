require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

initDb();

app.use(cors({ origin: false }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));
app.use('/api/session', require('./routes/session'));
app.use('/api/admin', require('./routes/admin'));

app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`MolStar API running on port ${PORT}`);
});
