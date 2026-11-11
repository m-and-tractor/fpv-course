/* Victory Drones · FPV course — app
   Content files call APP.part({...}) to register the intro and each module.
   Progress is kept by a small store (local for the demo; Supabase later) keyed by stable ids,
   so new versions and the move to accounts never lose progress. */
var APP = (function () {
  'use strict';
  var VERSION = 'v1', VERSION_LABEL = '0.1 (чернетка)';
  // Where lesson videos live. Later: Cloudflare R2 public URL, e.g. 'https://media.example.com/'.
  var VIDEO_BASE = window.COURSE_VIDEO_BASE || '../media/';
  var PASS_RATE = 0.8;          // module test: 80% to pass
  var TEST_SIZE = 20;           // questions per module test (fewer if the pool is smaller)
  var PREV_SHARE = 0.2;         // 20% of a module test comes from earlier modules
  var WARM_N = 2;               // remembering questions before a lesson
  var RETAKES_DEFAULT = 2;      // demo value; with groups the admin sets it per group (attempts = 1 + retakes)

  // ---------- store ----------
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var S = load('vdc.settings', {});                                   // { mode, theme, preview }
  var P = load('vdc.progress', { les: {}, q: {}, tests: {} });        // see below
  P.les = P.les || {}; P.q = P.q || {}; P.tests = P.tests || {};
  function saveS() { save('vdc.settings', S); }
  function saveP() { save('vdc.progress', P); if (window.BACKEND && BACKEND.enabled) BACKEND.push(P); }
  // les[id] = { seen, quiz: {best, total, done, at} } · q[id] = { s, r, w } · tests[mod] = { attempts, best, total, passed, extra }

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mmss(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function plural(n, a, b, c) { var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c); }
  function toast(msg) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600); }
  var PLAY = '<svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z"/></svg>';

  // ---------- content registry ----------
  var PARTS = [], LES = {}, QBYID = {};
  function part(def) {
    def.lessons = def.lessons || [];
    def.lessons.forEach(function (l, i) {
      l.part = def; l.idx = i;
      (l.quiz || []).forEach(function (q, k) { q.id = q.id || (l.id + 'q' + (k < 9 ? '0' : '') + (k + 1)); q.les = l.id; q.mod = def.id; QBYID[q.id] = q; });
      LES[l.id] = l;
    });
    PARTS.push(def); PARTS.sort(function (a, b) { return a.order - b.order; });
  }
  function modules() { return PARTS.filter(function (p) { return p.kind === 'module'; }); }
  function lp(id) { return P.les[id] || (P.les[id] = {}); }
  function tp(id) { return P.tests[id] || (P.tests[id] = { attempts: 0 }); }
  function avail(l) { return !l.soon; }
  function lessonDone(l) { var p = P.les[l.id]; if (!p) return false; return l.quiz && l.quiz.length ? !!(p.quiz && p.quiz.done) : !!p.seen; }
  function isOpen(l) {
    if (!avail(l)) return false;
    if (S.preview || window.COURSE_REVIEW) return true;
    var prev = l.part.lessons.slice(0, l.idx).filter(avail).pop();
    if (prev) return lessonDone(prev);
    // first lesson of a module: the previous part must be finished (intro: all pages seen; module: test passed)
    var pi = PARTS.indexOf(l.part), before = PARTS[pi - 1];
    if (!before) return true;
    if (before.kind === 'module') return !!tp(before.id).passed;
    return before.lessons.filter(avail).every(lessonDone);
  }
  function testOpen(m) { return S.preview || window.COURSE_REVIEW || m.lessons.filter(avail).every(lessonDone); }
  function attemptsAllowed(m) { var t = tp(m.id); if (t.allowedSrv) return t.allowedSrv; return 1 + RETAKES_DEFAULT + (t.extra || 0); }

  // ---------- figures ----------
  function img(src) { return 'img/' + src + '.webp'; }
  function photo(src, cap) {
    return '<div class="fig"><div class="photo"><img loading="lazy" src="' + img(src) + '" alt="' + esc(String(cap).replace(/<[^>]+>/g, '')) + '"></div>' + (cap ? '<div class="cap">' + cap + '</div>' : '') + '</div>';
  }
  function gallery(items, cls) {
    return '<div class="fig"><div class="gallery ' + (cls || '') + '">' + items.map(function (x) {
      return '<figure><img loading="lazy" src="' + img(x[0]) + '" alt="' + esc(x[1]) + '"><figcaption>' + x[1] + (x[2] ? '<small>' + x[2] + '</small>' : '') + '</figcaption></figure>';
    }).join('') + '</div></div>';
  }
  function anim(name, cap) { return '<div class="fig"><div class="anim" data-anim="' + name + '"></div>' + (cap ? '<div class="cap">' + cap + '</div>' : '') + '</div>'; }
  var ANIMS = {}, live = [];
  function mountAnims(root) {
    $$('.anim[data-anim]', root).forEach(function (el) {
      var f = ANIMS[el.dataset.anim]; if (!f || el.dataset.on) return; el.dataset.on = 1;
      try { var h = f(el); if (h) live.push(h); } catch (e) { console.error(e); }
    });
  }
  function stopAnims() { live.forEach(function (h) { try { h.stop && h.stop(); } catch (e) {} }); live = []; }

  // ---------- views ----------
  var view, back, hmode;
  function setTop(showBack, showMode) { back.hidden = !showBack; hmode.hidden = !showMode; }

  function home() {
    setTop(false, false);
    var all = [], done = 0;
    modules().forEach(function (m) { m.lessons.forEach(function (l) { all.push(l); if (lessonDone(l)) done++; }); });
    var mods = modules(), mPassed = mods.filter(function (m) { return tp(m.id).passed; }).length;
    var html =
      '<section class="hero"><svg class="deco" viewBox="0 0 100 100"><g fill="none" stroke="#fff" stroke-width="5"><circle cx="22" cy="22" r="16"/><circle cx="78" cy="22" r="16"/><circle cx="22" cy="78" r="16"/><circle cx="78" cy="78" r="16"/><path d="M33 33l34 34M67 33L33 67"/><rect x="40" y="40" width="20" height="20" rx="4" fill="#fff"/></g></svg>' +
      '<div class="eyebrow">Онлайн-курс · Victory Drones × ARM Drones</div>' +
      '<h2>Ударний FPV-коптер: будова, збирання, налаштування</h2>' +
      '<p>Кожен урок можна <b>дивитися</b> як відео або <b>читати</b> як текст із малюнками й анімаціями. Після уроку — питання для закріплення, наприкінці модуля — тест.</p>' +
      '<div class="pbar"><i style="width:' + (all.length ? Math.round(done / all.length * 100) : 0) + '%"></i></div>' +
      '<div class="stat"><div><b>' + done + ' / ' + all.length + '</b><span>уроків пройдено</span></div><div><b>' + mPassed + ' / ' + mods.length + '</b><span>' + plural(mods.length, 'модуль', 'модулі', 'модулів') + ' складено</span></div></div>' +
      '</section>';
    PARTS.forEach(function (p) {
      var avl = p.lessons.filter(avail), dn = avl.filter(lessonDone).length;
      html += '<section class="part"><div class="part-h"><h3>' + (p.kind === 'module' ? 'Модуль ' + p.n + '. ' : '') + esc(p.title) + '</h3><span>' + (p.lessons.length ? dn + ' / ' + p.lessons.length : '') + '</span></div><div class="lessons">';
      if (!p.lessons.length) html += '<div class="les locked"><span class="n">·</span><span class="tt"><b>' + esc(p.soonText || 'Незабаром') + '</b><span>Матеріали готуються</span></span><span class="chip lock">незабаром</span></div>';
      p.lessons.forEach(function (l, i) {
        var open = isOpen(l), d = lessonDone(l), st = P.les[l.id] || {};
        var cls = d ? 'done' : (open ? 'open' : 'locked');
        var chip = !avail(l) ? '<span class="chip lock">незабаром</span>' : d ? '<span class="chip ok">пройдено</span>' : open ? (st.seen ? '<span class="chip go">питання</span>' : '<span class="chip new">нове</span>') : '<span class="chip lock">закрито</span>';
        var sub = [l.minutes ? (l.video ? 'відео ' : '') + l.minutes + ' хв' : '', st.quiz && st.quiz.total ? 'питання: ' + st.quiz.best + '/' + st.quiz.total : ''].filter(Boolean).join(' · ');
        html += '<a class="les ' + cls + '" ' + (open ? 'href="#l-' + l.id + '"' : 'aria-disabled="true"') + '><span class="n">' + (p.kind === 'module' ? (i + 1) : (i + 1)) + '</span><span class="tt"><b>' + esc(l.title) + '</b><span>' + esc(sub || l.sub || '') + '</span></span>' + chip + '</a>';
      });
      if (p.kind === 'module') {
        var t = tp(p.id), to = testOpen(p), left = attemptsAllowed(p) - (t.attempts || 0);
        var tchip = t.passed ? '<span class="chip ok">складено</span>' : !to ? '<span class="chip lock">закрито</span>' : left <= 0 ? '<span class="chip bad">спроби вичерпано</span>' : '<span class="chip go">тест</span>';
        html += '<a class="les test ' + (t.passed ? 'done' : (to ? 'open' : 'locked')) + '" ' + (to ? 'href="#t-' + p.id + '"' : 'aria-disabled="true"') + '><span class="n">★</span><span class="tt"><b>Підсумковий тест модуля ' + p.n + '</b><span>' + (t.best != null ? 'найкраще: ' + t.best + '/' + t.total + ' · ' : '') + 'прохідний бал — ' + Math.round(PASS_RATE * 100) + '%</span></span>' + tchip + '</a>';
      }
      html += '</div></section>';
    });
    html += '<div class="row" style="margin-top:26px"><a class="btn quiet" href="#options">Налаштування</a></div>' +
      '<div class="demo">Демо-режим: поступ зберігається лише в цьому браузері' + (window.COURSE_REVIEW ? '. Режим перевірки: усі уроки й тест відкриті' : '') + '</div>';
    view.innerHTML = html;
  }

  // ----- lesson -----
  function lesson(l) {
    setTop(true, true);
    var p = l.part, mode = S.mode === 'read' || !videoReady(l) ? 'read' : 'video';
    var warm = pickWarm(l);
    view.innerHTML =
      '<div class="crumbs"><a href="#home">' + (p.kind === 'module' ? 'Модуль ' + p.n : esc(p.title)) + '</a> · урок ' + (l.idx + 1) + ' з ' + p.lessons.length + '</div>' +
      '<h2 class="page">' + esc(l.title) + '</h2>' + (l.sub ? '<p class="lede">' + esc(l.sub) + '</p>' : '') +
      (warm.length ? '<section class="warm"><h3>Пригадаймо</h3><div class="small">' + warm.length + ' ' + plural(warm.length, 'коротке питання', 'короткі питання', 'коротких питань') + ' з попередніх уроків. Без оцінки — лише щоб освіжити памʼять.</div>' + warm.map(function (_, i) { return '<div class="q" data-wq="' + i + '"></div>'; }).join('') + '</section>' : '') +
      '<p class="modehint" id="modehint"></p><div id="pane"></div>';
    warm.forEach(function (q, i) { miniQuestion($('[data-wq="' + i + '"]'), q); });
    renderPane(l, mode);
  }
  function renderPane(l, mode, seekTo) {
    stopAnims();
    var pane = $('#pane');
    $$('#hmode button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mode === mode); });
    var hint = $('#modehint');
    if (hint) hint.textContent = mode === 'video' ? 'Відео' + (l.minutes ? ', ' + l.minutes + ' хв' : '') + '. Перемкнути на текстову версію — «Читати» вгорі.' : 'Текстова версія уроку з малюнками й анімаціями.' + (videoReady(l) ? ' Будь-яку частину можна переглянути у відео — кнопка «▶ у відео».' : '');
    if (mode === 'video') {
      var src = l.video ? VIDEO_BASE + l.video : null;
      pane.innerHTML =
        '<div class="player">' + (!videoReady(l) ? '<div class="novideo"><div><b>Відео додається</b>Поки що пройдіть урок у режимі «Читати».</div></div>' : '<video id="vid" controls playsinline preload="metadata"' + (l.poster ? ' poster="' + img(l.poster) + '"' : '') + ((window.COURSE_HLS || []).indexOf(l.video.replace(/\.mp4$/, '')) >= 0 ? '' : ' src="' + src + '"') + '></video>') + '</div>' +
        '<div class="chapters">' + (l.chapters || []).map(function (c) { return '<button class="chap" type="button" data-seek="' + c[0] + '"><span class="t">' + mmss(c[0]) + '</span><b>' + c[1] + '</b></button>'; }).join('') + '</div>' +
        endBlock(l);
      var v = $('#vid'), chaps = $$('.chap');
      // Long videos can be served as HLS segments (used by the preview build, where single files are size-limited).
      var hlsList = window.COURSE_HLS || [];
      if (v && hlsList.indexOf(l.video.replace(/\.mp4$/, '')) >= 0) {
        var m3u8 = VIDEO_BASE + 'hls/' + l.video.replace(/\.mp4$/, '') + '/index.txt';
        if (window.Hls && window.Hls.isSupported()) { var hls = new window.Hls(); hls.loadSource(m3u8); hls.attachMedia(v); live.push({ stop: function () { hls.destroy(); } }); }
        else if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = m3u8;
      }
      function mark() { if (!v) return; var t = v.currentTime, k = 0; (l.chapters || []).forEach(function (c, i) { if (t >= c[0]) k = i; }); chaps.forEach(function (b, i) { b.classList.toggle('on', i === k); }); }
      function seek(t) {
        if (!v) return;
        var go = function () { v.currentTime = t; v.play().catch(function () {}); };
        if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
        $('.player').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (v) {
        v.addEventListener('timeupdate', mark);
        v.addEventListener('timeupdate', function () { if (v.duration && v.currentTime > v.duration * 0.9) markSeen(l); });
        v.addEventListener('ended', function () { markSeen(l); });
        trackVideo(l, v);
      }
      chaps.forEach(function (b) { b.onclick = function () { seek(+b.dataset.seek); }; });
      if (seekTo != null) seek(seekTo); else mark();
    } else {
      pane.innerHTML = (l.steps || []).map(function (s, i) {
        return '<section class="step" id="st-' + i + '"><div class="step-h"><span class="kind">' + (i + 1) + ' · ' + s.kind + '</span>' + (videoReady(l) && s.t != null ? '<button class="jump" type="button" data-t="' + s.t + '">' + PLAY + ' у відео ' + mmss(s.t) + '</button>' : '') + '</div><h3>' + s.h + '</h3><div class="body">' + s.body + '</div></section>';
      }).join('') +
        (l.summary ? '<div class="summary"><h3>Що потрібно запамʼятати</h3><ul>' + l.summary.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' : '') +
        endBlock(l);
      $$('.jump', pane).forEach(function (b) { b.onclick = function () { S.mode = 'video'; saveS(); renderPane(l, 'video', +b.dataset.t); }; });
      mountAnims(pane);
      trackRead(l);
      var sum = $('.summary', pane);
      if (sum && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { markSeen(l); use(l).end = true; saveP(); io.disconnect(); } });
        io.observe(sum);
      } else if (!sum) markSeen(l);
    }
  }
  function videoName(l) { return l.video ? l.video.replace(/\.mp4$/, '') : ''; }
  function videoReady(l) {
    if (!l.video || l.videoReady === false) return false;
    var list = window.COURSE_VIDEOS, hls = window.COURSE_HLS || [];
    if (hls.indexOf(videoName(l)) >= 0) return true;
    return !list || list.indexOf(videoName(l)) >= 0;
  }
  function markSeen(l) { var p = lp(l.id); if (!p.seen) { p.seen = true; p.seenAt = Date.now(); saveP(); } }
  // learning statistics (for the admin dashboard): time per tab, share of the video watched, text read to the end
  function use(l) { P.use = P.use || {}; return P.use[l.id] || (P.use[l.id] = { v: 0, r: 0, vmax: 0, end: false }); }
  var useDirty = 0;
  function useSave(force) { if (useDirty && (force || useDirty >= 30)) { useDirty = 0; saveP(); } }
  function trackRead(l) {
    var id = setInterval(function () { if (document.visibilityState === 'visible') { use(l).r += 5; use(l).last = Date.now(); useDirty += 5; useSave(); } }, 5000);
    live.push({ stop: function () { clearInterval(id); useSave(true); } });
  }
  function trackVideo(l, v) {
    var prev = null;
    v.addEventListener('timeupdate', function () {
      var t = v.currentTime, u = use(l);
      if (!v.paused && prev != null && t > prev && t - prev < 2) { u.v += t - prev; u.last = Date.now(); useDirty += t - prev; }
      prev = t; if (v.duration) u.vmax = Math.max(u.vmax || 0, Math.round(t / v.duration * 100) / 100);
      useSave();
    });
    v.addEventListener('seeking', function () { prev = null; });
    live.push({ stop: function () { useSave(true); } });
  }
  function endBlock(l) {
    var p = lp(l.id), q = l.quiz || [], next = nextLesson(l);
    if (!q.length) return '<div class="endcta">' + (next ? '<a class="btn wide" href="#l-' + next.id + '" data-seen="' + l.id + '">Далі: ' + esc(next.title) + '</a>' : '<a class="btn wide" href="#home" data-seen="' + l.id + '">До змісту курсу</a>') + '</div>';
    return '<div class="endcta"><a class="btn wide" href="#q-' + l.id + '">Питання до уроку (' + q.length + ')</a>' +
      (p.quiz && p.quiz.total ? '<p class="small muted" style="text-align:center;margin:0">Найкращий результат: ' + p.quiz.best + ' з ' + p.quiz.total + '</p>' : '') + '</div>';
  }
  function nextLesson(l) {
    var rest = l.part.lessons.slice(l.idx + 1).filter(avail);
    if (rest.length) return rest[0];
    var pi = PARTS.indexOf(l.part), nx = PARTS[pi + 1];
    return nx ? nx.lessons.filter(avail)[0] : null;
  }

  // ----- question instances -----
  function instance(q) {
    if (q.open) return { id: q.id, q: q.q, open: true, model: q.model, ex: q.ex, src: q };
    var ord = shuffle(q.o.map(function (_, i) { return i; }));
    return { id: q.id, q: q.q, o: ord.map(function (i) { return q.o[i]; }), a: ord.indexOf(q.a), ex: q.ex, src: q };
  }
  // Explanation after an answer. Most supplied questions have no explanation: then a wrong answer shows the right one.
  function exText(q, ok) { return '<b>' + (ok ? 'Правильно.' : 'Ні.') + '</b> ' + (ok ? '' : 'Правильна відповідь: ' + q.o[q.a].replace(/\.$/, '') + '. ') + (q.ex || ''); }
  function record(id, ok) { var st = P.q[id] || (P.q[id] = { s: 0, r: 0, w: 0 }); st.s++; if (ok) st.r++; else st.w++; saveP(); }
  // weights: unseen and previously-missed questions come up more often
  function wOwn(q) { var st = P.q[q.id]; if (!st || !st.s) return 3; if (st.w > st.r) return 4; return st.w ? 2 : 1; }
  function wReview(q) { var st = P.q[q.id]; if (!st || !st.s) return 1; return st.w ? 2 + Math.min(st.w, 3) : 0.8; }
  function wsample(items, wfn, n) {
    var pool = items.map(function (x) { return { x: x, w: wfn(x) }; }), out = [];
    while (out.length < n && pool.length) {
      var tot = pool.reduce(function (a, b) { return a + b.w; }, 0), r = Math.random() * tot, i = 0;
      while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
      out.push(pool.splice(i, 1)[0].x);
    }
    return out;
  }
  // Remembering: questions from the previous module; inside the first module — from earlier lessons of it.
  function pickWarm(l) {
    var p = l.part, pool = [];
    if (p.kind === 'module') {
      var mods = modules(), mi = mods.indexOf(p);
      if (mi > 0) mods.slice(0, mi).forEach(function (m, k) { if (k >= mi - 1) m.lessons.forEach(function (x) { pool = pool.concat(x.quiz || []); }); });
      else {
        p.lessons.slice(0, l.idx).forEach(function (x) { pool = pool.concat(x.quiz || []); });
        // first lesson of the first module: remember the intro
        if (!pool.length) PARTS.filter(function (x) { return x.kind === 'intro'; }).forEach(function (ip) { ip.lessons.forEach(function (x) { pool = pool.concat(x.quiz || []); }); });
      }
    }
    pool = pool.filter(function (q) { return !q.open; });
    return wsample(pool, wReview, WARM_N).map(instance);
  }
  function miniQuestion(el, q) {
    el.innerHTML = '<div class="qt">' + q.q + '</div><div class="opts">' + q.o.map(function (o, i) { return '<button type="button" class="opt" data-i="' + i + '">' + o + '</button>'; }).join('') + '</div><div data-ex></div>';
    $$('.opt', el).forEach(function (b) {
      b.onclick = function () {
        var k = +b.dataset.i, ok = k === q.a; record(q.id, ok);
        $$('.opt', el).forEach(function (x, i) { x.disabled = true; if (i === q.a) x.classList.add('right'); else if (i === k) x.classList.add('wrong'); });
        var src = LES[q.src.les];
        $('[data-ex]', el).innerHTML = '<div class="explain">' + exText(q, ok) + (src ? '<br><a href="#l-' + src.id + '" class="small">↺ Повторити урок «' + esc(src.title) + '»</a>' : '') + '</div>';
      };
    });
  }

  // ----- quiz runner (lesson quiz and module test share it) -----
  var Q = null;
  function runQuiz(cfg) { Q = cfg; Q.i = 0; Q.res = []; renderQ(); }
  function renderQ() {
    var it = Q.items[Q.i], n = Q.items.length;
    setTop(true, false);
    var bar = Q.items.map(function (_, i) { var r = Q.res[i]; return '<i class="' + (i === Q.i ? 'cur' : r === true ? 'ok' : r === false ? 'no' : '') + '"></i>'; }).join('');
    var tag = it.review ? '<span class="qtag rev">повторення · модуль ' + it.review + '</span>' : (it.open ? '<span class="qtag">відкрите · без оцінки</span>' : '');
    view.innerHTML = '<div class="crumbs">' + esc(Q.title) + '</div>' +
      '<div class="qcard"><div class="qhead"><span class="qtag">Питання ' + (Q.i + 1) + ' з ' + n + '</span>' + tag + '</div>' +
      '<div class="qtext">' + it.q + '</div>' +
      (it.open ? '<textarea class="open" id="openans" placeholder="Ваша відповідь…"></textarea><div class="row" style="margin-top:10px"><button class="btn" type="button" id="showm">Показати відповідь</button></div>'
        : '<div class="opts">' + it.o.map(function (o, i) { return '<button class="opt" type="button" data-i="' + i + '">' + o + '</button>'; }).join('') + '</div>') +
      '<div id="after"></div><div class="qbar">' + bar + '</div></div>';
    function after(ok, html) {
      Q.res[Q.i] = ok;
      $('#after').innerHTML = html + '<div style="margin-top:12px"><button class="btn wide" type="button" id="next">' + (Q.i + 1 < n ? 'Далі' : 'Результат') + '</button></div>';
      $('#next').onclick = function () { Q.i++; if (Q.i < n) renderQ(); else Q.done(Q); };
      $('#next').focus({ preventScroll: true });
      $('#after').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (it.open) {
      $('#showm').onclick = function () {
        $('#openans').readOnly = true; this.remove();
        after(null, '<div class="explain"><b>Зразок відповіді:</b> ' + it.model + (it.ex ? '<br><span class="muted">' + it.ex + '</span>' : '') + '</div>');
      };
    } else {
      $$('.opt').forEach(function (b) {
        b.onclick = function () {
          var k = +b.dataset.i, ok = k === it.a; record(it.id, ok);
          $$('.opt').forEach(function (x, i) { x.disabled = true; if (i === it.a) x.classList.add('right'); else if (i === k) x.classList.add('wrong'); });
          after(ok, Q.noExplain ? '' : '<div class="explain">' + exText(it, ok) + '</div>');
        };
      });
    }
  }
  function tally(cfg) {
    var score = 0, total = 0, wrong = [];
    cfg.items.forEach(function (it, i) { if (it.open) return; total++; if (cfg.res[i] === true) score++; else wrong.push(it); });
    return { score: score, total: total, wrong: wrong };
  }
  function reviewHtml(wrong) {
    if (!wrong.length) return '';
    return '<div class="review"><h3>Помилки</h3>' + wrong.map(function (it) {
      return '<div class="qcard"><div class="qtext" style="margin-top:0">' + it.q + '</div><div class="explain"><b>Правильна відповідь:</b> ' + it.o[it.a] + (it.ex ? '<br>' + it.ex : '') + '</div></div>';
    }).join('') + '</div>';
  }

  function lessonQuiz(l) {
    var items = shuffle((l.quiz || []).filter(function (q) { return !q.open; })).map(instance)
      .concat((l.quiz || []).filter(function (q) { return q.open; }).map(instance));
    runQuiz({ title: 'Питання до уроку · ' + l.title, items: items, done: function (c) {
      var t = tally(c), p = lp(l.id);
      p.quiz = p.quiz || {}; p.quiz.best = Math.max(p.quiz.best || 0, t.score); p.quiz.total = t.total; p.quiz.done = true; p.quiz.at = Date.now(); p.seen = true; saveP();
      var good = t.score / t.total >= PASS_RATE, next = nextLesson(l), m = l.part;
      var nextBtn = next ? '<a class="btn" href="#l-' + next.id + '">Далі: ' + esc(next.title) + '</a>' : (m.kind === 'module' && testOpen(m) ? '<a class="btn hi" href="#t-' + m.id + '">До тесту модуля</a>' : '');
      setTop(true, false);
      view.innerHTML = '<div class="crumbs">' + esc(l.title) + '</div><div class="score ' + (good ? 'result-ok' : 'result-bad') + '">' + t.score + ' / ' + t.total + '</div>' +
        '<p>' + (good ? 'Добре засвоєно. Урок зараховано.' : 'Урок зараховано, але варто повторити матеріал — нижче ваші помилки. Пройти питання ще раз можна будь-коли.') + '</p>' +
        '<div class="row">' + nextBtn + '<button class="btn quiet" type="button" id="again">Ще раз</button><a class="btn quiet" href="#l-' + l.id + '">До уроку</a></div>' + reviewHtml(t.wrong);
      $('#again').onclick = function () { lessonQuiz(l); };
    } });
  }

  // ----- module test -----
  function buildTest(m) {
    var own = []; m.lessons.filter(avail).forEach(function (l) { own = own.concat((l.quiz || []).filter(function (q) { return !q.open; })); });
    var mods = modules(), mi = mods.indexOf(m), prior = [];
    mods.slice(0, mi).forEach(function (pm) { pm.lessons.forEach(function (l) { prior = prior.concat((l.quiz || []).filter(function (q) { return !q.open; })); }); });
    var size = Math.min(TEST_SIZE, own.length + prior.length);
    var nPrev = prior.length ? Math.min(prior.length, Math.round(size * PREV_SHARE)) : 0;
    var nOwn = Math.min(own.length, size - nPrev); nPrev = Math.min(prior.length, size - nOwn);
    var items = wsample(own, wOwn, nOwn).map(instance).concat(wsample(prior, wReview, nPrev).map(function (q) { var it = instance(q); it.review = LES[q.les].part.n; return it; }));
    return shuffle(items);
  }
  function testIntro(m, fresh) {
    setTop(true, false);
    if (window.BACKEND && BACKEND.enabled && !fresh) {          // attempts are counted on the server
      view.innerHTML = '<p class="muted">Завантаження…</p>';
      BACKEND.attempts(m.id).then(function (r) { var t = tp(m.id); t.attempts = r.used; t.allowedSrv = r.allowed; t.requested = r.requested; testIntro(m, true); }, function () { testIntro(m, true); });
      return;
    }
    var t = tp(m.id), allowed = attemptsAllowed(m), used = t.attempts || 0, left = allowed - used, open = testOpen(m);
    var own = 0; m.lessons.filter(avail).forEach(function (l) { own += (l.quiz || []).filter(function (q) { return !q.open; }).length; });
    var size = Math.min(TEST_SIZE, own), hasPrev = modules().indexOf(m) > 0;
    var html = '<div class="crumbs"><a href="#home">Модуль ' + m.n + '</a></div><h2 class="page">Підсумковий тест модуля ' + m.n + '</h2><p class="lede">' + esc(m.title) + '</p>' +
      '<div class="rules"><b>Правила</b><ul>' +
      '<li>' + size + ' ' + plural(size, 'питання', 'питання', 'питань') + (hasPrev ? ': 80% — з цього модуля, 20% — з попередніх модулів' : ' з уроків цього модуля') + '.</li>' +
      '<li>Щоб скласти, потрібно щонайменше ' + Math.round(PASS_RATE * 100) + '% правильних відповідей.</li>' +
      '<li>Кількість спроб обмежена: ' + allowed + '. Пояснення до відповідей — після завершення тесту.</li>' +
      '<li>Порядок питань і варіантів щоразу інший.</li></ul>' +
      '<div class="attempts" title="Використано спроб">' + Array.apply(null, Array(allowed)).map(function (_, i) { return '<i class="' + (i < used ? 'used' : '') + '"></i>'; }).join('') + '</div>' +
      '<p class="small muted" style="margin:6px 0 0">Використано спроб: ' + used + ' з ' + allowed + (t.best != null ? ' · найкращий результат: ' + t.best + '/' + t.total : '') + '</p></div>';
    if (t.passed) html += '<p class="chip ok" style="display:inline-block;margin-top:14px">Тест складено</p><div class="row" style="margin-top:12px"><a class="btn quiet" href="#home">До змісту</a></div>';
    else if (!open) html += '<p class="muted" style="margin-top:14px">Тест відкриється, коли ви пройдете всі уроки модуля.</p>';
    else if (left <= 0) html += '<div class="warnbox" style="margin-top:14px"><b>Спроби вичерпано.</b> Адміністратор групи бачить це у своїй панелі й може надати додаткову спробу.</div>' +
      '<div class="row"><button class="btn quiet" type="button" id="askmore">Повідомити адміністратора</button></div>';
    else html += '<div class="row" style="margin-top:16px"><button class="btn hi" type="button" id="go">Почати тест</button><a class="btn quiet" href="#home">Пізніше</a></div>';
    view.innerHTML = html;
    var go = $('#go'); if (go) go.onclick = function () { startTest(m); };
    var ask = $('#askmore');
    if (ask && t.requested) { ask.disabled = true; ask.textContent = 'Запит надіслано'; }
    if (ask) ask.onclick = function () { var b = this; t.askMore = Date.now(); saveP(); (window.BACKEND && BACKEND.enabled ? BACKEND.requestExtra(m.id) : Promise.resolve()).then(function () { toast('Запит надіслано адміністратору'); b.disabled = true; b.textContent = 'Запит надіслано'; }); };
  }
  function startTest(m) {
    var t = tp(m.id);
    if (window.BACKEND && BACKEND.enabled) {
      BACKEND.startTest(m.id).then(function (r) {
        t.attempts = r.used; t.allowedSrv = r.allowed; saveP();
        if (!r.ok) return testIntro(m, true);
        runTest(m, t, r.attempt);
      }, function () { toast('Немає з’єднання з сервером. Спробуйте ще раз.'); });
      return;
    }
    t.attempts = (t.attempts || 0) + 1; saveP();     // an attempt counts as soon as it starts
    runTest(m, t, null);
  }
  function runTest(m, t, attemptId) {
    runQuiz({ title: 'Тест модуля ' + m.n, items: buildTest(m), noExplain: true, done: function (c) {
      var r = tally(c), pass = r.score / r.total >= PASS_RATE;
      t.best = Math.max(t.best || 0, r.score); t.total = r.total; if (pass) t.passed = true; t.last = { score: r.score, total: r.total, at: Date.now() }; saveP();
      if (attemptId && window.BACKEND) BACKEND.finishTest(attemptId, r.score, r.total, PASS_RATE);
      var left = attemptsAllowed(m) - t.attempts;
      setTop(true, false);
      view.innerHTML = '<div class="crumbs">Тест модуля ' + m.n + '</div><div class="score ' + (pass ? 'result-ok' : 'result-bad') + '">' + Math.round(r.score / r.total * 100) + '%</div>' +
        '<p><b>' + r.score + ' з ' + r.total + '</b> правильних. ' + (pass ? 'Тест складено — модуль зараховано.' : 'Потрібно щонайменше ' + Math.round(PASS_RATE * 100) + '%. ' + (left > 0 ? 'Залишилось ' + plural(left, 'спроба', 'спроби', 'спроб').replace(/^/, left + ' ') + '. Повторіть уроки, у яких були помилки.' : 'Спроби вичерпано — зверніться до адміністратора групи.')) + '</p>' +
        '<div class="row">' + (pass ? '<a class="btn" href="#home">До змісту курсу</a>' : '<a class="btn" href="#t-' + m.id + '">До тесту</a><a class="btn quiet" href="#home">До уроків</a>') + '</div>' + reviewHtml(r.wrong);
    } });
  }

  // ----- settings -----
  function settings() {
    setTop(true, false);
    var th = S.theme || 'auto';
    view.innerHTML = '<h2 class="page">Налаштування</h2>' +
      '<div class="set"><h3>Тема</h3><div class="seg">' + [['auto', 'Як у системі'], ['light', 'Світла'], ['dark', 'Темна']].map(function (x) { return '<button type="button" data-th="' + x[0] + '" aria-pressed="' + (th === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="set"><h3>Режим перевірки</h3><p class="small muted" style="margin:0">Відкриває всі уроки й тести без проходження попередніх. Для авторів курсу.</p><button class="tog" type="button" id="pv" aria-pressed="' + !!S.preview + '">' + (S.preview ? 'Увімкнено' : 'Вимкнено') + '</button></div>' +
      '<div class="set"><h3>Скинути поступ</h3><p class="small muted" style="margin:0">Видалить результати на цьому пристрої (демо-режим).</p><button class="btn quiet" type="button" id="reset">Скинути</button></div>' +
      (window.BACKEND && BACKEND.enabled ? BACKEND.settingsHtml() : '') +
      '<p class="small muted" style="margin-top:18px">Версія ' + VERSION_LABEL + '.</p>';
    if (window.BACKEND && BACKEND.enabled) BACKEND.bindSettings();
    $$('[data-th]').forEach(function (b) { b.onclick = function () { S.theme = b.dataset.th; saveS(); applyTheme(); settings(); }; });
    $('#pv').onclick = function () { S.preview = !S.preview; saveS(); settings(); };
    $('#reset').onclick = function () { if (this.dataset.sure) { P = { les: {}, q: {}, tests: {} }; saveP(); toast('Поступ скинуто'); location.hash = '#home'; } else { this.dataset.sure = 1; this.textContent = 'Так, скинути'; } };
  }
  function applyTheme() { var t = S.theme; if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }

  // ----- router -----
  function route() {
    stopAnims(); window.scrollTo(0, 0);
    var h = location.hash.replace(/^#/, '') || 'home', parts = h.split('-');
    var l = LES[parts[1]], m = PARTS.filter(function (x) { return x.id === parts[1]; })[0];
    if (window.BACKEND && BACKEND.enabled) {                       // accounts: join / login / admin screens and the login gate
      setTop(false, false);
      if (parts[0] === 'join') return BACKEND.joinView(parts.slice(1).join('-'));
      if (parts[0] === 'invite') return BACKEND.inviteView(parts.slice(1).join('-'));
      if (!BACKEND.user) return BACKEND.loginView();
      if (BACKEND.status !== 'active' && !BACKEND.isAdmin) return BACKEND.waitView();
      if (parts[0] === 'admin' && BACKEND.isAdmin) { setTop(true, false); return BACKEND.adminView(parts.slice(1)); }
    }
    if (parts[0] === 'options') return settings();
    if (parts[0] === 'l' && l && isOpen(l)) return lesson(l);
    if (parts[0] === 'q' && l && isOpen(l)) return lessonQuiz(l);
    if (parts[0] === 't' && m && m.kind === 'module') return testIntro(m);
    home();
  }
  function start() {
    view = $('#view'); back = $('#back'); hmode = $('#hmode');
    applyTheme();
    window.addEventListener('hashchange', route);
    back.onclick = function () {
      var h = location.hash.replace(/^#/, '').split('-');
      location.hash = (h[0] === 'q' && LES[h[1]]) ? '#l-' + h[1] : '#home';
    };
    $('#menu').onclick = function () { location.hash = '#options'; };
    $$('#hmode button').forEach(function (b) {
      b.onclick = function () {
        var l = LES[location.hash.replace(/^#/, '').split('-')[1]]; if (!l) return;
        if (b.dataset.mode === 'video' && !l.video) { toast('Для цього уроку відео немає'); return; }
        S.mode = b.dataset.mode; saveS(); var v = $('#vid'); if (v) v.pause(); renderPane(l, S.mode); window.scrollTo(0, 0);
      };
    });
    view.addEventListener('click', function (e) {
      var sn = e.target.closest('[data-seen]'); if (sn && LES[sn.dataset.seen]) markSeen(LES[sn.dataset.seen]);
      var im = e.target.closest('.photo img, .gallery img');
      if (im) {
        var fig = im.closest('figure'), cap = fig ? fig.querySelector('figcaption').textContent : ((im.closest('.fig') || {}).querySelector ? (im.closest('.fig').querySelector('.cap') || {}).textContent || '' : '');
        var lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = '<img src="' + im.src + '" alt=""><p>' + esc(cap) + '</p>';
        lb.onclick = function () { lb.remove(); }; document.body.appendChild(lb);
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var lb = $('.lb'); if (lb) lb.remove(); } });
    if (window.BACKEND && BACKEND.enabled) BACKEND.init(api).then(route, route); else route();
  }

  // what backend.js may use
  var api = {
    getP: function () { return P; }, setP: function (v) { P = v; P.les = P.les || {}; P.q = P.q || {}; P.tests = P.tests || {}; save('vdc.progress', P); },
    view: function () { return view; }, setTop: setTop, esc: esc, toast: toast, route: route, $: $, $$: $$, plural: plural,
    modules: modules, lessons: function () { return LES; }, PASS_RATE: PASS_RATE, lessonDone: lessonDone
  };
  return { part: part, start: start, ANIMS: ANIMS, photo: photo, gallery: gallery, anim: anim, img: img, esc: esc };
})();
