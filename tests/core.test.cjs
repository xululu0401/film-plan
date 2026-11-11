/* 这张相纸够不够 · 核心测试
 * 运行：node --test tests/core.test.cjs
 * 看原始 pass/fail/cancelled/skipped/todo，不凑数量。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const A = require('../core.js');

/* ── 手算锚点（算式写在这里，逐位核对） ──────────────────────────────────
 * 默认场景：小卡 54×86 mm、每包 8 张、¥68/包；已有 0 张；计划拍 137 张；
 *   墙面 2400×1500 mm；相框每边加宽 2 mm；相框留缝 20 mm；
 *   内页每张 3 个口袋、一小包 10 张；成品相册 30 张内页；冲洗店 ¥12/张；备用 0 包。
 *
 * ① 相纸（相纸只能整包买，这一步不含任何假设）
 *    need       = 137 − 0 = 137 张
 *    最少包数   = ceil(137 ÷ 8) = ceil(17.125) = 18 包
 *    买来的张数 = 18 × 8 = 144 张
 *    余料       = 144 − 137 = 7 张
 *    余料金额   = 7 × (68 ÷ 8) = 7 × 8.5 = 59.50 元
 *    花费       = 18 × 68 = 1224 元
 *    实际成片   = min(137, 0 + 144) = 137 张
 *    每张实际成本 = 1224 ÷ 137 = 8.934306569… 元
 *    名义每张   = 68 ÷ 8 = 8.5 元；实际比名义贵 0.434306569… 元
 *
 * ② 照片墙（2400×1500 mm 墙、54×86 相纸、每边 2 mm 框、20 mm 缝）
 *    相框外廓 = (54+4) × (86+4) = 58 × 90 mm
 *    竖挂 → 摆位 58（宽）× 90（高）；中到中间距 = (58+20) × (90+20) = 78 × 110 mm
 *    cols = floor((2400 + 20) ÷ 78) = floor(31.0256) = 31
 *    rows = floor((1500 + 20) ÷ 110) = floor(13.818) = 13
 *    张数 = 31 × 13 = 403
 *    占墙 = 31×58 + 30×20 = 2398 mm；13×90 + 12×20 = 1410 mm
 *    占墙面 = 2398 × 1410 ÷ (2400 × 1500) = 93.9217%
 *    铺满这面墙要 403 张 → ceil(403 ÷ 8) = 51 包
 *
 * ③ 相册（内页口径）
 *    内页张数 = ceil(137 ÷ 3) = 46 张 → 口袋 46 × 3 = 138 个（比 137 张多 1 个）
 *    小包数   = ceil(46 ÷ 10) = 5 小包 → 50 张内页（比 46 张多 4 张）
 *    （成品相册口径：一本 = 30 × 3 = 90 个口袋 → ceil(137 ÷ 90) = 2 本）
 *
 * ④ 冲洗店对照（口径：同样 137 张成片）
 *    冲洗店 = 12 × 137 = 1644 元；自己买 = 1224 元 → 自己买省 420 元
 *
 * ⑤ 为什么不做「相纸会过期、剩余会坏掉」的折损模型：
 *    那需要假设「每包拆封后放多久」；本轮真的推到过「买得越多可用越少」这种反物理结论，
 *    说明这个假设一旦取错就会把结论带歪。所以本页只报能直接核对的量：
 *    余料几张、余料值多少钱、每张实际成本是多少；相纸会不会在你拍完前过期，交给使用者按
 *    手上的有效期自己判断（页面把这条边界写在清点单的说明与「这个页面不做什么」里）。
 */
const D = A.DEFAULTS;
function withCfg(patch) { return A.normCfg(Object.assign({}, D, patch)); }
function compute(patch) { return A.compute(withCfg(patch)); }
function near(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps); }

test('1 默认场景：包数、余料、花费、每张成本逐位核对', () => {
  const r = compute({});
  assert.strictEqual(r.ok, true);
  const c = r.plan.chosen;
  assert.strictEqual(c.packs, 18, '默认建议 18 包');
  assert.strictEqual(c.boughtShots, 144);
  assert.strictEqual(c.usable, 137);
  assert.strictEqual(c.actualShots, 137);
  assert.strictEqual(c.leftovers, 7);
  assert.strictEqual(c.spend, 1224);
  assert.strictEqual(c.leftoverCost, 59.5);
  assert.ok(near(c.leftoverCost, 7 * (68 / 8), 1e-9));
  assert.ok(near(c.realPerShot, 1224 / 137, 1e-12), '每张实际成本');
  assert.ok(near(c.realPerShot - 68 / 8, 1224 / 137 - 8.5, 1e-12), '与名义单价之差');
  assert.strictEqual(r.plan.basisPacks, 18);
  assert.strictEqual(r.plan.minPacksByNeed, 18);
});

