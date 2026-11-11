/* Offline videos: download whole course / one module in 720p or 480p into the device (Cache Storage), delete them later.
   The service worker (sw.js) plays downloaded files with range support, so video works without internet.
   Index of downloaded files: localStorage 'vdc.dl' = { "m01-l07": "hd" | "sd" } — re-checked against the cache when the screen opens. */
var OFFLINE = (function () {
  var A, CACHE = 'videos-v1', BASE = window.COURSE_VIDEO_BASE || '../media/', SIZES = window.COURSE_VIDEO_SIZES || {};
  var idx = read('vdc.dl', {}), job = null, wake = null;
  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return A.esc(s == null ? '' : s); }
  function $(s) { return A.$(s); }
  function url(name, q) { return BASE + name + (q === 'sd' ? '-sd' : '') + '.mp4'; }
  function ok() { return 'caches' in window && 'serviceWorker' in navigator && window.ReadableStream; }
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function ios() { var ua = navigator.userAgent; return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
  function quality() { return read('vdc.dlq', 'sd'); }
  function mb(b) { return b >= 1e9 ? (Math.round(b / 1e8) / 10).toString().replace('.', ',') + ' ГБ' : Math.max(1, Math.round(b / 1e6)) + ' МБ'; }
  function nameOf(l) { return l.video ? l.video.replace(/\.mp4$/, '') : ''; }

  // which videos exist, grouped by part (intro, module 1, …)
  function groups() {
    var vids = window.COURSE_VIDEOS || [], out = [], all = [];
    A.parts().forEach(function (p) {
      var names = p.lessons.filter(function (l) { return !l.soon && l.video && vids.indexOf(nameOf(l)) >= 0 && SIZES[nameOf(l)]; }).map(nameOf);
      if (!names.length) return;
      out.push({ id: p.id, title: p.kind === 'module' ? 'Модуль ' + p.n + '. ' + p.title : p.title, names: names, passed: p.kind === 'module' && ((A.getP().tests || {})[p.id] || {}).passed });
      all = all.concat(names);
    });
    out.unshift({ id: 'all', title: 'Увесь курс', names: all });
    return out;
  }
  function size(names, q) { return names.reduce(function (s, n) { return s + ((SIZES[n] || [0, 0])[q === 'sd' ? 1 : 0]); }, 0); }
  function have(names) { return names.filter(function (n) { return idx[n]; }); }
  function usedBytes() { return Object.keys(idx).reduce(function (s, n) { return s + ((SIZES[n] || [0, 0])[idx[n] === 'sd' ? 1 : 0]); }, 0); }

  // make the index match what is really stored (the phone may clear storage when it runs out of space)
  function verify() {
    if (!ok()) return Promise.resolve();
    return caches.open(CACHE).then(function (c) {
      return Promise.all(Object.keys(idx).map(function (n) { return c.match(url(n, idx[n])).then(function (r) { if (!r) delete idx[n]; }); }));
    }).then(function () { write('vdc.dl', idx); });
  }

  // ---------- download / delete ----------
  function download(names, q) {
    if (job) return;
    var todo = names.filter(function (n) { return idx[n] !== q; });
    if (!todo.length) { A.toast('Ці відео вже завантажено'); return; }
    if (!navigator.onLine) { A.toast('Для завантаження потрібен інтернет'); return; }
    job = { todo: todo, q: q, i: 0, total: size(todo, q), loaded: 0, cur: 0, stop: false };
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
    render();
    next();
  }
  function next() {
    if (!job) return;
    if (job.stop || job.i >= job.todo.length) return finish();
    var n = job.todo[job.i], u = url(n, job.q), started = job.loaded;
    fetch(u, { mode: 'cors', cache: 'no-store' }).then(function (res) {
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      var reader = res.body.getReader(), len = res.headers.get('Content-Length') || String((SIZES[n] || [0, 0])[job.q === 'sd' ? 1 : 0]);
      job.reader = reader;
      var stream = new ReadableStream({
        pull: function (ctl) {
          return reader.read().then(function (r) {
            if (r.done) { ctl.close(); return; }
            job.loaded += r.value.byteLength; tick(); ctl.enqueue(r.value);
          });
        },
        cancel: function () { reader.cancel(); }
      });
      return caches.open(CACHE).then(function (c) {
        return c.put(u, new Response(stream, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': len } })).then(function () { return c.match(u); }).then(function (r) {
          if (!r) throw new Error('not stored');
          var old = idx[n]; idx[n] = job.q; write('vdc.dl', idx);
          if (old && old !== job.q) return c.delete(url(n, old));          // keep only one quality of each video
        });
      });
    }).then(function () { job.i++; next(); }).catch(function (e) {
      console.warn(e); job.loaded = started;
      var full = /quota|space|QuotaExceeded/i.test(String(e && (e.name + e.message)));
      job.err = job.stop ? '' : full ? 'На пристрої закінчилося місце. Видаліть частину відео або оберіть економну якість.' : 'Завантаження перервалося (немає зв’язку або екран було заблоковано). Натисніть «Завантажити» ще раз — продовжимо з того ж місця.';
      finish();
    });
  }
  function finish() {
    var j = job; job = null;
    if (wake) { wake.release().catch(function () {}); wake = null; }
    if (j && !j.err && !j.stop) A.toast('Відео завантажено — їх можна дивитися без інтернету');
    if (j && j.err) A.toast(j.err);
    render(j && j.err);
  }
  function remove(names) {
    if (!ok()) return;
    caches.open(CACHE).then(function (c) {
      return Promise.all(names.map(function (n) { delete idx[n]; return Promise.all([c.delete(url(n, 'hd')), c.delete(url(n, 'sd'))]); }));
    }).then(function () { write('vdc.dl', idx); A.toast('Відео видалено з пристрою. Поступ збережено.'); render(); });
  }

  // ---------- screen ----------
  function tick() {
    var b = $('#dlbar'), t = $('#dltxt'); if (!b || !job) return;
    var p = job.total ? Math.min(100, Math.round(job.loaded / job.total * 100)) : 0;
    b.style.width = p + '%';
    t.textContent = 'Відео ' + Math.min(job.i + 1, job.todo.length) + ' з ' + job.todo.length + ' · ' + mb(job.loaded) + ' з ' + mb(job.total) + ' · ' + p + '%';
  }
  function storageLine() {
    var el = $('#dlstore'); if (!el) return;
    var used = usedBytes(), txt = 'Завантажено відео: ' + (used ? mb(used) : 'немає') + '.';
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) {
      if (e && e.quota) el.textContent = txt + ' Курсу доступно на пристрої ще близько ' + mb(Math.max(0, e.quota - (e.usage || 0))) + '.';
    }).catch(function () {});
    el.textContent = txt;
  }
  function installHtml() {
    if (standalone()) return '<div class="set offok"><b>✓ Курс встановлено як застосунок</b><span class="small muted">Завантажені відео зберігаються на цьому пристрої і грають без інтернету.</span></div>';
    var I = A.installSteps();
    return '<div class="set"><h3>Крок 1. Встановіть курс як застосунок</h3>' +
      (ios() ? '<p class="warnline">На iPhone завантажуйте відео <b>вже у встановленому застосунку</b>. У звичайному Safari iPhone може видалити завантажене, якщо курс не відкривати 7 днів.</p>' : '') +
      I + '</div>';
  }
  function render(err) {
    var v = A.view(); if (!v || location.hash.replace(/^#/, '') !== 'offline') return;
    var q = quality(), G = groups(), allSd = size(G[0].names, 'sd'), allHd = size(G[0].names, 'hd');
    var html = '<div class="crumbs"><a href="#home">Головна</a></div><h2 class="page">Навчання без інтернету</h2>' +
      '<p class="lede">Встановіть курс на телефон і завантажте відео — тоді уроки, малюнки, питання і відео працюватимуть без зв’язку. Цей крок можна пропустити й повернутися сюди будь-коли: посилання є на головній і в налаштуваннях.</p>' +
      installHtml();
    if (!ok()) {
      html += '<div class="set"><p style="margin:0">Цей браузер не підтримує збереження відео. Відкрийте курс у Chrome (Android, комп’ютер) або Safari (iPhone).</p></div>';
    } else {
      html += '<div class="set"><h3>' + (standalone() ? '' : 'Крок 2. ') + 'Якість відео</h3><div class="seg q2">' +
        '<button type="button" data-q="hd" aria-pressed="' + (q === 'hd') + '"><b>Висока</b><span>720p · увесь курс ' + mb(allHd) + '</span></button>' +
        '<button type="button" data-q="sd" aria-pressed="' + (q === 'sd') + '"><b>Економна</b><span>480p · увесь курс ' + mb(allSd) + '</span></button></div>' +
        '<p class="small muted" style="margin:0">На екрані телефона різниця майже непомітна, а місця економна якість займає вдвічі менше.</p></div>';
      if (job) html += '<div class="set dljob"><h3>Завантаження…</h3><div class="pbar"><i id="dlbar" style="width:0"></i></div><p class="small" id="dltxt"></p><p class="small muted" style="margin:0">Не блокуйте екран і не закривайте застосунок, доки завантаження не завершиться.</p><button class="btn quiet" type="button" id="dlstop">Зупинити</button></div>';
      if (err) html += '<p class="ferr">' + esc(err) + '</p>';
      html += '<div class="set"><h3>' + (standalone() ? '' : 'Крок 3. ') + 'Що завантажити</h3><p class="small muted" style="margin:0" id="dlstore"></p>' + G.map(function (g) {
        var h = have(g.names), need = size(g.names.filter(function (n) { return idx[n] !== q; }), q), all = h.length === g.names.length && g.names.every(function (n) { return idx[n] === q; });
        return '<div class="dlrow' + (g.id === 'all' ? ' main' : '') + '"><div class="dlinfo"><b>' + esc(g.title) + '</b><span>' + g.names.length + ' ' + A.plural(g.names.length, 'відео', 'відео', 'відео') + ' · ' + mb(size(g.names, q)) + '</span>' +
          (h.length ? '<span class="chip ' + (all ? 'ok' : 'go') + '">' + (all ? 'на пристрої' : 'завантажено ' + h.length + ' з ' + g.names.length) + '</span>' : '') +
          (g.passed && h.length ? '<span class="small muted">Модуль складено — відео можна видалити, поступ збережено.</span>' : '') + '</div>' +
          '<div class="dlbtn">' + (!all ? '<button class="btn" type="button" data-dl="' + g.id + '"' + (job ? ' disabled' : '') + '>Завантажити' + (h.length ? ' ще ' + mb(need) : '') + '</button>' : '') +
          (h.length ? '<button class="btn quiet" type="button" data-rm="' + g.id + '"' + (job ? ' disabled' : '') + '>Видалити</button>' : '') + '</div></div>';
      }).join('') + '</div>' +
        '<div class="set"><h3>Що працює без інтернету</h3><ul class="okl"><li>Уроки, малюнки, анімації і питання після уроків</li><li>Завантажені відео</li></ul><h3>Потрібен інтернет</h3><ul class="nol"><li>Підсумкові тести модулів (спроби рахуються на сервері)</li><li>Вхід і завантаження відео</li></ul><p class="small muted" style="margin:0">Поступ, зроблений без зв’язку, збережеться на пристрої і надішлеться, щойно з’явиться інтернет.</p></div>';
    }
    html += '<div class="row" style="margin-top:14px"><a class="btn quiet" href="#home">' + (Object.keys(idx).length ? 'На головну' : 'Пропустити й перейти до курсу') + '</a></div>';
    v.innerHTML = html;
    storageLine(); tick();
    v.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { write('vdc.dlq', b.dataset.q); render(); }; });
    v.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { var g = groups().filter(function (x) { return x.id === b.dataset.dl; })[0]; download(g.names, quality()); }; });
    v.querySelectorAll('[data-rm]').forEach(function (b) {
      b.onclick = function () { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Так, видалити'; return; } var g = groups().filter(function (x) { return x.id === b.dataset.rm; })[0]; remove(g.names); };
    });
    var st = $('#dlstop'); if (st) st.onclick = function () { if (job) { job.stop = true; if (job.reader) job.reader.cancel().catch(function () {}); } };
    if (A.bindInstall) A.bindInstall();
  }

  return {
    init: function (api) { A = api; },
    show: function () { A.setTop(true, false); render(); verify().then(function () { render(); }); },
    // video address for a lesson: the downloaded copy if there is one (served by the service worker), otherwise 720p online
    src: function (l) { var n = nameOf(l); return url(n, idx[n] || 'hd'); },
    has: function (l) { return !!idx[nameOf(l)]; },
    count: function () { return Object.keys(idx).length; },
    // the first time the installed app is opened after login, show this screen once
    firstRun: function () {
      if (!standalone() || read('vdc.offintro', false)) return false;
      write('vdc.offintro', true); location.hash = '#offline'; return true;
    },
    standalone: standalone
  };
})();
