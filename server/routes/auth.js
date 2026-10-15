const express = require('express');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const SESSION_DAYS = 7;

function publicUser(user) {
  return {
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Username ต้องมี 3–30 ตัว ใช้ตัวอักษรอังกฤษ ตัวเลข หรือ _' });
    }
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อ 2–80 ตัวอักษร' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    }
    if (password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมี 8–100 ตัวอักษร' });
    }

    const db = getDB();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = {
      username,
      name,
      email,
      passwordHash,
      role: 'member',
      createdAt: new Date()
    };

    await db.collection('users').insertOne(user);
    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ', user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Username หรืออีเมลนี้ถูกใช้แล้ว' });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const db = getDB();
    const user = await db.collection('users').findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Username หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await db.collection('sessions').insertOne({
      token,
      userId: user._id,
      createdAt: new Date(),
      expiresAt
    });

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await getDB().collection('sessions').deleteOne({ token: req.token });
    res.json({ message: 'ออกจากระบบแล้ว' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
