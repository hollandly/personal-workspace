/**
 * 账号体系（零依赖）：scrypt 密码哈希 + 随机 token 会话
 */
const crypto = require('crypto');
const db = require('./db');

const SESSION_DAYS = 7;
const KEYLEN = 64;

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), s, KEYLEN, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { salt: s, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.salt || !user.hash) return false;
  const calc = crypto.scryptSync(String(password), user.salt, KEYLEN, { N: 16384, r: 8, p: 1 });
  const stored = Buffer.from(user.hash, 'hex');
  if (calc.length !== stored.length) return false;
  return crypto.timingSafeEqual(calc, stored);
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

function validatePassword(pwd) {
  const p = String(pwd || '');
  if (p.length < 8) return '密码至少 8 位';
  if (p.length > 72) return '密码过长（最多 72 位）';
  if (!/[a-zA-Z]/.test(p) && !/[0-9]/.test(p)) return '密码需包含字母或数字';
  return null;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.putSession(token, { userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_DAYS * 24 * 3600 * 1000 });
  return token;
}

/* 简易登录限流：同一 IP + 邮箱，15 分钟内最多 8 次失败 */
const fails = new Map();
function failKey(ip, email) { return ip + '|' + String(email || '').toLowerCase(); }
function checkRate(ip, email) {
  const k = failKey(ip, email);
  const rec = fails.get(k);
  if (!rec) return true;
  if (Date.now() - rec.t > 15 * 60 * 1000) { fails.delete(k); return true; }
  return rec.n < 8;
}
function noteFail(ip, email) {
  const k = failKey(ip, email);
  const rec = fails.get(k);
  if (!rec || Date.now() - rec.t > 15 * 60 * 1000) fails.set(k, { n: 1, t: Date.now() });
  else rec.n++;
}
function clearFail(ip, email) { fails.delete(failKey(ip, email)); }

module.exports = {
  hashPassword, verifyPassword, publicUser, validateEmail, validatePassword,
  createSession, checkRate, noteFail, clearFail,
  SESSION_DAYS
};
