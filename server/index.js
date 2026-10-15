require('dotenv').config();

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { connectDB, getDB } = require('./db');

const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');
const userRoutes = require('./routes/users');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false, limit: '12mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Notes App' });
});

app.use('/api', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/users', userRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'ไม่พบ API endpoint นี้' });
  res.status(404).send('ไม่พบหน้าที่ต้องการ');
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.log('Admin seeding skipped (ADMIN_USERNAME / ADMIN_PASSWORD not set).');
    return;
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD ต้องมีอย่างน้อย 12 ตัวอักษร');
  }

  const db = getDB();
  const users = db.collection('users');
  const existing = await users.findOne({ username });
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = {
    username,
    name: process.env.ADMIN_NAME || 'Administrator',
    email: (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase(),
    passwordHash,
    role: 'admin'
  };

  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: { ...admin, createdAt: existing.createdAt || new Date() } });
  } else {
    admin.createdAt = new Date();
    await users.insertOne(admin);
  }
  console.log(`Admin account ready: ${username}`);
}

async function start() {
  try {
    await connectDB();
    await seedAdmin();
    app.listen(PORT, () => console.log(`Notes App running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start application:', err.message);
    process.exit(1);
  }
}

start();
