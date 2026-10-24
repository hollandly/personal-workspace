/* ===== 目标 OKR ===== */
Views.goals = {
  title: '目标 OKR',
  state: { period: 'all' },

  render(root) {
    const st = Views.goals.state;
    const periods = [...new Set(Store.db.goals.map(g => g.period))];
    let list = Store.db.goals.slice();
    if (st.period !== 'all') list = list.filter(g => g.period === st.period);

    root.innerHTML = `
      <div class="tabs">
        <div class="tab ${st.period === 'all' ? 'active' : ''}" data-p="all">全部</div>
        ${periods.map(p => `<div class="tab ${st.period === p ? 'active' : ''}" data-p="${U.esc(p)}">${U.esc(p)}</div>`).join('')}
        <div style="margin-left:auto"></div>
        <button class="btn btn-primary" id="gAdd">${U.icon('plus', 14)}新建目标</button>
      </div>
      <div id="gList"></div>
    `;

    const wrap = U.$('#gList', root);
    wrap.innerHTML = list.length ? `<div class="grid grid-3">${list.map(g => {
      const pct = g.target ? Math.min(100, Math.round(g.current / g.target * 100)) : 0;
      const statusCls = pct >= 100 ? 'green' : pct >= 60 ? 'blue' : pct >= 30 ? 'orange' : '';
      const statusTxt = pct >= 100 ? '已达成' : pct >= 60 ? '进展顺利' : pct >= 30 ? '需要加把劲' : '刚起步';
      return `<div class="card" data-id="${g.id}" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="font-size:14px;font-weight:600">${U.esc(g.title)}</div>
          <span class="badge">${U.esc(g.period)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:4px">${U.esc(g.note || '暂无说明')}</div>
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
            <span>${U.esc(g.metric || '进度')}</span>
            <span><b style="font-size:15px">${g.current}</b><span style="color:var(--text-dim)"> / ${g.target} ${U.esc(g.unit || '')}</span></span>
          </div>
          <div class="progress"><div style="width:${pct}%;background:${pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--primary)' : 'var(--warn)'}"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px">
            <span class="badge ${statusCls}">${statusTxt} · ${pct}%</span>
            <span style="color:var(--text-faint)">${(g.projectIds || []).length} 个关联项目</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:14px">
          <button class="btn btn-sm" data-act="upd" data-id="${g.id}">${U.icon('refresh', 13)}更新进度</button>
          <button class="btn btn-sm" data-act="edit" data-id="${g.id}">${U.icon('edit', 13)}编辑</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-id="${g.id}">${U.icon('trash', 13)}</button>
        </div>
      </div>`;
    }).join('')}</div>` : `<div class="empty"><div class="empty-ico">${U.icon('target', 21)}</div>还没有目标，先定一个小目标</div>`;

    U.$('.tabs', root).addEventListener('click', e => {
      const tab = e.target.closest('.tab');
      if (tab) { st.period = tab.dataset.p; App.render(); }
    });
    U.$('#gAdd', root).addEventListener('click', () => Views.goals.edit(null));

    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      e.stopPropagation();
      const g = Store.get('goals', btn.dataset.id);
      if (btn.dataset.act === 'upd') Views.goals.update(g);
      else if (btn.dataset.act === 'edit') Views.goals.edit(g);
      else if (btn.dataset.act === 'del') U.confirm(`删除目标「${g.title}」？`, () => { Store.remove('goals', g.id); App.render(); });
    });
  },

  edit(goal) {
    const isNew = !goal;
    const g = goal || { title: '', period: Views.goals.curPeriod(), metric: '', target: 100, current: 0, unit: '', note: '', projectIds: [] };
    const projOpts = Store.db.projects.map(p => ({ value: p.id, label: p.name }));

    const body = U.el('div', {}, [
      U.field('目标标题', U.input(g.title, { id: 'fTitle', placeholder: '例如：Q4 完成官网改版上线' })),
      U.el('div.form-row', {}, [
        U.field('周期', U.input(g.period, { id: 'fPeriod', placeholder: '2026-Q4' })),
        U.field('衡量指标', U.input(g.metric, { id: 'fMetric', placeholder: '例如：上线页面数' })),
        U.field('单位', U.input(g.unit || '', { id: 'fUnit', placeholder: '页 / % / 小时' }))
      ]),
      U.el('div.form-row', {}, [
        U.field('目标值', U.input(g.target, { id: 'fTarget', type: 'number' })),
        U.field('当前值', U.input(g.current, { id: 'fCurrent', type: 'number' }))
      ]),
      U.field('说明 / 关键结果', U.textarea(g.note || '', { id: 'fNote', style: { minHeight: '70px' }, placeholder: 'KR1…\nKR2…' })),
      U.field('关联项目（可多选，Ctrl/⌘ 多选）', U.el('select', { id: 'fProjects', multiple: true, size: Math.min(5, Math.max(2, projOpts.length)) },
        projOpts.map(o => {
          const op = U.el('option', { value: o.value, text: o.label });
          if ((g.projectIds || []).includes(o.value)) op.selected = true;
          return op;
        })))
    ]);

    U.modal({
      title: isNew ? '新建目标' : '编辑目标',
      body,
      onOk: b => {
        const title = U.$('#fTitle', b).value.trim();
        if (!title) { U.toast('请填写目标标题'); return false; }
        const sel = Array.from(U.$('#fProjects', b).selectedOptions).map(o => o.value);
        const data = {
          title,
          period: U.$('#fPeriod', b).value.trim() || Views.goals.curPeriod(),
          metric: U.$('#fMetric', b).value.trim(),
          unit: U.$('#fUnit', b).value.trim(),
          target: Number(U.$('#fTarget', b).value) || 0,
          current: Number(U.$('#fCurrent', b).value) || 0,
          note: U.$('#fNote', b).value,
          projectIds: sel
        };
        if (isNew) { Store.add('goals', data); U.toast('已创建'); }
        else { Store.update('goals', g.id, data); U.toast('已保存'); }
        App.render();
      }
    });
  },

  update(g) {
    const body = U.el('div', {}, [
      U.el('div', { html: `<div style="font-size:13px;margin-bottom:10px">${U.esc(g.title)}</div>` }),
      U.field(`当前值（目标 ${g.target}${g.unit || ''}）`, U.input(g.current, { id: 'fCur', type: 'number' })),
      U.field('本次推进说明（可选）', U.input('', { id: 'fNote2', placeholder: '例如：完成 3 个页面开发' }))
    ]);
    U.modal({
      title: '更新进度',
      body,
      okText: '更新',
      onOk: b => {
        const cur = Number(U.$('#fCur', b).value) || 0;
        Store.update('goals', g.id, { current: cur });
        const note = U.$('#fNote2', b).value.trim();
        if (note) Store.add('logs', { date: U.today(), minutes: 0, refType: 'goal', refId: g.id, title: note });
        U.toast(cur >= g.target ? '🎉 目标达成！' : '进度已更新');
        App.render();
      }
    });
  },

  curPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  }
};
