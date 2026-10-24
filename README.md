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

## 上线部署

### 方式一：WorkBuddy 发布应用（推荐）

直接用客户端的「发布应用」入口发布本目录即可。服务已按要求监听 `PORT` 环境变量并绑定 `0.0.0.0`。

发布时建议使用简短的链接前缀，例如：

```
domainPrefix: workspace      →  https://workspace.<平台域名>
```

> 注意：发布工具会复用该目录已记录的应用与链接，重复发布是覆盖更新，链接保持不变。

### 方式二：部署到自己的服务器

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

## 安全与备份

- 密码：scrypt（N=16384）加盐哈希，登录失败限流（同 IP + 邮箱 15 分钟内 8 次）
- 会话：32 字节随机 token，HttpOnly + SameSite=Lax + HTTPS 环境下自动 Secure，7 天有效并滑动续期
- 数据隔离：所有读写都绑定当前登录用户，用户之间互不可见
- 备份：`数据设置 → 导出备份`，或直接复制 `data/db.json`

> 提醒：账号数据存放在应用目录下，重装或迁移服务时请记得带走 `data/` 目录。
