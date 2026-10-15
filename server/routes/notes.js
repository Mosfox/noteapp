const express = require('express');
const { ObjectId } = require('mongodb');
const { getDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function validId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

function cleanText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

// Allow a small set of formatting tags and remove attributes to reduce HTML injection risk.
function cleanHtml(value) {
  let html = String(value || '').slice(0, 100000);
  html = html.replace(/<(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<\/?(?!p\b|br\b|b\b|strong\b|i\b|em\b|u\b|ul\b|ol\b|li\b|h[1-6]\b|blockquote\b|div\b|span\b)[a-z][^>]*>/gi, '');
  html = html.replace(/<([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name) => {
    const allowed = ['p','br','b','strong','i','em','u','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','div','span'];
    return allowed.includes(name.toLowerCase()) ? `<${name.toLowerCase()}>` : '';
  });
  html = html.replace(/<\/([a-z][a-z0-9]*)\s*>/gi, (tag, name) => {
    const allowed = ['p','b','strong','i','em','u','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','div','span'];
    return allowed.includes(name.toLowerCase()) ? `</${name.toLowerCase()}>` : '';
  });
  return html;
}

function cleanChecklist(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 100).map(item => ({
    id: cleanText(item?.id, 60) || new ObjectId().toString(),
    text: cleanText(item?.text, 200),
    done: Boolean(item?.done)
  })).filter(item => item.text);
}

function cleanImages(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 6).filter(src =>
    typeof src === 'string' &&
    src.length <= 1500000 &&
    /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(src)
  );
}

function buildPayload(body, existing = {}) {
  const title = body.title === undefined ? existing.title || '' : cleanText(body.title, 120);
  const category = body.category === undefined ? existing.category || 'ทั่วไป' : cleanText(body.category, 40);
  const content = body.content === undefined ? existing.content || '' : cleanHtml(body.content);
  const checklist = body.checklist === undefined ? existing.checklist || [] : cleanChecklist(body.checklist);
  const images = body.images === undefined ? existing.images || [] : cleanImages(body.images);
  const pinned = body.pinned === undefined ? Boolean(existing.pinned) : Boolean(body.pinned);

  if (!title && !content.replace(/<[^>]*>/g, '').trim() && checklist.length === 0 && images.length === 0) {
    throw new Error('กรุณาใส่หัวข้อ ข้อความ รูปภาพ หรือ Checklist อย่างน้อยหนึ่งอย่าง');
  }

  return { title, category: category || 'ทั่วไป', content, checklist, images, pinned };
}

router.get('/categories', async (req, res, next) => {
  try {
    const rows = await getDB().collection('notes').aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    res.json(rows.map(row => ({ name: row._id || 'ทั่วไป', count: row.count })));
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.category) filter.category = cleanText(req.query.category, 40);
    if (req.query.pinned === 'true') filter.pinned = true;
    if (req.query.q) {
      const q = cleanText(req.query.q, 100);
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } }
      ];
    }
    const notes = await getDB().collection('notes')
      .find(filter, { projection: { images: { $slice: 1 } } })
      .sort({ pinned: -1, updatedAt: -1 })
      .toArray();

    res.json(notes.map(note => ({
      ...note,
      imageCount: Array.isArray(note.images) ? note.images.length : 0
    })));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'รหัสโน้ตไม่ถูกต้อง' });
    const note = await getDB().collection('notes').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id
    });
    if (!note) return res.status(404).json({ error: 'ไม่พบโน้ตนี้' });
    res.json(note);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = buildPayload(req.body);
    const now = new Date();
    const note = {
      ...payload,
      userId: req.user._id,
      createdAt: now,
      updatedAt: now
    };
    const result = await getDB().collection('notes').insertOne(note);
    res.status(201).json({ ...note, _id: result.insertedId });
  } catch (err) {
    if (err.message.startsWith('กรุณาใส่')) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'รหัสโน้ตไม่ถูกต้อง' });
    const db = getDB();
    const existing = await db.collection('notes').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id
    });
    if (!existing) return res.status(404).json({ error: 'ไม่พบโน้ตนี้' });

    const payload = buildPayload(req.body, existing);
    await db.collection('notes').updateOne(
      { _id: existing._id, userId: req.user._id },
      { $set: { ...payload, updatedAt: new Date() } }
    );
    res.json({ ...existing, ...payload, updatedAt: new Date() });
  } catch (err) {
    if (err.message.startsWith('กรุณาใส่')) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'รหัสโน้ตไม่ถูกต้อง' });
    const result = await getDB().collection('notes').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id
    });
    if (!result.deletedCount) return res.status(404).json({ error: 'ไม่พบโน้ตนี้' });
    res.json({ message: 'ลบโน้ตสำเร็จ' });
  } catch (err) { next(err); }
});

module.exports = router;
