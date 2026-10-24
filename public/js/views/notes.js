/* ===== 速记 ===== */
Views.notes = {
  title: '速记',
  state: { cur: '', kw: '' },

  render(root) {
    const st = Views.notes.state;
    let list = Store.db.notes.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (st.kw) {
      const k = st.kw.toLowerCase();
      list = list.filter(n => (n.title + n.content + (n.tags || []).join('')).toLowerCase().includes(k));
    }
    if (!st.cur || !Store.get('notes', st.cur)) st.cur = list[0] ? list[0].id : '';
    const cur = Store.get('notes', st.cur);

    root.innerHTML = `
      <div class="notes-wrap">
        <div class="card" style="padding:10px">
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <input id="nKw" class="meta-input" placeholder="搜索笔记…" value="${U.esc(st.kw)}" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface-2);outline:none">
            <button class="btn btn-sm btn-primary" id="nAdd" style="width:28px;justify-content:center;padding:0">${U.icon('plus', 14)}</button>
          </div>
          <div id="nList" style="max-height:520px;overflow-y:auto"></div>
        </div>
        <div class="card" id="nEditor"></div>
      </div>
    `;

    const renderList = () => {
      U.$('#nList', root).innerHTML = list.length ? list.map(n => `
        <div class="note-item ${n.id === st.cur ? 'active' : ''}" data-id="${n.id}">
          <div class="n-title">${U.esc(n.title || '未命名')}</div>
          <div class="n-meta">${U.esc((n.content || '').slice(0, 30).replace(/\n/g, ' ') || '空白')} · ${U.prettyDate((n.updatedAt || '').slice(0, 10))}</div>
        </div>`).join('') : `<div class="empty" style="padding:24px"><div class="empty-ico">${U.icon('note', 21)}</div>暂无笔记</div>`;
    };

    const renderEditor = () => {
      const box = U.$('#nEditor', root);
      if (!cur) {
        box.innerHTML = `<div class="empty" style="padding:70px"><div class="empty-ico">${U.icon('note', 21)}</div>选择或新建一条笔记</div>`;
        return;
      }
      box.innerHTML = `
        <div class="note-editor">
          <div style="display:flex;gap:8px;align-items:center">
            <input class="title" id="neTitle" value="${U.esc(cur.title || '')}" placeholder="笔记标题" style="flex:1">
            <button class="btn btn-sm btn-danger" id="neDel">${U.icon('trash', 13)}删除</button>
          </div>
          <input id="neTags" class="meta-input" value="${U.esc((cur.tags || []).join(', '))}" placeholder="标签（逗号分隔）">
          <textarea id="neBody" placeholder="随手记录…">${U.esc(cur.content || '')}</textarea>
          <div style="font-size:11.5px;color:var(--text-faint)" id="neInfo"></div>
        </div>
      `;
      const save = U.debounce(() => {
        Store.update('notes', cur.id, {
          title: U.$('#neTitle', box).value,
          tags: U.$('#neTags', box).value.split(/[,，\s]+/).filter(Boolean),
          content: U.$('#neBody', box).value,
          updatedAt: new Date().toISOString()
        });
        U.$('#neInfo', box).textContent = `已自动保存 · ${U.nowTime()}`;
        renderList();
      }, 500);
      ['#neTitle', '#neTags', '#neBody'].forEach(s => U.$(s, box).addEventListener('input', save));
      U.$('#neDel', box).addEventListener('click', () => {
        U.confirm(`删除笔记「${cur.title || '未命名'}」？`, () => {
          Store.remove('notes', cur.id); st.cur = ''; U.toast('已删除'); App.render();
        });
      });
      U.$('#neInfo', box).textContent = `创建于 ${(cur.createdAt || '').slice(0, 10)} · 更新于 ${(cur.updatedAt || '').slice(0, 10)}`;
    };

    renderList();
    renderEditor();

    U.$('#nAdd', root).addEventListener('click', () => {
      const n = Store.add('notes', { title: '新笔记', content: '', tags: [], updatedAt: new Date().toISOString() });
      st.cur = n.id; App.render();
    });
    U.$('#nKw', root).addEventListener('input', U.debounce(e => { st.kw = e.target.value; App.render(() => { const i = U.$('#nKw'); if (i) i.focus(); }); }, 300));
    U.$('#nList', root).addEventListener('click', e => {
      const it = e.target.closest('.note-item');
      if (it) { st.cur = it.dataset.id; App.render(); }
    });
  }
};
