# 个人工作台

待办 · 周计划 · 项目 · 看板 · 日历 · 统计 · 目标 · 速记，一套自用的个人生产力工作台。
支持账号登录与多设备同步，手机 / 电脑 / 平板都能用。

## 快速开始

```bash
cd personal-workspace
npm start            # 等价于 node server.js
# 打开 http://127.0.0.1:3000
```

零依赖，无需 `npm install`（`package.json` 里没有任何运行时依赖）。

## 目录结构

```
personal-workspace/
├── server.js            # HTTP 服务：静态托管 + 账号 + 数据同步 API
├── lib/
│   ├── db.js            # JSON 持久化（data/db.json）
│   └── auth.js          # scrypt 密码哈希 + 会话
├── public/              # 前端（原生 JS，无构建）
│   ├── index.html
│   ├── styles.css
│   └── js/              # utils / icons / store / sync / charts + views/*
└── data/                # 运行时数据（已 gitignore，请定期备份）
```

## 功能

| 模块 | 说明 |
| --- | --- |
| 今日概览 | 今日待办、逾期、项目进度、近 14 天趋势 |
| 待办 | 6 种筛选视图 + 四象限 + 番茄钟（25 分钟自动记工时） |
| 周计划 | 每周目标 + 模板一键套用 + 周五复盘 + 历史归档 + Markdown 导出 |
| 项目 | 卡片列表、详情页、任务与里程碑、进度自动计算 |
| 看板 | 四列拖拽（待办 / 进行中 / 待验收 / 已完成），支持跨项目聚合 |
| 日历 | 月历聚合待办、任务、项目节点 |
| 统计分析 | 月度 KPI、趋势、分布、贡献热力图、项目健康度 |
| 目标 OKR | 周期、指标、进度更新留痕 |
| 速记 | 自动保存的轻量笔记 |
| 数据与设置 | JSON 备份 / 恢复、CSV、周报月报、打印存 PDF、账户管理 |

## 账号与同步

- 邮箱 + 密码注册登录（密码用 scrypt 加盐哈希，永不明文存储）
- 登录后数据每 4 秒防抖推送到服务端；切回页面 / 联网时自动拉取
- 多设备冲突时提供**智能合并 / 以云端为准 / 以本机为准**三种选择
- 未登录也能正常使用，数据只存在当前浏览器（localStorage）
- 改密码会踢掉其他设备的登录；注销账号会一并删除云端数据

## 上线部署（随时随地用手机访问）

### ⚠️ 先说结论：GitHub Pages 不够用

**GitHub Pages 只能托管静态文件，跑不了 Node 后端**，所以推到 GitHub Pages 之后：

- ✅ 页面能打开，界面、待办、看板都能用
- ❌ 没有账号系统，不能登录，也**不会同步**——数据只存在打开页面的那个浏览器里，换台设备就是空的

要做到「在外面用手机登录，数据和家里电脑一致」，必须让 `server.js` 跑起来。推荐下面这套组合：**代码放 GitHub（版本管理）+ 部署到 Render / Fly.io / Zeabur（提供公网服务）**。

### 方式一：GitHub → Render（最省事）

1. 在 GitHub 新建一个空仓库（不要勾选 README / .gitignore）
2. 在本目录执行：

```bash
git remote add origin git@github.com:<你的用户名>/<仓库名>.git
git branch -M main
git push -u origin main
```

3. 打开 [Render](https://render.com) → **New → Blueprint** → 选择刚推上去的仓库 → Apply
   （仓库里已有 `render.yaml`，会自动带上端口、数据盘和健康检查配置）
4. 部署完会得到一个 `https://personal-workspace-xxxx.onrender.com` 的链接，手机直接打开就能注册登录

> 数据持久化：蓝图里申请了 1GB 磁盘挂到 `/var/data`，对应 starter 档位。
> 免费档没有磁盘，实例重启后账号数据会丢，个人长期使用建议开 starter。

### 方式二：GitHub → Fly.io

```bash
fly launch --no-deploy     # 按提示确认，会自动读取 fly.toml
fly deploy                 # 部署
fly apps open              # 打开链接
```

配置里已声明 Tokyo 区域 + 1GB 持久化卷挂载到 `/data`。

### 方式三：部署到自己的服务器

```bash
# 1. 上传目录（不需要 node_modules）
rsync -av --exclude data ./ user@server:/opt/workspace/

# 2. 用 pm2 守护
cd /opt/workspace && pm2 start server.js --name workspace

# 或用 systemd
# /etc/systemd/system/workspace.service
# [Service]
# Environment=PORT=3000
# Environment=WS_DATA_DIR=/var/lib/workspace
# Environment=WS_INVITE_CODE=你的邀请码
# ExecStart=/usr/bin/node /opt/workspace/server.js
# Restart=always
```

### 绑定自己的域名

用 Nginx 反代并申请证书即可（国内服务器需先完成 ICP 备案）：

```nginx
server {
    listen 443 ssl http2;
    server_name desk.yourdomain.com;

    ssl_certificate     /path/fullchain.pem;
    ssl_certificate_key /path/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;   # 必须：用于下发 Secure Cookie
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
```

数据文件默认在项目 `data/db.json`，可用 `WS_DATA_DIR` 环境变量改到独立目录（便于备份和升级）。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口，部署平台会自动注入 |
| `WS_DATA_DIR` | `./data` | 数据目录，部署时指向持久化卷 |
| `WS_INVITE_CODE` | 空 | **建议设置**。设置后注册必须填对邀请码，避免陌生人注册占用你的站点 |

## 临时公网访问（不部署也能试）

在家里电脑上跑着服务时，用 Cloudflare Tunnel 可以临时拿到一个公网 https 链接，手机马上能用（电脑关机后失效）：

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

## 安全与备份

- 密码：scrypt（N=16384）加盐哈希，登录失败限流（同 IP + 邮箱 15 分钟内 8 次）
- 会话：32 字节随机 token，HttpOnly + SameSite=Lax + HTTPS 环境下自动 Secure，7 天有效并滑动续期
- 数据隔离：所有读写都绑定当前登录用户，用户之间互不可见
- 备份：`数据设置 → 导出备份`，或直接复制 `data/db.json`

> 提醒：账号数据存放在应用目录下，重装或迁移服务时请记得带走 `data/` 目录。
