/* ===== 数据与设置 ===== */
Views.settings = {
  title: '数据与设置',

  render(root) {
    const db = Store.db;
    const size = new Blob([JSON.stringify(db)]).size;
    root.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><div class="card-title">安全与隐私</div>
          <div class="card-desc" id="setSyncDesc"></div></div>
        <div class="setting-row">
          <div><div class="setting-label" id="setAccLabel">本机加密</div>
            <div class="setting-desc" id="setAccDesc">数据用你的口令加密后只存在这台设备，不上传任何服务器</div></div>
          <div class="export-btns" id="setAccBtns"></div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">自动锁定</div>
            <div class="setting-desc">无操作一段时间后自动锁定，需重新输入口令</div></div>
          <select id="setIdle" class="filters" style="margin:0;height:32px">
            ${[0, 5, 15, 30, 60, 120].map(m =>
              `<option value="${m}" ${Vault.idleMinutes() === m ? 'selected' : ''}>${m === 0 ? '不自动锁定' : m + ' 分钟'}</option>`).join('')}
          </select>
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

    /* 安全与隐私 */
    const syncBox = U.$('#setAccBtns', root);
    if (Vault.plainMode) {
      U.$('#setAccLabel', root).textContent = '未加密（明文保存）';
      U.$('#setAccDesc', root).textContent = '当前环境不支持浏览器加密，数据以明文存在本机';
      U.$('#setSyncDesc', root).textContent = '明文模式';
      syncBox.appendChild(U.el('button.btn.btn-sm.btn-primary', {
        text: '启用加密',
        onclick: () => U.confirm('启用前建议先导出备份。继续？', () => { Vault.wipe(); Vault.renderLock('setup'); })
      }));
    } else {
      U.$('#setAccLabel', root).textContent = '已启用 · AES-256-GCM 本机加密';
      U.$('#setAccDesc', root).textContent = '密钥由你的口令派生，只存在内存中，锁屏即销毁；数据不上传任何服务器';
      U.$('#setSyncDesc', root).textContent = '已加密';
      syncBox.appendChild(U.el('button.btn.btn-sm', { text: '修改口令', onclick: () => Views.settings.changePasscode() }));
      syncBox.appendChild(U.el('button.btn.btn-sm', {
        text: '立即锁定',
        onclick: async () => { await Vault.saveNow(); Vault.lock(); U.toast('已锁定'); location.reload(); }
      }));
    }
    U.$('#setIdle', root).addEventListener('change', e => {
      Vault.setIdleMinutes(Number(e.target.value));
      U.toast('自动锁定已设置为 ' + (e.target.value === '0' ? '不启用' : e.target.value + ' 分钟'));
    });

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
        Store.hydrate(Store.seed()); Store.save(); U.toast('示例数据已载入'); App.render();
      });
    });
    U.$('#setClear', root).addEventListener('click', () => {
      U.confirm('将清空本机全部数据且无法恢复，确定？建议先导出备份。', () => {
        Vault.wipe(); U.toast('已清空');
        Vault.renderLock('setup');
      });
    });
  },

  changePasscode() {
    const body = U.el('div', {}, [
      U.field('当前口令', U.input('', { id: 'cpOld', type: 'password' })),
      U.field('新口令（至少 8 位）', U.input('', { id: 'cpNew', type: 'password' })),
      U.field('确认新口令', U.input('', { id: 'cpNew2', type: 'password' })),
      U.field('口令提示（可选）', U.input(Vault.hint || '', { id: 'cpHint', maxlength: '60' })),
      U.el('div', { id: 'cpErr', style: { color: 'var(--danger)', fontSize: '12.5px', minHeight: '18px' } }),
      U.el('div', {
        html: `<p style="font-size:12px;color:var(--text-faint);line-height:1.7">
          修改口令会用新口令重新加密本机全部数据，不影响已有内容。</p>`
      })
    ]);
    U.modal({
      title: '修改口令', body,
      okText: '确认修改',
      onOk: async b => {
        const err = U.$('#cpErr', b);
        const oldP = U.$('#cpOld', b).value;
        const newP = U.$('#cpNew', b).value;
        const newP2 = U.$('#cpNew2', b).value;
        if (newP.length < 8) { err.textContent = '新口令至少 8 位'; return false; }
        if (newP !== newP2) { err.textContent = '两次输入的新口令不一致'; return false; }
        const r = await Vault.changePassword(oldP, newP, U.$('#cpHint', b).value);
        if (r.error) { err.textContent = r.error; return false; }
        U.toast('口令已更新');
        App.render();
      }
    });
  }
};
