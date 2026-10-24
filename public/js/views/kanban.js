/* ===== 看板 ===== */
Views.kanban = {
  title: '看板',
  state: { proj: '' },
  dragId: null,

  render(root) {
    const st = Views.kanban.state;
    if (!st.proj && Store.db.projects.length) st.proj = Store.db.projects[0].id;
    const T = U.today();

    root.innerHTML = `
      <div class="filters">
        <select id="kbProj" style="min-width:180px">
          ${Store.db.projects.map(p => `<option value="${p.id}" ${st.proj === p.id ? 'selected' : ''}>${U.esc(p.name)}</option>`).join('')}
          <option value="__all" ${st.proj === '__all' ? 'selected' : ''}>全部项目（聚合）</option>
        </select>
        <div id="kbStat" style="font-size:12px;color:var(--text-dim)"></div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn-primary" id="kbAdd">${U.icon('plus', 14)}新建任务</button>
        </div>
      </div>
      <div class="board" id="kbBoard"></div>
      <div style="font-size:12px;color:var(--text-faint);margin-top:2px;display:flex;align-items:center;gap:6px">
        ${U.icon('zap', 13)}拖动卡片换列或排序，双击卡片可编辑
      </div>
    `;

    const board = U.$('#kbBoard', root);
    const tasks = Store.db.tasks
      .filter(t => st.proj === '__all' || t.projectId === st.proj)
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const projName = t => {
      const p = Store.get('projects', t.projectId);
      return p ? `<span style="font-size:11px;color:var(--text-dim)"><i class="dot" style="background:${p.color}"></i>${U.esc(p.name)}</span>` : '';
    };

    board.innerHTML = TASK_COLS.map(col => {
      const items = tasks.filter(t => t.status === col.value);
      return `<div class="board-col" data-col="${col.value}">
        <div class="col-head">
          <span><i class="dot" style="background:${col.color}"></i> ${col.label}</span>
          <span class="col-count">${items.length}</span>
        </div>
        <div class="col-body" data-col="${col.value}" style="min-height:60px">
          ${items.map(t => {
            const pri = P_MAP[t.priority] || P_MAP.p3;
            const isLate = t.status !== 'done' && t.due && t.due < T;
            return `<div class="card-item" draggable="true" data-id="${t.id}">
              <div class="card-title">${U.esc(t.title)}</div>
              <div class="card-meta">
                <span class="badge ${pri.cls}">${pri.label.split(' ')[0]}</span>
                ${t.due ? `<span class="badge ${isLate ? 'red' : ''}">${U.prettyDate(t.due)}</span>` : ''}
                ${st.proj === '__all' ? projName(t) : ''}
                <span style="margin-left:auto;color:var(--text-faint);cursor:pointer;display:flex;opacity:0;transition:.14s"
                  class="card-del" data-act="del">${U.icon('x', 13)}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="btn btn-sm" style="width:100%;margin-top:2px;justify-content:center;color:var(--text-dim)" data-add="${col.value}">${U.icon('plus', 13)}添加</div>
      </div>`;
    }).join('');

    const total = tasks.length, dn = tasks.filter(t => t.status === 'done').length;
    U.$('#kbStat', root).innerHTML = `共 ${total} 个任务 · 完成 ${dn} · ${total ? Math.round(dn / total * 100) : 0}%`;

    /* 事件 */
    U.$('#kbProj', root).addEventListener('change', e => { st.proj = e.target.value; App.render(); });
    U.$('#kbAdd', root).addEventListener('click', () => Views.kanban.editTask(null, st.proj === '__all' ? (Store.db.projects[0] || {}).id : st.proj, App.render));

    board.addEventListener('click', e => {
      const addBtn = e.target.closest('[data-add]');
      if (addBtn) {
        const pid = st.proj === '__all' ? (Store.db.projects[0] || {}).id : st.proj;
        if (!pid) return U.toast('请先创建项目');
        Views.kanban.editTask(null, pid, App.render, addBtn.dataset.add);
        return;
      }
      const del = e.target.closest('[data-act="del"]');
      if (del) {
        const t = Store.get('tasks', del.closest('.card-item').dataset.id);
        U.confirm(`删除任务「${t.title}」？`, () => { Store.remove('tasks', t.id); App.render(); });
        return;
      }
      const card = e.target.closest('.card-item');
      if (card) Views.kanban.editTask(Store.get('tasks', card.dataset.id), null, App.render);
    });

    board.addEventListener('dblclick', e => {
      const card = e.target.closest('.card-item');
      if (card) Views.kanban.editTask(Store.get('tasks', card.dataset.id), null, App.render);
    });

    /* 拖拽 */
    board.addEventListener('dragstart', e => {
      const card = e.target.closest('.card-item');
      if (!card) return;
      Views.kanban.dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (err) { }
    });
    board.addEventListener('dragend', e => {
      const c = e.target.closest('.card-item');
      if (c) c.classList.remove('dragging');
      U.$$('.board-col', board).forEach(x => x.classList.remove('dragover'));
    });
    board.addEventListener('dragover', e => {
      e.preventDefault();
      const col = e.target.closest('.board-col');
      U.$$('.board-col', board).forEach(x => x.classList.toggle('dragover', x === col));
    });
    board.addEventListener('drop', e => {
      e.preventDefault();
      const id = Views.kanban.dragId;
      if (!id) return;
      const col = e.target.closest('.board-col');
      if (!col) return;
      const newStatus = col.dataset.col;
      const t = Store.get('tasks', id);
      if (!t) return;
      // 计算插入位置：落在某卡片上则插到其前
      const overCard = e.target.closest('.card-item');
      const siblings = Store.db.tasks.filter(x => x.projectId === t.projectId && x.status === newStatus && x.id !== id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      let idx = siblings.length;
      if (overCard && overCard.dataset.id !== id) {
        const oi = siblings.findIndex(x => x.id === overCard.dataset.id);
        if (oi >= 0) idx = oi;
      }
      Store.update('tasks', id, { status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : null });
      siblings.splice(idx, 0, t);
      siblings.forEach((x, i) => Store.update('tasks', x.id, { order: i }));
      U.toast(`已移到「${TASK_COLS.find(c => c.value === newStatus).label}」`);
      App.render();
    });
  },

  editTask(task, projectId, after, defaultStatus) {
    const isNew = !task;
    const t = task || { title: '', status: defaultStatus || 'todo', priority: 'p3', due: '', desc: '', projectId: projectId || '' };
    if (!t.projectId && Store.db.projects.length) t.projectId = Store.db.projects[0].id;
    const projOpts = Store.db.projects.map(p => ({ value: p.id, label: p.name }));
    if (!projOpts.length) { U.toast('请先创建项目'); return; }

    const body = U.el('div', {}, [
      U.field('任务标题', U.input(t.title, { id: 'fTitle', placeholder: '任务名称' })),
      U.el('div.form-row', {}, [
        U.field('所属项目', U.select(projOpts, t.projectId, { id: 'fProj' })),
        U.field('状态', U.select(TASK_COLS, t.status, { id: 'fStatus' })),
        U.field('优先级', U.select(PRIORITY, t.priority, { id: 'fPri' }))
      ]),
      U.el('div.form-row', {}, [
        U.field('截止日期', U.input(t.due || '', { id: 'fDue', type: 'date' })),
        U.field('负责人', U.input(t.owner || '', { id: 'fOwner', placeholder: '自己' }))
      ]),
      U.field('任务描述', U.textarea(t.desc || '', { id: 'fDesc', style: { minHeight: '70px' } }))
    ]);

    U.modal({
      title: isNew ? '新建任务' : '编辑任务',
      body,
      onOk: b => {
        const title = U.$('#fTitle', b).value.trim();
        if (!title) { U.toast('请填写任务标题'); return false; }
        const data = {
          title,
          projectId: U.$('#fProj', b).value,
          status: U.$('#fStatus', b).value,
          priority: U.$('#fPri', b).value,
          due: U.$('#fDue', b).value,
          owner: U.$('#fOwner', b).value,
          desc: U.$('#fDesc', b).value
        };
        if (isNew) {
          const maxOrder = Math.max(0, ...Store.db.tasks.filter(x => x.projectId === data.projectId).map(x => x.order || 0));
          Store.add('tasks', Object.assign({ order: maxOrder + 1 }, data));
          U.toast('已添加');
        } else {
          if (data.status === 'done' && !t.completedAt) data.completedAt = new Date().toISOString();
          if (data.status !== 'done') data.completedAt = null;
          Store.update('tasks', t.id, data);
          U.toast('已保存');
        }
        if (after) after();
        else App.render();
      }
    });
  }
};