test('2 默认场景：18 包够、17 包不够（最小性）', () => {
  const cfg = withCfg({});
  assert.strictEqual(A.usableShots(cfg, 18), 137);
  assert.strictEqual(A.usableShots(cfg, 17), 136);
  assert.ok(A.usableShots(cfg, 17) < 137 - 1e-9, '17 包不该够：' + A.usableShots(cfg, 17));
  const r = A.compute(cfg);
  assert.strictEqual(r.plan.basisPacks, 18);
  assert.strictEqual(r.plan.minPacksByNeed, 18);
});

test('3 恰好整包用完：没有余料，包数就是 need ÷ 每包张数', () => {
  const r = compute({ wantShots: 96, haveShots: 0, packShots: 8 });
  assert.strictEqual(r.plan.chosen.packs, 12);
  assert.strictEqual(r.plan.chosen.leftovers, 0);
  assert.strictEqual(r.plan.chosen.usable, 96);
  assert.strictEqual(r.plan.chosen.leftoverCost, 0);
  assert.strictEqual(r.shop.total, 12 * 96);
});

test('4 差 1 张要整包：want=9 / 每包 8 张 → 2 包，余料 7 张', () => {
  const r = compute({ wantShots: 9, packShots: 8, haveShots: 0 });
  assert.strictEqual(r.plan.chosen.packs, 2);
  assert.strictEqual(r.plan.chosen.leftovers, 7);
  assert.strictEqual(r.plan.chosen.usable, 9);
});

test('5 照片墙几何：2400×1500 墙 + 54×86 相纸 + 每边 2mm 框 + 20mm 缝', () => {
  const r = compute({});
  const w = r.wall;
  assert.strictEqual(w.frameW, 58);
  assert.strictEqual(w.frameH, 90);
  assert.strictEqual(w.dispW, 58);
  assert.strictEqual(w.dispH, 90);
  assert.strictEqual(w.pitchW, 78);
  assert.strictEqual(w.pitchH, 110);
  assert.strictEqual(w.cols, 31);
  assert.strictEqual(w.rows, 13);
  assert.strictEqual(w.count, 403);
  assert.strictEqual(w.usedW, 31 * 58 + 30 * 20);   // 2398
  assert.strictEqual(w.usedH, 13 * 90 + 12 * 20);   // 1410
  assert.ok(w.usedW <= 2400 && w.usedH <= 1500);
  assert.strictEqual(w.needShots, 403);
  // 独立重写一遍列/行算式
  const cols2 = Math.floor((2400 + 20) / (54 + 2 * 2 + 20));
  const rows2 = Math.floor((1500 + 20) / (86 + 2 * 2 + 20));
  assert.strictEqual(w.cols, cols2);
  assert.strictEqual(w.rows, rows2);
  assert.ok(near(w.fillPct, 2398 * 1410 / (2400 * 1500) * 100, 1e-9));
});

test('6 相册内页：137 张 ÷ 每页 3 个口袋 = 46 张内页 → 5 小包', () => {
  const r = compute({});
  assert.strictEqual(r.album.kind, 'sheet');
  assert.strictEqual(r.album.sheets, 46);
  assert.strictEqual(r.album.packs, 5);
  assert.strictEqual(r.album.cells, 138);
  assert.strictEqual(r.album.extraCells, 1);
  assert.strictEqual(r.album.extraSheets, 4);
  assert.ok(r.album.cells >= 137);
});

test('7 成品相册口径：一本 = 内页张数 × 每页口袋', () => {
  const r = compute({ albumKind: 'book', albumBookSheets: 30, albumSheetPocket: 3, wantShots: 137 });
  assert.strictEqual(r.album.kind, 'book');
  assert.strictEqual(r.album.perBook, 90);
  assert.strictEqual(r.album.books, 2);
  assert.strictEqual(r.album.cells, 180);
  assert.ok(r.album.cells >= 137);
});

