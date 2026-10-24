/* ===== 应用主控 ===== */
const App = {
  routes: ['dashboard', 'todos', 'week', 'projects', 'kanban', 'calendar', 'stats', 'goals', 'notes', 'settings'],
  icons: {
    dashboard: 'grid', todos: 'check', week: 'plan', projects: 'folder', kanban: 'columns',
    calendar: 'calendar', stats: 'chart', goals: 'target', notes: 'note', settings: 'settings'
  },
  focus: { timer: null, left: 0, refId: '', title: '' },

  async init() {
    Store.load();
    App.paintIcons();
    App.setTheme(Store.db.profile.theme || 'light');
    App.bindNav();
    App.bindGlobal();
    window.addEventListener('hashchange', () => App.render());
    if (!location.hash) location.hash = '#/dashboard';
    App.render();
    // 账号与云端同步（失败不影响本地使用）
    try {
      const user = await Sync.init();
      if (!user && !App.guestPrompted) {
        App.guestPrompted = true;
        setTimeout(() => {
          if (!Sync.user) U.toast('当前为本地模式，登录后可在多设备间同步');
        }, 1200);
      }
    } catch (e) {
      Sync.setState('offline');
    }
  },

  setTheme(t) {
    Store.db.profile.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    const btn = U.$('#btnTheme span');
    if (btn) btn.innerHTML = U.icon(t === 'dark' ? 'sun' : 'moon', 16);
    Store.save();
  },

  /** 注入图标 */
  paintIcons() {
    U.$$('[data-icon]').forEach(el => {
      el.innerHTML = U.icon(el.dataset.icon, 16, 1.8);
    });
    U.$('#focusIco').innerHTML = U.icon('clock', 15);
    U.$('#searchIco').innerHTML = U.icon('search', 15);
    U.$('#modalClose').innerHTML = U.icon('x', 16);
  },

  /* ---- 路由 ---- */
  parse() {
    const h = (location.hash || '#/dashboard').replace('#/', '');
    const [route, param] = h.split('/');
    return { route: App.routes.includes(route) ? route : 'dashboard', param };
  },

  render(after) {
    const { route, param } = App.parse();
    const view = Views[route];
    const holder = U.$('#view');
    // 每次渲染使用全新的根节点，避免事件监听器累积
    holder.innerHTML = '';
    const root = document.createElement('div');
    holder.appendChild(root);
    U.$('#pageTitle').textContent = view.title;
    U.$('#pageIco').innerHTML = U.icon(App.icons[route] || 'grid', 18, 1.8);
    U.$('#pageSub').textContent = App.subtitle(route);
    U.$$('.nav-item[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    U.$$('.mt-item[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    view.render(root, param ? { id: param } : null);
    App.updateBadge();
    U.$('#brandSub').textContent = `${U.today().slice(5).replace('-', '/')} ${U.weekdayCN(U.today())}`;
    holder.scrollTop = 0;
    if (after) after();
  },

  subtitle(route) {
    const db = Store.db;
    const wk = U.startOfWeek(U.today());
    const plan = (db.plans || []).find(p => p.weekStart === wk);
    const subs = {
      dashboard: '一眼掌握今天该做什么',
      todos: `${db.todos.filter(t => !t.done).length} 项未完成 · ${Store.overdueTodos().length} 项逾期`,
      week: plan
        ? `本周计划完成 ${plan.goals.filter(g => g.done).length}/${plan.goals.length} 项`
        : `${wk} 起这一周还没做计划`,
      projects: `${db.projects.length} 个项目 · ${db.projects.filter(p => p.status === 'active').length} 个进行中`,
      kanban: '拖动卡片推进任务',
      calendar: '按日期查看全部安排',
      stats: '用数据复盘你的节奏',
      goals: `${db.goals.length} 个目标`,
      notes: `${db.notes.length} 条速记`,
      settings: '备份、导出与偏好'
    };
    return subs[route] || '';
  },

  updateBadge() {
    const n = Store.overdueTodos().length;
    const b = U.$('#badgeTodo');
    b.textContent = n;
    b.classList.toggle('show', n > 0);
  },

  bindNav() {
    U.$$('.nav-item[data-route], .mt-item[data-route]').forEach(a => {
      a.addEventListener('click', () => {
        location.hash = `#/${a.dataset.route}`;
        App.closeSidebar();
      });
    });
    /* 移动端：抽屉侧栏 */
    U.$('#btnMenu').addEventListener('click', () => {
      U.$('#sidebar').classList.add('open');
      U.$('#sidebarMask').classList.add('show');
    });
    const close = () => App.closeSidebar();
    U.$('#sidebarMask').addEventListener('click', close);
    U.$('#sidebarClose').addEventListener('click', close);
    U.$('#mtAccount').addEventListener('click', () => Sync.accountDialog());
  },

  closeSidebar() {
    U.$('#sidebar').classList.remove('open');
    U.$('#sidebarMask').classList.remove('show');
  },

  bindGlobal() {
    /* 主题切换 */
    U.$('#btnTheme').addEventListener('click', () => {
      App.setTheme(Store.db.profile.theme === 'dark' ? 'light' : 'dark');
    });
    /* 快速添加 */
    U.$('#btnQuickAdd').addEventListener('click', () => Views.todos.edit(null));
    /* 账户与同步 */
    U.$('#btnAccount').addEventListener('click', () => Sync.accountDialog());
    U.$('#syncBadge').addEventListener('click', () => {
      if (!Sync.user) return Sync.authDialog('login');
      Sync.push({ force: true });
    });
    /* 模态框关闭 */
    U.$('#modalClose').addEventListener('click', U.closeModal);
    U.$('#modalMask').addEventListener('click', e => { if (e.target.id === 'modalMask') U.closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') U.closeModal();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); U.$('#globalSearch').focus(); }
      if (e.key === 'n' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault(); Views.todos.edit(null);
      }
    });
    /* 全局搜索 */
    const input = U.$('#globalSearch'), res = U.$('#searchResult');
    input.addEventListener('input', () => {
      const kw = input.value.trim().toLowerCase();
      if (!kw) { res.classList.remove('show'); res.innerHTML = ''; return; }
      const hits = [];
      Store.db.todos.filter(t => (t.title + (t.note || '')).toLowerCase().includes(kw)).slice(0, 6)
        .forEach(t => hits.push({ type: '待办', title: t.title, go: () => Views.todos.edit(t) }));
      Store.db.tasks.filter(t => t.title.toLowerCase().includes(kw)).slice(0, 6)
        .forEach(t => hits.push({ type: '任务', title: t.title, go: () => Views.kanban.editTask(t, t.projectId, App.render) }));
      Store.db.projects.filter(p => (p.name + (p.desc || '')).toLowerCase().includes(kw)).slice(0, 5)
        .forEach(p => hits.push({ type: '项目', title: p.name, go: () => { location.hash = `#/projects/${p.id}`; } }));
      Store.db.notes.filter(n => (n.title + n.content).toLowerCase().includes(kw)).slice(0, 5)
        .forEach(n => hits.push({ type: '笔记', title: n.title, go: () => { Views.notes.state.cur = n.id; location.hash = '#/notes'; } }));
      Store.db.goals.filter(g => g.title.toLowerCase().includes(kw)).slice(0, 4)
        .forEach(g => hits.push({ type: '目标', title: g.title, go: () => { location.hash = '#/goals'; } }));
      (Store.db.plans || []).filter(p => (p.weekStart + ' ' + (p.goals || []).map(x => x.text).join(' ') + ' ' + ((p.review || {}).done || '')).toLowerCase().includes(kw)).slice(0, 4)
        .forEach(p => hits.push({ type: '周计划', title: `${p.weekStart} 周计划`, go: () => { Views.week.state.weekStart = p.weekStart; location.hash = '#/week'; } }));

      res.innerHTML = hits.length ? hits.map((h, i) =>
        `<div class="sr-item" data-i="${i}"><span class="sr-type">${h.type}</span><span class="sr-title">${U.esc(h.title)}</span></div>`).join('')
        : `<div class="sr-item" style="color:var(--text-faint)">没有找到相关内容</div>`;
      res.classList.add('show');
      U.$$('.sr-item', res).forEach((el, i) => {
        el.addEventListener('click', () => {
          const h = hits[i];
          if (!h) return;
          res.classList.remove('show'); input.value = '';
          h.go();
        });
      });
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-box')) res.classList.remove('show');
    });
    /* 专注计时器 */
    U.$('#focusMini').addEventListener('click', () => {
      if (App.focus.timer) {
        clearInterval(App.focus.timer); App.focus.timer = null;
        U.$('#focusMini').classList.remove('running');
        U.$('#focusTime').textContent = '25:00';
        U.$('#focusLabel').textContent = '已取消，点击重来';
        U.$('#focusIco').innerHTML = U.icon('clock', 15);
        App.focusArc(1);
        document.title = '个人工作台';
        return;
      }
      App.startFocus('', '专注');
    });
  },

  /** 专注进度环：ratio = 剩余比例 */
  focusArc(ratio) {
    const arc = U.$('#focusArc');
    if (arc) arc.setAttribute('stroke-dashoffset', String(97.4 * (1 - Math.max(0, Math.min(1, ratio)))));
  },

  startFocus(refId, title) {
    if (App.focus.timer) { U.toast('已有专注进行中'); return; }
    App.focus.left = 25 * 60;
    App.focus.refId = refId || '';
    App.focus.title = title || '专注';
    U.$('#focusMini').classList.add('running');
    U.$('#focusLabel').textContent = title.length > 8 ? title.slice(0, 8) + '…' : title;
    U.$('#focusIco').innerHTML = U.icon('x', 13);
    const tick = () => {
      App.focus.left--;
      const m = Math.floor(App.focus.left / 60), s = App.focus.left % 60;
      U.$('#focusTime').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      document.title = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} · 专注中`;
      App.focusArc(App.focus.left / (25 * 60));
      if (App.focus.left <= 0) {
        clearInterval(App.focus.timer); App.focus.timer = null;
        Store.add('logs', { date: U.today(), minutes: 25, refType: App.focus.refId ? 'todo' : 'focus', refId: App.focus.refId, title: App.focus.title });
        document.title = '个人工作台';
        U.$('#focusMini').classList.remove('running');
        U.$('#focusTime').textContent = '25:00';
        U.$('#focusLabel').textContent = '专注完成';
        U.$('#focusIco').innerHTML = U.icon('clock', 15);
        App.focusArc(0);
        U.toast('🎉 专注 25 分钟完成，已记录');
        App.render();
      }
    };
    App.focus.timer = setInterval(tick, 1000);
    tick();
  },

  /* ---- 导出 ---- */
  csv(rows) {
    const esc = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n');
  },

  exportCSV(kind, filter) {
    let rows = [], name = '';
    const projName = id => { const p = Store.get('projects', id); return p ? p.name : ''; };
    if (kind === 'todos') {
      name = `待办-${U.today()}.csv`;
      rows = [['标题', '优先级', '截止日期', '所属项目', '标签', '状态', '完成日期', '备注']];
      Store.db.todos.forEach(t => rows.push([t.title, (P_MAP[t.priority] || {}).label || '', t.due || '', projName(t.projectId), (t.tags || []).join('/'), t.done ? '已完成' : '未完成', t.completedAt || '', (t.note || '').replace(/\n/g, ' ')]));
    } else if (kind === 'tasks') {
      name = `任务-${U.today()}.csv`;
      rows = [['任务', '所属项目', '状态', '优先级', '截止日期', '负责人', '描述']];
      Store.db.tasks.filter(t => !filter || t.projectId === filter).forEach(t =>
        rows.push([t.title, projName(t.projectId), (TASK_COLS.find(c => c.value === t.status) || {}).label || '', (P_MAP[t.priority] || {}).label || '', t.due || '', t.owner || '', (t.desc || '').replace(/\n/g, ' ')]));
    } else if (kind === 'projects') {
      name = `项目-${U.today()}.csv`;
      rows = [['项目', '状态', '进度', '开始', '截止', '任务总数', '已完成', '描述']];
      Store.db.projects.forEach(p => {
        const pg = Store.projectProgress(p.id);
        rows.push([p.name, (PS_MAP[p.status] || {}).label || '', pg.pct + '%', p.start || '', p.due || '', pg.total, pg.done, (p.desc || '').replace(/\n/g, ' ')]);
      });
    } else if (kind === 'month') {
      const mk = filter;
      name = `月度完成-${mk}.csv`;
      rows = [['日期', '类型', '标题', '项目']];
      Store.db.todos.filter(t => t.done && (t.completedAt || '').slice(0, 7) === mk)
        .forEach(t => rows.push([t.completedAt, '待办', t.title, projName(t.projectId)]));
      Store.db.tasks.filter(t => t.status === 'done' && t.completedAt && U.fmt(new Date(t.completedAt)).slice(0, 7) === mk)
        .forEach(t => rows.push([U.fmt(new Date(t.completedAt)), '任务', t.title, projName(t.projectId)]));
    }
    if (rows.length <= 1) return U.toast('没有可导出的数据');
    U.download(name, App.csv(rows), 'text/csv');
    U.toast('已导出 ' + name);
  },

  /** 周计划复盘导出 */
  exportWeekReview(plan) {
    const db = Store.db;
    const ws = plan.weekStart, we = U.endOfWeek(ws);
    const inRange = d => d && d >= ws && d <= we;
    const doneTodos = db.todos.filter(t => t.done && inRange(t.completedAt));
    const doneTasks = db.tasks.filter(t => t.status === 'done' && t.completedAt && inRange(U.fmt(new Date(t.completedAt))));
    const focusMin = db.logs.filter(l => inRange(l.date)).reduce((a, b) => a + b.minutes, 0);
    const goals = plan.goals || [];
    const doneN = goals.filter(g => g.done).length;
    const rv = plan.review || {};
    const projName = id => { const p = Store.get('projects', id); return p ? p.name : '—'; };

    let md = `# 周计划复盘 · ${ws} ~ ${we}\n\n`;
    md += `## 一、本周目标（${doneN}/${goals.length}）\n\n`;
    goals.forEach(g => md += `- [${g.done ? 'x' : ' '}] ${g.text}\n`);
    md += `\n## 二、完成事项\n\n### 待办\n\n`;
    doneTodos.forEach(t => md += `- ${t.title}\n`);
    md += `\n### 项目任务\n\n`;
    doneTasks.forEach(t => md += `- ${t.title}（${projName(t.projectId)}）\n`);
    md += `\n## 三、复盘\n\n`;
    md += `**做成了什么**\n\n${rv.done || '（未填写）'}\n\n`;
    md += `**可以做得更好**\n\n${rv.improve || '（未填写）'}\n\n`;
    md += `**下周重点**\n\n${rv.next || '（未填写）'}\n\n`;
    md += `**本周自评**：${rv.score || 0}/10\n\n`;
    md += `**专注时长**：${(focusMin / 60).toFixed(1)} 小时\n`;

    U.download(`周复盘-${ws}.md`, md, 'text/markdown');
    U.toast('周复盘已导出');
  },

  exportReport(period) {
    const db = Store.db;
    let start, end, title;
    if (period === 'week') {
      start = U.startOfWeek(U.today()); end = U.endOfWeek(U.today());
      title = `周报 ${start} ~ ${end}`;
    } else {
      const mk = period;
      const [y, m] = mk.split('-').map(Number);
      start = `${mk}-01`; end = `${mk}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      title = `月报 ${mk}`;
    }
    const inRange = d => d && d >= start && d <= end;
    const todoDone = db.todos.filter(t => t.done && inRange(t.completedAt));
    const taskDone = db.tasks.filter(t => t.status === 'done' && t.completedAt && inRange(U.fmt(new Date(t.completedAt))));
    const todoNew = db.todos.filter(t => inRange((t.createdAt || '').slice(0, 10)));
    const focusMin = db.logs.filter(l => inRange(l.date)).reduce((a, b) => a + b.minutes, 0);
    const projName = id => { const p = Store.get('projects', id); return p ? p.name : '—'; };

    let md = `# ${title}\n\n生成时间：${U.today()} ${U.nowTime()}\n\n`;
    md += `## 一、总体数据\n\n`;
    md += `| 指标 | 数值 |\n| --- | --- |\n`;
    md += `| 完成待办 | ${todoDone.length} 项 |\n`;
    md += `| 完成任务 | ${taskDone.length} 项 |\n`;
    md += `| 新增待办 | ${todoNew.length} 项 |\n`;
    md += `| 专注时长 | ${(focusMin / 60).toFixed(1)} 小时 |\n\n`;

    md += `## 二、完成清单\n\n`;
    if (taskDone.length) {
      md += `### 项目任务\n\n`;
      const byProj = {};
      taskDone.forEach(t => { (byProj[t.projectId] = byProj[t.projectId] || []).push(t); });
      Object.entries(byProj).forEach(([pid, list]) => {
        md += `**${projName(pid)}**\n\n`;
        list.forEach(t => md += `- ${t.title}\n`);
        md += `\n`;
      });
    }
    if (todoDone.length) {
      md += `### 其他待办\n\n`;
      todoDone.forEach(t => md += `- ${t.title}${t.completedAt ? `（${t.completedAt}）` : ''}\n`);
      md += `\n`;
    }

    md += `## 三、项目进展\n\n`;
    md += `| 项目 | 状态 | 进度 | 已完成/总数 | 截止 |\n| --- | --- | --- | --- | --- |\n`;
    db.projects.filter(p => p.status !== 'done').forEach(p => {
      const pg = Store.projectProgress(p.id);
      md += `| ${p.name} | ${(PS_MAP[p.status] || {}).label || ''} | ${pg.pct}% | ${pg.done}/${pg.total || 0} | ${p.due || '—'} |\n`;
    });
    md += `\n`;

    md += `## 四、目标进展\n\n`;
    db.goals.forEach(g => {
      const pct = g.target ? Math.round(g.current / g.target * 100) : 0;
      md += `- **${g.title}**：${g.current}/${g.target} ${g.unit || ''}（${pct}%）\n`;
    });
    md += `\n`;

    const pending = db.todos.filter(t => !t.done).sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1).slice(0, 10);
    if (pending.length) {
      md += `## 五、下阶段待办 TOP10\n\n`;
      pending.forEach(t => md += `- [ ] ${t.title}${t.due ? `（${t.due}）` : ''} — ${projName(t.projectId)}\n`);
    }

    U.download(`${title.replace(/[~ ]/g, '')}.md`, md, 'text/markdown');
    U.toast('报告已导出');
  }
};

document.addEventListener('DOMContentLoaded', App.init);
