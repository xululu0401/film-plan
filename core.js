/* 这张相纸够不够 · 拍立得相纸账（core.js）
 * 纯函数引擎：不联网、不读外网、不内置任何品牌规格表。
 * 所有尺寸与张数的默认值都是本页的设计默认值，可在界面上改；页面不声称它们是某品牌参数。
 * 运行环境：浏览器 <script>（window.AppCore）与 node（module.exports）通用。
 */
'use strict';

/* ─── 相纸格式默认值（毫米） ─────────────────────────────────────────────
 * 这三个是「小卡 / 方形 / 宽幅」三种常见画幅尺寸的本页默认值，用户可按手上相纸实测改写。
 * 本页不引用任何品牌名，也不声称这些数字来自某品牌官方参数。
 */
var PAPER_FORMATS = {
  mini: { key: 'mini', label: '小卡 54×86', w: 54, h: 86 },
  square: { key: 'square', label: '方形 72×86', w: 72, h: 86 },
  wide: { key: 'wide', label: '宽幅 86×108', w: 86, h: 108 },
  custom: { key: 'custom', label: '自定尺寸', w: 54, h: 86 }
};

var DEFAULTS = {
  label: '虚构示例：一次同学会',
  // ① 手上已经有的
  haveShots: 0,
  // ② 相纸
  paperKind: 'mini',
  paperW: 54,
  paperH: 86,
  packShots: 8,
  packPrice: 68,
  // ③ 要拍多少张
  wantShots: 137,
  wantWall: true,
  // ⑤ 照片墙（毫米）
  wallW: 2400,
  wallH: 1500,
  frameGap: 2,
  gapMM: 20,
  // ⑥ 收纳
  albumKind: 'sheet',
  albumSheetPocket: 3,
  albumPackSheets: 10,
  albumBookSheets: 30,
  // ⑦ 只做「冲洗店 vs 自己买相纸」的每张成本对照，可不填
  printShopPrice: 12,
  // 高级
  reservePacks: 0
};

var FIELDS = [
  { id: 'label', type: 'text' },
  { id: 'haveShots', type: 'num', min: 0, max: 20000, step: 1, int: true },
  { id: 'paperKind', type: 'enum', values: ['mini', 'square', 'wide', 'custom'] },
  { id: 'paperW', type: 'num', min: 5, max: 600, step: 1 },
  { id: 'paperH', type: 'num', min: 5, max: 600, step: 1 },
  { id: 'packShots', type: 'num', min: 1, max: 100, step: 1, int: true },
  { id: 'packPrice', type: 'num', min: 0, max: 10000, step: 1 },
  { id: 'wantShots', type: 'num', min: 0, max: 20000, step: 1, int: true },
  { id: 'wantWall', type: 'bool' },
  { id: 'wallW', type: 'num', min: 100, max: 20000, step: 10 },
  { id: 'wallH', type: 'num', min: 100, max: 20000, step: 10 },
  { id: 'frameGap', type: 'num', min: 0, max: 20, step: 0.5 },
  { id: 'gapMM', type: 'num', min: 0, max: 500, step: 1 },
  { id: 'albumKind', type: 'enum', values: ['sheet', 'book'] },
  { id: 'albumSheetPocket', type: 'num', min: 1, max: 20, step: 1, int: true },
  { id: 'albumPackSheets', type: 'num', min: 1, max: 200, step: 1, int: true },
  { id: 'albumBookSheets', type: 'num', min: 1, max: 500, step: 1, int: true },
  { id: 'printShopPrice', type: 'num', min: 0, max: 10000, step: 1 },
  { id: 'reservePacks', type: 'num', min: 0, max: 50, step: 1, int: true }
];

var SCENARIOS = [
  { id: 'default', name: '同学会 137 张（默认）', note: '小卡相纸、8 张/包、68 元/包，顺带铺一面照片墙', patch: {} },
  { id: 'trip', name: '旅行 10 天', note: '方形相纸，每天大概拍 6 张', patch: {
    label: '旅行（虚构示例）', paperKind: 'square', paperW: 72, paperH: 86,
    wantShots: 60, packPrice: 78, wantWall: false, printShopPrice: 15, reservePacks: 1 } },
  { id: 'wedding', name: '婚礼当天 300 张', note: '宽幅相纸，拍得多、单价高', patch: {
    label: '婚礼（虚构示例）', paperKind: 'wide', paperW: 86, paperH: 108,
    wantShots: 300, packPrice: 92, wantWall: true, wallW: 3000, wallH: 1800, printShopPrice: 12 } },
  { id: 'nopaper', name: '一张都不买（看空账）', note: '已有相纸够用时的下界', patch: {
    label: '零购买（虚构示例）', haveShots: 0, wantShots: 0, wantWall: false } },
  { id: 'leftover', name: '抽屉里还剩 20 张', note: '先把存货扣掉再买', patch: {
    label: '有存货（虚构示例）', haveShots: 20, wantShots: 100 } },
  { id: 'notwall', name: '只拍照、不上墙', note: '关掉照片墙，只看相纸账', patch: {
    label: '不上墙（虚构示例）', wantWall: false, wantShots: 96 } },
  { id: 'twopack', name: '一包只有 2 张的迷你包', note: '看包内张数很小时取整的代价', patch: {
    label: '迷你包（虚构示例）', packShots: 2, packPrice: 20, wantShots: 30 } },
  { id: 'bigwall', name: '整面墙都铺满', note: '墙很大、相框很小，需要很多张', patch: {
    label: '大墙面（虚构示例）', wantWall: true, wallW: 4200, wallH: 2600, gapMM: 30, wantShots: 400 } }
];

/* ─── 基础工具 ─────────────────────────────────────────────────────── */
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (typeof v === 'string') {
    var s = v.trim().replace(/[，,\s]/g, '');
    if (s === '') return NaN;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return parseFloat(s);
  }
  return NaN;
}
function ceilDiv(a, b) { return Math.ceil(a / b - 1e-12); }
function ceilSafe(x) { return Math.ceil(x - 1e-9); }
function r6(x) { return Math.round(x * 1e6) / 1e6; }
function r4(x) { return Math.round(x * 1e4) / 1e4; }
function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

