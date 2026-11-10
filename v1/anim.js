/* Victory Drones · FPV course — interactive figures.
   Each entry: APP.ANIMS[name] = function (root) { ...; return { stop } }.
   SVG uses theme classes from styles.css (.st, .navy, .cy, .yl, .surf …) so it works in light and dark. */
(function () {
  'use strict';
  var A = APP.ANIMS;
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  function loop(fn) {
    var on = true, last = performance.now(), id;
    function f(t) { if (!on) return; var dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt, t / 1000); id = requestAnimationFrame(f); }
    id = requestAnimationFrame(f);
    return { stop: function () { on = false; cancelAnimationFrame(id); } };
  }
  function q(root, s) { return root.querySelector(s); }
  function qa(root, s) { return Array.prototype.slice.call(root.querySelectorAll(s)); }

  // Top view of a quad: used by several figures. cx, cy = centre, r = arm reach, pr = prop radius.
  function quadSvg(cx, cy, r, pr, extra) {
    var d = r / Math.SQRT2, pos = [[-d, -d], [d, -d], [d, d], [-d, d]], s = '';
    s += '<g class="frame"><path class="st navy" style="stroke-width:7" d="M' + (cx - d) + ' ' + (cy - d) + 'L' + (cx + d) + ' ' + (cy + d) + 'M' + (cx + d) + ' ' + (cy - d) + 'L' + (cx - d) + ' ' + (cy + d) + '"/>' +
      '<rect class="navyf" x="' + (cx - r * .26) + '" y="' + (cy - r * .42) + '" width="' + (r * .52) + '" height="' + (r * .84) + '" rx="' + (r * .08) + '"/></g>';
    pos.forEach(function (p, i) {
      s += '<g class="motor" data-m="' + i + '" transform="translate(' + (cx + p[0]) + ' ' + (cy + p[1]) + ')">' +
        '<circle class="disc" r="' + pr + '" style="fill:var(--hi);opacity:.13"/>' +
        '<g class="blade"><path class="st cy" style="stroke-width:' + Math.max(2.5, pr * .13) + '" d="M' + (-pr * .92) + ' 0L' + (pr * .92) + ' 0"/></g>' +
        '<circle class="surf st navy" r="' + Math.max(4, pr * .2) + '" style="stroke-width:2.5"/></g>';
    });
    return s + (extra || '');
  }

  // ===== 1. Components of an FPV drone: tap a part =====
  A.parts = function (root) {
    var P = [
      { id: 'frame', n: 'Рама', t: '<b>Рама</b> — скелет дрона. Тримає всі компоненти, захищає електроніку і приймає на себе удари та механічні навантаження.' },
      { id: 'motor', n: 'Мотори', t: '<b>Мотори</b> обертають пропелери і створюють тягу. Головні параметри: KV, розмір статора, максимальний струм.' },
      { id: 'prop', n: 'Пропелери', t: '<b>Пропелери</b> перетворюють обертання мотора на тягу. Від їхнього діаметра, кроку й кількості лопатей залежать тяга, шум та енергоспоживання.' },
      { id: 'fc', n: 'FC', t: '<b>FC (польотний контролер)</b> — «мозок» дрона: стабілізує політ, обробляє дані датчиків, керує ESC, працює з GPS і телеметрією, накладає OSD на відео.' },
      { id: 'esc', n: 'ESC', t: '<b>ESC (регулятор обертів)</b> отримує команди від FC і змінює швидкість кожного мотора. Захищає систему від перевантажень.' },
      { id: 'cam', n: 'Камера', t: '<b>FPV-камера</b> — «очі» пілота. Важливі роздільна здатність, світлочутливість і кут огляду.' },
      { id: 'vtx', n: 'VTX', t: '<b>VTX (відеопередавач)</b> передає зображення з камери на окуляри або монітор пілота через свою антену.' },
      { id: 'rx', n: 'RX', t: '<b>RX (приймач)</b> отримує команди з пульта пілота. Популярні системи: ELRS, Crossfire, Ghost.' },
      { id: 'bat', n: 'Акумулятор', t: '<b>Акумулятор</b> — джерело живлення. Параметри: кількість банок (S), ємність, струмовіддача.' }
    ];
    var W = 360, H = 300, cx = 180, cy = 150;
    var svg = '<svg class="sv" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Будова FPV-дрона, вид зверху">' +
      quadSvg(cx, cy, 120, 52) +
      // battery on top (semi-transparent so stack is visible below)
      '<g class="hotz" data-p="bat"><rect class="hl" x="' + (cx - 26) + '" y="' + (cy - 12) + '" width="52" height="66" rx="7" style="fill:var(--gold);opacity:.92;stroke:transparent;stroke-width:3"/><text class="tx" x="' + cx + '" y="' + (cy + 26) + '" text-anchor="middle" style="fill:#18213f;font-size:11px">LiPo</text></g>' +
      // FC / ESC stack (front part of body)
      '<g class="hotz" data-p="fc"><rect class="hl" x="' + (cx - 22) + '" y="' + (cy - 46) + '" width="44" height="22" rx="4" style="fill:#2e9e6a;stroke:transparent;stroke-width:3"/><text class="tx" x="' + cx + '" y="' + (cy - 31) + '" text-anchor="middle" style="fill:#fff;font-size:11px">FC</text></g>' +
      '<g class="hotz" data-p="esc"><rect class="hl" x="' + (cx - 22) + '" y="' + (cy - 22) + '" width="44" height="8" rx="2" style="fill:#5a6b9a;stroke:transparent;stroke-width:3"/></g>' +
      // camera at the nose
      '<g class="hotz" data-p="cam"><rect class="hl" x="' + (cx - 13) + '" y="' + (cy - 76) + '" width="26" height="22" rx="5" style="fill:#18213f;stroke:transparent;stroke-width:3"/><circle cx="' + cx + '" cy="' + (cy - 70) + '" r="6" style="fill:#05aac8"/></g>' +
      // VTX + antenna at the tail
      '<g class="hotz" data-p="vtx"><rect class="hl" x="' + (cx - 20) + '" y="' + (cy + 58) + '" width="22" height="14" rx="3" style="fill:#c0392b;stroke:transparent;stroke-width:3"/><path class="st" style="stroke:#c0392b;stroke-width:3" d="M' + (cx - 9) + ' ' + (cy + 72) + 'l-12 26"/><circle cx="' + (cx - 22) + '" cy="' + (cy + 100) + '" r="5" style="fill:#c0392b"/></g>' +
      // RX + antennas at the tail
      '<g class="hotz" data-p="rx"><rect class="hl" x="' + (cx + 4) + '" y="' + (cy + 58) + '" width="16" height="12" rx="3" style="fill:#7b4fc4;stroke:transparent;stroke-width:3"/><path class="st" style="stroke:#7b4fc4;stroke-width:2" d="M' + (cx + 14) + ' ' + (cy + 70) + 'l14 26M' + (cx + 10) + ' ' + (cy + 70) + 'l4 28"/></g>' +
      // invisible hit areas for frame / motors / props
      '<g class="hotz" data-p="frame"><path class="hl" style="stroke:transparent;stroke-width:22;fill:none" d="M' + (cx - 60) + ' ' + (cy - 60) + 'L' + (cx - 30) + ' ' + (cy - 30) + 'M' + (cx + 60) + ' ' + (cy - 60) + 'L' + (cx + 30) + ' ' + (cy - 30) + 'M' + (cx + 60) + ' ' + (cy + 60) + 'L' + (cx + 30) + ' ' + (cy + 30) + 'M' + (cx - 60) + ' ' + (cy + 60) + 'L' + (cx - 30) + ' ' + (cy + 30) + '"/></g>' +
      '<g class="hotz" data-p="motor">' + [[-85, -85], [85, -85], [85, 85], [-85, 85]].map(function (p) { return '<circle class="hl" cx="' + (cx + p[0]) + '" cy="' + (cy + p[1]) + '" r="13" style="fill:transparent;stroke:transparent"/>'; }).join('') + '</g>' +
      '<g class="hotz" data-p="prop">' + [[-85, -85], [85, -85], [85, 85], [-85, 85]].map(function (p) { return '<path class="hl" d="M' + (cx + p[0] - 50) + ' ' + (cy + p[1]) + 'a50 50 0 1 0 100 0a50 50 0 1 0 -100 0M' + (cx + p[0] - 18) + ' ' + (cy + p[1]) + 'a18 18 0 1 1 36 0a18 18 0 1 1 -36 0" style="fill:transparent;fill-rule:evenodd;stroke:transparent"/>'; }).join('') + '</g>' +
      '<text class="txs" x="' + cx + '" y="14" text-anchor="middle">▲ ніс дрона (камера)</text>' +
      '<g class="ring" style="pointer-events:none"></g>' +
      '</svg>';
    root.innerHTML = svg + '<div class="hotlist">' + P.map(function (p) { return '<button type="button" data-b="' + p.id + '">' + p.n + '</button>'; }).join('') + '</div><div class="readout">Натисніть на деталь на схемі або на кнопку з назвою.</div>';
    var ring = q(root, '.ring'), out = q(root, '.readout');
    var spots = { frame: [[cx - 45, cy - 45, 22], [cx + 45, cy + 45, 22]], motor: [[cx - 85, cy - 85, 16], [cx + 85, cy - 85, 16], [cx + 85, cy + 85, 16], [cx - 85, cy + 85, 16]], prop: [[cx - 85, cy - 85, 54], [cx + 85, cy - 85, 54], [cx + 85, cy + 85, 54], [cx - 85, cy + 85, 54]], fc: [[cx, cy - 35, 26]], esc: [[cx, cy - 18, 26]], cam: [[cx, cy - 65, 20]], vtx: [[cx - 14, cy + 78, 24]], rx: [[cx + 14, cy + 76, 22]], bat: [[cx, cy + 21, 40]] };
    function sel(id) {
      var p = P.filter(function (x) { return x.id === id; })[0]; if (!p) return;
      out.innerHTML = p.t;
      qa(root, '[data-b]').forEach(function (b) { b.classList.toggle('on', b.dataset.b === id); });
      ring.innerHTML = spots[id].map(function (s) { return '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" style="fill:none;stroke:var(--gold);stroke-width:3;stroke-dasharray:6 4"/>'; }).join('');
    }
    qa(root, '.hotz').forEach(function (g) { g.addEventListener('click', function () { sel(g.dataset.p); }); });
    qa(root, '[data-b]').forEach(function (b) { b.onclick = function () { sel(b.dataset.b); }; });
    // slow idle spin of props
    var blades = qa(root, '.blade'), a = 0;
    var lp = RM ? null : loop(function (dt) { a += dt * 140; blades.forEach(function (b, i) { b.setAttribute('transform', 'rotate(' + (i % 2 ? -a : a) + ')'); }); });
    return { stop: function () { lp && lp.stop(); } };
  };

  // ===== 2. Sizes: drag the slider =====
  A.sizes = function (root) {
    var C = [
      { inch: 1, label: '1″', role: 'Навчання в приміщенні', note: 'Крихітні дрони типу Tiny Whoop: легкі й безпечні, літають навіть у квартирі.' },
      { inch: 2.5, label: '2–3″', role: 'Легкі тренувальні дрони', note: 'Малі дрони (1–3″) найчастіше використовують для тренувань у приміщеннях.' },
      { inch: 5, label: '5″', role: 'Універсальний FPV', note: 'Розміри 5–7″ — універсальні, підходять для більшості задач.' },
      { inch: 7, label: '7″', role: 'Дальність та розвідка', note: 'Більший пропелер — більша тяга й запас енергії для дальших польотів.' },
      { inch: 10, label: '10″+', role: 'Важкі платформи', note: 'Дальність, скиди та важкі задачі: можуть нести більше навантаження на більші відстані.' }
    ];
    root.innerHTML = '<svg class="sv" viewBox="0 0 360 236"><g class="q"></g><g class="scale"></g></svg>' +
      '<div class="anim-ctl"><label>Розмір пропелера <input type="range" min="0" max="4" step="1" value="2"><output></output></label></div><div class="readout"></div>';
    var g = q(root, '.q'), sc = q(root, '.scale'), inp = q(root, 'input'), o = q(root, 'output'), out = q(root, '.readout');
    function draw() {
      var c = C[+inp.value], k = Math.sqrt(c.inch / 10);          // visual size grows with prop size
      var pr = 10 + 38 * k, r = pr * 1.9;
      g.innerHTML = quadSvg(180, 114, r, pr);
      sc.innerHTML = '<text class="tx" x="180" y="226" text-anchor="middle" style="font-size:14px">' + c.label + '</text>';
      o.textContent = c.label; out.innerHTML = '<b>' + c.label + ' — ' + c.role + '.</b> ' + c.note;
    }
    inp.oninput = draw; draw();
    var blades, a = 0;
    var lp = RM ? null : loop(function (dt) { a += dt * 300; qa(root, '.blade').forEach(function (b, i) { b.setAttribute('transform', 'rotate(' + (i % 2 ? -a : a) + ')'); }); });
    return { stop: function () { lp && lp.stop(); } };
  };

  // ===== 3. Video path: camera → FC (OSD) → VTX → antenna → goggles =====
  A.video = function (root) {
    var nodes = [['Камера', 36], ['FC + OSD', 108], ['VTX', 180], ['Антена', 252], ['Окуляри', 324]];
    var icons = [
      '<rect class="navyf" x="-12" y="-9" width="24" height="18" rx="4"/><circle cx="0" cy="0" r="6" style="fill:var(--hi)"/>',
      '<rect class="navyf" x="-10" y="-10" width="20" height="20" rx="2"/><path class="st navy" style="stroke-width:2" d="M-14 -5h4M-14 0h4M-14 5h4M10 -5h4M10 0h4M10 5h4"/><text x="0" y="4" text-anchor="middle" style="fill:#fff;font:700 9px var(--sans)">FC</text>',
      '<rect class="navyf" x="-12" y="-8" width="24" height="16" rx="3"/><path class="st cy" style="stroke-width:2" d="M-5 -1a6 6 0 0 1 10 0M-8 -4a10 10 0 0 1 16 0"/>',
      '',
      '<path class="navyf" d="M-16 -7h32a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-10l-6-5-6 5h-10a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z"/><rect x="-11" y="-4" width="8" height="6" rx="2" style="fill:var(--hi)"/><rect x="3" y="-4" width="8" height="6" rx="2" style="fill:var(--hi)"/>'];
    var s = '<svg class="sv" viewBox="0 0 360 250">';
    s += '<path class="st ln" style="stroke-width:3" d="M36 60H324"/>';
    nodes.forEach(function (n, i) {
      var x = n[1];
      s += '<g transform="translate(' + x + ' 60)">' + (i === 3 ? '<path class="st cy" style="stroke-width:3" d="M0 14V-14M-9 -20l9 6 9-6"/>' : '<rect class="surf st navy" x="-26" y="-18" width="52" height="36" rx="8"/>' + icons[i]) +
        '<text class="tx" y="38" text-anchor="middle" style="font-size:11.5px">' + n[0] + '</text></g>';
    });
    // goggles screen
    s += '<g transform="translate(70 118)"><rect x="0" y="0" width="220" height="118" rx="10" style="fill:#0d1b2a"/>' +
      '<defs><clipPath id="gscr"><rect x="0" y="0" width="220" height="118" rx="10"/></clipPath></defs><g class="scene" clip-path="url(#gscr)"><path d="M0 70 L220 62 L220 118 L0 118Z" style="fill:#3d5a2c"/><path d="M0 70 L220 62" style="stroke:#9cc3e6;stroke-width:1"/>' +
      '<circle class="sun" cx="170" cy="30" r="10" style="fill:#fcc500;opacity:.8"/><rect class="tree" x="40" y="48" width="8" height="24" style="fill:#24401a"/><circle class="treec" cx="44" cy="46" r="11" style="fill:#2f5622"/></g>' +
      '<g class="osd" style="font:700 10px var(--sans);fill:#fff">' +
      '<text x="8" y="14">🔋 16,4 В</text><text x="212" y="14" text-anchor="end">📶 92%</text>' +
      '<text x="8" y="110">GPS 50.45°N 30.52°E</text><text x="212" y="110" text-anchor="end" class="tmr">00:00</text>' +
      '<path d="M100 59h20M110 49v20" style="stroke:#fff;stroke-width:1.5"/></g>' +
      '<rect x="0" y="0" width="220" height="118" rx="10" style="fill:none;stroke:var(--navy);stroke-width:3"/></g>';
    s += '<g class="pk"></g></svg>';
    root.innerHTML = s + '<div class="anim-ctl"><button type="button" class="tog" data-osd aria-pressed="true">OSD на екрані</button></div>' +
      '<div class="readout"><b>OSD</b> — службова інформація поверх відео: напруга батареї, рівень сигналу, GPS-координати, таймер польоту. Її накладає польотний контролер. Уся дорога від камери до окулярів займає лише <b>3–30 мс</b>.</div>';
    var pk = q(root, '.pk'), osd = q(root, '.osd'), tmr = q(root, '.tmr'), tree = q(root, '.tree'), treec = q(root, '.treec');
    var b = q(root, '[data-osd]');
    b.onclick = function () { var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); osd.style.display = on ? '' : 'none'; };
    var dots = [], t0 = 0;
    for (var i = 0; i < 4; i++) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 5); c.setAttribute('class', 'ylf'); pk.appendChild(c); dots.push(c); }
    var lp = loop(function (dt, t) {
      t0 += dt;
      dots.forEach(function (d, i) {
        var u = ((t * 0.35) + i / 4) % 1, x = 36 + u * 288;
        d.setAttribute('cx', x); d.setAttribute('cy', 60 - (x > 240 ? Math.sin((x - 240) / 60 * Math.PI) * 26 : 0));
        d.style.opacity = (x > 240 && x < 300) ? 0.6 : 1; d.style.display = (Math.abs(x - 36) < 26 || Math.abs(x - 108) < 26 || Math.abs(x - 180) < 26 || x > 298) ? 'none' : '';
      });
      var sec = Math.floor(t0); tmr.textContent = '00:' + ('0' + (sec % 60)).slice(-2);
      var x = 40 + ((t * 30) % 260) - 20; tree.setAttribute('x', 220 - x); treec.setAttribute('cx', 224 - x);
    });
    if (RM) lp.stop();
    return { stop: lp.stop };
  };

  // ===== 4. Control path: stick → transmitter → RX → FC → ESC → motors =====
  A.control = function (root) {
    var chain = ['Пульт', 'RX', 'FC', 'ESC', 'Мотори'];
    var s = '<svg class="sv" viewBox="0 0 360 270"><g class="ch">';
    chain.forEach(function (n, i) {
      var x = 36 + i * 72;
      s += '<g transform="translate(' + x + ' 26)"><rect class="surf st navy box" x="-30" y="-16" width="60" height="32" rx="8"/><text class="tx" y="5" text-anchor="middle" style="font-size:11.5px">' + n + '</text></g>' + (i < 4 ? '<path class="st mut" d="M' + (x + 32) + ' 26h8l-4-4m4 4l-4 4"/>' : '');
    });
    s += '</g><g class="qd">' + quadSvg(180, 165, 84, 34) + '</g>' +
      '<text class="txs" x="180" y="66" text-anchor="middle">▲ ніс</text>' +
      '<g class="lbl" style="font:700 11px var(--sans)"></g></svg>';
    root.innerHTML = s + '<div class="anim-ctl"><label>Газ <input type="range" data-thr min="0" max="100" value="45"><output data-o1></output></label>' +
      '<label>Крен <input type="range" data-roll min="-100" max="100" value="0"><output data-o2></output></label></div><div class="readout"></div>';
    var thr = q(root, '[data-thr]'), roll = q(root, '[data-roll]'), o1 = q(root, '[data-o1]'), o2 = q(root, '[data-o2]'), out = q(root, '.readout'), lbl = q(root, '.lbl');
    var boxes = qa(root, '.box'), blades = qa(root, '.blade'), discs = qa(root, '.disc');
    var ang = [0, 0, 0, 0], pulse = -1, lastIn = 0;
    // motor order: 0 front-left, 1 front-right, 2 rear-right, 3 rear-left
    var pos = [[-59, -59], [59, -59], [59, 59], [-59, 59]];
    function speeds() {
      var t = +thr.value / 100, r = +roll.value / 100;
      return [0, 1, 2, 3].map(function (i) { var left = i === 0 || i === 3; return Math.max(0, Math.min(1, t + (left ? 1 : -1) * r * 0.35 * (t > 0.02 ? 1 : 0))); });
    }
    function text() {
      var t = +thr.value, r = +roll.value; o1.textContent = t + '%'; o2.textContent = r === 0 ? '0' : (r > 0 ? '→ ' : '← ') + Math.abs(r);
      var sp = speeds();
      lbl.innerHTML = sp.map(function (v, i) { var right = pos[i][0] > 0; return '<text x="' + (180 + pos[i][0] + (right ? 42 : -42)) + '" y="' + (169 + pos[i][1]) + '" text-anchor="' + (right ? 'start' : 'end') + '" style="fill:var(--ink)">' + Math.round(v * 100) + '%</text>'; }).join('');
      out.innerHTML = t < 3 ? 'Газ на нулі — мотори зупинені.' :
        r === 0 ? '<b>Газ ' + t + '%:</b> усі чотири мотори крутяться однаково — дрон набирає або тримає висоту.' :
        '<b>Крен ' + (r > 0 ? 'вправо' : 'вліво') + ':</b> ESC пришвидшують мотори з ' + (r > 0 ? 'лівого' : 'правого') + ' боку і пригальмовують з ' + (r > 0 ? 'правого' : 'лівого') + ' — дрон нахиляється ' + (r > 0 ? 'вправо' : 'вліво') + '.';
      pulse = 0; lastIn = performance.now();
    }
    thr.oninput = text; roll.oninput = text; text();
    var lp = loop(function (dt) {
      var sp = speeds();
      sp.forEach(function (v, i) { ang[i] += dt * (60 + v * 1500) * (v > 0.01 ? 1 : 0) * (i % 2 ? -1 : 1); blades[i].setAttribute('transform', 'rotate(' + ang[i] + ')'); discs[i].style.opacity = 0.05 + v * 0.3; });
      // command pulse runs along the chain after each stick move
      if (pulse >= 0) { pulse += dt * 3.2; var k = Math.floor(pulse); boxes.forEach(function (b, i) { b.style.fill = i === k ? 'var(--gold-soft)' : ''; b.style.stroke = i === k ? 'var(--gold)' : ''; }); if (k > 4) pulse = -1; }
    });
    if (RM) { lp.stop(); }
    return { stop: lp.stop };
  };
})();