test('8 冲洗店对照：两边口径必须用同一个张数', () => {
  const r = compute({ printShopPrice: 12 });
  assert.ok(r.shop);
  assert.strictEqual(r.shop.shots, r.plan.chosen.actualShots);
  assert.strictEqual(r.shop.total, 12 * r.plan.chosen.actualShots);
  assert.strictEqual(r.shop.diff, r.plan.chosen.spend - r.shop.total);
  assert.strictEqual(r.shop.cheaper, 'film');
  assert.strictEqual(r.shop.total, 1644);
  assert.strictEqual(r.shop.diff, -420);
  assert.strictEqual(compute({ printShopPrice: 3 }).shop.cheaper, 'shop');
  const r3 = compute({ printShopPrice: '' });
  assert.strictEqual(r3.shop, null);
  assert.strictEqual(r3.ok, true, '留空不该报错');
});

test('9 自洽：余料 = 最少包数 × 每包张数 − 还差的张数', () => {
  const cfg = withCfg({});
  const c = A.planFor(cfg, 18, 0);
  assert.strictEqual(c.leftovers, 18 * 8 - 137);
  assert.strictEqual(c.usable, 137);
  for (const want of [1, 5, 8, 9, 16, 17, 100, 137, 999]) {
    const cfg2 = withCfg({ wantShots: want, haveShots: 0, packShots: 8 });
    const minPacks = Math.ceil(want / 8);
    const c2 = A.planFor(cfg2, minPacks, 0);
    assert.strictEqual(c2.leftovers, minPacks * 8 - want, 'want=' + want);
    assert.strictEqual(c2.packs, minPacks);
    assert.strictEqual(c2.usable, want);
  }
});

test('10 买多不买少：包数越多「够拍出来」不减少，余料只增不减', () => {
  const cfg = withCfg({});
  let prevU = -Infinity, prevL = -Infinity;
  for (let k = 0; k <= 60; k++) {
    const u = A.usableShots(cfg, k);
    const l = A.planFor(cfg, k, 0).leftovers;
    assert.ok(u >= prevU - 1e-9, 'k=' + k + ' 可用 ' + u + ' < ' + prevU);
    assert.ok(l >= prevL - 1e-9, 'k=' + k + ' 余料 ' + l + ' < ' + prevL);
    prevU = u; prevL = l;
  }
  assert.strictEqual(prevU, 137, '买到足够多时可用就固定在要拍的张数');
});

test('11 三档判定：余料 0 / 小半包 / 多于半包', () => {
  const a = compute({ wantShots: 9, packShots: 8, haveShots: 0 });
  assert.strictEqual(a.plan.chosen.leftovers, 7);
  assert.strictEqual(a.verdict.level, 'warn');
  const b = compute({ wantShots: 8, packShots: 8, haveShots: 0 });
  assert.strictEqual(b.plan.chosen.leftovers, 0);
  assert.strictEqual(b.verdict.level, 'ok');
  assert.ok(b.verdict.title.indexOf('一张不多') >= 0, b.verdict.title);
  const c = compute({ wantShots: 12, packShots: 8, haveShots: 0 });
  assert.strictEqual(c.plan.chosen.leftovers, 4);
  assert.ok(c.verdict.title.indexOf('只多出') >= 0, c.verdict.title);
});

test('12 每包张数越多、所需包数越少，余料可能反而为 0', () => {
  const a = compute({ wantShots: 100, packShots: 8, haveShots: 0 });
  const b = compute({ wantShots: 100, packShots: 20, haveShots: 0 });
  assert.strictEqual(a.plan.chosen.packs, 13);
  assert.strictEqual(a.plan.chosen.leftovers, 4);
  assert.strictEqual(b.plan.chosen.packs, 5);
  assert.strictEqual(b.plan.chosen.leftovers, 0);
});

test('13 存量抵充：已有 20 张时包数下降，刚好不多不少', () => {
  const a = compute({ haveShots: 0, wantShots: 100 });
  const b = compute({ haveShots: 20, wantShots: 100 });
  assert.strictEqual(a.plan.chosen.packs, 13);
  assert.strictEqual(b.plan.chosen.packs, 10);
  assert.strictEqual(b.plan.chosen.leftovers, 0, '20 + 80 = 100，恰好不多不少');
  assert.strictEqual(b.plan.chosen.actualShots, 100);
});

