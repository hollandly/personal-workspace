#!/usr/bin/env node
/**
 * 构建发布版：合并 + 压缩混淆前端脚本，产出 dist/
 *
 *   node build.js
 *
 * 说明：
 * - 前端代码无法真正"加密"（浏览器必须能读懂才能执行），这里做的是压缩 + 变量名混淆，
 *   让代码难以直接阅读；真正保护数据的是 AES-256-GCM 本地加密（见 js/vault.js）。
 * - dist/index.html 增加了 CSP：connect-src 'none'，从策略层面禁止页面发起任何网络请求，
 *   任何人都可以用浏览器开发者工具验证数据没有外发。
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

/* 脚本加载顺序（顶层 const 跨文件共享，顺序不可变） */
const FILES = [
  'js/utils.js',
  'js/icons.js',
  'js/store.js',
  'js/vault.js',
  'js/charts.js',
  'js/views/dashboard.js',
  'js/views/todos.js',
  'js/views/week.js',
  'js/views/projects.js',
  'js/views/kanban.js',
  'js/views/calendar.js',
  'js/views/stats.js',
  'js/views/goals.js',
  'js/views/notes.js',
  'js/views/settings.js',
  'js/app.js'
];

function loadTerser() {
  const candidates = [
    'terser',
    '/Users/linpengchen/.workbuddy/binaries/node/workspace/node_modules/terser'
  ];
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* 继续尝试 */ }
  }
  console.error('未找到 terser。请先安装：npm i terser');
  process.exit(1);
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",            // 禁止一切网络请求（fetch / XHR / WebSocket）
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');

(async () => {
  const { minify } = loadTerser();

  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  /* 1. 合并脚本 */
  const merged = FILES.map(f => {
    const p = path.join(SRC, f);
    if (!fs.existsSync(p)) throw new Error('缺少文件：' + f);
    return `/* ${f} */\n` + fs.readFileSync(p, 'utf8');
  }).join('\n;\n');

  /* 2. 压缩混淆 */
  const result = await minify(merged, {
    compress: { passes: 2, drop_console: true, drop_debugger: true },
    mangle: { toplevel: true },
    format: { comments: false, ascii_only: false }
  });
  if (result.error) throw result.error;
  const code = result.code;

  const raw = Buffer.byteLength(merged, 'utf8');
  const min = Buffer.byteLength(code, 'utf8');

  fs.writeFileSync(path.join(OUT, 'app.js'), code, 'utf8');

  /* 3. 复制样式 */
  fs.copyFileSync(path.join(SRC, 'styles.css'), path.join(OUT, 'styles.css'));

  /* 4. 生成 index.html：单个脚本 + CSP */
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  html = html.replace(/<script src="js\/[^"]+"><\/script>\s*/g, '');
  html = html.replace('</head>', `  <meta http-equiv="Content-Security-Policy" content="${CSP}">\n</head>`);
  html = html.replace('</body>', '  <script src="app.js"></script>\n</body>');
  fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');

  console.log('构建完成 → dist/');
  console.log(`  脚本  ${(raw / 1024).toFixed(1)} KB → ${(min / 1024).toFixed(1)} KB（压缩 ${Math.round((1 - min / raw) * 100)}%）`);
  console.log('  已注入 CSP：connect-src none（页面禁止任何网络请求）');
  console.log('  把 dist/ 的内容推到 GitHub Pages 即可在线使用');
})().catch(e => { console.error('构建失败：', e.message); process.exit(1); });
