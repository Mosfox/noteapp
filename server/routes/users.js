const express = require('express');
const { getDB } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const users = await getDB().collection('users').find(
      {},
      { projection: { passwordHash: 0 } }
    ).sort({ createdAt: -1 }).toArray();

    res.json(users.map(user => ({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    })));
  } catch (err) { next(err); }
});

router.delete('/:username', async (req, res, next) => {
  try {
    const username = String(req.params.username || '');
    if (username === req.user.username) {
      return res.status(400).json({ error: 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้' });
    }

    const db = getDB();
    const target = await db.collection('users').findOne({ username });
    if (!target) return res.status(404).json({ error: 'ไม่พบบัญชีผู้ใช้' });
    if (target.role === 'admin') return res.status(403).json({ error: 'ไม่สามารถลบบัญชีผู้ดูแลระบบผ่าน API นี้ได้' });

    await Promise.all([
      db.collection('users').deleteOne({ _id: target._id }),
      db.collection('sessions').deleteMany({ userId: target._id }),
      db.collection('notes').deleteMany({ userId: target._id })
    ]);
    res.json({ message: `ลบบัญชี ${username} และโน้ตที่เกี่ยวข้องแล้ว` });
  } catch (err) { next(err); }
});

module.exports = router;