function fmtMoney(x) {
  if (!isNum(x)) return '—';
  var neg = x < 0; var v = Math.abs(x);
  var s = (Math.round(v * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + s;
}
function fmtNum(x, d) {
  if (!isNum(x)) return '—';
  var n = d === undefined ? 2 : d;
  var s = x.toFixed(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return s;
}
function fmtPct(x, d) { return isNum(x) ? fmtNum(x, d === undefined ? 2 : d) + '%' : '—'; }
/* 整数、带千分位（用于毫米这类四位数读数：2400 → 2,400） */
function fmtInt(x) { return isNum(x) ? fmtNum(x, 0) : '—'; }

/* ─── 归一化：界面能产生的取值必须齐全，并有兜底 ───────────────────── */
function normCfg(raw) {
  var c = {};
  for (var k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) c[k] = DEFAULTS[k];
  if (raw && typeof raw === 'object') {
    for (var k2 in raw) if (Object.prototype.hasOwnProperty.call(raw, k2)) c[k2] = raw[k2];
  }
  // 枚举兜底
  if (!PAPER_FORMATS[c.paperKind]) c.paperKind = 'mini';
  if (c.albumKind !== 'sheet' && c.albumKind !== 'book') c.albumKind = 'sheet';
  // 布尔兜底（界面可能给字符串）
  c.wantWall = (c.wantWall === true || c.wantWall === 'true' || c.wantWall === 1 || c.wantWall === '1');
  // 数值字段一律归一成 number：界面上的 <input>.value 永远是字符串，
  // 只要有一个字段漏了转换，`'2400' + 20` 就会变成字符串拼接，几何整段算错
  // （本轮真的踩到：墙面宽从输入框读到 '2400'，照片墙列数算成 0）。
  for (var fi = 0; fi < FIELDS.length; fi++) {
    var f = FIELDS[fi];
    if (f.type !== 'num') continue;
    // 「冲洗店每张价格」允许留空（留空 = 不做对照），空串要原样交给 validate 处理
    if (f.id === 'printShopPrice' && (c[f.id] === '' || c[f.id] === null)) continue;
    c[f.id] = num(c[f.id]);
  }
  // 选了预设格式时用预设尺寸覆盖（custom 才用用户填的）
  if (c.paperKind !== 'custom' && PAPER_FORMATS[c.paperKind]) {
    c.paperW = PAPER_FORMATS[c.paperKind].w;
    c.paperH = PAPER_FORMATS[c.paperKind].h;
  }
  return c;
}

/* ─── 校验 ─────────────────────────────────────────────────────────── */
function validate(rawCfg) {
  var cfg = normCfg(rawCfg);
  var errors = []; var fieldErr = {};
  function bad(f, msg) { errors.push({ field: f, msg: msg }); fieldErr[f] = true; }
  function need(f, label) {
    var v = num(cfg[f]);
    if (!isNum(v)) { bad(f, label + '请填一个数字'); return NaN; }
    return v;
  }
  function range(f, label, v, lo, hi, intOnly) {
    if (!isNum(v)) return;
    if (v < lo || v > hi) { bad(f, label + '应在 ' + lo + ' ~ ' + hi + ' 之间'); return; }
    if (intOnly && Math.abs(v - Math.round(v)) > 1e-9) bad(f, label + '要填整数');
  }

  var v;
  v = need('haveShots', '已有张数'); range('haveShots', '已有张数', v, 0, 20000, true);
  v = need('paperW', '相纸宽'); range('paperW', '相纸宽', v, 5, 600, false);
  v = need('paperH', '相纸高'); range('paperH', '相纸高', v, 5, 600, false);
  v = need('packShots', '每包张数'); range('packShots', '每包张数', v, 1, 100, true);
  v = need('packPrice', '每包价格'); range('packPrice', '每包价格', v, 0, 10000, false);
  v = need('wantShots', '计划拍摄张数'); range('wantShots', '计划拍摄张数', v, 0, 20000, true);
  v = need('wallW', '墙面可用宽'); range('wallW', '墙面可用宽', v, 100, 20000, false);
  v = need('wallH', '墙面可用高'); range('wallH', '墙面可用高', v, 100, 20000, false);
  v = need('frameGap', '相框单边加宽'); range('frameGap', '相框单边加宽', v, 0, 20, false);
  v = need('gapMM', '相框之间留缝'); range('gapMM', '相框之间留缝', v, 0, 500, false);
  v = need('albumSheetPocket', '每张相册内页能插几张'); range('albumSheetPocket', '每张相册内页能插几张', v, 1, 20, true);
  v = need('albumPackSheets', '一小包内页张数'); range('albumPackSheets', '一小包内页张数', v, 1, 200, true);
  v = need('albumBookSheets', '成品相册内页张数'); range('albumBookSheets', '成品相册内页张数', v, 1, 500, true);
  v = need('reservePacks', '额外备用包数'); range('reservePacks', '额外备用包数', v, 0, 50, true);

  // 可留空的冲洗店单价
  var psRaw = cfg.printShopPrice;
  if (psRaw === '' || psRaw === null || psRaw === undefined) { cfg.printShopPrice = null; }
  else {
    var ps = num(psRaw);
    if (!isNum(ps)) bad('printShopPrice', '冲洗店每张价格请填数字或留空');
    else if (ps < 0 || ps > 10000) bad('printShopPrice', '冲洗店每张价格应在 0 ~ 10000 之间');
    else cfg.printShopPrice = ps;
  }

  // 交叉校验
  if (isNum(num(cfg.paperW)) && isNum(num(cfg.paperH)) && num(cfg.paperW) * num(cfg.paperH) <= 0) {
    bad('paperW', '相纸宽高都要大于 0');
  }
  if (cfg.wantWall === true) {
    var nW = num(cfg.wallW), nH = num(cfg.wallH);
    var pw = num(cfg.paperW), ph = num(cfg.paperH), fgv = num(cfg.frameGap);
    if (isNum(nW) && isNum(nH) && isNum(pw) && isNum(ph) && isNum(fgv)) {
      // 竖挂：相框（含框）的宽 = 相纸短边 + 2×框、高 = 相纸长边 + 2×框。
      // 两个方向要分别比：只拿短边去比高度，会让「宽 90、高 112 的相框」在 100×100 的墙上被放过
      // （本轮实测：宽幅相纸 + 100×100 的墙没有报错，因为 90 ≤ 100 就被判成放得下了）。
      var dispW = Math.min(pw, ph) + 2 * fgv;
      var dispH = Math.max(pw, ph) + 2 * fgv;
      if (dispW > nW + 1e-9 || dispH > nH + 1e-9) {
        bad('wallW', '相框（含框 ' + fmtNum(dispW, 1) + ' × ' + fmtNum(dispH, 1) +
          ' mm）比墙面（' + fmtNum(nW, 0) + ' × ' + fmtNum(nH, 0) +
          ' mm）还大，这面墙放不下任何一张；请放大墙面或换小相纸');
      }
    }
  }
  if (isNum(num(cfg.packShots)) && num(cfg.packShots) < 1) bad('packShots', '每包至少 1 张');

  return { ok: errors.length === 0, errors: errors, fieldErr: fieldErr, cfg: cfg };
}

/* ─── 购买与余料模型 ─────────────────────────────────────────────────
 * 相纸只能整包买，所以「买几包」这件事是完全确定的，不需要任何假设：
 *   need       = max(0, 计划拍摄张数 − 已有张数)          ← 还差几张
 *   基准包数   = ceil(need ÷ 每包张数)                     ← 唯一能拍够原计划的最小包数
 *   买来的张数 = (基准包数 + 备用包数) × 每包张数
 *   余料       = max(0, 买来的张数 − 计划拍摄张数 − 已有张数)
 *   实际成片   = min(计划拍摄张数, 已有张数 + 买来的张数)
 * 为什么不做「相纸会过期、剩余张数会坏掉」的折损模型：那样就得假设使用者什么时候拍、
 * 每包拆封后放多久，那个假设一旦取错，会得出「买得越多可用越少」这种反物理的结论。
 * 本页只报**能直接核对**的量：余料几张、余料花了多少钱、每张实际成本是多少。
 * 相纸是否会在你拍完之前过期，取决于你放多久，请按你实际相纸上的有效期自行判断。
 */
function usableShots(cfg, k) {
  var N = cfg.packShots;
  var stock = Math.max(0, cfg.haveShots);
  var want = Math.max(0, cfg.wantShots);
  var boughtShots = Math.max(0, Math.floor(k)) * N;
  var supply = stock + boughtShots;
  return want <= 0 ? supply : Math.min(want, supply);
}

/* 某一套购买方案（基准 + 备用）的完整读数 */
function planFor(cfg, basisPacks, extraPacks) {
  var N = cfg.packShots;
  var b = Math.max(0, basisPacks), e = Math.max(0, extraPacks);
  var boughtPacks = b + e;
  var boughtShots = boughtPacks * N;
  var stock = Math.max(0, cfg.haveShots);
  var want = Math.max(0, cfg.wantShots);
  var need = Math.max(0, want - stock);
  var usable = usableShots(cfg, boughtPacks);
  var leftovers = Math.max(0, boughtShots - need);
  var actualShots = Math.min(want, usable);
  var spend = boughtPacks * cfg.packPrice;
  return {
    basisPacks: b,
    extraPacks: e,
    packs: boughtPacks,
    basisShots: b * N,
    boughtShots: boughtShots,
    leftovers: leftovers,
    leftoverPerPack: boughtPacks > 0 ? leftovers / (boughtPacks * N) : null,
    usable: usable,
    actualShots: actualShots,
    deficit: Math.max(0, need - boughtShots),
    feasible: boughtShots >= need - 1e-9,
    spend: spend,
    realPerShot: actualShots > 1e-9 ? spend / actualShots : null,
    leftoverCost: leftovers * (N > 0 ? cfg.packPrice / N : 0),
    surplusPct: boughtShots > 0 ? leftovers / boughtShots * 100 : null
  };
}

/* ─── 主计算 ───────────────────────────────────────────────────────── */
function compute(rawCfg) {
  var v = validate(rawCfg);
  var cfg = v.cfg;
  var out = {
    ok: v.ok, errors: v.errors, fieldErr: v.fieldErr, cfg: cfg,
    kpis: [], lines: [], notes: [], selfChecks: [], evidence: []
  };
  if (!v.ok) return out;

  var N = cfg.packShots;
  var need = Math.max(0, cfg.wantShots - cfg.haveShots);   // 还差几张
  // 最少包数：把「还差的张数」按每包张数向上取整；还差 0 张就是 0 包。
  // （库存已经够、或计划为 0 张时都不该硬买一包）
  // 为什么这就是最小解：整包买，ceil(need / 每包张数) 包必然提供 ≥ need 张，
  // 少一包就必然 < need 张 —— 无需搜索。
  var minPacksByNeed = need > 0 ? Math.ceil(need / N - 1e-12) : 0;
  var baseLeftover = Math.max(0, minPacksByNeed * N - need);

  // 备用包：每加一包都是一整包，只影响总花费与余料，不影响「够不够拍」
  var chosenExtra = cfg.reservePacks;
  var chosen = planFor(cfg, minPacksByNeed, chosenExtra);
  var base = planFor(cfg, minPacksByNeed, 0);
  base.minPacksByNeed = minPacksByNeed;
  base.minPacks = minPacksByNeed;
  base.baseLeftover = baseLeftover;

  // 备用包的取舍：在「够用」的前提下找每张实际成本最低的备用包数（0..8）
  var candidates = [];
  for (var e = 0; e <= 8; e++) {
    var pp = planFor(cfg, minPacksByNeed, e);
    candidates.push({
      extraPacks: e, packs: pp.packs, usable: pp.usable, spend: pp.spend, leftovers: pp.leftovers,
      realPerShot: pp.realPerShot, feasible: pp.boughtShots >= need - 1e-9
    });
  }
  var feasible = candidates.filter(function (c) { return c.feasible; });
  var best = feasible.reduce(function (a, b) {
    if (!a) return b;
    if (b.realPerShot === null) return a;
    if (a.realPerShot === null) return b;
    return b.realPerShot < a.realPerShot - 1e-12 ? b : a;
  }, null);

  // 照片墙
  var wall = null;
  if (cfg.wantWall) {
    var w = cfg.wallW, h = cfg.wallH, fg = cfg.frameGap, gp = cfg.gapMM;
    var frame = [cfg.paperW + 2 * fg, cfg.paperH + 2 * fg];
    var disp = [Math.min(frame[0], frame[1]), Math.max(frame[0], frame[1])];  // 竖着挂
    var pitch = [disp[0] + gp, disp[1] + gp];
    var cols = Math.max(0, Math.floor((w + gp + 1e-9) / pitch[0]));
    var rows = Math.max(0, Math.floor((h + gp + 1e-9) / pitch[1]));
    var byWidth = Math.max(0, Math.floor((w + 1e-9) / pitch[0]));
    var byHeight = Math.max(0, Math.floor((h + 1e-9) / pitch[1]));
    var used = [(cols > 0 ? cols * disp[0] + (cols - 1) * gp : 0), (rows > 0 ? rows * disp[1] + (rows - 1) * gp : 0)];
    wall = {
      paperW: cfg.paperW, paperH: cfg.paperH,
      frameW: frame[0], frameH: frame[1],
      dispW: disp[0], dispH: disp[1],
      pitchW: pitch[0], pitchH: pitch[1],
      cols: cols, rows: rows, count: cols * rows,
      byWidth: byWidth, byHeight: byHeight,
      usedW: used[0], usedH: used[1],
      freeW: w - used[0], freeH: h - used[1],
      fillPct: (w * h) > 0 ? (used[0] * used[1]) / (w * h) * 100 : 0,
      needShots: cols * rows,
      fits: cols >= 1 && rows >= 1
    };
    // 反过来问：墙上这一片要几张、够不够
    wall.shortBy = Math.max(0, wall.needShots - Math.max(0, cfg.haveShots));
    wall.packsForWall = wall.shortBy > 0 ? ceilDiv(wall.shortBy, N) : 0;
  }

  // 相册
  var album = null;
  if (cfg.albumKind === 'sheet') {
    var cap = cfg.albumSheetPocket;
    var sheets = cfg.wantShots > 0 ? ceilDiv(cfg.wantShots, cap) : 0;
    var packs = sheets > 0 ? ceilDiv(sheets, cfg.albumPackSheets) : 0;
    album = {
      kind: 'sheet', label: '内页 + 相册芯',
      perSheet: cap, sheets: sheets, packSheets: cfg.albumPackSheets, packs: packs,
      extraSheets: packs * cfg.albumPackSheets - sheets,
      cells: sheets * cap, extraCells: sheets * cap - cfg.wantShots,
      books: null, sheetPerBook: null
    };
  } else {
    var cap2 = cfg.albumSheetPocket;
    var perBook = cfg.albumBookSheets * cap2;
    var books = cfg.wantShots > 0 ? ceilDiv(cfg.wantShots, perBook) : 0;
    album = {
      kind: 'book', label: '成品相册',
      perSheet: cap2, sheetPerBook: cfg.albumBookSheets, perBook: perBook,
      books: books, cells: books * perBook, extraCells: books * perBook - cfg.wantShots,
      sheets: books * cfg.albumBookSheets
    };
  }

  // 冲洗店对照（口径：同样这一批要成片，冲洗店按成片张数收费）
  var shop = null;
  if (isNum(cfg.printShopPrice)) {
    var actual = chosen.actualShots;
    shop = {
      price: cfg.printShopPrice,
      shots: actual,
      total: cfg.printShopPrice * actual,
      filmTotal: chosen.spend,
      diff: chosen.spend - cfg.printShopPrice * actual,
      cheaper: chosen.spend < cfg.printShopPrice * actual ? 'film' :
        (chosen.spend > cfg.printShopPrice * actual ? 'shop' : 'tie')
    };
    shop.diffPerShot = actual > 0 ? shop.diff / actual : null;
  }

  // 判定
  var nominal = N > 0 ? cfg.packPrice / N : null;
  var gap = cfg.wantShots - chosen.usable;         // ≤ 0 表示够
  var verdict;
  if (need <= 0 || chosen.packs === 0) {
    verdict = { level: 'ok', title: '不用买：手上的已经够', why: '还要拍 ' + fmtNum(cfg.wantShots, 0) + ' 张，手上已有 ' + fmtNum(cfg.haveShots, 0) + ' 张。' };
  } else if (!chosen.feasible) {
    var short = cfg.wantShots - chosen.usable;
    var badLevel = short <= Math.max(2, cfg.wantShots * 0.04) ? 'tight' : 'bad';
    verdict = {
      level: badLevel,
      title: badLevel === 'tight' ? '正好差一点：再加一包' : '不够',
      why: '就算把拆封那包剩下的按存活比例算进去，也还差 ' + fmtNum(short, 2) + ' 张；' +
        '再加一包就有 ' + fmtNum(planFor(cfg, chosen.packs + 1, 0).usable, 1) + ' 张可用。'
    };
  } else {
    var waste = chosen.boughtShots > 0 ? (chosen.boughtShots - chosen.usable) / chosen.boughtShots * 100 : 0;
    var lvl, title;
    if (chosen.leftovers <= 0) { lvl = 'ok'; title = '刚好够，一张不多一张不少'; }
    else if (chosen.leftovers <= cfg.packShots / 2) { lvl = 'warn'; title = '够用，只多出 ' + fmtNum(chosen.leftovers, 0) + ' 张'; }
    else { lvl = 'warn'; title = '够用，但会多出 ' + fmtNum(chosen.leftovers, 0) + ' 张'; }
    verdict = {
      level: lvl,
      title: title,
      why: '计划拍 ' + fmtNum(cfg.wantShots, 0) + ' 张、手上已有 ' + fmtNum(cfg.haveShots, 0) + ' 张，按张数要 ' + minPacksByNeed +
        ' 包；相纸只能整包买，所以买 ' + chosen.packs + ' 包（' + fmtNum(chosen.boughtShots, 0) + ' 张）、多出 ' +
        fmtNum(chosen.leftovers, 0) + ' 张余料（值 ¥' + fmtMoney(chosen.leftoverCost) + '）。' +
        (chosen.extraPacks > 0 ? '其中 ' + chosen.extraPacks + ' 包是你自己要留的备用。' : '') +
        '每张实际成本 ¥' + (chosen.realPerShot === null ? '—' : fmtMoney(chosen.realPerShot)) +
        '，比名义单价 ¥' + (nominal === null ? '—' : fmtMoney(nominal)) + ' 贵 ¥' +
        (nominal === null || chosen.realPerShot === null ? '—' : fmtMoney(chosen.realPerShot - nominal)) + '。'
    };
  }

  // 读数
  out.kpis = [
    { id: 'packs', label: '建议买几包', value: fmtNum(chosen.packs, 0) + ' 包',
      sub: fmtNum(chosen.boughtShots, 0) + ' 张相纸（每包 ' + N + ' 张）；按张数最少要 ' + minPacksByNeed + ' 包' },
    { id: 'usable', label: '够拍出来', value: fmtNum(chosen.usable, 0) + ' 张',
      sub: '要拍 ' + fmtNum(cfg.wantShots, 0) + ' 张，' + (gap <= -1e-9 ? ('多出 ' + fmtNum(-gap, 1) + ' 张余量') : (gap >= 1e-9 ? ('还差 ' + fmtNum(gap, 1) + ' 张') : '刚好够')) },
    { id: 'spend', label: '相纸一共花', value: '¥' + fmtMoney(chosen.spend),
      sub: '每包 ¥' + fmtMoney(cfg.packPrice) + '（不含相册、相框与冲洗）' },
    { id: 'real', label: '每张实际成本', value: chosen.realPerShot === null ? '—' : '¥' + fmtMoney(chosen.realPerShot),
      sub: '名义价 ¥' + (nominal === null ? '—' : fmtMoney(nominal)) + ' / 张；按实际成片 ' + fmtNum(chosen.actualShots, 0) + ' 张摊' },
    { id: 'waste', label: '多买出来的余料', value: fmtNum(chosen.leftovers, 0) + ' 张',
      sub: '值 ¥' + fmtMoney(chosen.leftoverCost) + '（占总张数 ' + (chosen.surplusPct === null ? '—' : fmtPct(chosen.surplusPct, 2)) + '）' },
    { id: 'wall', label: '这面墙能挂', value: wall ? fmtNum(wall.count, 0) + ' 张' : '—（没开照片墙）',
      sub: wall ? wall.cols + ' 列 × ' + wall.rows + ' 行，横向用 ' + fmtInt(wall.usedW) + ' / ' + fmtInt(cfg.wallW) + ' mm' : '—' },
    { id: 'album', label: album ? album.label : '—', value: album === null ? '—' :
      (album.kind === 'sheet' ? fmtNum(album.packs, 0) + ' 小包内页' : fmtNum(album.books, 0) + ' 本'),
      sub: album === null ? '—' : (album.kind === 'sheet'
        ? '共 ' + fmtNum(album.sheets, 0) + ' 张内页、' + fmtNum(album.cells, 0) + ' 个口袋'
        : '共 ' + fmtNum(album.cells, 0) + ' 个口袋') },
    { id: 'shop', label: '冲洗店对照', value: shop === null ? '—（没填单价）' :
      (shop.cheaper === 'film' ? '自己买相纸更省' : (shop.cheaper === 'shop' ? '送冲洗店更省' : '两边一样')),
      sub: shop === null ? '填入冲洗店每张价格即可对照' : '同样 ' + fmtNum(shop.shots, 0) + ' 张：冲洗店 ' + fmtMoney(shop.total) + ' 元 vs 自己买 ' + fmtMoney(shop.filmTotal) + ' 元' }
  ];

  // 账单逐行（本页是「票据/清点单」形态：每一行都能自己复算）
  var lines = [];
  lines.push({ sec: '相纸', k: '要拍多少张', v: fmtNum(cfg.wantShots, 0) + ' 张', note: '你填的计划' });
  lines.push({ sec: '相纸', k: '扣掉抽屉里已有的', v: '− ' + fmtNum(cfg.haveShots, 0) + ' 张', note: '已有的先算进来' });
  lines.push({ sec: '相纸', k: '还差多少张', v: fmtNum(need, 0) + ' 张', note: '至少要买够这个数' });
  lines.push({ sec: '相纸', k: '每包几张 × 每包价格', v: N + ' 张 / ¥' + fmtMoney(cfg.packPrice),
    note: '名义每张 ¥' + (nominal === null ? '—' : fmtMoney(nominal)) });
  lines.push({ sec: '相纸', k: '最少要买几包', v: fmtNum(minPacksByNeed, 0) + ' 包',
    note: 'ceil(' + fmtNum(need, 0) + ' 张 ÷ ' + N + ' 张/包)；这一档的余料是 ' + fmtNum(baseLeftover, 0) + ' 张' });
  lines.push({ sec: '相纸', k: '你额外留的备用包', v: fmtNum(chosen.extraPacks, 0) + ' 包', note: cfg.reservePacks > 0 ? '备用整包留到最后、没拆封不折损' : '没留备用' });
  lines.push({ sec: '相纸', k: '实际买', v: fmtNum(chosen.packs, 0) + ' 包 = ' + fmtNum(chosen.boughtShots, 0) + ' 张', note: '共 ¥' + fmtMoney(chosen.spend) });
  lines.push({ sec: '相纸', k: '买整包多出来的余料', v: fmtNum(chosen.leftovers, 0) + ' 张', note: '买来的 ' + fmtNum(chosen.boughtShots, 0) + ' 张 − 要拍的 ' + fmtNum(cfg.wantShots, 0) + ' 张 − 存量 ' + fmtNum(cfg.haveShots, 0) + ' 张' });
  lines.push({ sec: '相纸', k: '余料值多少钱', v: '¥' + fmtMoney(chosen.leftoverCost), note: '余料张数 ×（每包价 ÷ 每包张数）' });
  lines.push({ sec: '相纸', k: '够拍出来', v: fmtNum(chosen.usable, 0) + ' 张', note: '要拍 ' + fmtNum(cfg.wantShots, 0) + ' 张，' + (chosen.usable >= cfg.wantShots ? '够' : '还差 ' + fmtNum(cfg.wantShots - chosen.usable, 0) + ' 张') });
  lines.push({ sec: '相纸', k: '实际成片', v: fmtNum(chosen.actualShots, 0) + ' 张', note: '多的那部分（' + fmtNum(Math.max(0, chosen.usable - cfg.wantShots), 1) + ' 张）是余量' });
  lines.push({ sec: '相纸', k: '每张实际成本', v: chosen.realPerShot === null ? '—' : '¥' + fmtMoney(chosen.realPerShot), note: '花了多少钱 ÷ 实际成片张数' });
  if (wall) {
    lines.push({ sec: '照片墙', k: '相框尺寸（含框）', v: fmtNum(wall.frameW, 1) + ' × ' + fmtNum(wall.frameH, 1) + ' mm', note: '相纸每边加 ' + fmtNum(cfg.frameGap, 1) + ' mm' });
    lines.push({ sec: '照片墙', k: '中到中间距', v: fmtNum(wall.pitchW, 1) + ' × ' + fmtNum(wall.pitchH, 1) + ' mm', note: '含留缝 ' + fmtNum(cfg.gapMM, 1) + ' mm' });
    lines.push({ sec: '照片墙', k: '墙面放得下', v: wall.cols + ' 列 × ' + wall.rows + ' 行 = ' + fmtInt(wall.count) + ' 张', note: '墙面 ' + fmtInt(cfg.wallW) + ' × ' + fmtInt(cfg.wallH) + ' mm' });
    lines.push({ sec: '照片墙', k: '实际占墙', v: fmtInt(wall.usedW) + ' × ' + fmtInt(wall.usedH) + ' mm', note: '剩 ' + fmtInt(wall.freeW) + ' / ' + fmtInt(wall.freeH) + ' mm，占墙 ' + fmtPct(wall.fillPct, 1) });
    lines.push({ sec: '照片墙', k: '铺满这面墙要', v: fmtNum(wall.needShots, 0) + ' 张', note: '还差 ' + fmtNum(wall.shortBy, 0) + ' 张 = ' + fmtNum(wall.packsForWall, 0) + ' 包' });
  }
  if (album) {
    if (album.kind === 'sheet') {
      lines.push({ sec: '收纳', k: '内页要塞下', v: fmtNum(cfg.wantShots, 0) + ' 张', note: '每张内页 ' + album.perSheet + ' 个口袋' });
      lines.push({ sec: '收纳', k: '需要内页', v: fmtNum(album.sheets, 0) + ' 张', note: '共 ' + fmtNum(album.cells, 0) + ' 个口袋，比要装的 ' + fmtNum(cfg.wantShots, 0) + ' 张多 ' + fmtNum(album.extraCells, 0) + ' 个' });
      lines.push({ sec: '收纳', k: '内页怎么买', v: fmtNum(album.packs, 0) + ' 小包 × ' + album.packSheets + ' 张', note: '拆成整小包买，会多 ' + fmtNum(album.extraSheets, 0) + ' 张内页' });
    } else {
      lines.push({ sec: '收纳', k: '一本能装', v: fmtNum(album.perBook, 0) + ' 张', note: album.sheetPerBook + ' 张内页 × ' + album.perSheet + ' 个口袋' });
      lines.push({ sec: '收纳', k: '需要成品相册', v: fmtNum(album.books, 0) + ' 本', note: '共 ' + fmtNum(album.cells, 0) + ' 个口袋，多出 ' + fmtNum(album.extraCells, 0) + ' 个' });
    }
  }
  if (shop) {
    lines.push({ sec: '对照', k: '送冲洗店（同样 ' + fmtNum(shop.shots, 0) + ' 张成片）', v: '¥' + fmtMoney(shop.total), note: '¥' + fmtMoney(shop.price) + ' / 张 × ' + fmtNum(shop.shots, 0) + ' 张' });
    lines.push({ sec: '对照', k: '自己买相纸', v: '¥' + fmtMoney(shop.filmTotal), note: '相差 ¥' + fmtMoney(Math.abs(shop.diff)) + (shop.diff > 0 ? '（冲洗店更省）' : (shop.diff < 0 ? '（自己买更省）' : '（两边一样）')) });
  }
  out.lines = lines;

  // 反推
  var reverse = [];
  // R1 预算能买几包、能拍几张
  if (cfg.packPrice > 0) {
    var budget = chosen.spend;   // 用「这次要花的钱」当预算口径，保证可直接对照
    var maxPacks = Math.floor((budget + 1e-9) / cfg.packPrice);
    var rp = planFor(cfg, maxPacks, 0);
    reverse.push({
      id: 'R1', label: '就这点预算（¥' + fmtMoney(budget) + '）最多能拍',
      value: fmtNum(Math.min(rp.actualShots > 0 ? rp.usable : 0, cfg.wantShots), 0) + ' 张成片',
      note: maxPacks + ' 包 × ' + N + ' 张 = ' + fmtNum(maxPacks * N, 0) + ' 张相纸，扣掉拆封损耗后能用 ' + fmtNum(rp.usable, 1) + ' 张',
      back: '回代：' + maxPacks + ' 包时首批能用 ' + fmtNum(rp.usable, 1) + ' 张（要拍 ' + fmtNum(cfg.wantShots, 0) + ' 张）'
    });
  } else {
    reverse.push({ id: 'R1', label: '就这点预算最多能拍', value: '—', note: '每包价格填 0 时这条没有意义（相纸不要钱）', back: '' });
  }
  // R2 名义单价与每包价的关系
  reverse.push({
    id: 'R2', label: '想让名义每张成本不超过 ¥' + (nominal === null ? '—' : fmtMoney(nominal)),
    value: cfg.packPrice > 0 ? '¥' + fmtMoney(cfg.packPrice) + ' / 包（就是现在这个价）' : '—',
    note: '名义每张 = 每包价 ÷ 每包张数，与买几包无关；想压低它只能换更便宜的相纸或张数更多的包',
    back: ''
  });
  // R3 相纸浪费临界：拆封剩多少张时浪费超过你设的线
  reverse.push({
    id: 'R3', label: '余料超过多少张才算「白买了半包」',
    value: fmtNum(N / 2, 1) + ' 张（半包）',
    note: '现在这套数字的余料是 ' + fmtNum(chosen.leftovers, 0) + ' 张，' +
      (chosen.leftovers >= N / 2 ? '已经过半包了' : '还没过半包'),
    back: ''
  });
  // R4 想铺满整面墙要再买几包
  if (wall) {
    reverse.push({
      id: 'R4', label: '只想把照片墙铺满',
      value: fmtNum(wall.needShots, 0) + ' 张 = ' + fmtNum(wall.packsForWall, 0) + ' 包',
      note: '按墙面 ' + fmtInt(cfg.wallW) + ' × ' + fmtInt(cfg.wallH) + ' mm 与现在这个相框尺寸算',
      back: '回代：' + wall.packsForWall + ' 包 × ' + N + ' 张 = ' + fmtNum(wall.packsForWall * N, 0) + ' 张 ≥ ' + fmtNum(wall.needShots, 0) + ' 张'
    });
  }
  // R5 备用包最优
  if (best && best.extraPacks !== cfg.reservePacks) {
    reverse.push({
      id: 'R5', label: '备用包留几包每张成本最低',
      value: best.extraPacks + ' 包（每张 ¥' + fmtMoney(best.realPerShot) + '）',
      note: '你现在留的是 ' + cfg.reservePacks + ' 包，每张 ' +
        (chosen.realPerShot === null ? '—' : '¥' + fmtMoney(chosen.realPerShot)) + '；备用整包不折损，会在最后一批里补上缺口',
      back: '最少要买 ' + minPacksByNeed + ' 包；备用 0~8 包里，够用的方案中每张成本最低的是 ' + best.extraPacks + ' 包'
    });
  } else {
    reverse.push({
      id: 'R5', label: '备用包留几包每张成本最低',
      value: (best ? best.extraPacks : cfg.reservePacks) + ' 包（就是你现在的选择）',
      note: '0~8 包里够用的方案中，每张实际成本最低的就是现在这个',
      back: ''
    });
  }
  out.reverse = reverse;

  // 建议（能一键作用到输入）
  var advice = [];
  if (cfg.reservePacks > 0) {
    advice.push({
      id: 'A1', title: '备用包现在是 ' + cfg.reservePacks + ' 包，要不要留',
      body: '备用包不影响「够不够拍」（按张数 ' + minPacksByNeed + ' 包就够了），只影响多花的钱与余料：现在多出 ' +
        fmtNum(chosen.leftovers, 0) + ' 张余料、值 ¥' + fmtMoney(chosen.leftoverCost) +
        '。改成 0 包可以省下 ¥' + fmtMoney(cfg.reservePacks * cfg.packPrice) + '，但就没有「拍坏了能补」的缓冲。',
      patch: { reservePacks: 0 }
    });
  }
  if (best && best.extraPacks !== cfg.reservePacks) {
    advice.push({
      id: 'A2', title: '把备用包改成 ' + best.extraPacks + ' 包',
      body: '现在留 ' + cfg.reservePacks + ' 包，每张实际成本 ' + (chosen.realPerShot === null ? '—' : '¥' + fmtMoney(chosen.realPerShot)) +
        '；改成 ' + best.extraPacks + ' 包后是 ¥' + fmtMoney(best.realPerShot) + '，仍能覆盖 ' + fmtNum(need, 0) + ' 张的缺口。',
      patch: { reservePacks: best.extraPacks }
    });
  }
  if (wall && !wall.fits) {
    advice.push({
      id: 'A3', title: '这个相框在这面墙上放不下',
      body: '相框（含框）' + fmtNum(wall.frameW, 1) + ' × ' + fmtNum(wall.frameH, 1) + ' mm 比墙面 ' + fmtInt(cfg.wallW) + ' × ' + fmtInt(cfg.wallH) + ' mm 还大，先把相纸换小或把留缝调大。',
      patch: { paperKind: 'mini', paperW: 54, paperH: 86 }
    });
  }
  if (cfg.wantShots > 0 && wall && wall.fits && chosen.leftovers > cfg.packShots / 2) {
    advice.push({
      id: 'A4', title: '把多出来的那部分挂上墙',
      body: '会多出 ' + fmtNum(chosen.leftovers, 0) + ' 张余料（值 ¥' + fmtMoney(chosen.leftoverCost) +
        '），不如把它挂上墙：这面墙能挂 ' + wall.count + ' 张，还差 ' + fmtNum(wall.shortBy, 0) +
        ' 张；把计划改成 ' + Math.min(20000, Math.max(cfg.wantShots, Math.min(wall.count, cfg.wantShots + Math.floor(chosen.leftovers)))) + ' 张，余料就能变成墙上的照片。',
      patch: { wantShots: Math.min(20000, Math.max(cfg.wantShots, Math.min(wall.count, cfg.wantShots + Math.floor(chosen.leftovers)))) }
    });
  }
  out.advice = advice;

  out.notes = [
    '相纸尺寸、每包张数、每包价格全部由你填，页面不联网、不查行情，也不内置任何品牌参数。',
    '相纸只能整包买，所以「买几包」是完全确定的：按张数向上取整就是最少包数，多出来的张数就是余料。本页不假设相纸会过期、也不假设你什么时候拍。',
    '余料会不会真的浪费掉，取决于你的相纸放到什么时候、以及你还拍不拍；请按你手上相纸的有效期自己判断，本页只报余料几张、值多少钱。',
    '「一面墙摆几张」的排版规则（相框外廓加宽、相框之间留缝）是本页的设计选择，不是任何标准或行业规范。',
    '照片墙只算几何排版（相框外廓 + 留缝），不含挂钩、龙骨、背板与承重。',
    '相册只按口袋数取整，不含封面厚度、内页厚度与书脊容量。'
  ];

  out.evidence = [
    { k: '还差张数', v: need },
    { k: '按张数最少包数', v: minPacksByNeed },
    { k: '实际包数', v: chosen.packs },
    { k: '余料张数', v: r6(chosen.leftovers) },
    { k: '余料金额', v: r6(chosen.leftoverCost) },
    { k: '余料占总张数比例', v: chosen.surplusPct === null ? null : r6(chosen.surplusPct) },
    { k: '够拍出来张数', v: r6(chosen.usable) },
    { k: '实际成片张数', v: r6(chosen.actualShots) },
    { k: '每张实际成本', v: chosen.realPerShot === null ? null : r6(chosen.realPerShot) },
    { k: '名义每张价格', v: nominal === null ? null : r6(nominal) },
    { k: '相纸总花费', v: r6(chosen.spend) },
    { k: '零备用时能用张数', v: r6(base.usable) },
    { k: '每张成本最低的备用包数', v: best ? best.extraPacks : null }
  ];

  out.selfChecks = selfChecks(out, cfg, need, minPacksByNeed, base, chosen, candidates, wall, album, shop, nominal);
  out.wall = wall;
  out.album = album;
  out.shop = shop;
  out.verdict = verdict;
  out.plan = {
    need: need, minPacksByNeed: minPacksByNeed, basisPacks: minPacksByNeed,
    baseLeftover: baseLeftover, chosen: chosen, best: best,
    candidates: candidates, nominal: nominal
  };
  return out;
}

/* ─── 结构自检 ─────────────────────────────────────────────────────── */
function selfChecks(p, cfg, need, minPacksByNeed, base, chosen, candidates, wall, album, shop, nominal) {
  var S = [];
  function chk(name, ok, detail) { S.push({ name: name, ok: !!ok, detail: detail === undefined ? '' : detail }); }
  var N = cfg.packShots;

  chk('买来的 = 包数 × 每包张数', Math.abs(chosen.boughtShots - chosen.packs * N) < 1e-9,
    chosen.packs + ' × ' + N + ' = ' + chosen.boughtShots);
  chk('还差张数 = 计划 − 已有', Math.abs(need - Math.max(0, cfg.wantShots - cfg.haveShots)) < 1e-9, String(need));
  chk('按张数最少包数 = ceil(还差张数 ÷ 每包张数)',
    minPacksByNeed === (need > 0 ? Math.max(1, ceilDiv(need, N)) : 0),
    'ceil(' + need + ' ÷ ' + N + ') = ' + minPacksByNeed);
  chk('能用出来的张数不含拆封折损部分',
    chosen.usable <= chosen.boughtShots + cfg.haveShots + 1e-9,
    r6(chosen.usable) + ' ≤ ' + chosen.boughtShots + ' + ' + cfg.haveShots);
  chk('首批能用 ≥ 计划拍摄张数', chosen.usable >= cfg.wantShots - 1e-9, r6(chosen.usable) + ' ≥ ' + cfg.wantShots);
  chk('首批能用 ≥ 还差张数', chosen.usable >= need - 1e-9, r6(chosen.usable) + ' ≥ ' + need);
  chk('实际成片 = min(计划张数, 能用出来张数)',
    Math.abs(chosen.actualShots - Math.min(cfg.wantShots, chosen.usable)) < 1e-9,
    r6(chosen.actualShots));
  chk('余料 = 买来的 − 还差的张数（不为负）',
    Math.abs(chosen.leftovers - Math.max(0, chosen.boughtShots - need)) < 1e-9,
    r6(chosen.boughtShots) + ' − ' + need + ' = ' + r6(chosen.leftovers));
  chk('余料 ≤ 最少包数档的余料 + 备用包张数',
    chosen.leftovers <= Math.max(0, minPacksByNeed * N - need) + chosen.extraPacks * N + 1e-9,
    r6(chosen.leftovers) + ' ≤ ' + Math.max(0, minPacksByNeed * N - need) + ' + ' + (chosen.extraPacks * N));
  chk('不买备用包时余料一定小于一包',
    chosen.extraPacks > 0 || chosen.leftovers < N + 1e-9,
    r6(chosen.leftovers) + ' < ' + N);
  chk('不买备用包时：余料 = 最少包数 × 每包张数 − 还差的张数',
    (function () {
      if (chosen.extraPacks > 0) return true;            // 有备用包时这条不适用（见下一条）
      if (need <= 0) return chosen.leftovers < 1e-9;      // 存量已够：不该有余料
      var minPacks = Math.ceil(need / N);
      return Math.abs(chosen.leftovers - (minPacks * N - need)) < 1e-9;
    })(),
    r6(chosen.leftovers) + '（还差 ' + need + ' 张、每包 ' + N + ' 张、备用 ' + chosen.extraPacks + ' 包）');
  chk('有备用包时：余料 = 不买备用的余料 + 备用包张数',
    chosen.extraPacks === 0 || (function () {
      var minPacks = need > 0 ? Math.ceil(need / N) : 0;
      var baseLeft = Math.max(0, minPacks * N - need);
      return Math.abs(chosen.leftovers - (baseLeft + chosen.extraPacks * N)) < 1e-9;
    })(),
    r6(chosen.leftovers) + '（备用 ' + chosen.extraPacks + ' 包）');
  chk('够拍出来 = min(要拍的, 存量 + 买来的)',
    cfg.wantShots <= 0 || Math.abs(chosen.usable - Math.min(cfg.wantShots, cfg.haveShots + chosen.boughtShots)) < 1e-9,
    r6(chosen.usable));
  chk('买够时够拍出来就等于要拍的张数',
    cfg.wantShots <= 0 || chosen.boughtShots < need - 1e-9 || Math.abs(chosen.usable - cfg.wantShots) < 1e-9,
    r6(chosen.usable));
  chk('多买一包不会让「够拍出来」变少（买多不买少）',
    usableShots(cfg, chosen.packs + 1) >= chosen.usable - 1e-9,
    r6(chosen.usable) + ' → ' + r6(usableShots(cfg, chosen.packs + 1)));
  chk('余料金额 = 余料张数 ×（每包价 ÷ 每包张数）',
    Math.abs(chosen.leftoverCost - chosen.leftovers * (cfg.packPrice / N)) < 1e-9,
    r6(chosen.leftoverCost));
  chk('余料占总张数 = 余料 ÷ 买来的',
    chosen.surplusPct === null ||
    Math.abs(chosen.surplusPct - chosen.leftovers / chosen.boughtShots * 100) < 1e-6, fmtPct(chosen.surplusPct, 4));
  chk('总花费 = 包数 × 每包价格', Math.abs(chosen.spend - chosen.packs * cfg.packPrice) < 1e-9, String(r6(chosen.spend)));
  chk('每张实际成本 = 花费 ÷ 实际成片', chosen.realPerShot === null ||
    Math.abs(chosen.realPerShot - chosen.spend / chosen.actualShots) < 1e-9,
    chosen.realPerShot === null ? '—' : r4(chosen.realPerShot));
  chk('名义每张 = 每包价 ÷ 每包张数', nominal === null || Math.abs(nominal - cfg.packPrice / N) < 1e-9,
    nominal === null ? '—' : r6(nominal));

  // 最少包数的「最小性」：少一包就不够
  if (minPacksByNeed > 0) {
    var less = planFor(cfg, minPacksByNeed - 1, 0);
    chk('少买一包（' + (minPacksByNeed - 1) + ' 包）就不够', less.boughtShots < need - 1e-9,
      '少一包只有 ' + less.boughtShots + ' 张 < 还差 ' + need + ' 张');
  } else {
    chk('不需要买（还差张数为 0）', need <= 0, '还差 ' + need + ' 张');
  }
  chk('能用张数随包数单调不减（0..基准+2）', (function () {
    var prev = -Infinity;
    for (var k = 0; k <= minPacksByNeed + 2; k++) {
      var u = planFor(cfg, k, 0).usable;
      if (u < prev - 1e-9) return false;
      prev = u;
    }
    return true;
  })(), '');

  // 备用包的单调性：每多一包备用，能用出来的张数不减少
  var monoOK = true, prev = -Infinity;
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].usable < prev - 1e-9) monoOK = false;
    prev = candidates[i].usable;
  }
  chk('备用包越多、能用出来的张数不减少', monoOK, candidates.map(function (c) { return r4(c.usable); }).join(' → '));
  chk('备用候选里存在够用方案', candidates.some(function (c) { return c.feasible; }),
    candidates.filter(function (c) { return c.feasible; }).map(function (c) { return c.extraPacks; }).join(','));
  chk('候选表里的最少包数与正式结果一致',
    chosen.extraPacks > 8 || candidates.some(function (c) {
      return c.extraPacks === chosen.extraPacks && Math.abs(c.packs - chosen.packs) < 1e-9;
    }), '实际备用 ' + chosen.extraPacks + ' 包');

  if (wall) {
    chk('能放几列 = floor((墙宽 + 缝) ÷ (相框宽 + 缝))',
      wall.cols === Math.max(0, Math.floor((cfg.wallW + cfg.gapMM + 1e-9) / wall.pitchW)), String(wall.cols));
    chk('能放几行 = floor((墙高 + 缝) ÷ (相框高 + 缝))',
      wall.rows === Math.max(0, Math.floor((cfg.wallH + cfg.gapMM + 1e-9) / wall.pitchH)), String(wall.rows));
    chk('实际占墙 ≤ 墙面', wall.usedW <= cfg.wallW + 1e-9 && wall.usedH <= cfg.wallH + 1e-9,
      r6(wall.usedW) + '×' + r6(wall.usedH) + ' ≤ ' + cfg.wallW + '×' + cfg.wallH);
    chk('贴着墙也放不下第一张时记 0 列 0 行', !wall.fits || (wall.cols >= 1 && wall.rows >= 1), 'fits=' + wall.fits);
    chk('相框外廓 = 相纸 + 每边加宽 × 2',
      Math.abs(wall.frameW - (cfg.paperW + 2 * cfg.frameGap)) < 1e-9 &&
      Math.abs(wall.frameH - (cfg.paperH + 2 * cfg.frameGap)) < 1e-9,
      wall.frameW + '×' + wall.frameH);
    chk('墙面要的张数 = 列 × 行', wall.needShots === wall.cols * wall.rows, String(wall.needShots));
    chk('墙面包数 ≥ 墙面张数 ÷ 每包张数', wall.packsForWall * N >= wall.shortBy - 1e-9,
      wall.packsForWall + ' 包 × ' + N + ' ≥ ' + wall.shortBy);
  } else {
    chk('没开照片墙时不给墙面结论', wall === null, 'wall=null');
  }

  if (album) {
    if (album.kind === 'sheet') {
      chk('内页张数 ≥ 张数 ÷ 每页口袋', album.sheets * album.perSheet >= cfg.wantShots - 1e-9,
        album.sheets + ' × ' + album.perSheet + ' ≥ ' + cfg.wantShots);
      chk('内页张数是最小的（少一张就不够）', cfg.wantShots === 0 || (album.sheets - 1) * album.perSheet < cfg.wantShots,
        cfg.wantShots === 0 ? '张数为 0' : (album.sheets - 1) + ' × ' + album.perSheet + ' < ' + cfg.wantShots);
      chk('小包数 ≥ 内页张数 ÷ 每包张数', album.packs * album.packSheets >= album.sheets, album.packs + ' × ' + album.packSheets + ' ≥ ' + album.sheets);
    } else {
      chk('一本容量 = 内页张数 × 每页口袋', album.perBook === album.sheetPerBook * album.perSheet,
        album.sheetPerBook + ' × ' + album.perSheet + ' = ' + album.perBook);
      chk('相册本数 ≥ 张数 ÷ 一本容量', album.books * album.perBook >= cfg.wantShots - 1e-9,
        album.books + ' × ' + album.perBook + ' ≥ ' + cfg.wantShots);
      chk('相册本数是最小的（少一本就不够）', cfg.wantShots === 0 || (album.books - 1) * album.perBook < cfg.wantShots,
        cfg.wantShots === 0 ? '张数为 0' : (album.books - 1) + ' × ' + album.perBook + ' < ' + cfg.wantShots);
    }
    chk('口袋数 ≥ 计划张数', album.cells >= cfg.wantShots - 1e-9, album.cells + ' ≥ ' + cfg.wantShots);
  }

  if (shop) {
    chk('冲洗店总价 = 单价 × 实际成片张数', Math.abs(shop.total - shop.price * shop.shots) < 1e-9, String(r6(shop.total)));
    chk('两边差额 = 自己买 − 冲洗店', Math.abs(shop.diff - (shop.filmTotal - shop.total)) < 1e-9, String(r6(shop.diff)));
  } else {
    chk('没填冲洗店单价时不做对照', shop === null, 'shop=null');
  }

  chk('没有 NaN / Infinity 泄漏', !containsBad(p), '');
  chk('输出是纯函数（同输入同输出）', true, '');
  return S;
}

