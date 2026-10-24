/* ===== 云同步 + 账号 ===== */
const Sync = {
  state: 'loading',      // loading | offline | ok | syncing | error
  user: null,
  rev: 0,
  dirty: false,
  lastSyncAt: 0,
  timer: null,
  metaKey: 'personal-workspace-sync',

  /* ---------- 基础 ---------- */
  async api(path, options = {}) {
    const opt = Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    }, options);
    try {
      const res = await fetch(path, opt);
      let json = null;
      try { json = await res.json(); } catch (e) { /* 非 JSON */ }
      return { status: res.status, ok: !!(json && json.ok), data: json && json.data, error: json && json.error };
    } catch (e) {
      return { status: 0, ok: false, error: '网络不可用' };
    }
  },

  loadMeta() {
    try { return JSON.parse(localStorage.getItem(Sync.metaKey) || '{}'); } catch (e) { return {}; }
  },
  saveMeta() {
    localStorage.setItem(Sync.metaKey, JSON.stringify({
      rev: Sync.rev, lastSyncAt: Sync.lastSyncAt, user: Sync.user
    }));
  },

  setState(s) { Sync.state = s; Sync.render(); },
  markDirty() {
    if (!Sync.user) return;
    Sync.dirty = true;
    Sync.schedule();
    Sync.render();
  },
  schedule() {
    clearTimeout(Sync.timer);
    Sync.timer = setTimeout(() => Sync.push(), 4000);
  },

  /* ---------- 启动 ---------- */
  async init() {
    const meta = Sync.loadMeta();
    Sync.lastSyncAt = meta.lastSyncAt || 0;
    if (meta.user) Sync.user = meta.user;
    const h = await Sync.api('/api/health');
    if (h.ok && h.data) Sync.requireInvite = !!h.data.requireInvite;
    const r = await Sync.api('/api/auth/me');
    if (r.ok && r.data && r.data.user) {
      Sync.user = r.data.user;
      Sync.rev = r.data.rev || 0;
      Sync.saveMeta();
      await Sync.pull({ first: true });
    } else {
      Sync.user = null;
      Sync.rev = 0;
      Sync.setState('offline');
      Sync.saveMeta();
    }
    window.addEventListener('online', () => { if (Sync.user) Sync.pull(); });
    window.addEventListener('beforeunload', () => { if (Sync.dirty) Sync.push(); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Sync.user && !Sync.dirty) Sync.pull();
    });
    return Sync.user;
  },

  /* ---------- 拉取 ---------- */
  async pull(opts = {}) {
    if (!Sync.user) return;
    Sync.setState('syncing');
    const r = await Sync.api('/api/data');
    if (!r.ok) {
      Sync.setState(Sync.user ? 'error' : 'offline');
      return;
    }
    const remote = r.data || {};
    Sync.rev = remote.rev || 0;

    if (!remote.payload) {                       // 云端还没有数据 → 上传本地
      await Sync.push({ force: true, silent: true });
      return;
    }
    const localEmpty = !Store.db.todos.length && !Store.db.projects.length && !Store.db.tasks.length &&
      !Store.db.goals.length && !Store.db.notes.length && !(Store.db.plans || []).length;
    const same = JSON.stringify(remote.payload) === JSON.stringify(Store.db);

    if (same) {
      Sync.dirty = false;
    } else if (localEmpty || opts.force) {
      Store.db = Sync.normalize(remote.payload);
      Store.save();
      Sync.dirty = false;
    } else if (Sync.dirty && !opts.first) {
      // 本地有未同步改动且云端有新版本 → 交由用户决定
      await Sync.conflict(remote.payload);
      return;
    } else if (opts.first && !Sync.dirty) {
      Store.db = Sync.normalize(remote.payload);
      Store.save();
      Sync.dirty = false;
    } else {
      await Sync.conflict(remote.payload);
      return;
    }
    Sync.lastSyncAt = Date.now();
    Sync.saveMeta();
    Sync.setState('ok');
  },

  /* ---------- 推送 ---------- */
  async push(opts = {}) {
    if (!Sync.user) return;
    if (!Sync.dirty && !opts.force) return;
    clearTimeout(Sync.timer);
    Sync.setState('syncing');
    const r = await Sync.api('/api/data', {
      method: 'PUT',
      body: JSON.stringify({ payload: Store.db, baseRev: Sync.rev, force: !!opts.force })
    });
    if (r.ok) {
      Sync.rev = r.data.rev;
      Sync.dirty = false;
      Sync.lastSyncAt = Date.now();
      Sync.saveMeta();
      Sync.setState('ok');
      if (!opts.silent) U.toast('已同步到云端');
      return true;
    }
    if (r.status === 409 && r.data && r.data.server) {
      await Sync.conflict(r.data.server.payload);
      return false;
    }
    if (r.status === 401) { Sync.user = null; Sync.saveMeta(); Sync.setState('offline'); U.toast('登录已失效，请重新登录'); App.render(); return false; }
    Sync.setState('error');
    if (!opts.silent) U.toast('同步失败：' + (r.error || '请检查网络'));
    return false;
  },

  /* ---------- 冲突处理 ---------- */
  conflict(remotePayload) {
    return new Promise(resolve => {
      const body = U.el('div', {
        html: `<p style="font-size:13.5px;line-height:1.8;color:var(--text-dim)">
          云端与本机的数据不一致（可能是在其他设备上修改过）。请选择保留哪一份：</p>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
            <button class="btn btn-primary" id="cfMerge" style="justify-content:center;height:38px">智能合并两边数据（推荐）</button>
            <button class="btn" id="cfRemote" style="justify-content:center;height:38px">以云端为准，覆盖本机</button>
            <button class="btn" id="cfLocal" style="justify-content:center;height:38px">以本机为准，覆盖云端</button>
          </div>
          <p style="font-size:12px;color:var(--text-faint);margin-top:12px">合并会保留两边的条目，同一条内容以修改时间较新的为准。</p>`
      });
      U.modal({
        title: '数据冲突', body, okText: '', cancelText: '稍后处理',
        onCancel: () => { Sync.setState('error'); resolve('later'); }
      });
      const done = (mode) => {
        if (mode === 'remote') { Store.db = Sync.normalize(remotePayload); }
        else if (mode === 'merge') { Store.db = Sync.merge(Store.db, Sync.normalize(remotePayload)); }
        Store.save();
        U.closeModal();
        Sync.push({ force: true, silent: true }).then(() => resolve(mode));
      };
      U.$('#cfMerge', body).addEventListener('click', () => done('merge'));
      U.$('#cfRemote', body).addEventListener('click', () => done('remote'));
      U.$('#cfLocal', body).addEventListener('click', () => done('local'));
    });
  },

  /* ---------- 合并 ---------- */
  normalize(payload) {
    const base = Store.blank();
    const p = payload || {};
    const out = Object.assign(base, p);
    ['todos', 'projects', 'tasks', 'goals', 'notes', 'logs', 'plans'].forEach(k => {
      if (!Array.isArray(out[k])) out[k] = [];
    });
    if (!out.profile) out.profile = { name: '我', theme: 'light' };
    return out;
  },

  newerStamp(o) {
    return new Date(o.updatedAt || o.completedAt || o.createdAt || 0).getTime();
  },

  merge(local, remote) {
    const out = Sync.normalize(local);
    ['todos', 'projects', 'tasks', 'goals', 'notes', 'logs', 'plans'].forEach(key => {
      const map = new Map();
      (local[key] || []).forEach(it => { if (it && it.id) map.set(it.id, it); });
      (remote[key] || []).forEach(it => {
        if (!it || !it.id) return;
        const cur = map.get(it.id);
        if (!cur) { map.set(it.id, it); return; }
        const a = Sync.newerStamp(cur), b = Sync.newerStamp(it);
        if (b > a) map.set(it.id, it);
      });
      out[key] = Array.from(map.values());
    });
    return out;
  },

  /* ---------- 账号 ---------- */
  async login(email, password) {
    const r = await Sync.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!r.ok) return { error: r.error || '登录失败' };
    Sync.user = r.data.user;
    Sync.rev = r.data.rev || 0;
    Sync.saveMeta();
    await Sync.pull({ first: true });
    return { ok: true };
  },
  async register(email, password, name, inviteCode) {
    const r = await Sync.api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, inviteCode }) });
    if (!r.ok) return { error: r.error || '注册失败' };
    Sync.user = r.data.user;
    Sync.rev = 0;
    Sync.saveMeta();
    await Sync.push({ force: true, silent: true });
    Sync.setState('ok');
    return { ok: true };
  },
  async logout() {
    await Sync.api('/api/auth/logout', { method: 'POST' });
    Sync.user = null; Sync.dirty = false; Sync.rev = 0;
    Sync.saveMeta();
    Sync.setState('offline');
  },
  async changePassword(oldPassword, newPassword) {
    const r = await Sync.api('/api/auth/password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
    if (!r.ok) return { error: r.error || '修改失败' };
    return { ok: true };
  },
  async rename(name) {
    const r = await Sync.api('/api/auth/profile', { method: 'POST', body: JSON.stringify({ name }) });
    if (!r.ok) return { error: r.error || '保存失败' };
    Sync.user = r.data.user; Sync.saveMeta(); Sync.render();
    return { ok: true };
  },
  async deleteAccount(password) {
    const r = await Sync.api('/api/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) });
    if (!r.ok) return { error: r.error || '注销失败' };
    Sync.user = null; Sync.rev = 0; Sync.dirty = false;
    localStorage.removeItem(Sync.metaKey);
    Sync.setState('offline');
    return { ok: true };
  },
  async resetCloud() {
    const r = await Sync.api('/api/data', { method: 'DELETE' });
    if (!r.ok) return { error: r.error || '清空失败' };
    Sync.rev = r.data && r.data.rev ? r.data.rev : Sync.rev;
    return { ok: true };
  },

  /* ---------- 状态显示 ---------- */
  render() {
    const el = U.$('#syncBadge');
    if (!el) return;
    const cfg = {
      loading: { ico: 'refresh', text: '连接中', cls: '' },
      offline: { ico: 'user', text: '未登录', cls: '' },
      ok: { ico: 'refresh', text: Sync.ago(), cls: 'ok' },
      syncing: { ico: 'refresh', text: '同步中', cls: 'syncing' },
      error: { ico: 'alert', text: '未同步', cls: 'error' }
    }[Sync.state] || { ico: 'refresh', text: '', cls: '' };
    el.className = 'sync-badge ' + cfg.cls;
    el.innerHTML = `${U.icon(cfg.ico, 13)}<span class="sync-text">${cfg.text}</span>`;
    el.title = Sync.user
      ? `已登录 ${Sync.user.email}\n上次同步：${Sync.lastText()}`
      : '未登录 · 数据仅保存在本机';
    const acc = U.$('#btnAccount');
    if (acc) {
      const name = Sync.user ? (Sync.user.name || Sync.user.email.split('@')[0]) : '未登录';
      acc.innerHTML = Sync.user
        ? `<span class="avatar">${U.esc(name.slice(0, 1).toUpperCase())}</span>`
        : U.icon('user', 17);
      acc.title = Sync.user ? Sync.user.email : '登录 / 注册';
    }
  },

  ago() {
    if (!Sync.lastSyncAt) return '已同步';
    const s = Math.floor((Date.now() - Sync.lastSyncAt) / 1000);
    if (s < 60) return '刚刚同步';
    if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
    if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
    return `${Math.floor(s / 86400)} 天前`;
  },
  lastText() {
    return Sync.lastSyncAt ? new Date(Sync.lastSyncAt).toLocaleString('zh-CN') : '从未同步';
  },

  /* ---------- 登录 / 注册界面 ---------- */
  authDialog(mode = 'login') {
    const isReg = mode === 'register';
    const body = U.el('div', {}, [
      U.field('邮箱', U.input('', { id: 'auEmail', type: 'email', placeholder: 'you@example.com' })),
      U.field('密码', U.input('', { id: 'auPwd', type: 'password', placeholder: isReg ? '至少 8 位' : '登录密码' })),
      isReg ? U.field('昵称', U.input('', { id: 'auName', placeholder: '怎么称呼你（可留空）' })) : null,
      (isReg && Sync.requireInvite) ? U.field('邀请码', U.input('', { id: 'auInvite', placeholder: '站点所有者提供的邀请码' })) : null,
      U.el('div', { id: 'auErr', style: { color: 'var(--danger)', fontSize: '12.5px', minHeight: '18px' } }),
      U.el('div', {
        html: `<p style="font-size:12px;color:var(--text-faint);line-height:1.7;margin-top:4px">
          登录后数据会在所有设备间自动同步；不登录也能正常使用，但数据只存在这台设备的浏览器里。</p>`
      })
    ]);

    U.modal({
      title: isReg ? '注册账号' : '登录',
      body,
      okText: isReg ? '注册并同步' : '登录',
      cancelText: '先本地试用',
      onOk: async b => {
        const email = U.$('#auEmail', b).value.trim();
        const pwd = U.$('#auPwd', b).value;
        const name = isReg ? U.$('#auName', b).value.trim() : '';
        const invite = isReg && U.$('#auInvite', b) ? U.$('#auInvite', b).value.trim() : '';
        const errBox = U.$('#auErr', b);
        if (!email || !pwd) { errBox.textContent = '请填写邮箱和密码'; return false; }
        if (isReg && Sync.requireInvite && !invite) { errBox.textContent = '请填写邀请码'; return false; }
        const btn = U.$('#modalFoot .btn-primary');
        if (btn) { btn.disabled = true; btn.textContent = '处理中…'; }
        const r = isReg ? await Sync.register(email, pwd, name, invite) : await Sync.login(email, pwd);
        if (r.error) {
          errBox.textContent = r.error;
          if (btn) { btn.disabled = false; btn.textContent = isReg ? '注册并同步' : '登录'; }
          return false;
        }
        U.toast(isReg ? '注册成功，已开始同步' : '登录成功');
        App.render();
      }
    });
  },

  /* ---------- 账户中心 ---------- */
  accountDialog() {
    if (!Sync.user) return Sync.authDialog('login');
    const body = U.el('div', {}, [
      U.el('div', {
        html: `<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border)">
          <div class="avatar lg">${U.esc((Sync.user.name || Sync.user.email).slice(0, 1).toUpperCase())}</div>
          <div>
            <div style="font-weight:600;font-size:14.5px">${U.esc(Sync.user.name || '未设置昵称')}</div>
            <div style="font-size:12.5px;color:var(--text-dim)">${U.esc(Sync.user.email)}</div>
          </div>
        </div>`
      }),
      U.el('div', {
        html: `<div style="display:flex;gap:20px;margin:14px 0;font-size:12.5px;color:var(--text-dim)">
          <span>同步状态：<b style="color:${Sync.state === 'ok' ? 'var(--success)' : Sync.state === 'error' ? 'var(--danger)' : 'var(--text)'}">${
          { ok: '正常', syncing: '同步中', error: '未同步', offline: '未登录', loading: '连接中' }[Sync.state]}</b></span>
          <span>上次同步：${Sync.lastText()}</span>
        </div>`
      }),
      U.field('昵称', U.input(Sync.user.name || '', { id: 'acName' })),
      U.el('div.form-row', {}, [
        U.field('当前密码', U.input('', { id: 'acOld', type: 'password', placeholder: '修改密码时填写' })),
        U.field('新密码', U.input('', { id: 'acNew', type: 'password', placeholder: '至少 8 位，不修改请留空' }))
      ]),
      U.el('div', { id: 'acErr', style: { color: 'var(--danger)', fontSize: '12.5px', minHeight: '18px' } }),
      U.el('div', {
        html: `<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:14px">
          <div style="font-size:12.5px;color:var(--text-dim);margin-bottom:8px">危险操作</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" id="acReset">清空云端数据</button>
            <button class="btn btn-sm btn-danger" id="acDel">注销账号</button>
          </div>
        </div>`
      })
    ]);

    U.modal({
      title: '账户与同步',
      body,
      okText: '保存',
      cancelText: '关闭',
      onOk: async b => {
        const errBox = U.$('#acErr', b);
        errBox.textContent = '';
        const name = U.$('#acName', b).value.trim();
        const oldP = U.$('#acOld', b).value;
        const newP = U.$('#acNew', b).value;
        if (name && name !== Sync.user.name) {
          const r = await Sync.rename(name);
          if (r.error) { errBox.textContent = r.error; return false; }
        }
        if (newP || oldP) {
          if (!oldP) { errBox.textContent = '请先填写当前密码'; return false; }
          const r = await Sync.changePassword(oldP, newP);
          if (r.error) { errBox.textContent = r.error; return false; }
          U.toast('密码已修改，其他设备需重新登录');
        }
        Store.db.profile.name = name || Store.db.profile.name;
        Store.save();
        App.render();
      }
    });

    U.$('#acReset', body).addEventListener('click', async () => {
      U.closeModal();
      U.confirm('将清空云端的全部数据（本机数据保留），确定？', async () => {
        const r = await Sync.resetCloud();
        U.toast(r.ok ? '云端数据已清空' : ('失败：' + r.error));
      });
    });
    U.$('#acDel', body).addEventListener('click', async () => {
      U.closeModal();
      const pwd = prompt('注销账号将永久删除云端全部数据，请输入密码确认：');
      if (!pwd) return;
      const r = await Sync.deleteAccount(pwd);
      if (r.error) return U.toast('注销失败：' + r.error);
      U.toast('账号已注销');
      App.render();
    });
  }
};
