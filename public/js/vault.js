/**
 * 本地保险箱：口令加密存储
 * - 数据在写入 localStorage 前用 AES-256-GCM 加密
 * - 密钥由口令经 PBKDF2(250k, SHA-256) 派生，只存在内存中，锁屏即销毁
 * - 服务端 / 网络不参与，任何数据都不离开这台设备
 */
const Vault = {
  STORE_KEY: 'pw-vault-v1',
  LEGACY_KEY: 'personal-workspace-v1',
  IDLE_KEY: 'pw-idle-minutes',
  ITER: 250000,

  key: null,          // CryptoKey，仅内存
  salt: null,
  hint: '',
  unlocked: false,
  plainMode: false,   // 浏览器不支持 WebCrypto 时的降级模式（明文）
  idleTimer: null,
  saveTimer: null,
  onLock: null,

  supported() {
    return !!(window.crypto && window.crypto.subtle);
  },

  /* ---------- UTF-8 编解码（不依赖 TextEncoder，兼容老浏览器） ---------- */
  utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const s = unescape(encodeURIComponent(String(str)));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
  utf8str(buf) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(buf);
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return decodeURIComponent(escape(s));
  },

  idleMinutes() {
    const v = Number(localStorage.getItem(Vault.IDLE_KEY));
    return v > 0 ? v : 30;
  },
  setIdleMinutes(m) {
    localStorage.setItem(Vault.IDLE_KEY, String(m));
    Vault.resetIdle();
  },

  /* ---------- 编解码 ---------- */
  b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  },
  unb64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  /* ---------- 密钥派生 ---------- */
  async derive(password, salt) {
    const baseKey = await crypto.subtle.importKey(
      'raw', Vault.utf8(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: Vault.ITER, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /* ---------- 记录读写 ---------- */
  readRecord() {
    try { return JSON.parse(localStorage.getItem(Vault.STORE_KEY) || 'null'); }
    catch (e) { return null; }
  },
  isConfigured() { return !!Vault.readRecord(); },

  async encrypt(obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = Vault.utf8(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, Vault.key, data);
    return { iv: Vault.b64(iv), data: Vault.b64(ct) };
  },

  async decrypt(rec) {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Vault.unb64(rec.iv) }, Vault.key, Vault.unb64(rec.data));
    return JSON.parse(Vault.utf8str(plain));
  },

  /* ---------- 建立 / 解锁 ---------- */
  async setup(password, hint) {
    if (!Vault.supported()) return { error: '当前环境不支持浏览器加密，无法启用本地保险箱' };
    if (String(password || '').length < 8) return { error: '口令至少 8 位' };
    Vault.salt = crypto.getRandomValues(new Uint8Array(16));
    Vault.key = await Vault.derive(password, Vault.salt);
    const payload = Object.assign(Store.blank(), Store.seed ? {} : {});
    const db = Object.assign(payload, {
      todos: [], projects: [], tasks: [], goals: [], notes: [], plans: [], logs: []
    });
    // 迁移旧明文数据
    const legacy = localStorage.getItem(Vault.LEGACY_KEY);
    if (legacy) {
      try {
        const old = JSON.parse(legacy);
        if (old && Array.isArray(old.todos)) {
          Object.assign(db, Store.blank(), old);
        }
      } catch (e) { /* 忽略损坏的旧数据 */ }
    } else {
      Object.assign(db, Store.blank(), Store.seed());
    }
    const enc = await Vault.encrypt(db);
    const rec = {
      v: 1, salt: Vault.b64(Vault.salt), iv: enc.iv, data: enc.data,
      hint: String(hint || '').slice(0, 60), updatedAt: Date.now()
    };
    localStorage.setItem(Vault.STORE_KEY, JSON.stringify(rec));
    localStorage.removeItem(Vault.LEGACY_KEY);
    Vault.unlocked = true;
    Vault.plainMode = false;
    Vault.hint = rec.hint;
    Store.hydrate(db);
    Vault.resetIdle();
    return { ok: true };
  },

  async unlock(password) {
    const rec = Vault.readRecord();
    if (!rec) return { error: '本机还没有数据，请先设置口令' };
    if (!Vault.supported()) return { error: '当前环境不支持浏览器加密' };
    try {
      const salt = Vault.unb64(rec.salt);
      Vault.key = await Vault.derive(password, salt);
      const db = await Vault.decrypt(rec);
      Vault.salt = salt;
      Vault.hint = rec.hint || '';
      Vault.unlocked = true;
      Store.hydrate(db);
      Vault.resetIdle();
      return { ok: true };
    } catch (e) {
      Vault.key = null;
      return { error: '口令不正确' };
    }
  },

  lock() {
    Vault.key = null;
    Vault.unlocked = false;
    clearTimeout(Vault.idleTimer);
    clearTimeout(Vault.saveTimer);
    if (Vault.onLock) Vault.onLock();
  },

  async changePassword(oldPwd, newPwd, newHint) {
    if (!Vault.unlocked) return { error: '未解锁' };
    if (!/^(?=.*[^\s]).{8,}$/.test(String(newPwd || ''))) return { error: '新口令至少 8 位' };
    // 校验旧口令
    const rec = Vault.readRecord();
    try {
      const testKey = await Vault.derive(oldPwd, Vault.unb64(rec.salt));
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: Vault.unb64(rec.iv) }, testKey, Vault.unb64(rec.data));
    } catch (e) { return { error: '当前口令不正确' }; }

    Vault.salt = crypto.getRandomValues(new Uint8Array(16));
    Vault.key = await Vault.derive(newPwd, Vault.salt);
    const enc = await Vault.encrypt(Store.db);
    localStorage.setItem(Vault.STORE_KEY, JSON.stringify({
      v: 1, salt: Vault.b64(Vault.salt), iv: enc.iv, data: enc.data,
      hint: String(newHint || Vault.hint || '').slice(0, 60), updatedAt: Date.now()
    }));
    Vault.hint = String(newHint || Vault.hint || '');
    return { ok: true };
  },

  /* ---------- 保存（防抖加密写回） ---------- */
  scheduleSave() {
    if (!Vault.unlocked) return;
    clearTimeout(Vault.saveTimer);
    Vault.saveTimer = setTimeout(() => Vault.saveNow(), 600);
  },

  async saveNow() {
    if (!Vault.unlocked || !Vault.key) return;
    try {
      const enc = await Vault.encrypt(Store.db);
      const rec = Vault.readRecord() || {};
      rec.v = 1;
      rec.salt = Vault.b64(Vault.salt);
      rec.iv = enc.iv;
      rec.data = enc.data;
      rec.hint = Vault.hint;
      rec.updatedAt = Date.now();
      localStorage.setItem(Vault.STORE_KEY, JSON.stringify(rec));
    } catch (e) {
      console.error('[vault] 加密保存失败', e);
      U.toast('保存失败，请检查浏览器存储权限');
    }
  },

  /** 清空本机全部数据 */
  wipe() {
    localStorage.removeItem(Vault.STORE_KEY);
    localStorage.removeItem(Vault.LEGACY_KEY);
    localStorage.removeItem('personal-workspace-sync');
    Vault.key = null;
    Vault.unlocked = false;
  },

  /* ---------- 自动锁定 ---------- */
  resetIdle() {
    clearTimeout(Vault.idleTimer);
    const mins = Vault.idleMinutes();
    if (!mins || mins <= 0) return;          // 0 = 不自动锁定
    Vault.idleTimer = setTimeout(() => {
      if (Vault.unlocked) {
        Vault.saveNow().then(() => { Vault.lock(); U.toast('已自动锁定'); });
      }
    }, mins * 60 * 1000);
  },
  bindIdleEvents() {
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(ev => {
      window.addEventListener(ev, () => { if (Vault.unlocked) Vault.resetIdle(); }, { passive: true });
    });
  },

  /* ---------- 锁屏界面 ---------- */
  renderLock(mode) {
    const screen = U.$('#lockScreen');
    const rec = Vault.readRecord();
    const isSetup = mode === 'setup' || !rec;
    screen.classList.add('show');
    const card = U.$('#lockCard');
    card.innerHTML = `
      <div class="lock-logo">工</div>
      <div class="lock-title">${isSetup ? '设置本机口令' : '输入口令解锁'}</div>
      <div class="lock-sub">${isSetup
        ? '数据只存在这台设备上，用这个口令加密保存'
        : (rec && rec.hint ? '提示：' + U.esc(rec.hint) : '数据已加密保存在本机')}</div>
      ${Vault.supported() ? '' : '<div class="lock-warn">当前环境不是 HTTPS 或 localhost，浏览器加密不可用</div>'}
      <form id="lockForm" autocomplete="off">
        <input type="password" id="lkPwd" placeholder="${isSetup ? '设置口令（至少 8 位）' : '口令'}" autocomplete="new-password">
        ${isSetup ? '<input type="password" id="lkPwd2" placeholder="再次输入口令" autocomplete="new-password">' : ''}
        ${isSetup ? '<input type="text" id="lkHint" placeholder="口令提示（可选，会明文存在本机）" maxlength="60">' : ''}
        <div class="lock-err" id="lkErr"></div>
        <button type="submit" class="btn btn-primary lock-btn" id="lkGo">${isSetup ? '创建并开始使用' : '解锁'}</button>
        ${isSetup
        ? '<button type="button" class="lock-link" id="lkSkip">暂不加密，直接开始（数据明文保存）</button>'
        : '<button type="button" class="lock-link" id="lkForgot">忘记口令？清空本机数据重新设置</button>'}
      </form>
    `;

    U.$('#lockForm', card).addEventListener('submit', async e => {
      e.preventDefault();
      const pwd = U.$('#lkPwd', card).value;
      const err = U.$('#lkErr', card);
      const btn = U.$('#lkGo', card);
      err.textContent = '';
      if (isSetup) {
        const pwd2 = U.$('#lkPwd2', card).value;
        if (pwd.length < 8) { err.textContent = '口令至少 8 位'; return; }
        if (pwd !== pwd2) { err.textContent = '两次输入的口令不一致'; return; }
        btn.disabled = true; btn.textContent = '正在加密…';
        const r = await Vault.setup(pwd, U.$('#lkHint', card).value);
        btn.disabled = false; btn.textContent = '创建并开始使用';
        if (r.error) { err.textContent = r.error; return; }
        Vault.closeLock();
        U.toast('已启用本地加密');
        App.afterUnlock();
      } else {
        btn.disabled = true; btn.textContent = '解锁中…';
        const r = await Vault.unlock(pwd);
        btn.disabled = false; btn.textContent = '解锁';
        if (r.error) { err.textContent = r.error; U.$('#lkPwd', card).value = ''; return; }
        Vault.closeLock();
        App.afterUnlock();
      }
    });

    const skip = U.$('#lkSkip', card);
    if (skip) skip.addEventListener('click', () => {
      U.confirm('不加密模式下，数据会以明文保存在浏览器里，任何人打开这台设备都能看到。确定继续？', () => {
        Vault.plainMode = true;
        Vault.unlocked = true;
        Store.hydrate(Store.seed());
        Store.save();
        Vault.closeLock();
        App.afterUnlock();
      });
    });

    const forgot = U.$('#lkForgot', card);
    if (forgot) forgot.addEventListener('click', () => {
      U.confirm('口令无法找回（数据只存在本机，没有服务器）。清空后将删除本机全部数据并重新设置，确定？', () => {
        Vault.wipe();
        U.toast('本机数据已清空');
        Vault.renderLock('setup');
      });
    });
  },

  closeLock() {
    U.$('#lockScreen').classList.remove('show');
  }
};
