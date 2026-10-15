const API = '/api/notes';
const MAX_IMAGES = 6;
const $ = id => document.getElementById(id);

let token = localStorage.getItem('token');
let me = JSON.parse(localStorage.getItem('me') || 'null');
let activeCategory = '';
let query = '';
let editing = null;
let searchTimer;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const reorder = list => [...list.filter(item => !item.done), ...list.filter(item => item.done)];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function showMsg(node, message) {
  node.textContent = message || '';
  node.hidden = !message;
}
async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) clearSession();
    throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}
const jsonOptions = (method, body) => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

function showView() {
  $('auth-view').hidden = !!token;
  $('app-view').hidden = !token;
  $('admin-section').hidden = !(token && me && me.role === 'admin');
  if (token && me) $('who').textContent = `${me.name} (${me.role})`;
}
function clearSession() {
  token = null; me = null;
  localStorage.removeItem('token'); localStorage.removeItem('me');
  closeEditor(); showView();
}
async function login(data) {
  const result = await request('/api/login', jsonOptions('POST', data));
  token = result.token; me = result.user;
  localStorage.setItem('token', token); localStorage.setItem('me', JSON.stringify(me));
  showMsg($('auth-msg'), ''); showView(); await loadAll();
}
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  try { await login(Object.fromEntries(new FormData(e.target))); e.target.reset(); }
  catch (err) { showMsg($('auth-msg'), err.message); }
});
$('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await request('/api/register', jsonOptions('POST', data));
    await login({ username: data.username, password: data.password });
    e.target.reset();
  } catch (err) { showMsg($('auth-msg'), err.message); }
});
$('logout').addEventListener('click', async () => {
  try { await request('/api/logout', { method: 'POST' }); } catch (_) {}
  clearSession();
});

async function loadNotes() {
  try {
    const params = new URLSearchParams();
    if (activeCategory) params.set('category', activeCategory);
    if (query) params.set('q', query);
    const [list, cats] = await Promise.all([request(`${API}?${params}`), request('/api/notes/categories')]);
    renderChips(cats); renderNotes(list); showMsg($('error'), '');
  } catch (err) { showMsg($('error'), err.message); }
}
function renderChips(cats) {
  const total = cats.reduce((sum, c) => sum + c.count, 0);
  $('chips').replaceChildren();
  [{ name: '', label: `ทั้งหมด (${total})` }, ...cats.map(c => ({ name: c.name, label: `${c.name} (${c.count})` }))].forEach(c => {
    const b = el('button', `chip${c.name === activeCategory ? ' active' : ''}`, c.label);
    b.type = 'button';
    b.addEventListener('click', () => { activeCategory = c.name; loadNotes(); });
    $('chips').append(b);
  });
  $('cat-list').replaceChildren(...cats.map(c => { const o = document.createElement('option'); o.value = c.name; return o; }));
}
function renderNotes(list) {
  const pinned = list.filter(n => n.pinned), others = list.filter(n => !n.pinned);
  $('pinned').replaceChildren(...pinned.map(card));
  $('notes').replaceChildren(...others.map(card));
  $('pinned-wrap').hidden = !pinned.length;
  $('others-label').hidden = !pinned.length;
  $('empty').hidden = list.length > 0;
  $('empty').textContent = query || activeCategory ? 'ไม่พบโน้ตที่ตรงกับเงื่อนไข' : 'ยังไม่มีโน้ต กดปุ่ม + เพื่อเริ่มจดได้เลย';
}
function textOf(html) {
  return (new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
}
function card(note) {
  const c = el('article', 'card'); c.tabIndex = 0;
  c.addEventListener('click', e => { if (!e.target.closest('.card-ck')) openEditor(note._id); });
  c.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === c) openEditor(note._id); });
  if (note.images && note.images[0]) {
    const img = el('img'); img.src = note.images[0]; img.alt = ''; c.append(img);
  }
  const body = el('div', 'card-body');
  if (note.title) body.append(el('div', 'card-title', note.title));
  const text = textOf(note.content);
  if (text) body.append(el('div', 'card-text', text.length > 140 ? text.slice(0, 140) + '…' : text));
  if (note.checklist?.length) {
    const ul = el('ul', 'card-ck');
    note.checklist.slice(0, 6).forEach(item => {
      const li = el('li', item.done ? 'done' : '');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = item.done;
      cb.setAttribute('aria-label', item.text);
      cb.addEventListener('change', () => toggleFromCard(note, item.id));
      li.append(cb, el('span', '', item.text)); ul.append(li);
    });
    body.append(ul);
    if (note.checklist.length > 6) body.append(el('div', 'card-more', `+ อีก ${note.checklist.length - 6} รายการ`));
  }
  const foot = el('div', 'card-foot'); foot.append(el('span', 'tag', note.category || 'ทั่วไป'));
  if (note.imageCount > 1) foot.append(el('span', '', `${note.imageCount} รูป`));
  body.append(foot); c.append(body); return c;
}
async function toggleFromCard(note, itemId) {
  const list = reorder(note.checklist.map(i => i.id === itemId ? { ...i, done: !i.done } : i));
  try { await request(`${API}/${note._id}`, jsonOptions('PATCH', { checklist: list })); await loadNotes(); }
  catch (err) { showMsg($('error'), err.message); }
}
$('search').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { query = e.target.value.trim(); loadNotes(); }, 250);
});

