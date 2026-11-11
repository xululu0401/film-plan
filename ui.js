/* 这张相纸够不够 · ui.js
 * 形态：结论票（票据式）+ 清点单（逐行可复算）+ 照片墙按真实比例排版图。
 * 纯原生 DOM；数字输入用 text + inputmode，校验交给 core.validate 单一来源。
 */
'use strict';
(function () {
  var C = window.AppCore;
  var LS_KEY = 'film-plan-v1';
  var state = { cfg: null, res: null, scenario: 'default' };
  window.__exports = 0;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = String(txt);
    return e;
  }

  /* ═══ 状态 ═══ */
  function freshCfg() { return JSON.parse(JSON.stringify(C.DEFAULTS)); }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.cfg) return null;
      return o;
    } catch (e) { return null; }
  }
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ cfg: state.cfg, scenario: state.scenario, v: 1 })); }
    catch (e) { /* 隐私模式会失败，不影响使用 */ }
  }

  /* ═══ 表单 ═══ */
  var TEXT_KEYS = ['label'];
  var NUM_KEYS = ['haveShots', 'paperW', 'paperH', 'packShots', 'packPrice', 'wantShots',
    'wallW', 'wallH', 'frameGap', 'gapMM',
    'albumSheetPocket', 'albumPackSheets', 'albumBookSheets', 'printShopPrice', 'reservePacks'];

  function setInput(k, v) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-k="' + k + '"]'), function (n) {
      if (n.tagName === 'INPUT') {
        n.value = (v === null || v === undefined) ? '' : String(v);
        n.classList.remove('bad');
      } else if (n.tagName === 'SELECT') {
        n.value = String(v);
      } else if (n.tagName === 'BUTTON') {
        n.setAttribute('aria-pressed', String(n.getAttribute('data-v')) === String(v) ? 'true' : 'false');
      }
    });
  }

  function readForm() {
    var cfg = {};
    Object.keys(C.DEFAULTS).forEach(function (k) { cfg[k] = C.DEFAULTS[k]; });
    Object.keys(state.cfg || {}).forEach(function (k) { if (k in cfg) cfg[k] = state.cfg[k]; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (n) {
      var k = n.getAttribute('data-k');
      if (!(k in cfg)) return;
      if (n.tagName === 'INPUT') { cfg[k] = n.value; return; }
      if (n.tagName === 'SELECT') { cfg[k] = n.value; return; }
      if (n.tagName === 'BUTTON') { return; }   // chip 单独读，见下
    });
    // chip 组：一个按钮代表一个取值（不能用「按下=真」折算）
    ['paperKind', 'albumKind'].forEach(function (k) {
      var btn = document.querySelector('#chips-' + k + ' .chip[aria-pressed="true"]');
      if (btn) cfg[k] = btn.getAttribute('data-v');
    });
    var wb = document.querySelector('#chips-wantWall .chip[aria-pressed="true"]');
    cfg.wantWall = wb ? (wb.getAttribute('data-v') === 'true') : false;
    return cfg;
  }

  function syncChips(cfg) {
    ['paperKind', 'albumKind'].forEach(function (k) {
      Array.prototype.forEach.call(document.querySelectorAll('#chips-' + k + ' .chip'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-v') === String(cfg[k]) ? 'true' : 'false');
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#chips-wantWall .chip'), function (b) {
      b.setAttribute('aria-pressed', (b.getAttribute('data-v') === 'true') === !!cfg.wantWall ? 'true' : 'false');
    });
  }

  function syncVisibility(cfg) {
    $('sec-custom').classList.toggle('hidden', cfg.paperKind !== 'custom');
    $('sec-wallin').classList.toggle('hidden', !cfg.wantWall);
    var isSheet = cfg.albumKind === 'sheet';
    $('sec-packSheets').classList.toggle('hidden', !isSheet);
    $('sec-bookSheets').classList.toggle('hidden', isSheet);
    $('sec-wall').classList.toggle('hidden', !cfg.wantWall);
  }

  /* ═══ 照片墙按真实比例画 ═══ */
  function renderWall(res, cfg) {
    var box = $('wallgrid'), meta = $('wallmeta'), hint = $('wall-hint');
    box.innerHTML = ''; meta.innerHTML = '';
    var w = res.wall;
    if (!cfg.wantWall) { hint.textContent = '没开照片墙。'; box.style.display = 'none'; return; }
    box.style.display = '';
    if (!w.fits) {
      hint.textContent = '按现在的相框尺寸，这面墙连一张都放不下。';
      box.appendChild(el('div', 'spinner', '放不下：相框（含框）' + C.fmtNum(w.frameW, 1) + ' × ' + C.fmtNum(w.frameH, 1) +
        ' mm 比墙面 ' + C.fmtNum(cfg.wallW, 0) + ' × ' + C.fmtNum(cfg.wallH, 0) + ' mm 还大。'));
      return;
    }
    hint.textContent = '按真实比例排版：' + w.cols + ' 列 × ' + w.rows + ' 行（列距 ' + C.fmtNum(w.pitchW, 1) +
      ' mm、行距 ' + C.fmtNum(w.pitchH, 1) + ' mm），共 ' + w.count + ' 张。';
    // 可用宽度必须读**外层容器**，不能读格子自己：格子宽度是上一次渲染按比例算出来的，
    // 拿它当输入会让每次重画都缩一圈（本轮实测：反复 resize 后格子从 317 缩到 120，
    // 照片小到看不清，而且第一列之外的格子会被 overflow 裁掉）。
    var host = $('wallbox');
    var boxW = (host && host.clientWidth ? host.clientWidth : (box.parentElement ? box.parentElement.clientWidth : 320)) || 320;
    boxW = boxW - 20;   // 减掉 wallbox 自身左右内边距
    var MAXW = Math.max(120, Math.min(520, boxW - 14));
    var MAXH = Math.max(120, Math.min(300, Math.round(MAXW * 0.62)));
    var k = Math.min(MAXW / Math.max(cfg.wallW, 1), MAXH / Math.max(cfg.wallH, 1));
    if (!isFinite(k) || k <= 0) k = 0.05;
    // 用固定像素列宽 + 固定像素缝，并让容器宽高按同一套数字反算：
    // 这样「画出来的格子」与「容器尺寸」严格一致，最后一列不会探出去
    // （本轮实测：容器宽用 usedW×k、列宽用 pitchW×k，两者口径不同，最后一列外溢 7px）
    var fw = Math.max(1.5, w.dispW * k), fh = Math.max(1.5, w.dispH * k);
    var gp = Math.max(0.8, cfg.gapMM * k);
    box.style.gridTemplateColumns = 'repeat(' + w.cols + ',' + fw.toFixed(2) + 'px)';
    box.style.gridAutoRows = fh.toFixed(2) + 'px';
    box.style.columnGap = gp.toFixed(2) + 'px';
    box.style.rowGap = gp.toFixed(2) + 'px';
    box.style.width = (w.cols * fw + (w.cols - 1) * gp).toFixed(2) + 'px';
    box.style.height = (w.rows * fh + (w.rows - 1) * gp).toFixed(2) + 'px';
    for (var i = 0; i < Math.min(w.count, 600); i++) {
      var f = el('div', 'fr');
      f.style.width = fw.toFixed(2) + 'px';
      f.style.height = fh.toFixed(2) + 'px';
      box.appendChild(f);
    }
    [[w.frameW + ' × ' + w.frameH + ' mm 相框（含框）'],
     ['占墙 ' + C.fmtInt(w.usedW) + ' × ' + C.fmtInt(w.usedH) + ' mm'],
     ['左右剩 ' + C.fmtInt(w.freeW) + ' mm、上下剩 ' + C.fmtInt(w.freeH) + ' mm'],
     ['占墙面 ' + C.fmtPct(w.fillPct, 1)],
     ['铺满要 ' + w.needShots + ' 张']].forEach(function (t, i) {
      meta.appendChild(el('span', null, (i === 0 ? '' : '· ') + t[0]));
    });
  }

  function renderPaperCompare(cfg) {
    var box = $('papercmp'); box.innerHTML = '';
    var mx = Math.max(cfg.paperW, cfg.paperH, 54, 86, 108);
    ['mini', 'square', 'wide'].forEach(function (key) {
      var f = C.PAPER_FORMATS[key];
      var on = (cfg.paperKind === key) || (cfg.paperKind === 'custom' && cfg.paperW === f.w && cfg.paperH === f.h);
      var wrap = el('div', 'pc' + (on ? ' on' : ''));
      var r = el('div', 'r');
      r.style.width = (f.w / mx * 70).toFixed(1) + 'px';
      r.style.height = (f.h / mx * 70).toFixed(1) + 'px';
      wrap.appendChild(r);
      wrap.appendChild(el('div', null, f.label));
      wrap.appendChild(el('div', null, f.w + '×' + f.h + ' mm'));
      box.appendChild(wrap);
    });
    var cu = el('div', 'pc' + (cfg.paperKind === 'custom' ? ' on' : ''));
    var rr = el('div', 'r');
    rr.style.width = (Math.min(cfg.paperW, mx) / mx * 70).toFixed(1) + 'px';
    rr.style.height = (Math.min(cfg.paperH, mx) / mx * 70).toFixed(1) + 'px';
    cu.appendChild(rr);
    cu.appendChild(el('div', null, '你现在这个'));
    cu.appendChild(el('div', null, C.fmtNum(cfg.paperW, 0) + '×' + C.fmtNum(cfg.paperH, 0) + ' mm'));
    box.appendChild(cu);
  }

  /* ═══ 渲染 ═══ */
  function render() {
    var res = state.res;

    // 错误
    if (!res.ok) {
      $('sec-err').classList.remove('hidden');
      var eb = $('err-body');
      while (eb.firstChild) eb.removeChild(eb.firstChild);   // 彻底清空（innerHTML='' 在旧内容里会留残影）
      eb.appendChild(el('div', null, '这些地方要改一下（共 ' + res.errors.length + ' 处）：'));
      var ul = el('ul');
      res.errors.forEach(function (e) { ul.appendChild(el('li', null, e.msg)); });
      eb.appendChild(ul);
      $('sec-verdict').classList.add('hidden');
      $('sec-ledger').classList.add('hidden');
      $('sec-advice').classList.add('hidden');
      $('sec-sens').classList.add('hidden');
      $('sec-selfcheck').classList.add('hidden');
      $('sec-wall').classList.add('hidden');
      ['d-packs', 'd-usable', 'd-spend', 'd-real'].forEach(function (id) { $(id).textContent = '—'; });
      $('d-verdict').textContent = '输入还没填对';
      return;
    }
    ['sec-verdict', 'sec-ledger', 'sec-advice', 'sec-sens', 'sec-selfcheck'].forEach(function (id) {
      $(id).classList.remove('hidden');
    });
    $('sec-err').classList.add('hidden');
    // 成功时也要清空错误区：否则它虽然被隐藏，文本还留在 DOM 里，
    // 读 innerText 的断言会继续读到上一条已经修好的错误（本轮实测踩到）
    var eb2 = $('err-body');
    while (eb2.firstChild) eb2.removeChild(eb2.firstChild);
    var cfg = res.cfg;
    syncChips(cfg);
    syncVisibility(cfg);

    // 结论票
    var tk = $('ticket');
    tk.className = 'ticket ' + res.verdict.level;
    $('v-title').textContent = res.verdict.title;
    $('v-why').textContent = res.verdict.why;

    // 读数
    var kb = $('kpis'); kb.innerHTML = '';
    res.kpis.forEach(function (k) {
      var d = el('div', 'ro');
      d.appendChild(el('div', 'l', k.label));
      d.appendChild(el('div', 'v', k.value));
      if (k.sub) d.appendChild(el('div', 's', k.sub));
      kb.appendChild(d);
    });

    // 清点单
    var tb = $('ledger-body'); tb.innerHTML = '';
    var lastSec = null;
    res.lines.forEach(function (L) {
      if (L.sec !== lastSec) {
        lastSec = L.sec;
        var sr = el('tr', 'secrow');
        var td0 = el('td', null, L.sec); td0.colSpan = 3;
        sr.appendChild(td0); tb.appendChild(sr);
      }
      var tr = el('tr');
      tr.appendChild(el('td', 'k', L.k));
      tr.appendChild(el('td', 'v', L.v));
      tr.appendChild(el('td', 'n', L.note || ''));
      tb.appendChild(tr);
    });

    // 建议
    var ab = $('advice-body'); ab.innerHTML = '';
    if (!res.advice.length) {
      ab.appendChild(el('div', 'spinner', '按现在这组数字，没有能明显改善的单项改动。'));
    }
    res.advice.forEach(function (a) {
      var d = el('div', 'adv');
      d.appendChild(el('div', 't', a.title));
      d.appendChild(el('div', 'b', a.body));
      var row = el('div', 'btnrow');
      var b = el('button', 'btn primary', '一键采用');
      b.type = 'button';
      b.addEventListener('click', function () {
        Object.keys(a.patch).forEach(function (k) {
          state.cfg[k] = a.patch[k];
          setInput(k, a.patch[k]);
        });
        recalc();
      });
      row.appendChild(b); d.appendChild(row);
      ab.appendChild(d);
    });

    // 自检
    var scb = $('sc-body'); scb.innerHTML = '';
    var pass = res.selfChecks.filter(function (x) { return x.ok; }).length;
    $('sc-count').textContent = pass + ' / ' + res.selfChecks.length + ' 通过';
    res.selfChecks.forEach(function (s) {
      var d = el('div', 'chk ' + (s.ok ? 'pass' : 'fail'));
      d.appendChild(el('span', 'm', s.ok ? 'PASS' : 'FAIL'));
      var t = el('span', 't');
      t.appendChild(el('span', 'n', s.name));
      if (s.detail) t.appendChild(el('span', 'd', '（' + s.detail + '）'));
      d.appendChild(t);
      scb.appendChild(d);
    });

    // 照片墙与相纸尺寸
    renderWall(res, cfg);
    renderPaperCompare(cfg);

    // 敏感性
    var sb = $('sens-body'); sb.innerHTML = '';
    C.sensitivity(cfg).forEach(function (r) {
      var tr = el('tr');
      var dir = r.delta > 0 ? '↑' : '↓';
      tr.appendChild(el('td', null, LABEL[r.field] + ' ' + dir + Math.abs(r.delta)));
      tr.appendChild(el('td', null, r.ok ? String(r.packs) : '—'));
      tr.appendChild(el('td', null, r.ok ? C.fmtNum(r.usable, 0) : '—'));
      tr.appendChild(el('td', null, r.ok ? '¥' + C.fmtMoney(r.spend) : '—'));
      tr.appendChild(el('td', null, r.ok && r.realPerShot !== null ? '¥' + C.fmtMoney(r.realPerShot) : '—'));
      tr.appendChild(el('td', null, r.verdict));
      sb.appendChild(tr);
    });

    // 边界说明
    var nb = $('notes'); nb.innerHTML = '';
    res.notes.forEach(function (n) { nb.appendChild(el('li', null, n)); });

    // 底部读数条
    var ch = res.plan.chosen;
    $('d-packs').textContent = ch.packs + ' 包';
    $('d-left').textContent = ch.leftovers + ' 张';
    $('d-usable').textContent = C.fmtNum(ch.usable, 0) + ' 张';
    $('d-spend').textContent = '¥' + C.fmtMoney(ch.spend);
    $('d-real').textContent = ch.realPerShot === null ? '—' : '¥' + C.fmtMoney(ch.realPerShot);
    $('d-verdict').textContent = res.verdict.title;
  }

  var LABEL = {
    wantShots: '计划拍摄张数', packPrice: '每包价格', packShots: '每包张数', haveShots: '已有张数',
    reservePacks: '备用包数', gapMM: '相框留缝'
  };

  function markErrors() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (n) { n.classList.remove('bad'); });
    var fe = state.res && state.res.fieldErr ? state.res.fieldErr : {};
    Object.keys(fe).forEach(function (k) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-k="' + k + '"]'), function (n) { n.classList.add('bad'); });
    });
  }

  function recalc() {
    var cfg = readForm();
    state.cfg = cfg;
    var res = C.compute(cfg);
    state.res = res;
    if (res.ok) state.cfg = res.cfg;   // 用归一化后的配置（预设画幅会覆盖宽高）
    render();
    markErrors();
    persist();
  }

  /* ═══ 导出 ═══ */
  function stamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function q(x) { return '"' + String(x === null || x === undefined ? '' : x).replace(/"/g, '""') + '"'; }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1200);
    window.__exports++;
  }

  function csvText() {
    var r = state.res, L = [];
    L.push('项目,' + q(r.cfg.label || ''));
    L.push('导出时间,' + stamp());
    L.push('');
    L.push('# 清点单');
    L.push('分区,条目,结果,说明');
    r.lines.forEach(function (x) { L.push([x.sec, x.k, x.v, x.note].map(q).join(',')); });
    L.push('');
    L.push('# 读数');
    r.kpis.forEach(function (k) { L.push([k.label, k.value, k.sub].map(q).join(',')); });
    L.push('');
    L.push('# 建议');
    r.advice.forEach(function (a) { L.push([a.title, a.body].map(q).join(',')); });
    L.push('');
    L.push('# 反推');
    r.reverse.forEach(function (a) { L.push([a.id, a.label, a.value, a.note].map(q).join(',')); });
    L.push('');
    L.push('# 证据（本次同一份计算输出）');
    r.evidence.forEach(function (e) { L.push([e.k, e.v].map(q).join(',')); });
    L.push('');
    L.push('# 自检');
    r.selfChecks.forEach(function (s) { L.push([s.ok ? 'PASS' : 'FAIL', s.name, s.detail].map(q).join(',')); });
    L.push('');
    L.push('# 边界');
    L.push(q('本页为估算，不联网、不查行情价、不内置任何品牌规格；默认值与内置场景都是虚构示例。'));
    return L.join('\n');
  }

  function mdText() {
    var r = state.res, L = [];
    L.push('# ' + (r.cfg.label || '相纸清点') + ' · 这张相纸够不够');
    L.push('');
    L.push('> 导出时间 ' + stamp() + '；本页为估算，不联网、不查行情价、不内置任何品牌规格；默认值与内置场景都是虚构示例。');
    L.push('');
    L.push('**' + r.verdict.title + '**');
    L.push('');
    L.push(r.verdict.why);
    L.push('');
    L.push('## 读数');
    L.push('| 指标 | 值 | 说明 |');
    L.push('|---|---|---|');
    r.kpis.forEach(function (k) { L.push('| ' + k.label + ' | ' + k.value + ' | ' + k.sub + ' |'); });
    L.push('');
    L.push('## 清点单');
    L.push('| 分区 | 条目 | 结果 | 说明 |');
    L.push('|---|---|---|---|');
    r.lines.forEach(function (x) { L.push('| ' + x.sec + ' | ' + x.k + ' | ' + x.v + ' | ' + (x.note || '') + ' |'); });
    L.push('');
    if (r.reverse.length) {
      L.push('## 反过来问');
      r.reverse.forEach(function (a) { L.push('- **' + a.label + '**：' + a.value + (a.note ? ' —— ' + a.note : '')); });
      L.push('');
    }
    if (r.advice.length) {
      L.push('## 下一步');
      r.advice.forEach(function (a) { L.push('- **' + a.title + '**：' + a.body); });
      L.push('');
    }
    L.push('## 本次计算的证据（与上面同一份输出）');
    r.evidence.forEach(function (e) { L.push('- ' + e.k + '：' + (e.v === null ? '—' : e.v)); });
    L.push('');
    L.push('## 算式自检（' + r.selfChecks.filter(function (s) { return s.ok; }).length + '/' + r.selfChecks.length + ' 通过）');
    r.selfChecks.forEach(function (s) { L.push('- ' + (s.ok ? '✓' : '✗') + ' ' + s.name + (s.detail ? '（' + s.detail + '）' : '')); });
    L.push('');
    L.push('## 这个页面不做的事');
    r.notes.forEach(function (n) { L.push('- ' + n); });
    return L.join('\n');
  }

  function jsonText() {
    var r = state.res;
    return JSON.stringify({
      app: '这张相纸够不够', slug: 'film-plan', version: '1.0.0',
      exported_at: new Date().toISOString(),
      cfg: r.cfg,
      plan: r.plan, verdict: r.verdict, kpis: r.kpis, lines: r.lines,
      reverse: r.reverse, advice: r.advice, evidence: r.evidence,
      wall: r.wall, album: r.album, shop: r.shop,
      selfChecks: r.selfChecks
    }, null, 2);
  }

  /* ═══ 结果卡 PNG 1080×1350 ═══ */
  function drawCard() {
    var r = state.res;
    var W = 1080, H = 1350;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    g.fillStyle = '#f7f5f1'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.fillRect(26, 26, W - 52, H - 52);

    var FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    function txt(s, x, y, size, color, weight, maxw) {
      g.font = (weight || 400) + ' ' + size + 'px ' + FONT;
      g.fillStyle = color;
      var t = String(s);
      if (maxw) {
        while (t.length > 1 && g.measureText(t + '…').width > maxw) t = t.slice(0, -1);
        if (t !== String(s)) t = t + '…';
      }
      g.fillText(t, x, y);
      return g.measureText(t).width;
    }
    function wrap(s, x, y, size, color, maxw, lh, maxLines) {
      g.font = '400 ' + size + 'px ' + FONT;
      g.fillStyle = color;
      var words = String(s).split('');
      var line = '', lines = [];
      for (var i = 0; i < words.length; i++) {
        var test = line + words[i];
        if (g.measureText(test).width > maxw && line) { lines.push(line); line = words[i]; }
        else line = test;
      }
      if (line) lines.push(line);
      var n = Math.min(lines.length, maxLines || 99);
      for (var j = 0; j < n; j++) {
        var t = lines[j];
        if (j === n - 1 && lines.length > n) {
          while (t.length > 1 && g.measureText(t + '…').width > maxw) t = t.slice(0, -1);
          t += '…';
        }
        g.fillText(t, x, y + j * lh);
      }
      return y + n * lh;
    }

    // 顶部
    g.fillStyle = '#1f5f6b'; g.fillRect(26, 26, W - 52, 8);
    txt('这张相纸够不够', 70, 120, 46, '#1b1815', 700);
    txt(r.cfg.label || '', 70, 160, 22, '#867e74', 400, W - 150);

    // 判定
    var lv = r.verdict.level;
    var vc = lv === 'ok' ? '#166b3c' : (lv === 'bad' ? '#a3251b' : '#8a5a00');
    txt(r.verdict.title, 70, 238, 40, vc, 700, W - 150);
    var y = wrap(r.verdict.why, 70, 286, 22, '#57514a', W - 150, 34, 4);

    // 读数 2×4（与页面同一份结果，术语一致）
    y += 18;
    var cw = (W - 140 - 20) / 2;
    var show = r.kpis.slice(0, 8);
    show.forEach(function (k, i) {
      var cx = 70 + (i % 2) * (cw + 20), cy = y + Math.floor(i / 2) * 104;
      g.fillStyle = '#fbfaf7'; g.fillRect(cx, cy, cw, 88);
      g.strokeStyle = '#e7e2d9'; g.strokeRect(cx, cy, cw, 88);
      txt(k.label, cx + 16, cy + 30, 19, '#867e74', 400, cw - 32);
      txt(k.value, cx + 16, cy + 64, 28, '#1b1815', 700, cw - 32);
    });
    y += 4 * 104 + 6;

    // 照片墙示意图（与页面同一套列/行数），把中段的空白用真信息填满
    if (r.wall && r.wall.fits) {
      txt('照片墙排版（' + r.wall.cols + ' 列 × ' + r.wall.rows + ' 行 = ' + r.wall.count + ' 张）', 70, y + 22, 23, '#1f5f6b', 700);
      y += 38;
      var avail = W - 140, availH = 275;
      var scale = Math.min(avail / Math.max(r.cfg.wallW, 1), availH / Math.max(r.cfg.wallH, 1));
      var gw = r.cfg.wallW * scale, gh = r.cfg.wallH * scale;
      var gx = 70 + (avail - gw) / 2, gy = y;
      g.fillStyle = '#f2ece1'; g.fillRect(gx, gy, gw, gh);
      g.strokeStyle = '#d0c9bd'; g.strokeRect(gx, gy, gw, gh);
      var fw = Math.max(1.1, r.wall.dispW * scale), fh = Math.max(1.4, r.wall.dispH * scale);
      var gp = Math.max(1, r.cfg.gapMM * scale);
      var drawn = 0;
      for (var rr = 0; rr < r.wall.rows; rr++) {
        for (var cc = 0; cc < r.wall.cols; cc++) {
          g.fillStyle = '#ffffff';
          g.fillRect(gx + cc * (fw + gp), gy + rr * (fh + gp), fw, fh);
          drawn++;
        }
      }
      y = gy + gh + 30;
      txt('画出来的 ' + drawn + ' 个格 = 这面墙摆得下的张数；占墙 ' + r.wall.usedW + ' × ' + r.wall.usedH +
        ' mm，左右剩 ' + r.wall.freeW + ' mm、上下剩 ' + r.wall.freeH + ' mm。', 70, y, 18, '#57514a', 400, W - 140);
      y += 30;
    }

    // 反推一条最要紧的
    if (r.reverse && r.reverse.length) {
      var rv = r.reverse.filter(function (x) { return x.id === 'R4' || x.id === 'R1'; })[0] || r.reverse[0];
      txt(rv.label + '：' + rv.value, 70, y + 6, 19, '#1f5f6b', 700, W - 140);
    }

    // 页脚
    g.fillStyle = '#f1f0ec'; g.fillRect(26, H - 96, W - 52, 70);
    txt('不联网 · 不查行情价 · 不内置任何品牌规格；数字全部由使用者填写，默认值是虚构示例。', 70, H - 54, 19, '#57514a', 400, W - 140);
    txt('导出 ' + stamp(), 70, H - 30, 18, '#867e74', 400, W - 140);
    return cv;
  }

  /* ═══ 初始化 ═══ */
  function init() {
    var saved = loadLocal();
    state.cfg = saved && saved.cfg ? C.normCfg(saved.cfg) : freshCfg();
    if (saved && saved.scenario) state.scenario = saved.scenario;

    // 填输入框
    NUM_KEYS.concat(TEXT_KEYS).forEach(function (k) { setInput(k, state.cfg[k]); });
    syncChips(state.cfg);

    // chip 点击
    ['paperKind', 'albumKind', 'wantWall'].forEach(function (k) {
      Array.prototype.forEach.call(document.querySelectorAll('#chips-' + k + ' .chip'), function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-v');
          if (k === 'wantWall') state.cfg.wantWall = (v === 'true');
          else if (k === 'paperKind') {
            state.cfg.paperKind = v;
            if (v !== 'custom' && C.PAPER_FORMATS[v]) {
              state.cfg.paperW = C.PAPER_FORMATS[v].w;
              state.cfg.paperH = C.PAPER_FORMATS[v].h;
              setInput('paperW', state.cfg.paperW); setInput('paperH', state.cfg.paperH);
            }
          } else state.cfg.albumKind = v;
          syncChips(state.cfg);
          recalc();
        });
      });
    });

    // 输入即重算
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (n) {
      if (n.tagName !== 'INPUT') return;
      n.addEventListener('input', function () { recalc(); });
      n.addEventListener('change', function () { recalc(); });
    });

    // 场景
    var sc = $('scenarios');
    C.SCENARIOS.forEach(function (s) {
      var b = el('button', 'chip', s.name);
      b.type = 'button';
      b.title = s.note;
      b.addEventListener('click', function () {
        state.scenario = s.id;
        state.cfg = C.normCfg(Object.assign({}, C.DEFAULTS, s.patch));
        NUM_KEYS.concat(TEXT_KEYS).forEach(function (k) { setInput(k, state.cfg[k]); });
        syncChips(state.cfg);
        recalc();
      });
      sc.appendChild(b);
    });

    // 按钮
    $('btn-calc').addEventListener('click', function () { recalc(); flash($('btn-calc'), '已重算'); });
    $('btn-save').addEventListener('click', function () { persist(); flash($('btn-save'), '已存在本机'); });
    $('btn-reset').addEventListener('click', function () {
      state.cfg = freshCfg(); state.scenario = 'default';
      NUM_KEYS.concat(TEXT_KEYS).forEach(function (k) { setInput(k, state.cfg[k]); });
      syncChips(state.cfg);
      recalc();
    });
    $('btn-csv').addEventListener('click', function () { download('这张相纸够不够-清点单.csv', '\ufeff' + csvText(), 'text/csv;charset=utf-8'); });
    $('btn-md').addEventListener('click', function () { download('这张相纸够不够-说明.md', mdText(), 'text/markdown;charset=utf-8'); });
    $('btn-json').addEventListener('click', function () { download('这张相纸够不够-备份.json', jsonText(), 'application/json;charset=utf-8'); });
    $('btn-png').addEventListener('click', function () {
      var cv = drawCard();
      cv.toBlob(function (b) {
        var url = URL.createObjectURL(b);
        var a = document.createElement('a');
        a.href = url; a.download = '这张相纸够不够-结果卡-1080x1350.png';
        document.body.appendChild(a); a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
        window.__exports++;
      }, 'image/png');
    });
    $('btn-import').addEventListener('click', function () { $('file-import').click(); });
    $('file-import').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var o = JSON.parse(String(fr.result));
          if (o && o.cfg) {
            state.cfg = C.normCfg(o.cfg);
            NUM_KEYS.concat(TEXT_KEYS).forEach(function (k) { setInput(k, state.cfg[k]); });
            syncChips(state.cfg);
            recalc();
          }
        } catch (e) { /* 不是合法备份就忽略 */ }
      };
      fr.readAsText(f);
      ev.target.value = '';
    });

    // 首次计算
    var cfg0 = readForm();
    state.cfg = cfg0;
    state.res = C.compute(cfg0);
    render();
    markErrors();
  }

  // 视口变化时重画照片墙：缩放比例是按容器宽度算出来的，
  // 页面加载后再改视口（验收脚本就是这样）会让它过期，格子会顶出容器。
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (state.res && state.res.ok) renderWall(state.res, state.res.cfg);
    }, 180);
  });

  function flash(btn, msg) {
    var old = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 1200);
  }

  // 只读调试入口（验收脚本用它读同一份计算结果与页面导出的原文；不提供任何写入能力）
  window.__app = {
    get state() { return state; },
    csvText: csvText,
    mdText: mdText,
    jsonText: jsonText,
    stamp: stamp
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
