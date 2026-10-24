/* ===== 数据层（localStorage） ===== */
const KEY = 'personal-workspace-v1';

const Store = {
  db: null,

  blank() {
    return {
      v: 1,
      profile: { name: '我', theme: 'light' },
      todos: [],
      projects: [],
      tasks: [],
      goals: [],
      notes: [],
      plans: [],        // 周计划与复盘 {id, weekStart, goals[], notes, review{}, updatedAt}
      logs: []          // 专注/工时记录 {id, date, minutes, refType, refId, title}
    };
  },

  /**
   * 启动时只准备空白数据；真实数据在口令解锁后由 hydrate() 注入。
   * 这样未解锁时内存中不保留任何业务数据。
   */
  load() {
    Store.db = Store.blank();
    return Store.db;
  },

  /** 解密后注入数据（补齐缺失字段） */
  hydrate(db) {
    Store.db = Object.assign(Store.blank(), db || {});
    ['todos', 'projects', 'tasks', 'goals', 'notes', 'logs', 'plans'].forEach(k => {
      if (!Array.isArray(Store.db[k])) Store.db[k] = [];
    });
    if (!Store.db.profile) Store.db.profile = { name: '我', theme: 'light' };
    return Store.db;
  },

  save() {
    // 已解锁且启用加密 → 加密写回；否则明文（降级模式）
    if (typeof Vault !== 'undefined' && Vault && Vault.unlocked && !Vault.plainMode) {
      Vault.scheduleSave();
      return;
    }
    try { localStorage.setItem(KEY, JSON.stringify(Store.db)); }
    catch (e) { U.toast('保存失败：浏览器存储空间不足'); }
  },

  reset() { Store.db = Store.blank(); Store.save(); },

  replace(data) { Store.db = data; Store.save(); },

  /* ---- CRUD ---- */
  add(col, obj) {
    const item = Object.assign({ id: U.uid(), createdAt: new Date().toISOString() }, obj);
    Store.db[col].unshift(item);
    Store.save();
    return item;
  },
  get(col, id) { return Store.db[col].find(x => x.id === id); },
  update(col, id, patch) {
    const i = Store.db[col].findIndex(x => x.id === id);
    if (i >= 0) { Store.db[col][i] = Object.assign({}, Store.db[col][i], patch); Store.save(); }
    return Store.db[col][i];
  },
  remove(col, id) {
    Store.db[col] = Store.db[col].filter(x => x.id !== id);
    Store.save();
  },

  /* ---- 派生计算 ---- */
  /** 项目进度：有任务按任务算，否则用手填进度 */
  projectProgress(pid) {
    const tasks = Store.db.tasks.filter(t => t.projectId === pid);
    const p = Store.get('projects', pid);
    if (!tasks.length) return { pct: p && p.manual != null ? p.manual : 0, done: 0, total: 0 };
    const done = tasks.filter(t => t.status === 'done').length;
    return { pct: Math.round(done / tasks.length * 100), done, total: tasks.length };
  },

  overdueTodos() {
    const t = U.today();
    return Store.db.todos.filter(x => !x.done && x.due && x.due < t);
  },
  todayTodos() {
    const t = U.today();
    return Store.db.todos.filter(x => !x.done && x.due && x.due <= t);
  },

  /** 示例数据：让新用户一进来就有东西看 */
  seed() {
    const db = Store.blank();
    const T = U.today();
    const d = n => U.addDays(T, n);

    const p1 = { id: U.uid(), name: '官网 2.0 改版', desc: '重构官网信息架构与视觉，Q4 上线', color: '#3b6ef5', status: 'active', start: d(-20), due: d(25), manual: 0, createdAt: new Date().toISOString() };
    const p2 = { id: U.uid(), name: '客户 CRM 系统', desc: '销售线索到回款全流程管理', color: '#7c5cf0', status: 'active', start: d(-40), due: d(50), manual: 0, createdAt: new Date().toISOString() };
    const p3 = { id: U.uid(), name: '团队季度复盘', desc: '整理 Q4 数据与改进项', color: '#0ea5a4', status: 'planning', start: d(0), due: d(14), manual: 0, createdAt: new Date().toISOString() };
    db.projects = [p1, p2, p3];

    const mk = (pid, title, status, due, priority) => ({
      id: U.uid(), projectId: pid, title, status, due, priority: priority || 'p3',
      desc: '', order: Math.random(), createdAt: new Date().toISOString(),
      completedAt: status === 'done' ? new Date().toISOString() : null
    });
    db.tasks = [
      mk(p1.id, '竞品调研与信息架构梳理', 'done', d(-10), 'p2'),
      mk(p1.id, '首页视觉稿设计', 'done', d(-5), 'p1'),
      mk(p1.id, '前端页面开发（首页/案例）', 'doing', d(6), 'p1'),
      mk(p1.id, '内容填充与 SEO 配置', 'todo', d(15), 'p3'),
      mk(p2.id, '需求梳理与字段定义', 'done', d(-25), 'p2'),
      mk(p2.id, '线索录入模块', 'doing', d(8), 'p1'),
      mk(p2.id, '回款与报表模块', 'todo', d(30), 'p2'),
      mk(p2.id, '权限与角色配置', 'review', d(3), 'p3'),
      mk(p3.id, '收集各组数据', 'todo', d(5), 'p2'),
      mk(p3.id, '撰写复盘报告', 'todo', d(12), 'p3')
    ];

    const td = (title, due, priority, pid, tags, done, doneOffset) => ({
      id: U.uid(), title, note: '', done: !!done, priority, due, projectId: pid || '',
      tags: tags || [], createdAt: new Date().toISOString(),
      completedAt: done ? U.addDays(T, doneOffset || 0) : null
    });
    db.todos = [
      td('评审首页视觉稿并给反馈', d(0), 'p1', p1.id, ['设计'], false),
      td('确认 CRM 权限方案', d(1), 'p2', p2.id, ['沟通'], false),
      td('整理本周进度同步发给团队', d(0), 'p2', '', ['协作'], false),
      td('预约下季度预算评审会', d(-2), 'p1', '', ['行政'], false),
      td('完成竞品调研报告', d(-3), 'p2', p1.id, ['调研'], true, -3),
      td('更新简历（可选）', d(4), 'p4', '', ['个人'], false),
      td('输出 CRM 字段字典', d(2), 'p3', p2.id, ['文档'], false),
      td('周会材料准备', d(-1), 'p2', '', ['协作'], true, -1),
      td('整理客户反馈清单', d(-6), 'p3', p2.id, ['客户'], true, -6),
      td('官网域名续费', d(-8), 'p2', p1.id, ['行政'], true, -8)
    ];

    db.goals = [
      { id: U.uid(), title: 'Q4 完成官网改版上线', period: '2026-Q4', metric: '上线页面数', target: 12, current: 7, unit: '页', status: 'active', projectIds: [p1.id], note: '', createdAt: new Date().toISOString() },
      { id: U.uid(), title: 'CRM 覆盖 80% 销售流程', period: '2026-Q4', metric: '流程覆盖率', target: 80, current: 45, unit: '%', status: 'active', projectIds: [p2.id], note: '', createdAt: new Date().toISOString() },
      { id: U.uid(), title: '每周专注时长 ≥ 10 小时', period: '2026-Q4', metric: '专注时长', target: 120, current: 36, unit: '小时', status: 'active', projectIds: [], note: '', createdAt: new Date().toISOString() }
    ];

    for (let i = 0; i < 30; i++) {
      const day = U.addDays(T, -i);
      const n = Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        db.logs.push({ id: U.uid(), date: day, minutes: 25, refType: 'focus', refId: '', title: '专注', createdAt: new Date().toISOString() });
      }
    }

    db.notes = [
      { id: U.uid(), title: '首页改版要点', content: '1. 首屏价值主张要一句话说清\n2. 案例区按行业分组\n3. 增加客户证言模块\n4. 移动端优先', tags: ['设计'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: U.uid(), title: 'CRM 字段字典（草稿）', content: '线索：来源、渠道、意向度、负责人、跟进阶段\n客户：行业、规模、决策人、合同额\n回款：账期、开票状态、回款比例', tags: ['文档'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];

    return db;
  }
};
