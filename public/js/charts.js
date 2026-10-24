/* ===== 轻量 SVG 图表（无外部依赖） ===== */
const Charts = {
  W: 760,
  seq: 0,

  /** 生成平滑曲线路径（Catmull-Rom 转贝塞尔） */
  smooth(pts, t = 0.18) {
    if (!pts.length) return '';
    if (pts.length < 3) return 'M' + pts.map(p => p.join(',')).join(' L');
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * t, c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t, c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  },

  niceMax(v) {
    if (v <= 5) return 5;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / (p / 2)) * (p / 2);
  },

  /** 折线/面积图 */
  line(labels, series, opts = {}) {
    const h = opts.height || 220;
    const pad = { l: 34, r: 14, t: 14, b: 26 };
    const w = Charts.W;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const max = Charts.niceMax(Math.max(1, ...series.flatMap(s => s.data)));
    const n = labels.length;
    const x = i => pad.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
    const y = v => pad.t + ih - (v / max) * ih;

    let g = '';
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + ih * i / 4;
      g += `<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${w - pad.r}" y2="${yy.toFixed(1)}" stroke="var(--border)" stroke-width="1" ${i === 4 ? '' : 'stroke-dasharray="3 4"'}/>`;
      g += `<text x="${pad.l - 9}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--text-faint)">${Math.round(max * (4 - i) / 4)}</text>`;
    }

    let defs = '', paths = '';
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => [x(i), y(v)]);
      const line = Charts.smooth(pts);
      const gid = `grad${Charts.seq++}`;
      if (s.area !== false) {
        defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${s.color}" stop-opacity=".22"/>
          <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
        paths += `<path d="${line} L${x(n - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z" fill="url(#${gid})"/>`;
      }
      paths += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      s.data.forEach((v, i) => {
        paths += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="var(--surface)" stroke="${s.color}" stroke-width="2">
          <title>${U.esc(labels[i])}｜${U.esc(s.name)}：${v}</title></circle>`;
      });
    });

    const step = Math.max(1, Math.ceil(n / 12));
    let xl = '';
    labels.forEach((l, i) => {
      if (i % step === 0 || i === n - 1) {
        xl += `<text x="${x(i).toFixed(1)}" y="${h - 7}" text-anchor="middle" font-size="10.5" fill="var(--text-faint)">${U.esc(l)}</text>`;
      }
    });

    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="xMidYMid meet">
      <defs>${defs}</defs>${g}${paths}${xl}</svg>`;
  },

  /** 柱状图 */
  bars(labels, values, color = '#4f46e5', opts = {}) {
    const h = opts.height || 200;
    const pad = { l: 34, r: 14, t: 14, b: 26 };
    const w = Charts.W;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const max = Charts.niceMax(Math.max(1, ...values));
    const n = values.length;
    const bw = Math.max(5, Math.min(34, iw / n * 0.52));
    const gid = `grad${Charts.seq++}`;

    let g = '';
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + ih * i / 4;
      g += `<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${w - pad.r}" y2="${yy.toFixed(1)}" stroke="var(--border)" stroke-width="1" ${i === 4 ? '' : 'stroke-dasharray="3 4"'}/>`;
      g += `<text x="${pad.l - 9}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="var(--text-faint)">${Math.round(max * (4 - i) / 4)}</text>`;
    }
    let bars = '';
    values.forEach((v, i) => {
      const cx = pad.l + (i + 0.5) * iw / n;
      const bh = (v / max) * ih;
      if (v > 0) {
        bars += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(pad.t + ih - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(4, bw / 2)}" fill="url(#${gid})">
          <title>${U.esc(labels[i])}：${v}</title></rect>`;
        bars += `<text x="${cx.toFixed(1)}" y="${(pad.t + ih - bh - 5).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="var(--text-dim)">${v}</text>`;
      }
    });
    const step = Math.max(1, Math.ceil(n / 12));
    let xl = '';
    labels.forEach((l, i) => {
      if (i % step === 0 || i === n - 1) {
        xl += `<text x="${(pad.l + (i + 0.5) * iw / n).toFixed(1)}" y="${h - 7}" text-anchor="middle" font-size="10.5" fill="var(--text-faint)">${U.esc(l)}</text>`;
      }
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".95"/>
        <stop offset="100%" stop-color="${color}" stop-opacity=".55"/></linearGradient></defs>
      ${g}${bars}${xl}</svg>`;
  },

  /** 环形图 */
  donut(items, opts = {}) {
    const size = opts.size || 168, sw = opts.stroke || 20;
    const r = (size - sw) / 2, c = size / 2;
    const total = items.reduce((a, b) => a + b.value, 0);
    if (!total) {
      return `<div class="empty" style="padding:26px">
        <div class="empty-ico">${U.icon('chart', 21)}</div>暂无数据</div>`;
    }
    const circ = 2 * Math.PI * r;
    const gap = total > 1 && items.length > 1 ? 2 : 0;
    let off = 0, seg = '';
    items.forEach(it => {
      const len = Math.max(0, it.value / total * circ - gap);
      seg += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${sw}"
        stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
        transform="rotate(-90 ${c} ${c})" stroke-linecap="round">
        <title>${U.esc(it.label)}：${it.value}</title></circle>`;
      off += it.value / total * circ;
    });
    const svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${seg}
      <text x="${c}" y="${c - 1}" text-anchor="middle" font-size="26" font-weight="650" fill="var(--text)" letter-spacing="-1">${total}</text>
      <text x="${c}" y="${c + 17}" text-anchor="middle" font-size="11" fill="var(--text-faint)">合计</text></svg>`;
    const legend = `<div style="display:flex;flex-direction:column;gap:9px;flex:1;min-width:130px">` +
      items.map(it => {
        const pct = Math.round(it.value / total * 100);
        return `<div style="display:flex;align-items:center;gap:9px;font-size:12.5px">
          <i class="dot" style="background:${it.color}"></i>
          <span style="color:var(--text-dim);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${U.esc(it.label)}</span>
          <b style="font-variant-numeric:tabular-nums">${it.value}</b>
          <span style="color:var(--text-faint);width:34px;text-align:right;font-variant-numeric:tabular-nums">${pct}%</span>
        </div>`;
      }).join('') + `</div>`;
    return `<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">${svg}${legend}</div>`;
  },

  /** 横向进度条列表 */
  hbars(items) {
    if (!items.length) {
      return `<div class="empty" style="padding:22px">
        <div class="empty-ico">${U.icon('inbox', 21)}</div>暂无数据</div>`;
    }
    return items.map(it => `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;gap:10px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:8px;font-weight:500">
            <i class="dot" style="background:${it.color || 'var(--primary)'}"></i> ${U.esc(it.label)}
          </span>
          <span style="color:var(--text-faint);flex-shrink:0;font-variant-numeric:tabular-nums">${it.tip || it.value + '%'}</span>
        </div>
        <div class="progress"><div style="width:${Math.min(100, it.value)}%;background:${it.color || 'var(--primary)'}"></div></div>
      </div>`).join('');
  },

  /** 贡献热力图 */
  heat(countMap, opts = {}) {
    const weeks = opts.weeks || 30;
    const today = U.today();
    const start = U.startOfWeek(U.addDays(today, -(weeks * 7 - 1)));
    const cols = [];
    let monthMarks = '';
    let lastMonth = -1;
    for (let wi = 0; wi < weeks; wi++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const day = U.addDays(start, wi * 7 + d);
        const n = countMap[day] || 0;
        const lv = n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
        const bg = ['var(--surface-3)', '#c7d2fe', '#a5b4fc', '#818cf8', '#4f46e5'][lv];
        col.push(`<i class="heat-cell" style="background:${bg}" title="${day}：${n} 项"></i>`);
      }
      const m = U.parse(U.addDays(start, wi * 7)).getMonth();
      monthMarks += `<span>${m !== lastMonth ? (m + 1) + '月' : ''}</span>`;
      lastMonth = m;
      cols.push(`<div class="heat-col">${col.join('')}</div>`);
    }
    return `<div style="overflow-x:auto;padding-bottom:4px">
      <div class="heat-months">${monthMarks}</div>
      <div class="heat">${cols.join('')}</div>
      <div class="legend" style="margin-top:10px;justify-content:flex-end;gap:5px">
        <span style="margin-right:4px">少</span>
        <i class="heat-cell" style="background:var(--surface-3)"></i>
        <i class="heat-cell" style="background:#c7d2fe"></i>
        <i class="heat-cell" style="background:#a5b4fc"></i>
        <i class="heat-cell" style="background:#818cf8"></i>
        <i class="heat-cell" style="background:#4f46e5"></i>
        <span style="margin-left:4px">多</span>
      </div>
    </div>`;
  }
};
