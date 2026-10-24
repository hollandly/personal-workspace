/* ===== 统计分析 ===== */
Views.stats = {
  title: '统计分析',
  state: { mk: U.monthKey(U.today()) },

  render(root) {
    const st = Views.stats.state;
    const mk = st.mk;
    const T = U.today();
    const [y, m] = mk.split('-').map(Number);
    const dayCount = new Date(y, m, 0).getDate();
    const days = Array.from({ length: dayCount }, (_, i) => `${mk}-${String(i + 1).padStart(2, '0')}`);
    const labels = days.map(d => String(Number(d.slice(8))));

    const monthTodos = Store.db.todos.filter(t => (t.completedAt || '') .slice(0, 7) === mk || (!t.completedAt && (t.createdAt || '').slice(0, 7) === mk));
    const todoDone = Store.db.todos.filter(t => t.done && (t.completedAt || '').slice(0, 7) === mk);
    const todoNew = Store.db.todos.filter(t => (t.createdAt || '').slice(0, 7) === mk);
    const taskDone = Store.db.tasks.filter(t => t.status === 'done' && t.completedAt && U.fmt(new Date(t.completedAt)).slice(0, 7) === mk);
    const taskTotal = Store.db.tasks.filter(t => (t.due || '').slice(0, 7) === mk || (t.completedAt && U.fmt(new Date(t.completedAt)).slice(0, 7) === mk));
    const focusMin = Store.db.logs.filter(l => l.date.slice(0, 7) === mk).reduce((a, b) => a + b.minutes, 0);

    const dailyTodoDone = days.map(d => Store.db.todos.filter(t => t.done && t.completedAt === d).length);
    const dailyTaskDone = days.map(d => Store.db.tasks.filter(t => t.status === 'done' && t.completedAt && U.fmt(new Date(t.completedAt)) === d).length);
    const dailyNew = days.map(d => Store.db.todos.filter(t => (t.createdAt || '').slice(0, 10) === d).length);
    const activeDays = days.filter((d, i) => dailyTodoDone[i] + dailyTaskDone[i] > 0).length;

    const priDist = PRIORITY.map(p => ({
      label: p.label.split(' ')[0] + ' ' + (p.label.split(' ')[1] || ''),
      value: todoDone.filter(t => t.priority === p.value).length, color: p.color
    })).filter(x => x.value > 0);

    const projDist = Store.db.projects.map(p => {
      const ts = Store.db.tasks.filter(t => t.projectId === p.id);
      const dn = ts.filter(t => t.status === 'done' && t.completedAt && U.fmt(new Date(t.completedAt)).slice(0, 7) === mk).length;
      return { label: p.name, value: dn, color: p.color, total: ts.length };
    }).filter(x => x.total > 0).sort((a, b) => b.value - a.value);

    const heatMap = {};
    Store.db.todos.filter(t => t.done && t.completedAt).forEach(t => heatMap[t.completedAt] = (heatMap[t.completedAt] || 0) + 1);
    Store.db.tasks.filter(t => t.status === 'done' && t.completedAt).forEach(t => {
      const d = U.fmt(new Date(t.completedAt)); heatMap[d] = (heatMap[d] || 0) + 1;
    });

    // 月份下拉：最近 18 个月
    const opts = [];
    for (let i = 0; i < 18; i++) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      opts.push(U.fmt(d).slice(0, 7));
    }

    const rate = todoNew.length ? Math.round(todoDone.length / Math.max(1, todoNew.length) * 100) : 0;

    root.innerHTML = `
      <div class="filters">
        <select id="stMonth">
          ${opts.map(o => `<option value="${o}" ${o === mk ? 'selected' : ''}>${o.replace('-', ' 年 ')} 月</option>`).join('')}
        </select>
        <div style="font-size:12px;color:var(--text-dim)">共 ${dayCount} 天 · 活跃 ${activeDays} 天</div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn" id="stReport">${U.icon('download', 14)}导出月报 Markdown</button>
          <button class="btn" id="stCsv">${U.icon('download', 14)}导出月度 CSV</button>
        </div>
      </div>

      <div class="grid grid-4 kpi-grid" style="margin-bottom:16px">
        <div class="kpi accent-green"><div class="kpi-ico green">${U.icon('checkSquare', 17)}</div><div class="kpi-label"><span class="ico">${U.icon('check', 14)}</span>完成待办</div><div class="kpi-value">${todoDone.length}</div><div class="kpi-foot">本月新增 ${todoNew.length}</div></div>
        <div class="kpi accent-blue"><div class="kpi-ico blue">${U.icon('trending', 17)}</div><div class="kpi-label"><span class="ico">${U.icon('trending', 14)}</span>完成率</div><div class="kpi-value">${rate}%</div><div class="kpi-foot">完成 / 新增</div></div>
        <div class="kpi accent-purple"><div class="kpi-ico purple">${U.icon('flag', 17)}</div><div class="kpi-label"><span class="ico">${U.icon('flag', 14)}</span>完成任务</div><div class="kpi-value">${taskDone.length}</div><div class="kpi-foot">涉及 ${projDist.length} 个项目</div></div>
        <div class="kpi accent-orange"><div class="kpi-ico orange">${U.icon('clock', 17)}</div><div class="kpi-label"><span class="ico">${U.icon('clock', 14)}</span>专注时长</div><div class="kpi-value">${(focusMin / 60).toFixed(1)}<span style="font-size:15px;font-weight:500;color:var(--text-faint)">h</span></div><div class="kpi-foot">${focusMin} 分钟</div></div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><div class="card-title">每日完成趋势</div>
          <div class="legend">
            <span><i class="dot" style="background:#17a672"></i>待办完成</span>
            <span><i class="dot" style="background:#7c5cf0"></i>任务完成</span>
            <span><i class="dot" style="background:#3b6ef5"></i>新建待办</span>
          </div>
        </div>
        <div class="chart-box">${Charts.line(labels, [
          { name: '待办完成', data: dailyTodoDone, color: '#17a672' },
          { name: '任务完成', data: dailyTaskDone, color: '#7c5cf0' },
          { name: '新建', data: dailyNew, color: '#3b6ef5' }
        ], { height: 220 })}</div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div class="card-title">完成待办的优先级分布</div></div>
          ${Charts.donut(priDist.length ? priDist : [{ label: '暂无', value: 1, color: 'var(--border)' }])}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">各项目本月完成任务</div></div>
          ${Charts.hbars(projDist.map(p => ({ label: p.label, value: p.total ? Math.round(p.value / p.total * 100) : 0, color: p.color, tip: `${p.value}/${p.total}` })))}
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><div class="card-title">全年贡献热力图</div><div class="card-desc">每格 = 当天完成事项数</div></div>
        ${Charts.heat(heatMap, { weeks: 30 })}
      </div>

      <div class="grid grid-2" style="margin-top:16px">
        <div class="card">
          <div class="card-head"><div class="card-title">本月完成清单（${todoDone.length + taskDone.length}）</div></div>
          <div id="stList" style="max-height:320px;overflow-y:auto"></div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">项目健康度</div></div>
          <div id="stHealth"></div>
        </div>
      </div>
    `;

    const items = [
      ...todoDone.map(t => ({ title: t.title, date: t.completedAt, color: (P_MAP[t.priority] || P_MAP.p3).color, kind: '待办' })),
      ...taskDone.map(t => ({ title: t.title, date: U.fmt(new Date(t.completedAt)), color: (Store.get('projects', t.projectId) || {}).color || '#3b6ef5', kind: '任务' }))
    ].sort((a, b) => a.date < b.date ? 1 : -1);

    U.$('#stList', root).innerHTML = items.length ? items.map(i => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title" style="font-size:13px"><i class="dot" style="background:${i.color}"></i> ${U.esc(i.title)}</div>
          <div class="li-meta"><span class="badge">${i.kind}</span><span>${i.date}</span></div>
        </div>
      </div>`).join('') : `<div class="empty" style="padding:26px"><div class="empty-ico">${U.icon('inbox', 21)}</div>本月还没有完成记录</div>`;

    const health = Store.db.projects.filter(p => p.status !== 'done').map(p => {
      const ts = Store.db.tasks.filter(t => t.projectId === p.id);
      const late = ts.filter(t => t.status !== 'done' && t.due && t.due < T).length;
      const pg = Store.projectProgress(p.id);
      const risk = late > 0 ? '有逾期任务' : (p.due && U.diffDays(p.due, T) < 7 ? '临近截止' : '正常');
      const color = late > 0 ? 'var(--danger)' : (risk === '临近截止' ? 'var(--warn)' : 'var(--success)');
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
        <i class="dot" style="background:${p.color}"></i>
        <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(p.name)}</span>
        <span style="font-size:12px;color:var(--text-dim)">${pg.pct}%</span>
        <span class="badge" style="color:${color}">${risk}</span>
      </div>`;
    });
    U.$('#stHealth', root).innerHTML = health.length ? health.join('')
      : `<div class="empty" style="padding:26px"><div class="empty-ico">${U.icon('folder', 21)}</div>暂无进行中项目</div>`;

    U.$('#stMonth', root).addEventListener('change', e => { st.mk = e.target.value; App.render(); });
    U.$('#stReport', root).addEventListener('click', () => App.exportReport(mk));
    U.$('#stCsv', root).addEventListener('click', () => App.exportCSV('month', mk));
  }
};
