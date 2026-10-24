/* ===== 周计划与复盘 ===== */
Views.week = {
  title: '周计划',
  state: { weekStart: U.startOfWeek(U.today()) },

  /* 模板 */
  template() {
    return {
      goals: [
        { text: '推进 1 个重点项目到下一个里程碑', hint: '最重要的一件事' },
        { text: '清理本周积压的待办与沟通事项', hint: '保持收尾' },
        { text: '完成一次本周复盘与下周排期', hint: '形成节奏' }
      ],
      notes: '',
      review: { done: '', improve: '', next: '', score: 0 }
    };
  },

  plan(weekStart, create) {
    let p = Store.db.plans.find(x => x.weekStart === weekStart);
    if (!p && create) {
      p = Store.add('plans', {
        weekStart,
        goals: Views.week.template().goals.map(g => ({ id: U.uid(), text: g.text, done: false })),
        notes: '',
        review: { done: '', improve: '', next: '', score: 0 },
        updatedAt: new Date().toISOString()
      });
    }
    return p;
  },

  render(root) {
    const st = Views.week.state;
    const ws = st.weekStart, we = U.endOfWeek(ws);
    const T = U.today();
    const isThisWeek = ws === U.startOfWeek(T);
    const plan = Views.week.plan(ws, true);

    /* 本周数据 */
    const weekTodos = Store.db.todos.filter(t => {
      const d = t.completedAt || t.due;
      return d && d >= ws && d <= we;
    });
    const doneTodos = Store.db.todos.filter(t => t.done && t.completedAt && t.completedAt >= ws && t.completedAt <= we);
    const doneTasks = Store.db.tasks.filter(t => t.status === 'done' && t.completedAt &&
      U.fmt(new Date(t.completedAt)) >= ws && U.fmt(new Date(t.completedAt)) <= we);
    const focusMin = Store.db.logs.filter(l => l.date >= ws && l.date <= we).reduce((a, b) => a + b.minutes, 0);
    const overdue = Store.overdueTodos().length;

    const goals = plan.goals || [];
    const doneN = goals.filter(g => g.done).length;
    const pct = goals.length ? Math.round(doneN / goals.length * 100) : 0;

    root.innerHTML = `
      <div class="cal-head" style="margin-bottom:18px">
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm icon" id="wkPrev" style="width:28px">${U.icon('chevronLeft', 15)}</button>
          <div style="font-size:15px;font-weight:600;min-width:190px;text-align:center;letter-spacing:-.3px">
            ${ws} ~ ${we}${isThisWeek ? ' · 本周' : ''}
          </div>
          <button class="btn btn-sm icon" id="wkNext" style="width:28px">${U.icon('chevronRight', 15)}</button>
          <button class="btn btn-sm" id="wkNow">回到本周</button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn" id="wkTpl">${U.icon('copy', 14)}套用模板</button>
          <button class="btn" id="wkExport">${U.icon('download', 14)}导出复盘</button>
        </div>
      </div>

      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="kpi accent-blue"><div class="kpi-label">${U.icon('target', 14)}计划完成</div>
          <div class="kpi-value">${doneN}/${goals.length}</div><div class="kpi-foot">目标完成率 ${pct}%</div></div>
        <div class="kpi accent-green"><div class="kpi-label">${U.icon('check', 14)}完成事项</div>
          <div class="kpi-value">${doneTodos.length + doneTasks.length}</div><div class="kpi-foot">待办 ${doneTodos.length} · 任务 ${doneTasks.length}</div></div>
        <div class="kpi accent-orange"><div class="kpi-label">${U.icon('clock', 14)}专注时长</div>
          <div class="kpi-value">${(focusMin / 60).toFixed(1)}<span style="font-size:15px;color:var(--text-faint)">h</span></div>
          <div class="kpi-foot">${focusMin} 分钟</div></div>
        <div class="kpi ${overdue ? 'accent-red' : ''}"><div class="kpi-label">${U.icon('alert', 14)}当前逾期</div>
          <div class="kpi-value">${overdue}</div><div class="kpi-foot">${overdue ? '需要清理' : '没有积压'}</div></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head">
            <div><div class="card-title">本周目标</div><div class="card-desc">建议 3 条以内，聚焦真正重要的事</div></div>
            <button class="btn btn-sm" id="wkAddGoal">${U.icon('plus', 13)}添加</button>
          </div>
          <div id="wkGoals"></div>
          <div class="progress" style="margin-top:12px"><div style="width:${pct}%"></div></div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><div class="card-title">本周复盘</div><div class="card-desc">建议周五或周末填写</div></div>
            <span class="badge ${plan.review.done ? 'green' : ''}">${plan.review.done ? '已复盘' : '待复盘'}</span>
          </div>
          <div class="form-field" style="margin-bottom:12px">
            <label>这周做成了什么</label>
            <textarea id="rvDone" placeholder="列出关键产出与进展…">${U.esc(plan.review.done || '')}</textarea>
          </div>
          <div class="form-field" style="margin-bottom:12px">
            <label>哪里可以做得更好</label>
            <textarea id="rvImprove" placeholder="卡点、分心、判断失误…">${U.esc(plan.review.improve || '')}</textarea>
          </div>
          <div class="form-field" style="margin-bottom:12px">
            <label>下周重点</label>
            <textarea id="rvNext" placeholder="下周最重要的 3 件事…">${U.esc(plan.review.next || '')}</textarea>
          </div>
          <div class="form-row" style="align-items:flex-end">
            <div class="form-field">
              <label>本周自评（1-10）</label>
              <input id="rvScore" type="number" min="0" max="10" value="${plan.review.score || 0}">
            </div>
            <button class="btn btn-primary" id="rvSave" style="height:34px">保存复盘</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><div class="card-title">历史周计划</div>
          <div class="card-desc">共 ${Store.db.plans.length} 周</div></div>
        <div id="wkHistory"></div>
      </div>
    `;

    /* 目标列表 */
    const renderGoals = () => {
      U.$('#wkGoals', root).innerHTML = goals.length ? goals.map(g => `
        <div class="list-item" data-gid="${g.id}">
          <div class="checkbox ${g.done ? 'checked' : ''}" data-act="toggle">${g.done ? U.icon('check', 12, 3) : ''}</div>
          <div class="li-main">
            <div class="li-title">${U.esc(g.text)}</div>
          </div>
          <div class="li-actions">
            <button class="btn btn-sm" data-act="edit">${U.icon('edit', 13)}</button>
            <button class="btn btn-sm btn-danger" data-act="del">${U.icon('trash', 13)}</button>
          </div>
        </div>`).join('') : `<div class="empty" style="padding:22px"><div class="empty-ico">${U.icon('target', 21)}</div>还没有目标，点右上角添加或套用模板</div>`;
    };
    renderGoals();

    /* 历史 */
    const hist = Store.db.plans.slice().sort((a, b) => a.weekStart < b.weekStart ? 1 : -1).slice(0, 12);
    U.$('#wkHistory', root).innerHTML = hist.length ? hist.map(p => {
      const g = p.goals || [];
      const d = g.filter(x => x.done).length;
      const rate = g.length ? Math.round(d / g.length * 100) : 0;
      return `<div class="list-item" data-week="${p.weekStart}" style="cursor:pointer">
        <div class="li-main">
          <div class="li-title">${p.weekStart} ~ ${U.endOfWeek(p.weekStart)}
            <span class="badge ${p.weekStart === U.startOfWeek(T) ? 'blue' : ''}" style="margin-left:6px">
              ${p.weekStart === U.startOfWeek(T) ? '本周' : ''}</span></div>
          <div class="li-meta">
            <span>目标 ${d}/${g.length}</span>
            <span>完成率 ${rate}%</span>
            ${p.review && p.review.score ? `<span>自评 ${p.review.score}/10</span>` : ''}
            ${p.review && p.review.done ? '<span class="badge green">已复盘</span>' : '<span class="badge">待复盘</span>'}
          </div>
        </div>
        <div style="width:90px"><div class="progress"><div style="width:${rate}%"></div></div></div>
      </div>`;
    }).join('') : '<div class="empty" style="padding:20px">暂无历史记录</div>';

    /* 事件 */
    const save = () => { plan.updatedAt = new Date().toISOString(); Store.update('plans', plan.id, { updatedAt: plan.updatedAt }); };

    U.$('#wkPrev', root).addEventListener('click', () => { st.weekStart = U.addDays(ws, -7); App.render(); });
    U.$('#wkNext', root).addEventListener('click', () => { st.weekStart = U.addDays(ws, 7); App.render(); });
    U.$('#wkNow', root).addEventListener('click', () => { st.weekStart = U.startOfWeek(T); App.render(); });

    U.$('#wkAddGoal', root).addEventListener('click', () => {
      const body = U.el('div', {}, [
        U.field('目标内容', U.input('', { id: 'gText', placeholder: '例如：完成官网首页开发' }))
      ]);
      U.modal({
        title: '添加本周目标', body,
        onOk: b => {
          const text = U.$('#gText', b).value.trim();
          if (!text) { U.toast('请填写内容'); return false; }
          goals.push({ id: U.uid(), text, done: false });
          Store.update('plans', plan.id, { goals, updatedAt: new Date().toISOString() });
          App.render();
        }
      });
    });

    U.$('#wkTpl', root).addEventListener('click', () => {
      U.confirm('将用模板覆盖本周的目标列表（复盘内容保留），确定？', () => {
        const tpl = Views.week.template();
        Store.update('plans', plan.id, {
          goals: tpl.goals.map(g => ({ id: U.uid(), text: g.text, done: false })),
          updatedAt: new Date().toISOString()
        });
        U.toast('模板已套用');
        App.render();
      });
    });

    U.$('#rvSave', root).addEventListener('click', () => {
      Store.update('plans', plan.id, {
        review: {
          done: U.$('#rvDone', root).value,
          improve: U.$('#rvImprove', root).value,
          next: U.$('#rvNext', root).value,
          score: Number(U.$('#rvScore', root).value) || 0
        },
        updatedAt: new Date().toISOString()
      });
      U.toast('复盘已保存');
      App.render();
    });

    U.$('#wkExport', root).addEventListener('click', () => App.exportWeekReview(plan));

    U.$('#wkGoals', root).addEventListener('click', e => {
      const item = e.target.closest('.list-item');
      if (!item) return;
      const g = goals.find(x => x.id === item.dataset.gid);
      if (!g) return;
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'toggle') {
        g.done = !g.done;
        Store.update('plans', plan.id, { goals, updatedAt: new Date().toISOString() });
        App.render();
      } else if (act.dataset.act === 'edit') {
        const body = U.el('div', {}, [U.field('目标内容', U.input(g.text, { id: 'gText' }))]);
        U.modal({
          title: '编辑目标', body,
          onOk: b => {
            g.text = U.$('#gText', b).value.trim() || g.text;
            Store.update('plans', plan.id, { goals, updatedAt: new Date().toISOString() });
            App.render();
          }
        });
      } else if (act.dataset.act === 'del') {
        Store.update('plans', plan.id, {
          goals: goals.filter(x => x.id !== g.id),
          updatedAt: new Date().toISOString()
        });
        App.render();
      }
    });

    U.$('#wkHistory', root).addEventListener('click', e => {
      const item = e.target.closest('[data-week]');
      if (item) { st.weekStart = item.dataset.week; App.render(); }
    });
  }
};
