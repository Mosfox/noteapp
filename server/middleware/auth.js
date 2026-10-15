const { getDB } = require('../db');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });

    const db = getDB();
    const session = await db.collection('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!session) return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });

    const user = await db.collection('users').findOne(
      { _id: session.userId },
      { projection: { passwordHash: 0 } }
    );

    if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
