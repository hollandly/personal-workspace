# 个人工作台

待办 · 周计划 · 项目 · 看板 · 日历 · 统计 · 目标 · 速记，一套自用的个人生产力工作台。

**纯静态 + 零后端 + 数据本机加密**。部署成静态站点后，任何设备打开网址都能用；但你的数据**只存在打开页面的那个浏览器里，用口令加密后落盘，不经过任何服务器**。

---

## 一、它是什么结构

```
personal-workspace/
├── public/              # 源码（原生 JS，无框架无构建即可直接跑）
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── utils.js     # 工具、日期、弹窗
│       ├── icons.js     # SVG 图标
│       ├── store.js     # 数据层（只经 Vault 落盘）
│       ├── vault.js     # ★ 本地保险箱：AES-256-GCM 加密
│       ├── charts.js    # 手写 SVG 图表
│       ├── app.js       # 路由与全局
│       └── views/       # 9 个页面
├── build.js             # 构建：合并 + 压缩混淆 + 注入 CSP → dist/
├── dist/                # ★ 构建产物，直接推 GitHub Pages 的就是它
├── server.js + lib/     # 可选的自托管版（带账号与多设备同步），当前默认不用
└── package.json         # 零运行时依赖
```

## 二、本地预览

```bash
cd personal-workspace
npm start          # node server.js，然后打开 http://127.0.0.1:3000
```

或者不启服务，直接构建后静态预览：

```bash
node build.js      # 产出 dist/
cd dist && python3 -m http.server 8080
```

> ⚠️ 加密功能依赖浏览器的 Web Crypto API。通过 `http://` 非 localhost 访问时浏览器会禁用它，请用 `https://` 或 `localhost` 打开。

## 三、上线（随时随地用手机打开）

### 方式一：GitHub Pages（推荐，免费 + 自带 HTTPS）

```bash
cd personal-workspace
node build.js                  # 先构建出 dist/

# 把 dist/ 单独推到 gh-pages 分支
cd dist
git init && git add -A && git commit -m "deploy"
git branch -M gh-pages
git remote add origin git@github.com:<你的用户名>/<仓库名>.git
git push -f origin gh-pages
```

然后到仓库 **Settings → Pages → Source** 选 `gh-pages` 分支，根目录 `/`。
几十秒后即可访问 `https://<用户名>.github.io/<仓库名>/`。

手机打开这个网址 → 设一个口令 → 开始用。**加到主屏幕后跟 App 一样**。

### 方式二：Cloudflare Pages / Vercel / Netlify

构建命令填 `node build.js`，输出目录填 `dist`，其余默认即可。

### 方式三：自己的服务器

```bash
rsync -av dist/ user@server:/var/www/desk/
```

```nginx
server {
    listen 443 ssl http2;
    server_name desk.yourdomain.com;
    ssl_certificate     /path/fullchain.pem;
    ssl_certificate_key /path/privkey.pem;
    root /var/www/desk;
    location / { try_files $uri $uri/ /index.html; }
}
```

> 国内服务器绑定域名需先完成 ICP 备案。

## 四、加密机制（为什么数据出不去）

| 环节 | 做法 |
| --- | --- |
| 加密算法 | AES-256-GCM（带完整性校验，密文被篡改会直接解密失败） |
| 密钥来源 | 你的口令 → PBKDF2-SHA256，25 万次迭代派生 |
| 密钥存放 | **只在内存里**，锁屏 / 关页面即销毁，从不写入 localStorage |
| 落盘内容 | 只有 `{v, salt, iv, data, hint, updatedAt}`——`data` 是密文，`salt`/`iv` 是随机数 |
| 未解锁时 | 内存里连一份明文数据都没有，页面也不渲染 |
| 网络 | 代码里**没有任何** `fetch` / `XMLHttpRequest` / `WebSocket`；CSP 写死 `connect-src 'none'`，从浏览器策略层彻底禁止一切网络请求 |

### 代码混淆

`build.js` 会把 16 个源文件合并后用 Terser 压缩混淆（`mangle.toplevel`），变量名、函数名、属性路径全部打乱：

```
脚本 144.5 KB → 109.8 KB（压缩 24%）
```

