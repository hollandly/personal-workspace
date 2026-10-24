/* ===== 数据与设置 ===== */
Views.settings = {
  title: '数据与设置',

  render(root) {
    const db = Store.db;
    const size = new Blob([JSON.stringify(db)]).size;
    root.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><div class="card-title">账户与同步</div>
          <div class="card-desc" id="setSyncDesc"></div></div>
        <div class="setting-row">
          <div><div class="setting-label" id="setAccLabel">未登录</div>
            <div class="setting-desc" id="setAccDesc">登录后，待办、项目、周计划会在所有设备之间自动同步</div></div>
          <div class="export-btns" id="setAccBtns"></div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><div class="card-title">个人信息</div></div>
          <div id="setProfile"></div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title">数据概览</div></div>
          <div id="setStat"></div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><div class="card-title">备份与恢复</div>
          <div class="card-desc">数据保存在本机浏览器，建议定期导出备份</div></div>
        <div class="setting-row">
          <div><div class="setting-label">导出完整备份（JSON）</div><div class="setting-desc">包含全部待办、项目、任务、目标、笔记</div></div>
          <button class="btn btn-primary" id="setExport">${U.icon('download', 14)}导出备份</button>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">从备份导入</div><div class="setting-desc">导入会覆盖当前全部数据</div></div>
          <button class="btn" id="setImport">${U.icon('upload', 14)}选择文件导入</button>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><div class="card-title">导出与报告</div></div>
        <div class="setting-row">
          <div><div class="setting-label">导出表格（CSV）</div><div class="setting-desc">可用 Excel / Numbers 打开</div></div>
          <div class="export-btns">
            <button class="btn" id="setCsvTodo">${U.icon('download', 13)}待办</button>
            <button class="btn" id="setCsvTask">${U.icon('download', 13)}任务</button>
            <button class="btn" id="setCsvProj">${U.icon('download', 13)}项目</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">月度 / 周度报告（Markdown）</div><div class="setting-desc">自动汇总完成情况，可直接粘到周报里</div></div>
          <div class="export-btns">
            <button class="btn" id="setRepWeek">${U.icon('note', 13)}本周报告</button>
            <button class="btn" id="setRepMonth">${U.icon('note', 13)}本月报告</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">打印当前页面</div><div class="setting-desc">调起系统打印，可另存为 PDF</div></div>
          <button class="btn" id="setPrint">${U.icon('print', 14)}打印 / 存为 PDF</button>
        </div>
      </div>

      <div class="card" style="margin-top:16px;border-color:var(--danger)">
        <div class="card-head"><div class="card-title" style="color:var(--danger)">危险操作</div></div>
        <div class="setting-row">
          <div><div class="setting-label">载入示例数据</div><div class="setting-desc">覆盖当前数据，用于快速体验</div></div>
          <button class="btn" id="setSeed">${U.icon('refresh', 14)}载入示例</button>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">清空全部数据</div><div class="setting-desc">不可恢复，请先导出备份</div></div>
          <button class="btn btn-danger" id="setClear">${U.icon('trash', 14)}清空数据</button>
        </div>
      </div>
    `;

    /* 账户与同步 */
    const syncBox = U.$('#setAccBtns', root);
    if (Sync.user) {
      U.$('#setAccLabel', root).textContent = `已登录 · ${Sync.user.email}`;
      U.$('#setAccDesc', root).textContent = `上次同步：${Sync.lastText()}`;
      U.$('#setSyncDesc', root).textContent = Sync.state === 'ok' ? '同步正常' : (Sync.state === 'error' ? '有改动未同步' : '同步中…');
      syncBox.appendChild(U.el('button.btn.btn-sm', { text: '立即同步', onclick: () => Sync.push({ force: true }) }));
      syncBox.appendChild(U.el('button.btn.btn-sm', { text: '账户设置', onclick: () => Sync.accountDialog() }));
      syncBox.appendChild(U.el('button.btn.btn-sm.btn-danger', {
        text: '退出登录',
        onclick: () => U.confirm('退出后本机数据仍会保留，但不再同步到其他设备。确定退出？', async () => {
          await Sync.logout(); U.toast('已退出登录'); App.render();
        })
      }));
    } else {
      U.$('#setAccLabel', root).textContent = '未登录 · 数据仅存本机';
      U.$('#setSyncDesc', root).textContent = '本地模式';
      syncBox.appendChild(U.el('button.btn.btn-sm.btn-primary', { text: '登录', onclick: () => Sync.authDialog('login') }));
      syncBox.appendChild(U.el('button.btn.btn-sm', { text: '注册', onclick: () => Sync.authDialog('register') }));
    }

    /* 个人信息 */
    const pbox = U.$('#setProfile', root);
    const nameInput = U.input(db.profile.name || '', { id: 'setName', placeholder: '怎么称呼你' });
    const themeSel = U.select([{ value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }], db.profile.theme || 'light', { id: 'setTheme' });
    pbox.appendChild(U.el('div.form-row', {}, [
      U.field('称呼', nameInput),
      U.field('主题', themeSel)
    ]));
    pbox.appendChild(U.el('div', { html: `<div style="font-size:12px;color:var(--text-dim)">数据本地存储，当前占用约 ${(size / 1024).toFixed(1)} KB，不会上传到任何服务器。</div>` }));
    nameInput.addEventListener('input', U.debounce(e => { db.profile.name = e.target.value; Store.save(); }, 400));
    themeSel.addEventListener('change', e => { App.setTheme(e.target.value); });

    /* 统计 */
    U.$('#setStat', root).innerHTML = [
      ['待办', db.todos.length], ['项目', db.projects.length], ['任务', db.tasks.length],
      ['目标', db.goals.length], ['笔记', db.notes.length], ['专注记录', db.logs.length]
    ].map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span style="color:var(--text-dim)">${k}</span><b>${v}</b></div>`).join('');

    /* 事件 */
    U.$('#setExport', root).addEventListener('click', () => {
      U.download(`工作台备份-${U.today()}.json`, JSON.stringify(db, null, 2), 'application/json');
      U.toast('备份已导出');
    });
    U.$('#setImport', root).addEventListener('click', async () => {
      const f = await U.pickFile('.json');
      if (!f) return;
      try {
        const data = JSON.parse(f.text);
        if (!data || typeof data !== 'object') throw new Error('格式错误');
        U.confirm(`导入将覆盖当前全部数据，确定继续？`, () => {
          Store.replace(Object.assign(Store.blank(), data));
          U.toast('导入成功'); App.render();
        });
      } catch (err) { U.toast('导入失败：文件格式不正确'); }
    });
    U.$('#setCsvTodo', root).addEventListener('click', () => App.exportCSV('todos'));
    U.$('#setCsvTask', root).addEventListener('click', () => App.exportCSV('tasks'));
    U.$('#setCsvProj', root).addEventListener('click', () => App.exportCSV('projects'));
    U.$('#setRepWeek', root).addEventListener('click', () => App.exportReport('week'));
    U.$('#setRepMonth', root).addEventListener('click', () => App.exportReport(U.monthKey(U.today())));
    U.$('#setPrint', root).addEventListener('click', () => window.print());
    U.$('#setSeed', root).addEventListener('click', () => {
      U.confirm('将用示例数据覆盖当前全部内容，确定？', () => {
        Store.replace(Store.seed()); U.toast('示例数据已载入'); App.render();
      });
    });
    U.$('#setClear', root).addEventListener('click', () => {
      U.confirm('将清空全部数据且无法恢复，确定？建议先导出备份。', () => {
        Store.reset(); U.toast('已清空'); App.render();
      });
    });
  }
};
