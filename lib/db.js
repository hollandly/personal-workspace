/**
 * 极简 JSON 持久化层（零依赖）
 * 数据文件：data/db.json
 * 结构：
 *   { users: {}, sessions: {}, data: {}, meta: {} }
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.WS_DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = { users: {}, sessions: {}, data: {}, meta: { createdAt: Date.now() } };

let cache = null;
let flushTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (cache) return cache;
  ensureDir();
  try {
    if (fs.existsSync(FILE)) {
      cache = Object.assign({}, EMPTY, JSON.parse(fs.readFileSync(FILE, 'utf8')));
    } else {
      cache = JSON.parse(JSON.stringify(EMPTY));
    }
  } catch (e) {
    console.error('[db] 读取失败，使用空库：', e.message);
    cache = JSON.parse(JSON.stringify(EMPTY));
  }
  ['users', 'sessions', 'data'].forEach(k => { if (!cache[k] || typeof cache[k] !== 'object') cache[k] = {}; });
  if (!cache.meta) cache.meta = { createdAt: Date.now() };
  return cache;
}

/** 落盘（防抖 + 原子写） */
function flush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      ensureDir();
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8');
      fs.renameSync(tmp, FILE);
    } catch (e) {
      console.error('[db] 写入失败：', e.message);
    }
  }, 120);
}

function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  ensureDir();
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache), 'utf8');
  fs.renameSync(tmp, FILE);
}

module.exports = {
  get db() { return load(); },
  flush,
  flushNow,
  get file() { return FILE; },

  /** 用户 */
  findUserByEmail(email) {
    const db = load();
    const key = String(email || '').trim().toLowerCase();
    return Object.values(db.users).find(u => u.email === key) || null;
  },
  getUser(id) { return load().users[id] || null; },
  putUser(u) { load().users[u.id] = u; flush(); return u; },
  removeUser(id) {
    const db = load();
    delete db.users[id];
    delete db.data[id];
    Object.keys(db.sessions).forEach(t => { if (db.sessions[t].userId === id) delete db.sessions[t]; });
    flushNow();
  },
  allUsers() { return Object.values(load().users); },

  /** 会话 */
  putSession(token, sess) { load().sessions[token] = sess; flush(); },
  getSession(token) {
    const s = load().sessions[token];
    if (!s) return null;
    if (s.expiresAt < Date.now()) { delete load().sessions[token]; flush(); return null; }
    // 滑动续期
    if (s.expiresAt - Date.now() < 3 * 24 * 3600 * 1000) {
      s.expiresAt = Date.now() + 7 * 24 * 3600 * 1000;
      flush();
    }
    return s;
  },
  dropSession(token) { delete load().sessions[token]; flush(); },
  dropUserSessions(userId) {
    const db = load();
    Object.keys(db.sessions).forEach(t => { if (db.sessions[t].userId === userId) delete db.sessions[t]; });
    flush();
  },
  sweepSessions() {
    const db = load(); const now = Date.now(); let n = 0;
    Object.keys(db.sessions).forEach(t => { if (db.sessions[t].expiresAt < now) { delete db.sessions[t]; n++; } });
    if (n) flush();
    return n;
  },

  /** 业务数据 */
  getData(userId) { return load().data[userId] || null; },
  putData(userId, payload) {
    const db = load();
    const prev = db.data[userId] || { payload: null, rev: 0, updatedAt: 0 };
    const next = {
      payload: payload,
      rev: (prev.rev || 0) + 1,
      updatedAt: Date.now()
    };
    db.data[userId] = next;
    flush();
    return next;
  }
};
