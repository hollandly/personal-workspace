/* ===== 日历 ===== */
Views.calendar = {
  title: '日历',
  state: { mk: U.monthKey(U.today()), sel: U.today() },

  render(root) {
    const st = Views.calendar.state;
    const T = U.today();
    const days = U.monthDays(st.mk);

    const events = {};   // date -> [{type,title,color,id,col}]
    const push = (d, e) => { (events[d] = events[d] || []).push(e); };
    Store.db.todos.forEach(t => { if (t.due) push(t.due, { type: 'todo', title: t.title, color: t.done ? '#17a672' : (P_MAP[t.priority] || P_MAP.p3).color, id: t.id, done: t.done }); });
    Store.db.tasks.forEach(t => {
      if (!t.due) return;
      const p = Store.get('projects', t.projectId);
      push(t.due, { type: 'task', title: t.title, color: p ? p.color : '#3b6ef5', id: t.id, done: t.status === 'done' });
    });
    Store.db.projects.forEach(p => { if (p.due) push(p.due, { type: 'project', title: `${p.name} · 截止`, color: p.color, id: p.id }); });

    root.innerHTML = `
      <div class="cal-head">
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm icon" id="calPrev" style="width:28px" title="上一月">${U.icon('chevronLeft', 15)}</button>
          <div style="font-size:15.5px;font-weight:600;min-width:118px;text-align:center;letter-spacing:-.3px">${st.mk.replace('-', ' 年 ')} 月</div>
          <button class="btn btn-sm icon" id="calNext" style="width:28px" title="下一月">${U.icon('chevronRight', 15)}</button>
          <button class="btn btn-sm" id="calToday">回到今天</button>
        </div>
        <div class="legend" style="margin:0">
          <span><i class="dot" style="background:#e0463c"></i>待办</span>
          <span><i class="dot" style="background:#3b6ef5"></i>项目任务</span>
          <span><i class="dot" style="background:#7c5cf0"></i>项目节点</span>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:1fr 300px;gap:16px">
        <div class="card">
          <div class="cal-grid">
            ${['一', '二', '三', '四', '五', '六', '日'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
            ${days.map(d => {
              const evs = events[d] || [];
              const isOther = U.monthKey(d) !== st.mk;
              return `<div class="cal-cell ${isOther ? 'other' : ''} ${d === T ? 'today' : ''} ${d === st.sel ? 'sel' : ''}" data-d="${d}">
                <div class="cal-date"><span>${Number(d.slice(8))}</span>${evs.length ? `<span class="wk">${evs.length}</span>` : ''}</div>
                ${evs.slice(0, 3).map(e => `<div class="cal-ev" style="background:${e.color}1a;color:${e.color};${e.done ? 'opacity:.5;text-decoration:line-through' : ''}">${U.esc(e.title)}</div>`).join('')}
                ${evs.length > 3 ? `<div class="cal-ev more">+${evs.length - 3} 项</div>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="card" style="align-self:start">
          <div class="card-head"><div>
            <div class="card-title">${U.esc(st.sel)}</div>
            <div class="card-desc">${U.weekdayCN(st.sel)}${st.sel === T ? ' · 今天' : ''}</div>
          </div></div>
          <div id="calDay"></div>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:12px;justify-content:center" id="calAdd">${U.icon('plus', 13)}在此新建待办</button>
        </div>
      </div>
    `;

    const renderDay = () => {
      const evs = events[st.sel] || [];
      U.$('#calDay', root).innerHTML = evs.length ? evs.map(e => {
        const tag = { todo: '待办', task: '任务', project: '项目' }[e.type];
        return `<div class="list-item ${e.done ? 'done' : ''}" data-type="${e.type}" data-id="${e.id}" style="padding:8px 6px">
          <div class="li-main">
            <div class="li-title" style="font-size:13px"><i class="dot" style="background:${e.color}"></i> ${U.esc(e.title)}</div>
            <div class="li-meta"><span class="badge">${tag}</span></div>
          </div>
        </div>`;
      }).join('') : `<div class="empty" style="padding:26px"><div class="empty-ico">${U.icon('calendar', 21)}</div>这一天没有安排</div>`;
    };
    renderDay();

    U.$('#calPrev', root).addEventListener('click', () => { st.mk = U.addMonth(st.mk, -1); App.render(); });
    U.$('#calNext', root).addEventListener('click', () => { st.mk = U.addMonth(st.mk, 1); App.render(); });
    U.$('#calToday', root).addEventListener('click', () => { st.mk = U.monthKey(T); st.sel = T; App.render(); });
    U.$('#calAdd', root).addEventListener('click', () => Views.todos.edit({ title: '', priority: 'p3', due: st.sel, projectId: '', tags: [], note: '' }));

    root.addEventListener('click', e => {
      const cell = e.target.closest('.cal-cell');
      if (cell) { st.sel = cell.dataset.d; App.render(); return; }
      const item = e.target.closest('.list-item[data-id]');
      if (!item) return;
      const { type, id } = item.dataset;
      if (type === 'todo') Views.todos.edit(Store.get('todos', id));
      else if (type === 'task') { const t = Store.get('tasks', id); Views.kanban.editTask(t, t.projectId, App.render); }
      else location.hash = `#/projects/${id}`;
    });
  }
};