/* ===== Module 1, lessons 3–8 ===== */
(function () {
  'use strict';
  var A = APP.ANIMS, NS = 'http://www.w3.org/2000/svg';
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(fn) {
    var on = true, last = performance.now(), id;
    function f(t) { if (!on) return; var dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt, t / 1000); id = requestAnimationFrame(f); }
    id = requestAnimationFrame(f);
    return { stop: function () { on = false; cancelAnimationFrame(id); } };
  }
  function q(r, s) { return r.querySelector(s); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  // KV × voltage → unloaded RPM
  A.kvcalc = function (root) {
    root.innerHTML = '<svg class="sv" viewBox="0 0 360 150"><g transform="translate(90 75)"><circle r="58" class="sunk"/><circle r="58" class="st navy" style="stroke-width:3"/>' +
      '<g class="rot">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { return '<rect x="-5" y="-56" width="10" height="14" rx="2" transform="rotate(' + i * 30 + ')" style="fill:' + (i % 2 ? 'var(--hi)' : 'var(--gold)') + '"/>'; }).join('') + '</g>' +
      '<circle r="34" class="navyf"/><circle r="6" class="surf"/></g>' +
      '<text class="txs" x="190" y="40">об/хв без пропелера</text><text class="tx rpm" x="190" y="78" style="font:700 30px var(--display)"></text><text class="txs calc" x="190" y="104"></text></svg>' +
      '<div class="anim-ctl"><label>KV <input type="range" data-kv min="600" max="2600" step="50" value="1150"><output data-okv></output></label>' +
      '<label>Батарея <input type="range" data-s min="1" max="6" step="1" value="6"><output data-os></output></label></div><div class="readout"></div>';
    var kv = q(root, '[data-kv]'), s = q(root, '[data-s]'), rot = q(root, '.rot'), ang = 0, rpm = 0;
    function upd() {
      var v = +s.value * 4.2; rpm = +kv.value * v;
      q(root, '[data-okv]').textContent = kv.value + 'KV'; q(root, '[data-os]').textContent = s.value + 'S';
      q(root, '.rpm').textContent = fmt(rpm); q(root, '.calc').textContent = kv.value + ' × ' + v.toFixed(1).replace('.', ',') + ' В (повний ' + s.value + 'S)';
      q(root, '.readout').innerHTML = 'KV — скільки обертів за хвилину двигун додає на кожен <b>вольт</b> напруги без навантаження. Повністю заряджена банка LiPo — 4,2 В, тож ' + s.value + 'S ≈ ' + v.toFixed(1).replace('.', ',') + ' В. На практиці з пропелером оберти будуть помітно нижчими.';
    }
    kv.oninput = upd; s.oninput = upd; upd();
    var lp = loop(function (dt) { ang += dt * Math.min(rpm, 30000) / 60 * 6; rot.setAttribute('transform', 'rotate(' + (ang % 360) + ')'); });
    if (RM) lp.stop();
    return { stop: lp.stop };
  };

  // thrust-to-weight check
  A.twr = function (root) {
    root.innerHTML = '<div class="anim-ctl"><label>Вага дрона з батареєю й навантаженням <input type="range" data-w min="300" max="4000" step="50" value="1500"><output data-ow></output></label>' +
      '<label>Тяга одного мотора (з data sheet, 100%) <input type="range" data-t min="200" max="4000" step="50" value="1400"><output data-ot></output></label></div>' +
      '<svg class="sv" viewBox="0 0 360 110"><rect x="20" y="30" width="320" height="22" rx="11" class="sunk"/><rect class="bar" x="20" y="30" height="22" rx="11"/><path class="st mut" d="M180 22v38"/><text class="txs" x="180" y="16" text-anchor="middle">мінімум 2 : 1</text><text class="tx big" x="20" y="88" style="font:700 20px var(--display)"></text></svg><div class="readout"></div>';
    var w = q(root, '[data-w]'), t = q(root, '[data-t]');
    function upd() {
      var W = +w.value, T = +t.value * 4, r = T / W, ok = r >= 2;
      q(root, '[data-ow]').textContent = fmt(W) + ' г'; q(root, '[data-ot]').textContent = fmt(+t.value) + ' г';
      var bar = q(root, '.bar'); bar.setAttribute('width', Math.max(22, Math.min(320, r / 4 * 320))); bar.style.fill = ok ? 'var(--ok)' : 'var(--bad)';
      q(root, '.big').textContent = 'Тяга : вага = ' + r.toFixed(1).replace('.', ',') + ' : 1';
      q(root, '.readout').innerHTML = 'Сумарна тяга 4 моторів: <b>' + fmt(T) + ' г</b>. ' + (ok ? 'Запас достатній: дрон буде керованим і підніме навантаження.' : '<b style="color:var(--bad)">Замало.</b> Дрон буде млявим, погано керованим і може не втримати навантаження. Потрібна тяга щонайменше вдвічі більша за вагу.');
    }
    w.oninput = upd; t.oninput = upd; upd();
  };

  // props in / props out
  A.propsdir = function (root) {
    root.innerHTML = '<svg class="sv" viewBox="0 0 360 262"><g class="qd"></g></svg><div class="anim-ctl"><button type="button" class="tog" data-m="out" aria-pressed="true">Розгрібаюча (Props Out)</button><button type="button" class="tog" data-m="in" aria-pressed="false">Загрібаюча (Props In)</button></div><div class="readout"></div>';
    var g = q(root, '.qd'), mode = 'out', ang = 0;
    var P = [[-70, -62], [70, -62], [70, 62], [-70, 62]];
    function draw() {
      // direction per motor: props out → front-left CCW, front-right CW (blades move outward at the front)
      var dir = mode === 'out' ? [-1, 1, -1, 1] : [1, -1, 1, -1];
      var s = '<path class="st navy" style="stroke-width:7" d="M110 58L250 182M250 58L110 182"/><rect x="155" y="80" width="50" height="80" rx="8" class="navyf"/><rect x="167" y="66" width="26" height="18" rx="4" style="fill:#18213f"/><circle cx="180" cy="72" r="6" style="fill:var(--hi)"/><text class="txs" x="180" y="20" text-anchor="middle">▲ ніс, камера</text>';
      P.forEach(function (p, i) {
        var cx = 180 + p[0], cy = 120 + p[1], d = dir[i];
        s += '<g transform="translate(' + cx + ' ' + cy + ')"><circle r="44" style="fill:var(--hi);opacity:.1"/><g class="bl" data-d="' + d + '"><path class="st cy" style="stroke-width:5" d="M-40 0H40"/></g><circle r="8" class="surf st navy"/>' +
          '<path class="st yl" style="stroke-width:2.5" d="' + (d > 0 ? 'M-30 -30A42 42 0 0 1 30 -30l-2 -8m2 8l-8 1' : 'M30 -30A42 42 0 0 0 -30 -30l2 -8m-2 8l8 1') + '"/>' +
          '<text class="txs" y="62" text-anchor="middle">' + (d > 0 ? 'CW' : 'CCW') + '</text></g>';
      });
      // debris arrows at the front
      var inward = mode === 'in';
      s += '<g style="stroke:var(--bad);fill:none;stroke-width:2.5;stroke-linecap:round">' + (inward ? '<path d="M120 26l40 36m-6 0l6 0 0-6M240 26l-40 36m6 0l-6 0 0-6"/>' : '<path d="M160 50l-40 -26m6 0l-6 0 3 5M200 50l40 -26m-6 0l6 0 -3 5"/>') + '</g>';
      g.innerHTML = s;
      q(root, '.readout').innerHTML = inward ? '<b>Props In:</b> пропелери спереду обертаються всередину. Трава, гілки й сміття загрібаються прямо на камеру та польотний стек.' : '<b>Props Out:</b> пропелери спереду обертаються назовні. Сміття відкидається від дрона, об’єктив лишається чистим, а при зіткненні дрон частіше відштовхується від перешкоди. Ця схема бажаніша для FPV.';
      root.querySelectorAll('[data-m]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.m === mode); });
    }
    root.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { mode = b.dataset.m; draw(); }; });
    draw();
    var lp = loop(function (dt) { ang += dt * 260; g.querySelectorAll('.bl').forEach(function (b) { b.setAttribute('transform', 'rotate(' + ang * b.dataset.d + ')'); }); });
    if (RM) lp.stop();
    return { stop: lp.stop };
  };

  // pitch: distance per one revolution
  A.pitch = function (root) {
    root.innerHTML = '<svg class="sv" viewBox="0 0 360 170"><path class="st ln" d="M20 140H340"/><g class="sc"></g><g class="pr"></g></svg>' +
      '<div class="anim-ctl"><label>Крок <input type="range" data-p min="2" max="6" step="0.5" value="3.5"><output></output></label></div><div class="readout"></div>';
    var inp = q(root, 'input'), sc = q(root, '.sc'), pr = q(root, '.pr'), u = 0;
    function upd() {
      var p = +inp.value; q(root, 'output').textContent = String(p).replace('.', ',') + '″';
      var ppx = p * 45, s = '';
      for (var x = 0; x <= 320; x += 45) s += '<path class="st mut" d="M' + (20 + x) + ' 136v8"/><text class="txs" x="' + (20 + x) + '" y="160" text-anchor="middle">' + (x / 45) + '″</text>';
      s += '<path class="st yl" style="stroke-width:3" d="M20 120H' + (20 + ppx) + '"/><text class="tx" x="' + (20 + ppx / 2) + '" y="112" text-anchor="middle">1 оберт = ' + String(p).replace('.', ',') + '″</text>';
      sc.innerHTML = s;
      q(root, '.readout').innerHTML = p <= 3 ? '<b>Малий крок:</b> швидко набирає оберти, економно витрачає струм. Плавні довгі польоти, висока маневреність, але менша максимальна швидкість.' : p >= 5 ? '<b>Великий крок:</b> більша тяга й швидкість, але повільніше розкручується і сильніше навантажує мотори та батарею. Для швидкісних польотів і важкої ваги.' : '<b>Середній крок:</b> баланс між швидкістю, тягою і витратою енергії.';
      root._ppx = ppx;
    }
    inp.oninput = upd; upd();
    var lp = loop(function (dt) { u = (u + dt * 0.5) % 1; var x = 20 + u * root._ppx, a = u * 360; pr.innerHTML = '<g transform="translate(' + x + ' 70)"><ellipse rx="10" ry="34" transform="rotate(' + (Math.cos(a * Math.PI / 180) * 0) + ')" style="fill:var(--hi);opacity:.25"/><path class="st cy" style="stroke-width:5" d="M0 ' + (-32 * Math.cos(a * Math.PI / 180)) + 'V' + (32 * Math.cos(a * Math.PI / 180)) + '"/><circle r="5" class="navyf"/><path class="st navy" d="M-20 0H-6"/></g>'; });
    if (RM) lp.stop();
    return { stop: lp.stop };
  };

  // UART cross wiring (used for FC and RX lessons)
  A.uart = function (root) {
    var dev = root.dataset.dev || 'Приймач ELRS';
    root.innerHTML = '<svg class="sv" viewBox="0 0 360 200">' +
      '<rect x="14" y="20" width="110" height="160" rx="12" style="fill:#2b2f3a"/><text x="69" y="44" text-anchor="middle" style="fill:#fff;font:700 13px var(--sans)">FC</text>' +
      '<rect x="236" y="20" width="110" height="160" rx="12" style="fill:#2b2f3a"/><text x="291" y="44" text-anchor="middle" style="fill:#fff;font:700 12px var(--sans)">' + dev + '</text>' +
      [['TX', 'RX', 70, '#05aac8'], ['RX', 'TX', 100, '#fcc500'], ['5V', '5V', 130, '#e0402a'], ['GND', 'GND', 160, '#9ba7c8']].map(function (r, i) {
        var y1 = r[2], y2 = i === 0 ? 100 : i === 1 ? 70 : r[2];
        return '<text x="112" y="' + (y1 + 4) + '" text-anchor="end" style="fill:#fff;font:700 11px var(--sans)">' + r[0] + '</text><circle cx="120" cy="' + y1 + '" r="4" style="fill:' + r[3] + '"/>' +
          '<text x="248" y="' + (y2 + 4) + '" style="fill:#fff;font:700 11px var(--sans)">' + r[1] + '</text><circle cx="240" cy="' + y2 + '" r="4" style="fill:' + r[3] + '"/>' +
          '<path class="w' + i + '" d="M124 ' + y1 + 'C180 ' + y1 + ' 180 ' + y2 + ' 236 ' + y2 + '" style="fill:none;stroke:' + r[3] + ';stroke-width:3"/>';
      }).join('') + '<circle class="pk0" r="5" style="fill:#fff"/><circle class="pk1" r="5" style="fill:#fff"/></svg>' +
      '<div class="readout"><b>Навхрест:</b> TX (передача) одного пристрою завжди йде на RX (прийом) іншого. 5V — до 5V, GND — до GND. Так кожен «говорить» у «вухо» співрозмовника.</div>';
    var p0 = q(root, '.pk0'), p1 = q(root, '.pk1'), w0 = q(root, '.w0'), w1 = q(root, '.w1'), L0 = w0.getTotalLength(), L1 = w1.getTotalLength();
    var lp = loop(function (dt, t) {
      var a = w0.getPointAtLength((t * 0.6 % 1) * L0), b = w1.getPointAtLength((1 - (t * 0.6 + 0.5) % 1) * L1);
      p0.setAttribute('cx', a.x); p0.setAttribute('cy', a.y); p1.setAttribute('cx', b.x); p1.setAttribute('cy', b.y);
    });
    if (RM) lp.stop();
    return { stop: lp.stop };
  };

  // ESC: six-step commutation of a 3-phase motor
  A.esc3 = function (root) {
    var ph = [['A', '#e0402a'], ['B', '#05aac8'], ['C', '#fcc500']];
    var s = '<svg class="sv" viewBox="0 0 360 220"><g transform="translate(250 110)"><circle r="78" class="sunk"/><circle r="78" class="st navy" style="stroke-width:3"/>';
    for (var i = 0; i < 6; i++) { var a = i * 60; s += '<g transform="rotate(' + a + ')"><rect class="coil c' + (i % 3) + '" x="-11" y="-62" width="22" height="30" rx="5" style="fill:var(--line)"/><text x="0" y="-42" text-anchor="middle" transform="rotate(' + (-a) + ' 0 -47)" style="font:700 11px var(--sans);fill:var(--ink)">' + ph[i % 3][0] + '</text></g>'; }
    s += '<g class="mag"><rect x="-6" y="-30" width="12" height="30" rx="3" style="fill:#e0402a"/><rect x="-6" y="0" width="12" height="30" rx="3" style="fill:#243260"/><text y="-14" text-anchor="middle" style="fill:#fff;font:700 10px var(--sans)">N</text><text y="20" text-anchor="middle" style="fill:#fff;font:700 10px var(--sans)">S</text></g></g>' +
      '<g transform="translate(14 30)">' + ph.map(function (p, i) { return '<text x="0" y="' + (i * 52 + 14) + '" style="font:700 12px var(--sans);fill:var(--ink)">Фаза ' + p[0] + '</text><rect class="lv' + i + '" x="0" y="' + (i * 52 + 22) + '" width="110" height="14" rx="7" style="fill:var(--sunk)"/>'; }).join('') + '</g></svg>' +
      '<div class="anim-ctl"><label>Газ <input type="range" min="5" max="100" value="30"><output></output></label></div><div class="readout">ESC по черзі подає струм на три фази обмоток статора (A, B, C). Магнітне поле «біжить» по колу, і магніти ротора тягнуться за ним. Що частіше перемикання, то швидше обертається мотор.</div>';
    root.innerHTML = s;
    var inp = q(root, 'input'), out = q(root, 'output'), mag = q(root, '.mag'), ang = 0;
    var coils = [0, 1, 2].map(function (i) { return root.querySelectorAll('.c' + i); }), lv = [0, 1, 2].map(function (i) { return q(root, '.lv' + i); });
    inp.oninput = function () { out.textContent = inp.value + '%'; }; inp.oninput();
    var lp = loop(function (dt) {
      ang = (ang + dt * (+inp.value) * 5) % 360;
      mag.setAttribute('transform', 'rotate(' + ang + ')');
      var step = Math.floor(((ang + 30) % 360) / 60);          // six steps per electrical turn
      var hi = step % 3, lo = (step + 1) % 3;
      for (var i = 0; i < 3; i++) {
        var on = i === hi ? '+' : i === lo ? '−' : '';
        coils[i].forEach(function (c) { c.style.fill = on === '+' ? '#e0402a' : on === '−' ? '#243260' : 'var(--line)'; });
        lv[i].style.fill = on === '+' ? '#e0402a' : on === '−' ? '#243260' : 'var(--sunk)';
      }
    });
    if (RM) lp.stop();
    return { stop: lp.stop };
  };

  // antenna length vs frequency (quarter-wave elements of a dipole)
  A.antlen = function (root) {
    var F = [[433, '433 МГц'], [750, '750 МГц'], [868, '868 МГц'], [915, '915 МГц'], [1020, '1020 МГц'], [2400, '2,4 ГГц']];
    root.innerHTML = '<svg class="sv" viewBox="0 0 360 170"><g class="ant"></g></svg><div class="anim-ctl"><label>Частота <input type="range" min="0" max="5" step="1" value="3"><output></output></label></div><div class="readout"></div>';
    var inp = q(root, 'input'), g = q(root, '.ant');
    function upd() {
      var f = F[+inp.value], el = 75 / f[0] * 100, px = el * 9;   // cm per element; 9 px per cm
      q(root, 'output').textContent = f[1];
      g.innerHTML = '<path class="st navy" style="stroke-width:5" d="M' + (180 - px) + ' 50H' + (180 + px) + '"/><path class="st navy" style="stroke-width:3" d="M180 50V150"/><rect x="170" y="44" width="20" height="12" rx="3" class="navyf"/>' +
        '<path class="st mut" d="M' + (180 - px) + ' 76H' + (180 + px) + 'M' + (180 - px) + ' 70v12M' + (180 + px) + ' 70v12"/><text class="tx" x="180" y="98" text-anchor="middle">≈ ' + (el * 2).toFixed(1).replace('.', ',') + ' см</text>';
      q(root, '.readout').innerHTML = 'Чим нижча частота, тим довша антена: розмір дипольної антени пов’язаний з довжиною радіохвилі. Антена має бути розрахована саме на частоту приймача, інакше дальність зв’язку різко падає. <span class="muted">Довжина на схемі — орієнтовна, для півхвильового диполя.</span>';
    }
    inp.oninput = upd; upd();
  };
})();