test('14 存量超过计划：一包都不用买', () => {
  const r = compute({ haveShots: 500, wantShots: 100 });
  assert.strictEqual(r.plan.chosen.packs, 0);
  assert.strictEqual(r.plan.chosen.spend, 0);
  assert.strictEqual(r.plan.minPacksByNeed, 0);
  assert.strictEqual(r.plan.basisPacks, 0);
  assert.strictEqual(r.plan.chosen.realPerShot, 0, '不花钱时每张成本是 0（不是算不出来）');
  assert.strictEqual(r.verdict.level, 'ok');
});

test('15 计划为 0：空账不算错，也不给每张成本', () => {
  const r = compute({ wantShots: 0 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.plan.chosen.packs, 0);
  assert.strictEqual(r.plan.chosen.usable, 0);
  assert.strictEqual(r.album.sheets, 0);
  assert.strictEqual(r.album.packs, 0);
});

test('16 备用包：不影响够不够，只多花钱与余料', () => {
  const cfg = withCfg({ reservePacks: 3 });
  const r = A.compute(cfg);
  const base = A.planFor(cfg, r.plan.minPacksByNeed, 0);
  assert.strictEqual(r.plan.chosen.extraPacks, 3);
  assert.strictEqual(r.plan.chosen.packs, r.plan.minPacksByNeed + 3);
  assert.strictEqual(r.plan.chosen.usable, base.usable, '够拍出来的张数不变');
  assert.strictEqual(r.plan.chosen.leftovers, base.leftovers + 24, '余料正好多 3 包');
  assert.ok(r.plan.chosen.realPerShot >= base.realPerShot - 1e-12, '备用越多每张不该更便宜');
  assert.strictEqual(r.plan.chosen.spend, (r.plan.minPacksByNeed + 3) * 68);
});

test('17 备用包候选表单调且与正式结果一致', () => {
  const r = compute({});
  const cs = r.plan.candidates;
  assert.strictEqual(cs.length, 9);
  for (let i = 1; i < cs.length; i++) {
    assert.ok(cs[i].leftovers >= cs[i - 1].leftovers - 1e-9, '候选余料不单调');
    assert.strictEqual(cs[i].packs, cs[i].extraPacks + r.plan.minPacksByNeed);
  }
  assert.ok(cs.some(c => c.extraPacks === r.plan.chosen.extraPacks && c.packs === r.plan.chosen.packs));
});

test('18 量纲不变性：价格全部 ×10，包数与几何一位都不变、成本 ×10', () => {
  const a = compute({ packPrice: 68, printShopPrice: 12 });
  const b = compute({ packPrice: 680, printShopPrice: 120 });
  assert.strictEqual(a.plan.chosen.packs, b.plan.chosen.packs);
  assert.strictEqual(a.plan.chosen.leftovers, b.plan.chosen.leftovers);
  assert.ok(near(a.plan.chosen.spend * 10, b.plan.chosen.spend, 1e-9));
  assert.ok(near(a.plan.chosen.leftoverCost * 10, b.plan.chosen.leftoverCost, 1e-9));
  assert.strictEqual(a.wall.cols, b.wall.cols);
  assert.strictEqual(a.wall.usedW, b.wall.usedW);
  assert.strictEqual(a.album.sheets, b.album.sheets);
  assert.ok(near(a.plan.chosen.realPerShot * 10, b.plan.chosen.realPerShot, 1e-9));
});

test('19 照片墙放不下：相框比墙还大要报错并指出是哪个字段', () => {
  const r = compute({ wantWall: true, wallW: 60, wallH: 60, paperKind: 'wide' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some(e => e.field === 'wallW'), JSON.stringify(r.errors));
  // 不算照片墙时，墙的尺寸与它没关系（60×60 只是小于字段下限 100，不是「放不下」）
  const r2 = compute({ wantWall: false, paperKind: 'wide' });
  assert.strictEqual(r2.ok, true, '不算照片墙时不该管墙的尺寸');
  // 但字段本身的取值范围仍然要守住
  assert.strictEqual(compute({ wantWall: false, wallW: 60 }).ok, false);
});

test('19b 相框两个方向要分别比：宽幅相纸在 100×100 的墙上就是放不下', () => {
  // 宽幅 86×108 + 每边 2 → 含框 90×112；高度 112 > 100，必须报错
  const r = compute({ paperKind: 'wide', wantWall: true, wallW: 100, wallH: 100 });
  assert.strictEqual(r.ok, false, '短边 90 ≤ 100 就被放过是错的');
  assert.ok(r.errors.some(e => e.field === 'wallW' && /112/.test(e.msg)), JSON.stringify(r.errors));
  // 120×120 放得下（90 ≤ 120、112 ≤ 120）
  assert.strictEqual(compute({ paperKind: 'wide', wantWall: true, wallW: 120, wallH: 120 }).ok, true);
  // 只有高度差一点：120 宽 × 111 高 → 高 112 > 111 仍要报错
  assert.strictEqual(compute({ paperKind: 'wide', wantWall: true, wallW: 120, wallH: 111 }).ok, false);
  assert.strictEqual(compute({ paperKind: 'wide', wantWall: true, wallW: 120, wallH: 112 }).ok, true);
});

test('20 尺寸边界：相纸宽高为 0 / 负数被拦下', () => {
  assert.strictEqual(compute({ paperKind: 'custom', paperW: 0, paperH: 86 }).ok, false);
  assert.strictEqual(compute({ paperKind: 'custom', paperW: -5, paperH: 86 }).ok, false);
  assert.strictEqual(compute({ paperKind: 'custom', paperW: 5, paperH: 5 }).ok, true);
});

test('21 非法输入逐条核字段：空串、乱码、超范围、非整数', () => {
  const cases = [
    ['', 'haveShots'], ['abc', 'haveShots'], ['-1', 'haveShots'], ['20001', 'haveShots'], ['1.5', 'haveShots'],
    ['', 'packShots'], ['0', 'packShots'], ['101', 'packShots'], ['2.5', 'packShots'],
    ['', 'packPrice'], ['-1', 'packPrice'], ['10001', 'packPrice'],
    ['', 'wantShots'], ['-1', 'wantShots'], ['20001', 'wantShots'], ['3.3', 'wantShots'],
    ['', 'wallW'], ['50', 'wallW'], ['20001', 'wallW'],
    ['', 'wallH'], ['50', 'wallH'],
    ['', 'frameGap'], ['21', 'frameGap'], ['-1', 'frameGap'],
    ['', 'gapMM'], ['501', 'gapMM'],
    ['', 'albumSheetPocket'], ['0', 'albumSheetPocket'], ['21', 'albumSheetPocket'],
    ['', 'albumPackSheets'], ['0', 'albumPackSheets'],
    ['', 'albumBookSheets'], ['0', 'albumBookSheets'],
    ['xyz', 'printShopPrice'], ['-1', 'printShopPrice'], ['10001', 'printShopPrice'],
    ['', 'reservePacks'], ['-1', 'reservePacks'], ['51', 'reservePacks'], ['2.5', 'reservePacks']
  ];
  cases.forEach(([v, field]) => {
    const r = compute({ [field]: v });
    assert.strictEqual(r.ok, false, field + '=' + JSON.stringify(v) + ' 应该被拦下');
    assert.ok(r.fieldErr[field], field + ' 应被标红；实际错误字段 ' + JSON.stringify(Object.keys(r.fieldErr)));
  });
});

test('21b 自定尺寸才校验宽高：选了预设画幅时宽高由预设决定', () => {
  [['', 'paperW'], ['4', 'paperW'], ['601', 'paperW'], ['', 'paperH'], ['601', 'paperH']].forEach(([v, field]) => {
    const r = compute({ paperKind: 'custom', [field]: v });
    assert.strictEqual(r.ok, false, 'custom ' + field + '=' + JSON.stringify(v) + ' 应该被拦下');
    assert.ok(r.fieldErr[field], field + ' 应被标红');
  });
  // 选了预设画幅：宽高被预设覆盖，填什么都不该报错（这是明示的行为）
  const ok = compute({ paperKind: 'mini', paperW: '', paperH: '999' });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.cfg.paperW, 54);
  assert.strictEqual(ok.cfg.paperH, 86);
});

test('22 一次多错：三处都填错要一次报三处，不是只报第一处', () => {
  const r = compute({ haveShots: 'x', packShots: '0', wallW: '40' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length >= 3, '只报了 ' + r.errors.length + ' 处');
  ['haveShots', 'packShots', 'wallW'].forEach(f => assert.ok(r.fieldErr[f], f + ' 未标红'));
});

test('23 留空不等于套默认值：清空一个必填框必须报错', () => {
  const r = compute({ wantShots: '' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.fieldErr.wantShots);
  assert.strictEqual(compute({ printShopPrice: '' }).ok, true, '只有冲洗店单价允许留空');
});

test('24 枚举兜底：未知画幅退回 mini，未知收纳方式退回内页', () => {
  const cfg = A.normCfg({ paperKind: 'nope', albumKind: 'nope' });
  assert.strictEqual(cfg.paperKind, 'mini');
  assert.strictEqual(cfg.albumKind, 'sheet');
  const cfg2 = A.normCfg({ paperKind: 'square', paperW: 999, paperH: 999 });
  assert.strictEqual(cfg2.paperW, 72);
  assert.strictEqual(cfg2.paperH, 86);
  const cfg3 = A.normCfg({ paperKind: 'custom', paperW: 60, paperH: 90 });
  assert.strictEqual(cfg3.paperW, 60);
  assert.strictEqual(cfg3.paperH, 90);
});

test('25 输出契约：递归查 NaN / Infinity，且不修改入参', () => {
  const raw = Object.assign({}, D);
  const snapshot = JSON.stringify(raw);
  const r = A.compute(raw);
  assert.strictEqual(JSON.stringify(raw), snapshot, 'compute 不该改入参');
  const bad = [];
  (function walk(o, path) {
    if (typeof o === 'number') { if (!isFinite(o)) bad.push(path); return; }
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(k => walk(o[k], path + '.' + k));
  })(r, 'r');
  assert.deepStrictEqual(bad, [], '有非法数字：' + bad.join(','));
});

test('26 确定性：同输入两次计算结果完全一致', () => {
  assert.strictEqual(JSON.stringify(A.compute(withCfg({}))), JSON.stringify(A.compute(withCfg({}))));
});

test('27 结构自检全通过（默认场景，逐条列出失败项）', () => {
  const r = compute({});
  const fail = r.selfChecks.filter(s => !s.ok);
  assert.deepStrictEqual(fail.map(s => s.name), [], '自检失败：' + JSON.stringify(fail, null, 1));
  assert.ok(r.selfChecks.length >= 30, '自检项只有 ' + r.selfChecks.length + ' 条');
});

test('28 八个内置场景：全部能算、自检全过', () => {
  A.SCENARIOS.forEach(s => {
    const r = A.compute(A.normCfg(Object.assign({}, D, s.patch)));
    assert.strictEqual(r.ok, true, s.id + ' 算不出来：' + JSON.stringify(r.errors));
    const fail = r.selfChecks.filter(x => !x.ok);
    assert.deepStrictEqual(fail.map(x => x.name), [], s.id + ' 自检失败');
    assert.ok(r.plan.chosen.usable >= Math.min(r.cfg.wantShots, r.cfg.haveShots + r.plan.chosen.boughtShots) - 1e-9,
      s.id + ' 够拍出来没取满');
  });
});

test('29 随机压力：200 组合法规格下自检必须全过（不变量扫描）', () => {
  let seed = 20261112;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function pick(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  let checked = 0, assertions = 0;
  for (let i = 0; i < 200; i++) {
    const cfg = A.normCfg(Object.assign({}, D, {
      paperKind: 'custom', paperW: pick(10, 200), paperH: pick(10, 200),
      packShots: pick(1, 30), packPrice: pick(0, 500), wantShots: pick(0, 600), haveShots: pick(0, 100),
      reservePacks: pick(0, 10),
      wallW: pick(200, 4000), wallH: pick(200, 3000), frameGap: pick(0, 10), gapMM: pick(0, 100),
      albumSheetPocket: pick(1, 12), albumPackSheets: pick(1, 50), albumBookSheets: pick(1, 100)
    }));
    const r = A.compute(cfg);
    if (!r.ok) continue;
    checked++;
    const fail = r.selfChecks.filter(x => !x.ok);
    assertions += r.selfChecks.length;
    assert.deepStrictEqual(fail.map(x => x.name), [],
      '第 ' + i + ' 组自检失败：' + JSON.stringify(fail) + ' cfg=' + JSON.stringify(cfg));
  }
  assert.ok(checked >= 150, '有效样本只有 ' + checked + ' 组');
  assert.ok(assertions >= 4500, '累计断言只有 ' + assertions + ' 条');
});

test('30 随机压力：六条物理不变量（买多不买少、可用不超过买来、余料不超一包）', () => {
  let seed = 777;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function pick(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const cfg = A.normCfg(Object.assign({}, D, {
      packShots: pick(1, 40), packPrice: pick(0, 300), wantShots: pick(0, 800), haveShots: pick(0, 300),
      reservePacks: pick(0, 8)
    }));
    const r = A.compute(cfg);
    if (!r.ok) continue;
    n++;
    const c = r.plan.chosen;
    assert.ok(c.usable <= cfg.haveShots + c.boughtShots + 1e-9,
      'ⅰ 够拍出来不能超过「已有 + 买来的」：' + c.usable);
    assert.ok(c.usable >= Math.min(cfg.wantShots, cfg.haveShots + c.boughtShots) - 1e-9,
      'ⅱ 够拍出来必须取满：' + c.usable);
    assert.ok(c.leftovers <= c.extraPacks * cfg.packShots + cfg.packShots - 1 + 1e-9,
      'ⅲ 余料不能超过「备用包 + 一包」：' + c.leftovers);
    assert.ok(c.leftovers >= -1e-9, 'ⅳ 余料不能为负');
    assert.ok(Math.abs(c.spend - c.packs * cfg.packPrice) < 1e-9, 'ⅴ 花费 = 包数 × 单价');
    assert.ok(A.usableShots(cfg, c.packs + 1) >= c.usable - 1e-9, 'ⅵ 买多不买少');
    if (cfg.haveShots >= cfg.wantShots) {
      assert.strictEqual(r.plan.basisPacks, 0, 'ⅶ 存量够时基准包数必须是 0');
      assert.strictEqual(c.packs, cfg.reservePacks, 'ⅶ 存量够时只该买用户自己要留的备用包');
    }
  }
  assert.ok(n >= 200, '有效样本只有 ' + n);
});

test('31 敏感性：13 行、每行都指向真实字段', () => {
  const rows = A.sensitivity(withCfg({}));
  assert.strictEqual(rows.length, 13);
  rows.forEach(r => {
    assert.ok(r.field in D, '未知字段 ' + r.field);
    assert.ok([-1, 1].indexOf(Math.sign(r.delta)) >= 0, 'delta 必须是 ±');
  });
  const base = A.compute(withCfg({})).plan.chosen.packs;
  const up = rows.find(r => r.field === 'wantShots' && r.delta === 60);
  assert.ok(up.packs >= base, '计划 +60 张包数反而少了');
  const p2 = rows.find(r => r.field === 'packShots' && r.delta === 2);
  assert.ok(p2.packs <= base, '每包更多张反而要更多包');
});

test('32 敏感性每行与「把同一个引擎用新数字重算」逐位一致', () => {
  const cfg = withCfg({});
  A.sensitivity(cfg).forEach(row => {
    const raw = Object.assign({}, cfg);
    raw[row.field] = Number(cfg[row.field]) + row.delta;
    if (row.field === 'reservePacks' && raw[row.field] < 0) raw[row.field] = 0;
    if (row.field === 'haveShots' && raw[row.field] < 0) raw[row.field] = 0;
    const fresh = A.compute(A.normCfg(raw));
    assert.strictEqual(row.ok, fresh.ok, row.field + ' ok 不一致');
    if (fresh.ok) {
      assert.strictEqual(row.packs, fresh.plan.chosen.packs, row.field + ' 包数不一致');
      assert.strictEqual(row.usable, A.r6(fresh.plan.chosen.usable), row.field + ' 可用不一致');
      assert.strictEqual(row.spend, A.r6(fresh.plan.chosen.spend));
      assert.strictEqual(row.realPerShot === null, fresh.plan.chosen.realPerShot === null);
    }
  });
});

test('33 建议补丁可回代：一键采用的补丁再算一遍要真的变好或至少不更差', () => {
  const cfg = withCfg({ reservePacks: 6 });
  const r = A.compute(cfg);
  assert.ok(r.advice.length > 0, '留 6 包备用时应该有建议');
  r.advice.forEach(a => {
    const patched = A.normCfg(Object.assign({}, cfg, a.patch));
    const r2 = A.compute(patched);
    assert.strictEqual(r2.ok, true, '补丁导致算不出来：' + JSON.stringify(a.patch));
    assert.ok(r2.plan.chosen.realPerShot === null ||
      r2.plan.chosen.realPerShot <= r.plan.chosen.realPerShot + 1e-9 ||
      r2.plan.chosen.usable >= r.plan.chosen.usable - 1e-9,
      '补丁 ' + JSON.stringify(a.patch) + ' 让每张成本变贵且可用更少');
  });
});

test('34 反推 R1/R4 可回代', () => {
  const r = compute({});
  const cfg = withCfg({});
  const r1 = r.reverse.find(x => x.id === 'R1');
  assert.ok(r1, '缺 R1');
  const budget = r.plan.chosen.spend;
  const packs = Math.floor(budget / cfg.packPrice);
  assert.strictEqual(packs, r.plan.chosen.packs);
  const r4 = r.reverse.find(x => x.id === 'R4');
  assert.ok(r4);
  const wallPacks = Math.ceil(r.wall.needShots / cfg.packShots);
  assert.strictEqual(wallPacks, 51);
  assert.ok(r4.value.indexOf(String(wallPacks) + ' 包') >= 0, 'R4 文案与手算包数不符：' + r4.value);
  assert.ok(wallPacks * cfg.packShots >= r.wall.needShots);
});

test('35 文案锁：关键口径声明不能被改掉', () => {
  const r = compute({});
  const all = JSON.stringify(r);
  ['不联网', '不内置任何品牌', '虚构示例', '设计选择', '不是任何标准', '整包'].forEach(w => {
    assert.ok(all.indexOf(w) >= 0, '缺少口径声明：' + w);
  });
  assert.ok(r.notes.length >= 5, '边界说明只有 ' + r.notes.length + ' 条');
  assert.ok(r.notes.some(n => n.indexOf('整包') >= 0), '整包购买口径必须写明');
  assert.ok(r.notes.some(n => n.indexOf('有效期') >= 0), '相纸有效期的边界必须写明');
  assert.ok(r.notes.some(n => n.indexOf('承重') >= 0), '照片墙边界必须写明');
});

test('36 单位与显示：金额千分位、百分比、缺失值显示「—」而不是 NaN', () => {
  assert.strictEqual(A.fmtMoney(1224), '1,224.00');
  assert.strictEqual(A.fmtMoney(8.9343), '8.93');
  assert.strictEqual(A.fmtMoney(null), '—');
  assert.strictEqual(A.fmtNum(NaN), '—');
  assert.strictEqual(A.fmtPct(4.214), '4.21%');
  assert.strictEqual(A.fmtPct(null), '—');
  const r = compute({ printShopPrice: '' });
  assert.strictEqual(r.shop, null);
  assert.ok(r.kpis.every(k => String(k.value).indexOf('NaN') < 0 && String(k.sub).indexOf('NaN') < 0));
  assert.ok(r.lines.every(l => String(l.v).indexOf('NaN') < 0 && String(l.note).indexOf('NaN') < 0));
});

test('37 余料张数恰好是「最后一包里没用到的那部分」', () => {
  [1, 2, 3, 7, 8, 9, 15, 16, 17, 100, 137, 300].forEach(w => {
    const cfg = withCfg({ wantShots: w, haveShots: 0, packShots: 8 });
    const minPacks = Math.ceil(w / 8);
    const c = A.planFor(cfg, minPacks, 0);
    const rem = w - Math.floor(w / 8) * 8;
    const expect = rem === 0 ? 0 : 8 - rem;
    assert.strictEqual(c.leftovers, expect, 'want=' + w + ' 期望余料 ' + expect);
    assert.strictEqual(c.usable, w);
  });
});

test('38 相纸尺寸只解析不改写：自定义尺寸会原样进入几何', () => {
  const r = compute({ paperKind: 'custom', paperW: 100, paperH: 50, wantWall: true });
  assert.strictEqual(r.wall.paperW, 100);
  assert.strictEqual(r.wall.paperH, 50);
  assert.strictEqual(r.wall.dispW, 50 + 4);   // 竖挂：短边作宽
  assert.strictEqual(r.wall.dispH, 100 + 4);
});

test('39 相册两种口径互斥：选内页时不给成品相册读数，反之亦然', () => {
  const a = compute({ albumKind: 'sheet' });
  assert.ok(a.album.packs !== null && a.album.books === null);
  const b = compute({ albumKind: 'book' });
  assert.ok(b.album.books !== null && b.album.packs === undefined);
});

test('40 每包价格 0：每张成本就是 0，也不报错', () => {
  const r = compute({ packPrice: 0 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.plan.chosen.spend, 0);
  assert.strictEqual(r.plan.chosen.realPerShot, 0);
  assert.strictEqual(r.plan.chosen.leftoverCost, 0);
  assert.strictEqual(r.shop.cheaper, 'film');
  assert.ok(r.kpis.every(k => String(k.value).indexOf('Infinity') < 0));
});
