/* ===== 通用工具 ===== */
const U = {
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  $: (s, r = document) => r.querySelector(s),
  $$: (s, r = document) => Array.from(r.querySelectorAll(s)),

  /** 创建元素：el('div.card', {onclick: fn}, [child|string]) */
  el(sel, attrs = {}, children = []) {
    const [tag, ...cls] = sel.split('.');
    const node = document.createElement(tag || 'div');
    if (cls.length) node.className = cls.join(' ');
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  },

  esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  /* ---- 日期 ---- */
  today() { return U.fmt(new Date()); },
  fmt(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const p = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  },
  parse(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  addDays(s, n) { const d = U.parse(s); d.setDate(d.getDate() + n); return U.fmt(d); },
  diffDays(a, b) { return Math.round((U.parse(a) - U.parse(b)) / 86400000); },
  /** 周一为一周起点 */
  startOfWeek(s) { const d = U.parse(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return U.fmt(d); },
  endOfWeek(s) { return U.addDays(U.startOfWeek(s), 6); },
  monthKey(s) { return s.slice(0, 7); },
  addMonth(s, n) {
    const d = U.parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return U.fmt(d).slice(0, 8) + '01';
  },
  monthDays(mk) {
    const [y, m] = mk.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const start = U.startOfWeek(U.fmt(first));
    const end = U.addDays(U.fmt(last), 6 - ((U.parse(U.fmt(last)).getDay() + 6) % 7));
    const days = [];
    let cur = start;
    while (U.diffDays(cur, end) <= 0) { days.push(cur); cur = U.addDays(cur, 1); }
    return days;
  },
  weekdayCN(s) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][U.parse(s).getDay()]; },
  prettyDate(s) {
    if (!s) return '';
    const t = U.today();
    const d = U.diffDays(s, t);
    if (d === 0) return '今天';
    if (d === 1) return '明天';
    if (d === -1) return '昨天';
    if (d === 2) return '后天';
    if (d < 0 && d > -7) return `${-d}天前`;
    return s.slice(5).replace('-', '/');
  },
  nowTime() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; },

  /* ---- 其它 ---- */
  debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },

  toast(msg) {
    const wrap = U.$('#toastWrap');
    const t = U.el('div.toast', { text: msg });
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 2000);
  },

  download(name, content, type = 'text/plain') {
    const blob = new Blob([content], { type: type + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  pickFile(accept = '.json') {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept;
      input.onchange = () => {
        const f = input.files[0];
        if (!f) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, text: r.result });
        r.readAsText(f);
      };
      input.click();
    });
  },

  /** 模态框 */
  modal({ title, body, okText = '保存', cancelText = '取消', onOk, onCancel, wide }) {
    const mask = U.$('#modalMask');
    const box = U.$('#modal');
    box.classList.toggle('wide', !!wide);
    U.$('#modalTitle').textContent = title;
    const b = U.$('#modalBody'); b.innerHTML = ''; b.appendChild(body);
    const f = U.$('#modalFoot'); f.innerHTML = '';
    const close = () => mask.classList.remove('show');
    if (cancelText) {
      f.appendChild(U.el('button.btn', {
        text: cancelText,
        onclick: () => { if (!onCancel || onCancel(b) !== false) close(); }
      }));
    }
    if (okText) {
      f.appendChild(U.el('button.btn.btn-primary', {
        text: okText,
        onclick: () => { if (!onOk || onOk(b) !== false) close(); }
      }));
    }
    mask.classList.add('show');
    const first = b.querySelector('input,textarea,select');
    if (first) setTimeout(() => first.focus(), 50);
    return { close };
  },
  closeModal() { U.$('#modalMask').classList.remove('show'); },

  confirm(msg, onYes) {
    const body = U.el('div', { html: `<p style="font-size:13.5px;line-height:1.8">${U.esc(msg)}</p>` });
    U.modal({ title: '确认操作', body, okText: '确定', cancelText: '取消', onOk: () => { onYes(); } });
  },

  /** 生成表单字段 */
  field(label, input) {
    return U.el('div.form-field', {}, [U.el('label', { text: label }), input]);
  },
  input(value = '', attrs = {}) {
    return U.el('input', Object.assign({ value, class: '' }, attrs));
  },
  textarea(value = '', attrs = {}) {
    const t = U.el('textarea', attrs); t.value = value; return t;
  },
  select(options, value = '', attrs = {}) {
    const s = U.el('select', attrs);
    options.forEach(o => {
      const op = U.el('option', { value: o.value, text: o.label });
      if (String(o.value) === String(value)) op.selected = true;
      s.appendChild(op);
    });
    return s;
  }
};

/* 视图注册表 */
const Views = {};

/* 全局常量 */
const PRIORITY = [
  { value: 'p1', label: 'P1 紧急重要', color: '#e0463c', cls: 'red' },
  { value: 'p2', label: 'P2 重要', color: '#e8930c', cls: 'orange' },
  { value: 'p3', label: 'P3 一般', color: '#3b6ef5', cls: 'blue' },
  { value: 'p4', label: 'P4 有空再做', color: '#9aa1ad', cls: '' }
];
const P_MAP = Object.fromEntries(PRIORITY.map(p => [p.value, p]));

const PROJ_STATUS = [
  { value: 'active', label: '进行中', cls: 'blue' },
  { value: 'planning', label: '规划中', cls: '' },
  { value: 'paused', label: '已暂停', cls: 'orange' },
  { value: 'done', label: '已完成', cls: 'green' }
];
const PS_MAP = Object.fromEntries(PROJ_STATUS.map(p => [p.value, p]));

const TASK_COLS = [
  { value: 'todo', label: '待办', color: '#9aa1ad' },
  { value: 'doing', label: '进行中', color: '#3b6ef5' },
  { value: 'review', label: '待验收', color: '#e8930c' },
  { value: 'done', label: '已完成', color: '#17a672' }
];

const COLORS = ['#3b6ef5', '#7c5cf0', '#0ea5a4', '#e8930c', '#e0463c', '#e0559a', '#17a672', '#6b7280'];
