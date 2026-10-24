/**
 * 个人工作台 · 服务端（零依赖 Node HTTP）
 * - 静态站点托管 public/
 * - 账号：注册 / 登录 / 改密 / 注销
 * - 数据：按用户隔离的云同步
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('./lib/db');
const auth = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 6 * 1024 * 1024;   // 6MB
const MAX_PAYLOAD = 4 * 1024 * 1024; // 单份数据 4MB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

/* ---------------- 工具 ---------------- */
function send(res, code, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  }, headers));
  res.end(buf);
}
const ok = (res, data) => send(res, 200, JSON.stringify({ ok: true, data }));
const fail = (res, code, msg, extra) => send(res, code, JSON.stringify(Object.assign({ ok: false, error: msg }, extra || {})));

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function currentUser(req) {
  const token = parseCookies(req).ws_session;
  if (!token) return null;
  const sess = db.getSession(token);
  if (!sess) return null;
  return db.getUser(sess.userId);
}

const isHttps = req => (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

function setSessionCookie(res, token, secure) {
  const maxAge = auth.SESSION_DAYS * 24 * 3600;
  res.setHeader('Set-Cookie',
    `ws_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
function clearSessionCookie(res, secure) {
  res.setHeader('Set-Cookie', `ws_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`);
}

const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

/* ---------------- 接口 ---------------- */
const routes = {
  /* 健康检查 */
  'GET /api/health': async (req, res) => ok(res, { time: Date.now(), users: db.allUsers().length }),

  /* 当前账号 */
  'GET /api/auth/me': async (req, res) => {
    const u = currentUser(req);
    if (!u) return fail(res, 401, '未登录');
    const d = db.getData(u.id);
    ok(res, { user: auth.publicUser(u), synced: !!d, updatedAt: d ? d.updatedAt : 0, rev: d ? d.rev : 0 });
  },

  /* 注册 */
  'POST /api/auth/register': async (req, res, body) => {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim() || email.split('@')[0];
    if (!auth.validateEmail(email)) return fail(res, 400, '请输入有效的邮箱');
    const pwErr = auth.validatePassword(password);
    if (pwErr) return fail(res, 400, pwErr);
    if (db.findUserByEmail(email)) return fail(res, 409, '该邮箱已注册，请直接登录');

    const { salt, hash } = auth.hashPassword(password);
    const user = {
      id: 'u_' + crypto.randomBytes(9).toString('hex'),
      email, name, salt, hash,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };
    db.putUser(user);
    const token = auth.createSession(user.id);
    setSessionCookie(res, token, isHttps(req));
    ok(res, { user: auth.publicUser(user) });
  },

  /* 登录 */
  'POST /api/auth/login': async (req, res, body) => {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const ip = clientIp(req);
    if (!auth.checkRate(ip, email)) return fail(res, 429, '尝试次数过多，请 15 分钟后再试');
    const user = db.findUserByEmail(email);
    if (!user || !auth.verifyPassword(password, user)) {
      auth.noteFail(ip, email);
      return fail(res, 401, '邮箱或密码不正确');
    }
    auth.clearFail(ip, email);
    user.lastLoginAt = Date.now();
    db.putUser(user);
    const token = auth.createSession(user.id);
    setSessionCookie(res, token, isHttps(req));
    const d = db.getData(user.id);
    ok(res, { user: auth.publicUser(user), synced: !!d, updatedAt: d ? d.updatedAt : 0, rev: d ? d.rev : 0 });
  },

  /* 退出 */
  'POST /api/auth/logout': async (req, res) => {
    const token = parseCookies(req).ws_session;
    if (token) db.dropSession(token);
    clearSessionCookie(res, isHttps(req));
    ok(res, { done: true });
  },

  /* 修改密码（需原密码） */
  'POST /api/auth/password': async (req, res, body) => {
    const u = currentUser(req);
    if (!u) return fail(res, 401, '未登录');
    if (!auth.verifyPassword(String(body.oldPassword || ''), u)) return fail(res, 403, '当前密码不正确');
    const pwErr = auth.validatePassword(String(body.newPassword || ''));
    if (pwErr) return fail(res, 400, pwErr);
    const { salt, hash } = auth.hashPassword(String(body.newPassword));
    u.salt = salt; u.hash = hash; u.pwdChangedAt = Date.now();
    db.putUser(u);
    db.dropUserSessions(u.id);                 // 改密后其他设备需重新登录
    setSessionCookie(res, auth.createSession(u.id), isHttps(req));
    ok(res, { done: true });
  },

  /* 修改昵称 */
  'POST /api/auth/profile': async (req, res, body) => {
    const u = currentUser(req);
    if (!u) return fail(res, 401, '未登录');
    const name = String(body.name || '').trim();
    if (!name) return fail(res, 400, '昵称不能为空');
    u.name = name.slice(0, 24);
    db.putUser(u);
    ok(res, { user: auth.publicUser(u) });
  },

  /* 注销账号（需密码，删除全部数据） */
  'DELETE /api/auth/account': async (req, res, body) => {
    const u = currentUser(req);
    if (!u) return fail(res, 401, '未登录');
    if (!auth.verifyPassword(String(body.password || ''), u)) return fail(res, 403, '密码不正确，无法注销');
    db.removeUser(u.id);
    clearSessionCookie(res, isHttps(req));
    ok(res, { done: true });
  },

  /* 拉取云端数据 */
  'GET /api/data': async (req, res) => {
    const u = currentUser(req);
    if (!u) return fail(res, 401, '未登录');
    const d = db.getData(u.id);
    ok(res, d ? { payload: d.payload, rev: d.rev, updatedAt: d.updatedAt } : { payload: null, rev: 0, updatedAt: 0 });
  },

  /* 推送本地数据（带版本冲突检测） */
  'PUT /api/data': async (req, res, body) => {
    const u = currentUser(req);
    if (!u) return fail(res, 401, '未登录');
    const payload = body && body.payload;
    if (!payload || typeof payload !== 'object') return fail(res, 400, '数据格式不正确');
    const size = Buffer.byteLength(JSON.stringify(payload));
    if (size > MAX_PAYLOAD) return fail(res, 413, '数据过大（上限 4MB）');
    const cur = db.getData(u.id);
    const baseRev = Number(body.baseRev || 0);
    // 冲突：服务端版本比客户端基线新，且不是客户端自己刚推上去的
    if (cur && baseRev && cur.rev > baseRev && body.force !== true) {
      return send(res, 409, JSON.stringify({
        ok: false, error: 'conflict',
        server: { payload: cur.payload, rev: cur.rev, updatedAt: cur.updatedAt }
      }));
    }
    const next = db.putData(u.id, payload);
    ok(res, { rev: next.rev, updatedAt: next.updatedAt });
  },

  /* 删除云端数据（重置） */
  'DELETE /api/data': async (req, res) => {
    const u = currentUser(req);
    if (!u) return fail(res, 401, '未登录');
    db.db.data[u.id] = { payload: null, rev: (db.getData(u.id) || { rev: 0 }).rev + 1, updatedAt: Date.now() };
    db.flush();
    ok(res, { done: true });
  }
};

/* ---------------- 静态文件 ---------------- */
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const target = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(PUBLIC_DIR)) return fail(res, 403, 'forbidden');

  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      // SPA 回退
      const idx = path.join(PUBLIC_DIR, 'index.html');
      return fs.readFile(idx, (e2, buf) => {
        if (e2) return send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8' });
        send(res, 200, buf, { 'Content-Type': MIME['.html'] });
      });
    }
    const ext = path.extname(target).toLowerCase();
    fs.readFile(target, (e3, buf) => {
      if (e3) return send(res, 404, 'not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      const cache = /\.(css|js|svg|png|jpg|woff2)$/.test(ext) ? 'public, max-age=300' : 'no-store';
      send(res, 200, buf, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    });
  });
}

/* ---------------- 服务 ---------------- */
const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  const method = (req.method || 'GET').toUpperCase();

  if (url.startsWith('/api/')) {
    const key = `${method} ${url.split('?')[0]}`;
    const handler = routes[key];
    if (!handler) return fail(res, 404, '接口不存在');
    try {
      let body = {};
      if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
        body = await readBody(req);
      }
      await handler(req, res, body);
    } catch (e) {
      console.error('[api]', key, e.message);
      if (/too large/.test(e.message)) return fail(res, 413, '请求体过大');
      if (/invalid json/.test(e.message)) return fail(res, 400, '请求格式错误');
      fail(res, 500, '服务异常，请稍后重试');
    }
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  db.sweepSessions();
  console.log(`个人工作台服务已启动：http://127.0.0.1:${PORT}`);
  console.log(`数据文件：${db.file}`);
});

process.on('SIGTERM', () => { db.flushNow(); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { db.flushNow(); server.close(() => process.exit(0)); });
