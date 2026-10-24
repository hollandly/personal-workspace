/* ===== 待办工作台 ===== */
Views.todos = {
  title: '待办',
  state: { view: 'open', proj: '', pri: '', q: 'list', kw: '' },

  render(root) {
    const st = Views.todos.state;
    const T = U.today();
    const wkStart = U.startOfWeek(T), wkEnd = U.endOfWeek(T);

    let list = Store.db.todos.slice();
    const v = st.view;
    if (v === 'open') list = list.filter(t => !t.done);
    else if (v === 'today') list = list.filter(t => !t.done && t.due && t.due <= T);
    else if (v === 'week') list = list.filter(t => !t.done && t.due && t.due >= wkStart && t.due <= wkEnd);
    else if (v === 'overdue') list = list.filter(t => !t.done && t.due && t.due < T);
    else if (v === 'done') list = list.filter(t => t.done);
    else if (v === 'nodate') list = list.filter(t => !t.done && !t.due);
    if (st.proj) list = list.filter(t => t.projectId === st.proj);
    if (st.pri) list = list.filter(t => t.priority === st.pri);
    if (st.kw) list = list.filter(t => (t.title + ' ' + (t.note || '') + ' ' + (t.tags || []).join(' ')).toLowerCase().includes(st.kw.toLowerCase()));

    const order = { p1: 0, p2: 1, p3: 2, p4: 3 };
    const sortFn = (a, b) => {
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return order[a.priority] - order[b.priority];
    };
    list.sort((a, b) => (v === 'done' ? (a.completedAt < b.completedAt ? 1 : -1) : sortFn(a, b)));

    const allTags = [...new Set(Store.db.todos.flatMap(t => t.tags || []))];

    root.innerHTML = `
      <div class="tabs">
        ${[['open', '未完成'], ['today', '今天'], ['week', '本周'], ['overdue', '逾期'], ['nodate', '无日期'], ['done', '已完成']]
          .map(([k, l]) => `<div class="tab ${st.view === k ? 'active' : ''}" data-view="${k}">${l}</div>`).join('')}
        <div style="margin-left:auto"></div>
        <div class="tab ${st.q === 'list' ? 'active' : ''}" data-q="list">列表</div>
        <div class="tab ${st.q === 'matrix' ? 'active' : ''}" data-q="matrix">四象限</div>
      </div>

      <div class="filters">
        <input id="tdKw" placeholder="搜索待办…" value="${U.esc(st.kw)}" style="width:180px">
        <select id="tdProj">
          <option value="">全部项目</option>
          ${Store.db.projects.map(p => `<option value="${p.id}" ${st.proj === p.id ? 'selected' : ''}>${U.esc(p.name)}</option>`).join('')}
        </select>
        <select id="tdPri">
          <option value="">全部优先级</option>
          ${PRIORITY.map(p => `<option value="${p.value}" ${st.pri === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
        ${allTags.length ? `<select id="tdTag"><option value="">全部标签</option>${allTags.map(t => `<option value="${U.esc(t)}">#${U.esc(t)}</option>`).join('')}</select>` : ''}
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn" id="tdClear">${U.icon('trash', 14)}清理已完成</button>
          <button class="btn btn-primary" id="tdAdd">${U.icon('plus', 14)}新建待办</button>
        </div>
      </div>

      <div id="tdBody"></div>
    `;

    const body = U.$('#tdBody', root);
    if (st.q === 'matrix') {
      body.innerHTML = Views.todos.matrixHTML(list);
    } else {
      body.innerHTML = list.length
        ? `<div class="card" style="padding:10px">${list.map(t => Views.todos.itemHTML(t)).join('')}</div>`
        : `<div class="empty"><div class="empty-ico">${U.icon('check', 21)}</div>这里空空的，添加一项待办吧</div>`;
    }

    /* 事件 */
    U.$('.tabs', root).addEventListener('click', e => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      if (tab.dataset.view) st.view = tab.dataset.view;
      if (tab.dataset.q) st.q = tab.dataset.q;
      App.render();
    });

    U.$('#tdKw', root).addEventListener('input', U.debounce(e => { st.kw = e.target.value; App.render(() => { const i = U.$('#tdKw'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300));
    U.$('#tdProj', root).addEventListener('change', e => { st.proj = e.target.value; App.render(); });
    U.$('#tdPri', root).addEventListener('change', e => { st.pri = e.target.value; App.render(); });
    const tagSel = U.$('#tdTag', root);
    if (tagSel) tagSel.addEventListener('change', e => { st.kw = e.target.value; App.render(); });
    U.$('#tdAdd', root).addEventListener('click', () => Views.todos.edit(null));
    U.$('#tdClear', root).addEventListener('click', () => {
      const n = Store.db.todos.filter(t => t.done).length;
      if (!n) return U.toast('没有已完成的待办');
      U.confirm(`将删除 ${n} 条已完成待办，删除后不可恢复。`, () => {
        Store.db.todos = Store.db.todos.filter(t => !t.done);
        Store.save(); U.toast('已清理'); App.render();
      });
    });

    body.addEventListener('click', e => {
      const item = e.target.closest('.list-item');
      if (!item) return;
      const t = Store.get('todos', item.dataset.id);
      if (!t) return;
      const act = e.target.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        if (a === 'toggle') {
          Store.update('todos', t.id, { done: !t.done, completedAt: t.done ? null : U.today() });
          if (!t.done) U.toast('🎉 完成一项');
          App.render();
        } else if (a === 'edit') Views.todos.edit(t);
        else if (a === 'del') {
          U.confirm(`删除「${t.title}」？`, () => { Store.remove('todos', t.id); U.toast('已删除'); App.render(); });
        } else if (a === 'focus') App.startFocus(t.id, t.title);
        return;
      }
      Views.todos.edit(t);
    });
  },

  itemHTML(t) {
    const p = P_MAP[t.priority] || P_MAP.p3;
    const proj = t.projectId ? Store.get('projects', t.projectId) : null;
    const T = U.today();
    const isOver = t.due && t.due < T && !t.done;
    return `<div class="list-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="checkbox ${t.done ? 'checked' : ''}" data-act="toggle">${t.done ? U.icon('check', 12, 3) : ''}</div>
      <div class="li-main">
        <div class="li-title">${U.esc(t.title)}</div>
        <div class="li-meta">
          <span class="badge ${p.cls}">${p.label.split(' ')[0]}</span>
          ${proj ? `<span style="display:flex;align-items:center;gap:5px"><i class="dot" style="background:${proj.color}"></i>${U.esc(proj.name)}</span>` : ''}
          ${t.due ? `<span style="color:${isOver ? 'var(--danger)' : 'var(--text-dim)'}">${isOver ? '⚠ ' : ''}${U.prettyDate(t.due)}</span>` : ''}
          ${(t.tags || []).map(x => `<span>#${U.esc(x)}</span>`).join('')}
          ${t.done && t.completedAt ? `<span>✓ ${U.prettyDate(t.completedAt)}</span>` : ''}
        </div>
      </div>
      <div class="li-actions">
        ${t.done ? '' : `<button class="btn btn-sm" data-act="focus" title="专注 25 分钟">${U.icon('play', 12)}</button>`}
        <button class="btn btn-sm" data-act="edit">${U.icon('edit', 13)}</button>
        <button class="btn btn-sm btn-danger" data-act="del">${U.icon('trash', 13)}</button>
      </div>
    </div>`;
  },

  /** 四象限：按优先级 + 紧急度 */
  matrixHTML(list) {
    const T = U.today();
    const q = { q1: [], q2: [], q3: [], q4: [] };
    list.filter(t => !t.done).forEach(t => {
      const urgent = t.due && U.diffDays(t.due, T) <= 2;
      const important = t.priority === 'p1' || t.priority === 'p2';
      if (important && urgent) q.q1.push(t);
      else if (important) q.q2.push(t);
      else if (urgent) q.q3.push(t);
      else q.q4.push(t);
    });
    const box = (key, title, sub, color) => `
      <div class="card" style="border-top:2.5px solid ${color};padding:14px 12px">
        <div class="card-head" style="padding:0 4px 10px">
          <div><div class="card-title">${title}</div><div class="card-desc">${sub}</div></div>
          <span class="badge" style="background:${color}18;color:${color}">${q[key].length}</span>
        </div>
        ${q[key].length ? q[key].map(t => Views.todos.itemHTML(t)).join('') : '<div class="empty" style="padding:18px">没有事项</div>'}
      </div>`;
    return `<div class="grid grid-2">
      ${box('q1', '紧急且重要', '马上做', 'var(--danger)')}
      ${box('q2', '重要不紧急', '计划做，重点投入', 'var(--primary)')}
      ${box('q3', '紧急不重要', '尽快做或委派', 'var(--warn)')}
      ${box('q4', '不紧急不重要', '有空再说', 'var(--text-faint)')}
    </div>`;
  },

  edit(todo) {
    const isNew = !todo || !todo.id;   // 传入不带 id 的模板对象也视为新建
    const t = Object.assign({ title: '', note: '', priority: 'p3', due: '', projectId: '', tags: [] }, todo || {});
    const projOpts = [{ value: '', label: '不关联项目' }].concat(
      Store.db.projects.filter(p => p.status !== 'done').map(p => ({ value: p.id, label: p.name })));

    const body = U.el('div', {}, [
      U.field('待办内容', U.input(t.title, { id: 'fTitle', placeholder: '要做什么？' })),
      U.el('div.form-row', {}, [
        U.field('优先级', U.select(PRIORITY, t.priority, { id: 'fPri' })),
        U.field('截止日期', U.input(t.due || '', { id: 'fDue', type: 'date' })),
        U.field('关联项目', U.select(projOpts, t.projectId || '', { id: 'fProj' }))
      ]),
      U.field('标签（逗号分隔）', U.input((t.tags || []).join(', '), { id: 'fTags', placeholder: '例如：设计, 沟通' })),
      U.field('备注', U.textarea(t.note || '', { id: 'fNote', placeholder: '补充说明…', style: { minHeight: '70px' } }))
    ]);

    U.modal({
      title: isNew ? '新建待办' : '编辑待办',
      body,
      onOk: b => {
        const title = U.$('#fTitle', b).value.trim();
        if (!title) { U.toast('请填写内容'); return false; }
        const data = {
          title,
          priority: U.$('#fPri', b).value,
          due: U.$('#fDue', b).value,
          projectId: U.$('#fProj', b).value,
          tags: U.$('#fTags', b).value.split(/[,，\s]+/).filter(Boolean),
          note: U.$('#fNote', b).value
        };
        if (isNew) { Store.add('todos', data); U.toast('已添加'); }
        else { Store.update('todos', t.id, data); U.toast('已保存'); }
        App.render();
      }
    });
  }
};
