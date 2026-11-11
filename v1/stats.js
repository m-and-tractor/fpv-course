/* Admin learning statistics: #admin-stats (all groups) or #admin-stats-<group id>.
   Plain SVG charts, colors from --c1..--c3 (validated for light and dark), hover/tap tooltips, a table under each chart. */
var STATS = (function () {
  var A, sb, data = null, sel = { g: '', m: '' }, resizeT;
  var NS = 'http://www.w3.org/2000/svg';
  function esc(s) { return A.esc(s == null ? '' : s); }
  function $(s) { return A.$(s); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function mins(s) { return Math.round(s / 60); }
  var DAY = 864e5;
  function weekStart(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); var wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; }
  function dm(t) { var d = new Date(t); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function niceMax(v) { var st = Math.max(1, v / 4), p = Math.pow(10, Math.floor(Math.log10(st))), u = p >= 10 ? p / 2 : 1; return Math.ceil(st / u) * u * 4; }
  function short(l) {
    var m = /^i0?(\d+)$/.exec(l.id); if (m) return 'Вступ ' + m[1];
    m = /^m0?(\d+)l0?(\d+)$/.exec(l.id); return m ? 'М' + m[1] + ' · урок ' + m[2] : l.id;
  }
  function lessons() { var L = A.lessons(); return Object.keys(L).map(function (k) { return L[k]; }).filter(function (l) { return !l.soon; }); }
  function doneAt(l, p) {
    if (!p) return null;
    if (l.quiz && l.quiz.length) return p.quiz && p.quiz.done ? (p.quiz.at || p.seenAt || 0) : null;
    return p.seen ? (p.seenAt || 0) : null;
  }

  // ---------- data ----------
  function load() {
    return Promise.all([
      sb.from('groups').select('id,name,retakes,created_at').order('created_at'),
      sb.from('memberships').select('user_id,group_id,status,created_at').eq('status', 'active'),
      sb.from('profiles').select('id,nickname,role')
    ]).then(function (r) {
      var groups = r[0].data || [], mem = r[1].data || [], prof = {};
      (r[2].data || []).forEach(function (p) { prof[p.id] = p; });
      mem = mem.filter(function (m) { return prof[m.user_id] && prof[m.user_id].role === 'learner'; });
      var ids = mem.map(function (m) { return m.user_id; });
      if (!ids.length) return { groups: groups, mem: mem, prof: prof, prog: {}, att: {}, grants: {} };
      return Promise.all([
        sb.from('progress').select('user_id,data,updated_at').in('user_id', ids),
        sb.from('test_attempts').select('user_id,module_id,score,total,passed,started_at').in('user_id', ids).order('started_at'),
        sb.from('test_grants').select('user_id,module_id,extra').in('user_id', ids)
      ]).then(function (x) {
        var prog = {}, att = {}, grants = {};
        (x[0].data || []).forEach(function (p) { prog[p.user_id] = p; });
        (x[1].data || []).forEach(function (a) { (att[a.user_id] = att[a.user_id] || []).push(a); });
        (x[2].data || []).forEach(function (g) { grants[g.user_id + '|' + g.module_id] = g.extra || 0; });
        return { groups: groups, mem: mem, prof: prof, prog: prog, att: att, grants: grants };
      });
    });
  }

  function compute(D) {
    var now = Date.now(), L = lessons(), mods = A.modules();
    var gById = {}; D.groups.forEach(function (g) { gById[g.id] = g; });
    var mem = D.mem.filter(function (m) { return !sel.g || m.group_id === sel.g; });
    var mod = sel.m || (mods[0] && mods[0].id);
    var S = { cadets: mem.length, groups: sel.g ? 1 : D.groups.length, active7: 0, lessonsDone: 0,
      perLesson: L.map(function (l) { return { l: l, done: 0, opened: 0, v: 0, r: 0 }; }),
      weeks: {}, start: null, vSec: 0, rSec: 0, pref: [0, 0, 0], tried: 0, passed: 0, exhausted: 0,
      toPass: [0, 0, 0, 0], scores: [0, 0, 0, 0, 0, 0], attemptsAll: 0, mod: mod, L: L };
    function wk(t) { var w = weekStart(t); var o = S.weeks[w] || (S.weeks[w] = { done: 0, who: {} }); return o; }
    mem.forEach(function (m) {
      var d = (D.prog[m.user_id] || {}).data || {}, les = d.les || {}, use = d.use || {}, last = 0, v = 0, r = 0;
      var joined = new Date(m.created_at).getTime(); if (S.start == null || joined < S.start) S.start = joined;
      L.forEach(function (l, i) {
        var p = les[l.id], u = use[l.id], t = doneAt(l, p), pl = S.perLesson[i];
        if (t != null) { pl.done++; S.lessonsDone++; var w = wk(t); w.done++; w.who[m.user_id] = 1; last = Math.max(last, t); }
        if (p && p.seenAt) { wk(p.seenAt).who[m.user_id] = 1; last = Math.max(last, p.seenAt); }
        if (u && (u.v || u.r)) { pl.opened++; pl.v += u.v || 0; pl.r += u.r || 0; v += u.v || 0; r += u.r || 0; if (u.last) { wk(u.last).who[m.user_id] = 1; last = Math.max(last, u.last); } }
      });
      S.vSec += v; S.rSec += r;
      if (v + r >= 60) { var sh = v / (v + r); S.pref[sh >= 0.65 ? 0 : sh <= 0.35 ? 1 : 2]++; }
      var at = (D.att[m.user_id] || []).filter(function (a) { return a.module_id === mod; });
      at.forEach(function (a) {
        var t = new Date(a.started_at).getTime(); wk(t).who[m.user_id] = 1; last = Math.max(last, t);
        if (a.score != null && a.total) { S.attemptsAll++; var p = a.score / a.total * 100; S.scores[p < 50 ? 0 : Math.min(5, Math.floor(p / 10) - 4)]++; }
      });
      if (at.length) {
        S.tried++;
        var k = -1; at.some(function (a, i) { if (a.passed) { k = i; return true; } return false; });
        if (k >= 0) { S.passed++; S.toPass[Math.min(3, k)]++; }
        else { var g = gById[m.group_id], allowed = 1 + (g ? g.retakes : 2) + (D.grants[m.user_id + '|' + mod] || 0); if (at.length >= allowed) S.exhausted++; }
      }
      if (now - last <= 7 * DAY) S.active7++;
    });
    var w0 = weekStart(S.start || now), wN = weekStart(now), list = [];
    for (var w = w0; w <= wN; w += 7 * DAY) {
      w = weekStart(w + DAY * 0.5); // DST-safe
      var o = S.weeks[w] || { done: 0, who: {} };
      list.push({ w: w, done: o.done, active: Object.keys(o.who).length });
    }
    S.weekList = list.slice(-12);
    return S;
  }

  // ---------- svg helpers ----------
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function txt(parent, x, y, s, cls, anchor) { var t = el('text', { x: x, y: y, class: cls || 'ax', 'text-anchor': anchor || 'start' }, parent); t.textContent = s; return t; }
  function vbar(x, y, w, h, r) { r = Math.min(r, h, w / 2); return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z'; }
  function hbar(x, y, w, h, r, roundLeft) {
    r = Math.min(r, w / 2, h / 2); var rl = roundLeft ? r : 0;
    return 'M' + (x + rl) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) +
      'H' + (x + rl) + (rl ? 'Q' + x + ',' + (y + h) + ' ' + x + ',' + (y + h - rl) + 'V' + (y + rl) + 'Q' + x + ',' + y + ' ' + (x + rl) + ',' + y : 'V' + y) + 'Z';
  }
  function svg(w, h) { return el('svg', { width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, role: 'img' }); }

  // vertical bars with a y-axis; o = { cats, vals, tips, h, ref:{v,label}, dim:fn(i) }
  function columns(box, o) {
    var W = box.clientWidth || 320, H = o.h || 190, padL = 30, padB = 26, padT = 12, n = o.vals.length;
    var max = niceMax(Math.max.apply(null, o.vals.concat([1]))), s = svg(W, H), ph = H - padB - padT, pw = W - padL - 4;
    for (var i = 0; i <= 4; i++) { var y = padT + ph - ph * i / 4; el('line', { x1: padL, x2: W - 4, y1: y, y2: y, class: i ? 'grid' : 'base' }, s); txt(s, padL - 6, y + 4, String(Math.round(max * i / 4)), 'ax', 'end'); }
    var slot = pw / n, bw = Math.max(6, Math.min(28, slot - 6)), every = Math.ceil(n / Math.floor(pw / 46));
    o.vals.forEach(function (v, i) {
      var x = padL + slot * i + (slot - bw) / 2, h = ph * v / max;
      if (v > 0) el('path', { d: vbar(x, padT + ph - h, bw, h, 4), class: 'mk c1' + (o.dim && o.dim(i) ? ' dim' : '') }, s);
      el('rect', { x: padL + slot * i, y: padT, width: slot, height: ph + 4, class: 'hit', 'data-tip': o.tips[i] }, s);
      if (i % every === 0 || i === n - 1) txt(s, x + bw / 2, H - 8, o.cats[i], 'ax', 'middle');
    });
    if (o.ref) {
      var rx = padL + slot * o.ref.at; el('line', { x1: rx, x2: rx, y1: padT - 4, y2: padT + ph, class: 'ref' }, s);
      txt(s, rx + 4, padT + 6, o.ref.label, 'ax strong');
    }
    box.appendChild(s);
  }

  // labelled horizontal rows; o = { rows:[{label, right, segs:[{v, cls, tip}]}], max }
  function rows(box, o) {
    var W = box.clientWidth || 320, rowH = 38, H = o.rows.length * rowH + 2, s = svg(W, H);
    o.rows.forEach(function (r, i) {
      var y = i * rowH; txt(s, 0, y + 14, r.label, 'ax strong'); txt(s, W, y + 14, r.right, 'ax', 'end');
      el('rect', { x: 0, y: y + 21, width: W, height: 10, rx: 5, class: 'track' }, s);
      var x = 0;
      r.segs.forEach(function (g, k) {
        var w = W * g.v / o.max; if (w <= 0) return;
        var last = k === r.segs.length - 1 || !r.segs.slice(k + 1).some(function (z) { return z.v > 0; });
        el('path', { d: hbar(x, y + 21, Math.max(w - (last ? 0 : 2), 1), 10, last ? 4 : 0, k === 0 ? 1 : 0), class: 'mk ' + g.cls }, s);
        x += w;
      });
      el('rect', { x: 0, y: y, width: W, height: rowH, class: 'hit', 'data-tip': r.tip }, s);
    });
    box.appendChild(s);
  }

  function donut(box, o) {
    var size = 150, R = 68, T = 18, s = svg(size, size), cx = size / 2, cy = size / 2, tot = o.vals.reduce(function (a, b) { return a + b; }, 0) || 1, a0 = -Math.PI / 2;
    el('circle', { cx: cx, cy: cy, r: R - T / 2, class: 'trackc', 'stroke-width': T }, s);
    o.vals.forEach(function (v, i) {
      if (!v) return; var a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, ro = R, ri = R - T;
      var p = 'M' + (cx + ro * Math.cos(a0)) + ',' + (cy + ro * Math.sin(a0)) + 'A' + ro + ',' + ro + ' 0 ' + big + ' 1 ' + (cx + ro * Math.cos(a1)) + ',' + (cy + ro * Math.sin(a1)) +
        'L' + (cx + ri * Math.cos(a1)) + ',' + (cy + ri * Math.sin(a1)) + 'A' + ri + ',' + ri + ' 0 ' + big + ' 0 ' + (cx + ri * Math.cos(a0)) + ',' + (cy + ri * Math.sin(a0)) + 'Z';
      el('path', { d: p, class: 'mk ring ' + o.cls[i], 'data-tip': o.tips[i] }, s); a0 = a1;
    });
    txt(s, cx, cy + 2, o.center, 'big', 'middle'); txt(s, cx, cy + 20, o.sub, 'ax', 'middle');
    box.appendChild(s);
  }

  function legend(items) { return '<div class="lgd">' + items.map(function (i) { return '<span><i class="sw ' + i[0] + '"></i>' + esc(i[1]) + (i[2] != null ? ' <b>' + esc(i[2]) + '</b>' : '') + '</span>'; }).join('') + '</div>'; }
  function table(head, body) {
    return '<details class="tview"><summary>Показати таблицею</summary><div class="tblwrap"><table class="tbl"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></details>';
  }
  function card(id, title, sub, extra) { return '<section class="set chart"><div class="ch-h"><h3>' + esc(title) + '</h3>' + (sub ? '<p class="small muted">' + sub + '</p>' : '') + '</div>' + (extra || '') + '<div class="plot" id="' + id + '"></div>' + '<div id="' + id + '-t"></div></section>'; }

  // ---------- view ----------
  function render() {
    var D = data, S = compute(D), mods = A.modules(), modN = (mods.filter(function (m) { return m.id === S.mod; })[0] || {}).n || 1;
    var gOpts = '<option value="">Усі групи (' + D.groups.length + ')</option>' + D.groups.map(function (g) { return '<option value="' + g.id + '"' + (g.id === sel.g ? ' selected' : '') + '>' + esc(g.name) + '</option>'; }).join('');
    var mOpts = mods.length > 1 ? '<label class="fld"><span>Тест модуля</span><select id="st_m">' + mods.map(function (m) { return '<option value="' + m.id + '"' + (m.id === S.mod ? ' selected' : '') + '>Модуль ' + m.n + '</option>'; }).join('') + '</select></label>' : '';
    var avgLes = S.cadets ? Math.round(S.lessonsDone / S.cadets / (S.L.length || 1) * 100) : 0;
    var passTot = S.toPass.reduce(function (a, b) { return a + b; }, 0), avgTry = passTot ? (S.toPass[0] + S.toPass[1] * 2 + S.toPass[2] * 3 + S.toPass[3] * 4) / passTot : 0;
    var html = '<div class="crumbs"><a href="#admin">Панель адміністратора</a></div><h2 class="page">Статистика навчання</h2>' +
      '<div class="filters"><label class="fld"><span>Група</span><select id="st_g">' + gOpts + '</select></label>' + mOpts + '</div>' +
      '<div class="tools kpi">' +
      '<div><b>' + S.groups + '</b><span>' + (sel.g ? 'група обрана' : A.plural(S.groups, 'група', 'групи', 'груп')) + '</span></div>' +
      '<div><b>' + S.cadets + '</b><span>' + A.plural(S.cadets, 'учень', 'учні', 'учнів') + ' навчається</span></div>' +
      '<div><b>' + S.active7 + '</b><span>активні за 7 днів</span></div>' +
      '<div><b>' + avgLes + '%</b><span>середній поступ уроків</span></div>' +
      '<div><b>' + S.passed + ' / ' + S.cadets + '</b><span>склали тест М' + modN + '</span></div>' +
      '<div><b>' + (S.tried ? pct(S.passed, S.tried) + '%' : '—') + '</b><span>успішність серед тих, хто складав</span></div>' +
      '</div>';
    if (!S.cadets) { view().innerHTML = '<div class="statsv">' + html + '<p class="muted">У цій вибірці ще немає учнів.</p></div>'; bind(); return; }
    html += card('ch-week', 'Поступ тиждень за тижнем', 'Скільки уроків завершили учні за кожен тиждень (урок завершено, коли пройдено тест уроку).') +
      card('ch-les', 'Скільки учнів пройшли кожен урок', 'Показує, на якому уроці група «відпадає».') +
      card('ch-try', 'З якої спроби складають тест модуля ' + modN, S.tried ? 'Склали ' + passTot + ' з ' + S.tried + ' (у середньому ' + avgTry.toFixed(1).replace('.', ',') + ' спроби). Ще не склали: ' + (S.tried - passTot) + (S.exhausted ? ', з них вичерпали спроби: ' + S.exhausted : '') + '.' : 'Ще ніхто не складав цей тест.') +
      card('ch-score', 'Результати всіх спроб тесту модуля ' + modN, S.attemptsAll + ' ' + A.plural(S.attemptsAll, 'спроба', 'спроби', 'спроб') + '. Прохідний бал — 80%.') +
      card('ch-pref', 'Відео чи текст', 'Час, проведений на вкладках «Відео» і «Читати», та як учні діляться за звичкою.') +
      card('ch-mix', 'Відео і текст по уроках', 'Середній час на учня, який відкривав урок, хвилини.', legend([['c1', 'Відео'], ['c2', 'Читання']]));
    view().innerHTML = '<div class="statsv">' + html + '</div>';

    var W = S.weekList, weekTip = function (w) { return 'Тиждень ' + dm(w.w) + '–' + dm(w.w + 6 * DAY) + '\n' + w.done + ' ' + A.plural(w.done, 'урок завершено', 'уроки завершено', 'уроків завершено') + '\n' + w.active + ' ' + A.plural(w.active, 'активний учень', 'активні учні', 'активних учнів'); };
    columns($('#ch-week'), { cats: W.map(function (w) { return dm(w.w); }), vals: W.map(function (w) { return w.done; }), tips: W.map(weekTip) });
    $('#ch-week-t').innerHTML = table(['Тиждень', 'Уроків завершено', 'Активних учнів'], W.map(function (w) { return [dm(w.w) + '–' + dm(w.w + 6 * DAY), w.done, w.active]; }));

    rows($('#ch-les'), { max: S.cadets, rows: S.perLesson.map(function (p) {
      return { label: short(p.l), right: p.done + ' / ' + S.cadets + ' · ' + pct(p.done, S.cadets) + '%', segs: [{ v: p.done, cls: 'c1' }], tip: short(p.l) + ' — ' + p.l.title + '\nПройшли: ' + p.done + ' з ' + S.cadets };
    }) });
    $('#ch-les-t').innerHTML = table(['Урок', 'Назва', 'Пройшли', '%'], S.perLesson.map(function (p) { return [short(p.l), p.l.title, p.done, pct(p.done, S.cadets) + '%']; }));

    var tryCats = ['З 1-ї', 'З 2-ї', 'З 3-ї', 'З 4-ї і далі'];
    columns($('#ch-try'), { h: 170, cats: tryCats, vals: S.toPass, tips: S.toPass.map(function (v, i) { return 'Склали ' + tryCats[i].toLowerCase() + ' спроби: ' + v + ' ' + A.plural(v, 'учень', 'учні', 'учнів'); }) });
    $('#ch-try-t').innerHTML = table(['Спроба', 'Учнів склали'], S.toPass.map(function (v, i) { return [tryCats[i], v]; }).concat([['Ще не склали', S.tried - passTot], ['з них вичерпали спроби', S.exhausted]]));

    var scCats = ['<50%', '50–59', '60–69', '70–79', '80–89', '90–100'];
    columns($('#ch-score'), { h: 170, cats: scCats, vals: S.scores, dim: function (i) { return i < 4; }, ref: { at: 4, label: '80%' },
      tips: S.scores.map(function (v, i) { return 'Результат ' + scCats[i] + (i ? '%' : '') + ': ' + v + ' ' + A.plural(v, 'спроба', 'спроби', 'спроб') + (i < 4 ? '\nнижче прохідного' : '\nтест складено'); }) });
    $('#ch-score-t').innerHTML = table(['Результат', 'Спроб'], S.scores.map(function (v, i) { return [scCats[i] + (i ? '%' : ''), v]; }));

    var tot = S.vSec + S.rSec, prefTot = S.pref[0] + S.pref[1] + S.pref[2];
    var pb = $('#ch-pref'); pb.classList.add('split');
    var dbox = document.createElement('div'); pb.appendChild(dbox);
    donut(dbox, { vals: [S.vSec, S.rSec], cls: ['c1', 'c2'], center: pct(S.vSec, tot) + '%', sub: 'часу — відео',
      tips: ['Відео: ' + mins(S.vSec) + ' хв (' + pct(S.vSec, tot) + '%)', 'Читання: ' + mins(S.rSec) + ' хв (' + pct(S.rSec, tot) + '%)'] });
    var side = document.createElement('div'); side.className = 'side'; pb.appendChild(side);
    side.innerHTML = legend([['c1', 'Відео', Math.round(S.vSec / 3600 * 10) / 10 + ' год'], ['c2', 'Читання', Math.round(S.rSec / 3600 * 10) / 10 + ' год']]) +
      '<p class="small muted" style="margin:14px 0 4px">Учні за звичкою (' + prefTot + ')</p><div class="plot" id="ch-pref-b"></div>' +
      legend([['c1', 'Переважно відео', S.pref[0]], ['c3', 'Змішано', S.pref[2]], ['c2', 'Переважно текст', S.pref[1]]]);
    rows($('#ch-pref-b'), { max: prefTot || 1, rows: [{ label: '', right: '', segs: [{ v: S.pref[0], cls: 'c1' }, { v: S.pref[2], cls: 'c3' }, { v: S.pref[1], cls: 'c2' }],
      tip: 'Переважно відео (≥65% часу): ' + S.pref[0] + '\nЗмішано: ' + S.pref[2] + '\nПереважно текст (≥65% часу): ' + S.pref[1] }] });
    $('#ch-pref-t').innerHTML = table(['Показник', 'Значення'], [['Відео, хв', mins(S.vSec)], ['Читання, хв', mins(S.rSec)], ['Частка відео', pct(S.vSec, tot) + '%'],
      ['Переважно відео, учнів', S.pref[0]], ['Змішано, учнів', S.pref[2]], ['Переважно текст, учнів', S.pref[1]]]);

    var mx = Math.max.apply(null, S.perLesson.map(function (p) { return p.opened ? (p.v + p.r) / p.opened : 0; }).concat([1]));
    rows($('#ch-mix'), { max: mx, rows: S.perLesson.map(function (p) {
      var v = p.opened ? p.v / p.opened : 0, r = p.opened ? p.r / p.opened : 0;
      return { label: short(p.l), right: mins(v) + ' + ' + mins(r) + ' хв', segs: [{ v: v, cls: 'c1' }, { v: r, cls: 'c2' }],
        tip: short(p.l) + ' — ' + p.l.title + '\nВідео: ' + mins(v) + ' хв · читання: ' + mins(r) + ' хв\nВідкривали: ' + p.opened };
    }) });
    $('#ch-mix-t').innerHTML = table(['Урок', 'Відео, хв', 'Читання, хв', 'Відкривали'], S.perLesson.map(function (p) {
      return [short(p.l), p.opened ? mins(p.v / p.opened) : 0, p.opened ? mins(p.r / p.opened) : 0, p.opened]; }));
    bind();
  }

  function view() { return A.view(); }
  function bind() {
    var g = $('#st_g'), m = $('#st_m');
    if (g) g.onchange = function () { location.hash = '#admin-stats' + (g.value ? '-' + g.value : ''); };
    if (m) m.onchange = function () { sel.m = m.value; render(); };
  }

  // one tooltip for every [data-tip] mark
  var tip;
  function showTip(e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t || !document.querySelector('.statsv')) { if (tip) tip.hidden = true; return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'ctip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
    var x = e.clientX, y = e.clientY, w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    tip.style.top = (y - h - 14 < 8 ? y + 18 : y - h - 14) + 'px';
  }
  document.addEventListener('pointermove', showTip);
  document.addEventListener('pointerdown', showTip);
  document.addEventListener('scroll', function () { if (tip) tip.hidden = true; }, true);
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { if (data && document.querySelector('.statsv')) render(); }, 200); });

  return {
    show: function (api, client, gid) {
      A = api; sb = client; sel.g = gid || '';
      view().innerHTML = '<p class="muted">Завантаження статистики…</p>';
      var p = data ? Promise.resolve(data) : load();
      p.then(function (d) { data = d; if (location.hash.indexOf('#admin-stats') === 0) render(); }).catch(function (e) { console.warn(e); view().innerHTML = '<p>Не вдалося завантажити статистику.</p>'; });
      setTimeout(function () { data = null; }, 60000); // refresh data after a minute
    }
  };
})();