「混淆」不等于「防破解」——前端代码在用户手里，理论上总归能被逆向。它的作用是**提高直接读懂、批量扒取的门槛**，真正保护数据的是上面的加密层：即使有人把整个 `app.js` 拿走，没有你的口令也解不开 localStorage 里的密文。

### 你可以自己验证「数据不出本机」

1. 打开页面，按 `F12` → **Network** 面板 → 刷新 → 除了 `index.html` / `app.js` / `styles.css` 三个文件，**不会有任何 XHR / Fetch 请求**
2. **Console** 里输入 `fetch('https://example.com')` → 会被 CSP 拦下并报错（说明策略层已封死）
3. **Application → Local Storage** 里只有 `pw-vault-v1`，值是一长串看不懂的密文，**搜不到任何中文待办内容**
4. 断网后再刷新 → 功能完全正常，数据照样能读写

## 五、功能

| 模块 | 说明 |
| --- | --- |
| 今日概览 | 今日待办、逾期提醒、项目进度、近 14 天趋势 |
| 待办 | 6 种筛选视图 + 四象限 + 番茄钟（25 分钟自动记工时） |
| 周计划 | 每周目标 + 模板一键套用 + 周末复盘 + 历史归档 + Markdown 导出 |
| 项目 | 卡片列表、详情页、任务与里程碑、进度自动计算 |
| 看板 | 四列拖拽（待办 / 进行中 / 待验收 / 已完成），支持跨项目聚合 |
| 日历 | 月历聚合待办、任务、项目节点 |
| 统计分析 | 月度 KPI、趋势、分布、贡献热力图、项目健康度 |
| 目标 OKR | 周期、指标、进度更新留痕 |
| 速记 | 自动保存的轻量笔记 |
| 数据与设置 | 口令管理、自动锁定、JSON 备份 / 恢复、CSV、周报月报、打印存 PDF |

## 六、安全与备份

### ⚠️ 三条必须知道的事

1. **口令无法找回。** 没有服务器、没有「忘记密码」邮件。口令丢了 = 数据永久解不开，只能清空重来。
   → 建议设一个**你肯定不会忘**的口令，并在设置页填上口令提示（提示会明文存在本机）。

2. **清浏览器数据 = 清应用数据。** 用无痕窗口、手动清除站点数据、换浏览器，数据都不会跟着走。
   → 请定期 `数据与设置 → 导出备份` 保存 JSON，换设备时用「从备份导入」恢复。

3. **加密只防「别人拿到你的设备/备份文件」，不防「设备本身已中毒」。**
   如果电脑上有恶意软件能读内存，任何本地加密都拦不住。日常保持系统更新即可。

### 自动锁定

`数据与设置` 里可设 5 / 15 / 30 / 60 / 120 分钟无操作自动锁定，默认 30 分钟；也可以关掉。
切到后台标签页、关闭页面前会自动落盘加密，不用担心丢数据。

### 备份建议

- **每周一次**：`数据与设置 → 导出备份` → 存到网盘 / 移动硬盘
- 备份文件是**明文 JSON**（没加密），请存在你信得过的地方
- 迁移新设备：新设备打开页面 → 设口令 → `从备份导入`

### 关于口令强度

密钥走 PBKDF2 25 万次迭代，暴力破解成本很高，但口令本身仍是唯一入口。
建议 12 位以上、别和其他网站用同一个。

---

## 附录：可选的自托管版（带账号同步）

仓库里的 `server.js` + `lib/` 是一套完整的 Node 后端（邮箱密码注册、scrypt 哈希、会话、多设备同步与冲突合并）。
当前**默认不使用**，仅保留代码以备日后需要「多设备自动同步」时启用：

```bash
npm start    # 打开 http://127.0.0.1:3000
```

部署到 Render / Fly.io 的配置（`render.yaml` / `fly.toml` / `Procfile`）也一并保留。

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `WS_DATA_DIR` | `./data` | 数据目录 |
| `WS_INVITE_CODE` | 空 | 设置后注册必须填对邀请码，避免陌生人占用你的站点 |

> 注意：自托管版走的是服务端账号体系，与本 README 主体的「本机加密」模式是两条独立路线，二者的数据不互通。