/* ===== Intro: soldering temperature ===== */
(function () {
  'use strict';
  var A = APP.ANIMS;
  A.solder = function (root) {
    var W = [['power', 'Силові дроти (батарея)', 400, 450], ['motor', 'Моторні дроти', 350, 380], ['aux', 'Супутнє обладнання', 250, 300]];
    root.innerHTML = '<div class="anim-ctl">' + W.map(function (w, i) { return '<button type="button" class="tog" data-w="' + i + '" aria-pressed="' + (i === 1) + '">' + w[1] + '</button>'; }).join('') + '</div>' +
      '<svg class="sv" viewBox="0 0 360 170"><g class="pad"></g><g class="th"></g></svg>' +
      '<div class="anim-ctl"><label>Температура жала <input type="range" min="200" max="480" step="10" value="300"><output></output></label></div><div class="readout"></div>';
    var wi = 1, inp = root.querySelector('input'), pad = root.querySelector('.pad'), th = root.querySelector('.th');
    function upd() {
      var w = W[wi], t = +inp.value, st = t < w[2] ? 'cold' : t > w[3] ? 'hot' : 'ok';
      root.querySelector('output').textContent = t + ' °C';
      root.querySelectorAll('[data-w]').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.w === wi); });
      // board + pad + wire + joint
      var s = '<rect x="20" y="118" width="230" height="22" rx="3" style="fill:#2f6b3a"/>' +
        '<rect x="70" y="' + (st === 'hot' ? 106 : 112) + '" width="120" height="8" rx="2" style="fill:#c98b3a"' + (st === 'hot' ? ' transform="rotate(-6 70 112)"' : '') + '/>' +
        '<path d="M10 96 H110" style="stroke:#e0402a;stroke-width:12;stroke-linecap:round"/><path d="M100 103 H170" style="stroke:#b8b8b8;stroke-width:6"/>';
      if (st === 'ok') s += '<ellipse cx="140" cy="104" rx="46" ry="16" style="fill:#d9dde3"/><ellipse cx="128" cy="98" rx="18" ry="5" style="fill:#fff;opacity:.8"/>';
      else if (st === 'cold') s += '<path d="M96 112 q6 -22 18 -10 q8 -16 18 -2 q10 -14 16 0 q10 -10 14 6 q6 4 2 8 z" style="fill:#9a9ea6"/><circle cx="118" cy="104" r="3" style="fill:#7d8188"/><circle cx="150" cy="100" r="2.5" style="fill:#7d8188"/>';
      else s += '<ellipse cx="140" cy="104" rx="40" ry="12" style="fill:#c9ccd2"/><path d="M60 120 q20 -14 40 0 M180 120 q20 -14 40 0" style="stroke:#3a2a12;stroke-width:5;fill:none;opacity:.7"/>';
      pad.innerHTML = s;
      // thermometer with the recommended band
      var y = function (v) { return 150 - (v - 200) / 280 * 130; };
      th.innerHTML = '<rect x="292" y="20" width="16" height="130" rx="8" class="sunk"/><rect x="292" y="' + y(w[3]) + '" width="16" height="' + (y(w[2]) - y(w[3])) + '" style="fill:var(--ok);opacity:.5"/>' +
        '<rect x="288" y="' + (y(t) - 2) + '" width="24" height="4" rx="2" style="fill:' + (st === 'ok' ? 'var(--ok)' : 'var(--bad)') + '"/>' +
        '<text class="txs" x="316" y="' + (y(w[3]) + 4) + '">' + w[3] + '</text><text class="txs" x="316" y="' + (y(w[2]) + 4) + '">' + w[2] + '</text>';
      root.querySelector('.readout').innerHTML = '<b>' + w[1] + ': ' + w[2] + '–' + w[3] + ' °C.</b> ' +
        (st === 'ok' ? 'Добре: пайка блискуча, однорідна, округла, без тріщин.' : st === 'cold' ? '<b style="color:var(--bad)">Замало.</b> Припій не прогрівається: пайка матова, зерниста, слабка.' : '<b style="color:var(--bad)">Забагато.</b> Ризик перегріти плату: майданчик може відшаруватися, флюс згорає.');
    }
    root.querySelectorAll('[data-w]').forEach(function (b) { b.onclick = function () { wi = +b.dataset.w; upd(); }; });
    inp.oninput = upd; upd();
  };
})();
