/* ===== 项目管理 ===== */
Views.projects = {
  title: '项目',
  state: { filter: 'active' },

  render(root, params) {
    if (params && params.id) return Views.projects.detail(root, params.id);
    Views.projects.list(root);
  },

  list(root) {
    const st = Views.projects.state;
    let list = Store.db.projects.slice();
    if (st.filter !== 'all') list = list.filter(p => p.status === st.filter);

    root.innerHTML = `
      <div class="tabs">
        ${[['active', '进行中'], ['planning', '规划中'], ['paused', '已暂停'], ['done', '已完成'], ['all', '全部']]
          .map(([k, l]) => `<div class="tab ${st.filter === k ? 'active' : ''}" data-f="${k}">${l}</div>`).join('')}
        <div style="margin-left:auto"></div>
        <button class="btn btn-primary" id="pAdd">${U.icon('plus', 14)}新建项目</button>
      </div>
      <div id="pList"></div>
    `;

    const wrap = U.$('#pList', root);
    wrap.innerHTML = list.length ? `<div class="grid grid-3">${list.map(p => {
      const pg = Store.projectProgress(p.id);
      const ps = PS_MAP[p.status] || PS_MAP.active;
      const T = U.today();
      const late = p.due && p.due < T && p.status !== 'done';
      const tasks = Store.db.tasks.filter(t => t.projectId === p.id);
      return `<div class="proj-card" data-id="${p.id}">
        <div class="proj-top">
          <div>
            <div class="proj-name"><i class="dot" style="background:${p.color}"></i> ${U.esc(p.name)}</div>
            <div class="proj-desc">${U.esc(p.desc || '暂无描述')}</div>
          </div>
          <span class="badge ${ps.cls}">${ps.label}</span>
        </div>
        <div class="progress"><div style="width:${pg.pct}%;background:${p.color}"></div></div>
        <div class="proj-meta">
          <span>${pg.pct}% · ${pg.done}/${pg.total || 0} 任务</span>
          <span style="color:${late ? 'var(--danger)' : 'inherit'}">${p.due ? (late ? '⚠ 逾期 ' : '截止 ') + p.due.slice(5) : '无截止'}</span>
        </div>
      </div>`;
    }).join('')}</div>` : `<div class="empty"><div class="empty-ico">${U.icon('folder', 21)}</div>还没有项目，新建一个吧</div>`;

    U.$('.tabs', root).addEventListener('click', e => {
      const tab = e.target.closest('.tab');
      if (tab) { st.filter = tab.dataset.f; App.render(); }
    });
    U.$('#pAdd', root).addEventListener('click', () => Views.projects.edit(null));
    wrap.addEventListener('click', e => {
      const c = e.target.closest('.proj-card');
      if (c) location.hash = `#/projects/${c.dataset.id}`;
    });
  },

  detail(root, id) {
    const p = Store.get('projects', id);
    if (!p) { root.innerHTML = '<div class="empty">项目不存在</div>'; return; }
    const pg = Store.projectProgress(id);
    const ps = PS_MAP[p.status] || PS_MAP.active;
    const tasks = Store.db.tasks.filter(t => t.projectId === id);
    const todos = Store.db.todos.filter(t => t.projectId === id && !t.done);
    const T = U.today();
    const done = tasks.filter(t => t.status === 'done');
    const late = tasks.filter(t => t.status !== 'done' && t.due && t.due < T);
    const logs = Store.db.logs.filter(l => l.refType === 'project' && l.refId === id);
    const minutes = logs.reduce((a, b) => a + b.minutes, 0);

    root.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
        <a class="btn btn-sm" href="#/projects">${U.icon('arrowLeft', 14)}返回</a>
        <button class="btn btn-sm" id="pdEdit">${U.icon('edit', 13)}编辑项目</button>
        <button class="btn btn-sm" id="pdBoard">${U.icon('columns', 13)}打开看板</button>
        <button class="btn btn-sm" id="pdExport">${U.icon('download', 13)}导出 CSV</button>
        <div style="margin-left:auto"></div>
        <button class="btn btn-sm btn-danger" id="pdDel">${U.icon('trash', 13)}删除</button>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="flex:1">
            <div style="font-size:18px;font-weight:600"><i class="dot" style="background:${p.color}"></i> ${U.esc(p.name)}</div>
            <div style="color:var(--text-dim);font-size:13px;margin-top:4px">${U.esc(p.desc || '暂无描述')}</div>
          </div>
          <span class="badge ${ps.cls}">${ps.label}</span>
        </div>
        <div class="grid grid-4" style="margin-top:16px">
          <div><div class="kpi-label">整体进度</div><div style="font-size:22px;font-weight:600">${pg.pct}%</div>
            <div class="progress" style="margin-top:6px"><div style="width:${pg.pct}%;background:${p.color}"></div></div></div>
          <div><div class="kpi-label">任务</div><div style="font-size:22px;font-weight:600">${done.length}/${tasks.length}</div></div>
          <div><div class="kpi-label">逾期任务</div><div style="font-size:22px;font-weight:600;color:${late.length ? 'var(--danger)' : 'inherit'}">${late.length}</div></div>
          <div><div class="kpi-label">累计投入</div><div style="font-size:22px;font-weight:600">${(minutes / 60).toFixed(1)}h</div></div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--text-dim)">
          周期：${p.start || '—'} → ${p.due || '—'}
          ${p.due ? ` · ${U.diffDays(p.due, T) >= 0 ? '还剩 ' + U.diffDays(p.due, T) + ' 天' : '已超期 ' + (-U.diffDays(p.due, T)) + ' 天'}` : ''}
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div class="card-title">项目任务</div>
            <button class="btn btn-sm btn-primary" id="pdTaskAdd">${U.icon('plus', 13)}任务</button></div>
          <div id="pdTasks"></div>
        </div>
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-head"><div class="card-title">状态分布</div></div>
            <div id="pdChart"></div>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">关联待办</div>
              <button class="btn btn-sm" id="pdTodoAdd">${U.icon('plus', 13)}待办</button></div>
            <div id="pdTodos"></div>
          </div>
        </div>
      </div>
    `;

    const renderTasks = () => {
      const ts = Store.db.tasks.filter(t => t.projectId === id);
      const order = { doing: 0, review: 1, todo: 2, done: 3 };
      ts.sort((a, b) => (order[a.status] - order[b.status]) || ((a.due || '9') < (b.due || '9') ? -1 : 1));
      U.$('#pdTasks', root).innerHTML = ts.length ? ts.map(t => {
        const col = TASK_COLS.find(c => c.value === t.status) || TASK_COLS[0];
        const pri = P_MAP[t.priority] || P_MAP.p3;
        const isLate = t.status !== 'done' && t.due && t.due < T;
        return `<div class="list-item ${t.status === 'done' ? 'done' : ''}" data-tid="${t.id}">
          <div class="checkbox ${t.status === 'done' ? 'checked' : ''}" data-act="tstatus">${t.status === 'done' ? U.icon('check', 12, 3) : ''}</div>
          <div class="li-main">
            <div class="li-title">${U.esc(t.title)}</div>
            <div class="li-meta">
              <span class="badge" style="background:${col.color}16;color:${col.color}">${col.label}</span>
              <span class="badge ${pri.cls}">${pri.label.split(' ')[0]}</span>
              ${t.due ? `<span style="color:${isLate ? 'var(--danger)' : 'var(--text-dim)'}">${U.prettyDate(t.due)}</span>` : ''}
            </div>
          </div>
          <div class="li-actions">
            <button class="btn btn-sm" data-act="tedit">${U.icon('edit', 13)}</button>
            <button class="btn btn-sm btn-danger" data-act="tdel">${U.icon('trash', 13)}</button>
          </div>
        </div>`;
      }).join('') : `<div class="empty" style="padding:24px"><div class="empty-ico">${U.icon('inbox', 21)}</div>还没有任务</div>`;
    };

    const renderTodos = () => {
      const td = Store.db.todos.filter(t => t.projectId === id && !t.done);
      U.$('#pdTodos', root).innerHTML = td.length ? td.map(t => Views.todos.itemHTML(t)).join('')
        : `<div class="empty" style="padding:24px"><div class="empty-ico">${U.icon('check', 21)}</div>暂无待办</div>`;
    };
    renderTasks();
    renderTodos();

    const dist = TASK_COLS.map(c => ({ label: c.label, value: tasks.filter(t => t.status === c.value).length, color: c.color }))
      .filter(x => x.value > 0);
    U.$('#pdChart', root).innerHTML = Charts.donut(dist.length ? dist : [{ label: '暂无', value: 1, color: 'var(--border)' }]);

    /* 事件 */
    U.$('#pdEdit', root).addEventListener('click', () => Views.projects.edit(p));
    U.$('#pdBoard', root).addEventListener('click', () => { location.hash = '#/kanban'; setTimeout(() => { Views.kanban.state.proj = id; App.render(); }, 0); });
    U.$('#pdDel', root).addEventListener('click', () => {
      U.confirm(`删除项目「${p.name}」？其下任务会一并移除。`, () => {
        Store.remove('projects', id);
        Store.db.tasks = Store.db.tasks.filter(t => t.projectId !== id);
        Store.save(); U.toast('已删除'); location.hash = '#/projects';
      });
    });
    U.$('#pdExport', root).addEventListener('click', () => App.exportCSV('tasks', id));
    U.$('#pdTaskAdd', root).addEventListener('click', () => {
      Views.kanban.editTask(null, id, renderTasks);
    });
    U.$('#pdTodoAdd', root).addEventListener('click', () => Views.todos.edit({ title: '', priority: 'p3', due: p.due || '', projectId: id, tags: [], note: '' }));

    U.$('#pdTasks', root).addEventListener('click', e => {
      const item = e.target.closest('.list-item');
      if (!item) return;
      const t = Store.get('tasks', item.dataset.tid);
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'tstatus') {
        Store.update('tasks', t.id, { status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : new Date().toISOString() });
        App.render();
      } else if (act.dataset.act === 'tedit') Views.kanban.editTask(t, id, App.render);
      else if (act.dataset.act === 'tdel') {
        U.confirm(`删除任务「${t.title}」？`, () => { Store.remove('tasks', t.id); App.render(); });
      }
    });
    U.$('#pdTodos', root).addEventListener('click', e => {
      const item = e.target.closest('.list-item');
      if (!item) return;
      const t = Store.get('todos', item.dataset.id);
      if (!t) return;
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'toggle') {
        Store.update('todos', t.id, { done: !t.done, completedAt: t.done ? null : U.today() });
        App.render();
      } else if (act && act.dataset.act === 'del') {
        U.confirm(`删除「${t.title}」？`, () => { Store.remove('todos', t.id); App.render(); });
      } else Views.todos.edit(t);
    });
  },

  edit(proj) {
    const isNew = !proj;
    const p = proj || { name: '', desc: '', color: COLORS[0], status: 'active', start: U.today(), due: '', manual: 0 };
    const body = U.el('div', {}, [
      U.field('项目名称', U.input(p.name, { id: 'fName', placeholder: '项目名称' })),
      U.field('项目描述', U.textarea(p.desc || '', { id: 'fDesc', style: { minHeight: '60px' }, placeholder: '一句话说清目标' })),
      U.el('div.form-row', {}, [
        U.field('状态', U.select(PROJ_STATUS, p.status, { id: 'fStatus' })),
        U.field('开始日期', U.input(p.start || '', { id: 'fStart', type: 'date' })),
        U.field('截止日期', U.input(p.due || '', { id: 'fDue', type: 'date' }))
      ]),
      U.field('标识色', U.select(COLORS.map((c, i) => ({ value: c, label: ['蓝', '紫', '青', '橙', '红', '粉', '绿', '灰'][i] })), p.color, { id: 'fColor' })),
      U.field('手动进度 %（无任务时生效）', U.input(p.manual || 0, { id: 'fManual', type: 'number', min: '0', max: '100' }))
    ]);
    U.modal({
      title: isNew ? '新建项目' : '编辑项目',
      body,
      onOk: b => {
        const name = U.$('#fName', b).value.trim();
        if (!name) { U.toast('请填写项目名称'); return false; }
        const data = {
          name,
          desc: U.$('#fDesc', b).value,
          status: U.$('#fStatus', b).value,
          start: U.$('#fStart', b).value,
          due: U.$('#fDue', b).value,
          color: U.$('#fColor', b).value,
          manual: Number(U.$('#fManual', b).value) || 0
        };
        if (isNew) { const np = Store.add('projects', data); U.toast('已创建'); location.hash = `#/projects/${np.id}`; }
        else { Store.update('projects', p.id, data); U.toast('已保存'); }
        App.render();
      }
    });
  }
};