async function openEditor(id) {
  try {
    const note = id ? await request(`${API}/${id}`) : null;
    editing = {
      id: note ? note._id : null,
      pinned: note ? note.pinned : false,
      images: note ? [...(note.images || [])] : [],
      checklist: note ? [...(note.checklist || [])] : []
    };
    $('ed-title').value = note?.title || '';
    $('ed-category').value = note?.category || activeCategory || '';
    $('ed-body').innerHTML = note?.content || '';
    $('ck-new').value = ''; $('ed-delete').hidden = !note;
    showMsg($('ed-error'), ''); renderPin(); renderImages(); renderChecklist();
    $('editor').hidden = false; document.body.classList.add('lock');
    (note ? $('ed-body') : $('ed-title')).focus();
  } catch (err) { showMsg($('error'), err.message); }
}
function closeEditor() {
  if ($('editor')) $('editor').hidden = true;
  document.body.classList.remove('lock'); editing = null;
}
function renderPin() {
  $('ed-pin').setAttribute('aria-pressed', String(editing.pinned));
  $('ed-pin').textContent = editing.pinned ? 'ปักหมุดแล้ว' : 'ปักหมุด';
}
document.querySelectorAll('.toolbar button').forEach(b => {
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', () => { document.execCommand(b.dataset.cmd, false, b.dataset.val || null); $('ed-body').focus(); });
});
function resizeImage(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
$('ed-file').addEventListener('change', async e => {
  try {
    for (const file of e.target.files) {
      if (editing.images.length >= MAX_IMAGES) throw new Error(`แนบรูปได้สูงสุด ${MAX_IMAGES} รูปต่อโน้ต`);
      if (!file.type.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      editing.images.push(await resizeImage(file));
    }
    showMsg($('ed-error'), '');
  } catch (err) { showMsg($('ed-error'), err.message); }
  e.target.value = ''; renderImages();
});
function renderImages() {
  $('ed-images').replaceChildren(...editing.images.map((src, i) => {
    const wrap = el('div', 'thumb'), img = el('img'); img.src = src; img.alt = `รูปที่ ${i + 1}`;
    const rm = el('button', '', '×'); rm.type = 'button'; rm.setAttribute('aria-label', `ลบรูปที่ ${i + 1}`);
    rm.addEventListener('click', () => { editing.images.splice(i, 1); renderImages(); });
    wrap.append(img, rm); return wrap;
  }));
}
function checkItem(item) {
  const li = el('li', item.done ? 'done' : ''); li.dataset.id = item.id;
  const cb = el('input'); cb.type = 'checkbox'; cb.checked = item.done; cb.setAttribute('aria-label', 'ทำเสร็จแล้ว');
  const text = el('input', 'ck-text'); text.value = item.text; text.maxLength = 200; text.setAttribute('aria-label', 'ข้อความรายการ');
  const rm = el('button', 'rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'ลบรายการ');
  li.append(cb, text, rm); return li;
}
function renderChecklist() {
  const open = editing.checklist.filter(i => !i.done), done = editing.checklist.filter(i => i.done);
  $('ck-open').replaceChildren(...open.map(checkItem)); $('ck-done').replaceChildren(...done.map(checkItem));
  $('ck-done-wrap').hidden = !done.length; $('ck-done-label').textContent = `เสร็จแล้ว ${done.length} รายการ`;
}
function addItem() {
  const text = $('ck-new').value.trim(); if (!text || !editing) return;
  const open = editing.checklist.filter(i => !i.done), done = editing.checklist.filter(i => i.done);
  editing.checklist = [...open, { id: uid(), text, done: false }, ...done];
  $('ck-new').value = ''; renderChecklist();
}
$('ck-add').addEventListener('click', addItem);
$('ck-new').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });
const findItem = target => {
  const li = target.closest('li'); return li && editing?.checklist.find(i => i.id === li.dataset.id);
};
$('editor').addEventListener('change', e => {
  if (e.target.type !== 'checkbox' || !editing) return;
  const item = findItem(e.target); if (!item) return;
  item.done = e.target.checked; editing.checklist = reorder(editing.checklist); renderChecklist();
});
$('editor').addEventListener('input', e => {
  if (!editing || !e.target.classList.contains('ck-text')) return;
  const item = findItem(e.target); if (item) item.text = e.target.value;
});
$('editor').addEventListener('click', e => {
  if (!e.target.classList.contains('rm') || !editing) return;
  const item = findItem(e.target); editing.checklist = editing.checklist.filter(i => i !== item); renderChecklist();
});
$('ed-close').addEventListener('click', closeEditor);
$('ed-pin').addEventListener('click', () => { editing.pinned = !editing.pinned; renderPin(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && editing) closeEditor(); });
$('ed-save').addEventListener('click', async () => {
  addItem();
  const payload = {
    title: $('ed-title').value,
    category: $('ed-category').value,
    content: $('ed-body').innerHTML,
    checklist: editing.checklist,
    images: editing.images,
    pinned: editing.pinned
  };
  try {
    await request(editing.id ? `${API}/${editing.id}` : API, jsonOptions(editing.id ? 'PATCH' : 'POST', payload));
    closeEditor(); await loadNotes();
  } catch (err) { showMsg($('ed-error'), err.message); }
});
$('ed-delete').addEventListener('click', async () => {
  if (!editing || !confirm('ลบโน้ตนี้ใช่หรือไม่?')) return;
  try { await request(`${API}/${editing.id}`, { method: 'DELETE' }); closeEditor(); await loadNotes(); }
  catch (err) { showMsg($('ed-error'), err.message); }
});
$('fab').addEventListener('click', () => openEditor(null));

async function loadUsers() {
  if (!me || me.role !== 'admin') return;
  try {
    const list = await request('/api/users');
    $('user-table').replaceChildren(...list.map(u => {
      const tr = document.createElement('tr');
      [u.username, u.name, u.email, u.role].forEach(v => tr.append(el('td', '', v)));
      const td = el('td');
      if (u.username !== me.username) {
        const btn = el('button', 'delete', 'ลบ');
        btn.addEventListener('click', async () => {
          if (!confirm(`ลบบัญชี ${u.username} และโน้ตทั้งหมดของเขา?`)) return;
          try { await request(`/api/users/${encodeURIComponent(u.username)}`, { method: 'DELETE' }); await loadUsers(); }
          catch (err) { showMsg($('error'), err.message); }
        });
        td.append(btn);
      }
      tr.append(td); return tr;
    }));
  } catch (err) { showMsg($('error'), err.message); }
}
async function loadAll() { await loadNotes(); await loadUsers(); }

showView();
if (token) {
  request('/api/me').then(result => {
    me = result.user; localStorage.setItem('me', JSON.stringify(me)); showView(); loadAll();
  }).catch(() => clearSession());
}
