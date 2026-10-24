/* ===== 今日概览 ===== */
Views.dashboard = {
  title: '今日概览',
  render(root) {
    const db = Store.db;
    const T = U.today();
    const mk = U.monthKey(T);

    const todayList = db.todos.filter(t => !t.done && t.due && t.due <= T);
    const overdue = Store.overdueTodos();
    const activeProjs = db.projects.filter(p => p.status === 'active');
    const doneThisMonth = db.tasks.filter(t => t.status === 'done' && t.completedAt && U.fmt(new Date(t.completedAt)).slice(0, 7) === mk).length
      + db.todos.filter(t => t.done && t.completedAt && U.fmt(new Date(t.completedAt)).slice(0, 7) === mk).length;
    const focusToday = db.logs.filter(l => l.date === T).reduce((a, b) => a + b.minutes, 0);
    const dueSoon = db.todos.filter(t => !t.done && t.due && t.due > T && U.diffDays(t.due, T) <= 7);

    // 近 14 天完成趋势
    const labels = [], doneData = [], addData = [];
    for (let i = 13; i >= 0; i--) {
      const day = U.addDays(T, -i);
      labels.push(day.slice(5).replace('-', '/'));
      doneData.push(
        db.todos.filter(t => t.done && t.completedAt === day).length +
        db.tasks.filter(t => t.status === 'done' && t.completedAt && U.fmt(new Date(t.completedAt)) === day).length
      );
      addData.push(db.todos.filter(t => t.createdAt && U.fmt(new Date(t.createdAt)) === day).length);
    }

    const projBars = activeProjs.map(p => {
      const pg = Store.projectProgress(p.id);
      return { label: p.name, value: pg.pct, color: p.color, tip: `${pg.pct}% · ${pg.done}/${pg.total || '—'}` };
    });

    const hour = new Date().getHours();
    const greet = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

    // 今日完成度：已完成 / (已完成 + 今日待办)
    const doneToday = db.todos.filter(t => t.done && t.completedAt === T).length
      + db.tasks.filter(t => t.status === 'done' && t.completedAt && U.fmt(new Date(t.completedAt)) === T).length;
    const totalToday = doneToday + todayList.length;
    const pctToday = totalToday ? Math.round(doneToday / totalToday * 100) : 0;
    const cheer = pctToday >= 100 ? '今天全部搞定，漂亮！'
      : pctToday >= 60 ? '就快完成了，再加把劲'
        : pctToday > 0 ? '已经开个好头，稳步推进'
          : '新的一天，从第一件事开始';
    const R = 27, C = 2 * Math.PI * R;

    root.innerHTML = `
      <!-- 移动端专属：渐变 Hero 卡（桌面端由 CSS 隐藏） -->
      <div class="mobile-hero">
        <div class="mh-top">
          <div class="mh-info">
            <div class="mh-greet">${greet}，${db.profile.name || '我'}</div>
            <div class="mh-date">${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日 ${U.weekdayCN(T)}</div>
            <div class="mh-cheer">${cheer}</div>
          </div>
          <div class="mh-ring">
            <svg width="68" height="68" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r="${R}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="7"/>
              <circle cx="34" cy="34" r="${R}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"
                stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pctToday / 100)).toFixed(1)}"
                transform="rotate(-90 34 34)"/>
            </svg>
            <div class="mh-ring-txt">
              <div class="mh-ring-num">${pctToday}%</div>
              <div class="mh-ring-lbl">完成度</div>
            </div>
          </div>
        </div>
        <div class="mh-bar"><div style="width:${pctToday}%"></div></div>
        <div class="mh-foot">已完成 <b>${doneToday}</b> 项 · 还有 <b>${todayList.length}</b> 项待办 · 今日专注 <b>${focusToday}</b> 分钟</div>
      </div>

      <div class="grid grid-4 kpi-grid" style="margin-bottom:14px">
        <div class="kpi accent-blue">
          <div class="kpi-ico blue">${U.icon('checkSquare', 17)}</div>
          <div class="kpi-label"><span class="ico">${U.icon('check', 14)}</span>今日待办</div>
          <div class="kpi-value">${todayList.length}</div>
          <div class="kpi-foot">含 ${overdue.length} 项逾期</div>
        </div>
        <div class="kpi ${overdue.length ? 'accent-red' : ''}">
          <div class="kpi-ico ${overdue.length ? 'red' : 'teal'}">${U.icon('alert', 17)}</div>
          <div class="kpi-label"><span class="ico">${U.icon('alert', 14)}</span>逾期未办</div>
          <div class="kpi-value">${overdue.length}</div>
          <div class="kpi-foot">${overdue.length ? '建议优先清理' : '节奏保持得不错'}</div>
        </div>
        <div class="kpi accent-purple">
          <div class="kpi-ico purple">${U.icon('folder', 17)}</div>
          <div class="kpi-label"><span class="ico">${U.icon('folder', 14)}</span>进行中项目</div>
          <div class="kpi-value">${activeProjs.length}</div>
          <div class="kpi-foot">共 ${db.projects.length} 个项目</div>
        </div>
        <div class="kpi accent-green">
          <div class="kpi-ico green">${U.icon('trending', 17)}</div>
          <div class="kpi-label"><span class="ico">${U.icon('trending', 14)}</span>本月已完成</div>
          <div class="kpi-value">${doneThisMonth}</div>
          <div class="kpi-foot">今日专注 ${focusToday} 分钟</div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">今天要做的事</div>
              <div class="card-desc">${greet}，${db.profile.name || '我'}。${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日 ${U.weekdayCN(T)}</div>
            </div>
            <button class="btn btn-sm btn-primary" id="dashAdd">${U.icon('plus', 14)}添加</button>
          </div>
          <div id="dashToday"></div>
          ${dueSoon.length ? `<div class="section-title">未来 7 天到期 <span class="count">${dueSoon.length}</span></div><div id="dashSoon"></div>` : ''}
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title">项目进度</div>
            <a class="btn btn-sm" href="#/projects">全部项目</a></div>
          <div id="dashProj">${Charts.hbars(projBars)}</div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><div class="card-title">近 14 天完成情况</div>
          <div class="legend">
            <span><i class="dot" style="background:#17a672"></i>完成数</span>
            <span><i class="dot" style="background:#3b6ef5"></i>新建待办</span>
          </div>
        </div>
        <div class="chart-box" id="dashChart"></div>
      </div>
    `;

    const renderTodoItem = t => {
      const p = P_MAP[t.priority] || P_MAP.p3;
      const proj = t.projectId ? Store.get('projects', t.projectId) : null;
      const isOver = t.due && t.due < T;
      return `<div class="list-item" data-id="${t.id}">
        <div class="checkbox" data-act="toggle"></div>
        <div class="li-main">
          <div class="li-title">${U.esc(t.title)}</div>
          <div class="li-meta">
            <span class="badge ${p.cls}">${p.label.split(' ')[0]}</span>
            ${proj ? `<span style="display:flex;align-items:center;gap:5px"><i class="dot" style="background:${proj.color}"></i>${U.esc(proj.name)}</span>` : ''}
            ${t.due ? `<span style="color:${isOver ? 'var(--danger)' : 'var(--text-dim)'}">${isOver ? '⚠ 逾期 ' : ''}${U.prettyDate(t.due)}</span>` : ''}
          </div>
        </div>
      </div>`;
    };

    U.$('#dashToday', root).innerHTML = todayList.length
      ? todayList.slice(0, 12).map(renderTodoItem).join('')
      : `<div class="empty"><div class="empty-ico">${U.icon('check', 21)}</div>今天没有待办，规划一下？</div>`;
    if (dueSoon.length) U.$('#dashSoon', root).innerHTML = dueSoon.slice(0, 8).map(renderTodoItem).join('');
    U.$('#dashChart', root).innerHTML = Charts.line(labels, [
      { name: '完成', data: doneData, color: '#17a672' },
      { name: '新建', data: addData, color: '#3b6ef5' }
    ]);

    root.addEventListener('click', e => {
      const item = e.target.closest('.list-item');
      if (item) {
        const t = Store.get('todos', item.dataset.id);
        if (e.target.dataset.act === 'toggle' || e.target.closest('.checkbox')) {
          Store.update('todos', t.id, { done: !t.done, completedAt: t.done ? null : U.today() });
          U.toast(t.done ? '已恢复' : '🎉 完成一项');
          App.render();
          return;
        }
        Views.todos.edit(t);
      }
      if (e.target.id === 'dashAdd') Views.todos.edit(null);
    });
  }
};