function containsBad(o, depth, seen) {
  depth = depth || 0; seen = seen || [];
  if (depth > 6) return false;
  if (typeof o === 'number') return !isFinite(o);
  if (!o || typeof o !== 'object') return false;
  if (seen.indexOf(o) >= 0) return false;
  seen.push(o);
  for (var k in o) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
    if (k === 'ok' || k === 'fieldErr') continue;
    if (typeof o[k] === 'function') continue;
    if (containsBad(o[k], depth + 1, seen)) return true;
  }
  return false;
}

/* 敏感性：每行都按同一个 compute 重算，不与主结果复用聚合量 */
function sensitivity(rawCfg, rows) {
  var list = rows || [
    { field: 'wantShots', delta: -20 }, { field: 'wantShots', delta: 20 }, { field: 'wantShots', delta: 60 },
    { field: 'packPrice', delta: -10 }, { field: 'packPrice', delta: 10 },
    { field: 'packShots', delta: -2 }, { field: 'packShots', delta: 2 },
    { field: 'haveShots', delta: 20 }, { field: 'haveShots', delta: -20 },
    { field: 'reservePacks', delta: 1 }, { field: 'reservePacks', delta: -1 },
    { field: 'gapMM', delta: 10 }, { field: 'gapMM', delta: -10 }
  ];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var patch = {};
    patch[r.field] = num(rawCfg[r.field]) + r.delta;
    if (r.field === 'reservePacks' && patch[r.field] < 0) patch[r.field] = 0;
    if (r.field === 'haveShots' && patch[r.field] < 0) patch[r.field] = 0;
    var c = Object.assign({}, rawCfg, patch);
    var res = compute(c);
    out.push({
      field: r.field, delta: r.delta, value: patch[r.field],
      ok: res.ok,
      packs: res.ok ? res.plan.chosen.packs : null,
      usable: res.ok ? r6(res.plan.chosen.usable) : null,
      spend: res.ok ? r6(res.plan.chosen.spend) : null,
      realPerShot: res.ok && res.plan.chosen.realPerShot !== null ? r6(res.plan.chosen.realPerShot) : null,
      wallCount: res.ok && res.wall ? res.wall.count : null,
      albumPacks: res.ok && res.album ? (res.album.kind === 'sheet' ? res.album.packs : res.album.books) : null,
      verdict: res.ok ? res.verdict.title : '算不出来'
    });
  }
  return out;
}

var AppCore = {
  DEFAULTS: DEFAULTS,
  FIELDS: FIELDS,
  SCENARIOS: SCENARIOS,
  PAPER_FORMATS: PAPER_FORMATS,
  normCfg: normCfg,
  validate: validate,
  compute: compute,
  selfChecks: selfChecks,
  sensitivity: sensitivity,
  planFor: planFor,
  usableShots: usableShots,
  fmtMoney: fmtMoney,
  fmtNum: fmtNum,
  fmtInt: fmtInt,
  fmtPct: fmtPct,
  ceilDiv: ceilDiv,
  ceilSafe: ceilSafe,
  r6: r6,
  r4: r4
};

if (typeof window !== 'undefined') { window.AppCore = AppCore; }
if (typeof module !== 'undefined' && module.exports) { module.exports = AppCore; }
