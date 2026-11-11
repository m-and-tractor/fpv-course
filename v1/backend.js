/* Victory Drones FPV course — accounts, groups and progress sync (Supabase).
   Turned on when config.js sets COURSE_SB_URL and COURSE_SB_KEY (the public "publishable" key — never the secret key).
   Without them the course runs in demo mode: progress only in this browser. */
var BACKEND = (function () {
  'use strict';
  var URL_ = window.COURSE_SB_URL, KEY = window.COURSE_SB_KEY;
  var B = { enabled: !!(URL_ && KEY && window.supabase), user: null, me: null, status: null, isAdmin: false };
  if (!B.enabled) return B;
  var sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, storageKey: 'vdc.auth' } });
  var A = null;                                     // app api, set in init()
  var MAIL_DOMAIN = 'learners.victory-drones.com';  // synthetic e-mails, never used for sending

  function esc(s) { return A.esc(s == null ? '' : s); }
  function view() { return A.view(); }
  function $(s) { return A.$(s); }
  function emailOf(nick) {
    var bytes = new TextEncoder().encode(String(nick).trim().toLowerCase()), hex = '';
    bytes.forEach(function (b) { hex += ('0' + b.toString(16)).slice(-2); });
    return 'u' + hex + '@' + MAIL_DOMAIN;
  }
  function err(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/invalid login|invalid_credentials/i.test(m)) return 'Невірний нікнейм або пароль.';
    if (/invite_invalid/.test(m)) return 'Посилання недійсне або термін його дії минув. Зверніться до адміністратора.';
    if (/already_member/.test(m)) return 'Цей акаунт уже в групі.';
    if (/duplicate|unique|already registered/i.test(m)) return 'Такий нікнейм уже зайнятий.';
    if (/password/i.test(m)) return 'Пароль має містити щонайменше 6 символів.';
    if (/nickname/i.test(m)) return 'Нікнейм: 3–24 символи, літери, цифри, «_», «-», «.».';
    if (/fetch|network/i.test(m)) return 'Немає з’єднання з сервером. Перевірте інтернет.';
    return m;
  }
  function form(title, lede, fields, submit, extra) {
    return '<h2 class="page">' + title + '</h2>' + (lede ? '<p class="lede">' + lede + '</p>' : '') +
      '<form class="set" id="authf" novalidate>' + fields.map(function (f) {
        return '<label class="fld"><span>' + f[1] + '</span><input id="' + f[0] + '" type="' + (f[2] || 'text') + '" autocomplete="' + (f[3] || 'off') + '" required></label>';
      }).join('') + '<p class="ferr" id="ferr" role="alert"></p><button class="btn wide" type="submit">' + submit + '</button>' + (extra || '') + '</form>';
  }
  function val(id) { var e = $('#' + id); return e ? e.value.trim() : ''; }
  function showErr(m) { var e = $('#ferr'); if (e) e.textContent = m; }
  function busy(on) { var b = $('#authf button[type=submit]'); if (b) { b.disabled = on; } }

  // ---------- session ----------
  function loadMe() {
    return sb.rpc('me').then(function (r) {
      if (r.error) throw r.error;
      B.me = r.data || {}; B.isAdmin = B.me.role === 'admin' || B.me.role === 'owner'; B.isOwner = B.me.role === 'owner'; B.status = B.me.status || (B.isAdmin ? 'active' : null);
    });
  }
  function mergeProgress() {
    return sb.from('progress').select('data').eq('user_id', B.user.id).maybeSingle().then(function (r) {
      var remote = (r.data && r.data.data) || null, local = A.getP(), owner = null;
      try { owner = localStorage.getItem('vdc.owner'); } catch (e) {}
      if (owner !== B.user.id) local = { les: {}, q: {}, tests: {} };         // progress of another person on this device is not mixed in
      var m = remote ? merge(local, remote) : local;
      A.setP(m);
      try { localStorage.setItem('vdc.owner', B.user.id); } catch (e) {}
      return pushNow(m);
    });
  }
  function merge(a, b) {
    var out = { les: {}, q: {}, tests: {}, use: {} };
    [a, b].forEach(function (src) {
      Object.keys(src.les || {}).forEach(function (k) {
        var x = src.les[k], o = out.les[k] || (out.les[k] = {});
        o.seen = o.seen || x.seen; if (x.seenAt) o.seenAt = Math.min(o.seenAt || x.seenAt, x.seenAt);
        if (x.quiz) { o.quiz = o.quiz || {}; o.quiz.best = Math.max(o.quiz.best || 0, x.quiz.best || 0); o.quiz.total = x.quiz.total || o.quiz.total; o.quiz.done = o.quiz.done || x.quiz.done; o.quiz.at = Math.max(o.quiz.at || 0, x.quiz.at || 0); }
      });
      Object.keys(src.use || {}).forEach(function (k) {
        var x = src.use[k], o = out.use[k] || (out.use[k] = { v: 0, r: 0, vmax: 0, end: false });
        o.v = Math.max(o.v, x.v || 0); o.r = Math.max(o.r, x.r || 0); o.vmax = Math.max(o.vmax, x.vmax || 0); o.end = o.end || !!x.end; o.last = Math.max(o.last || 0, x.last || 0);
      });
      Object.keys(src.q || {}).forEach(function (k) { var x = src.q[k], o = out.q[k]; if (!o || (x.s || 0) > (o.s || 0)) out.q[k] = x; });
      Object.keys(src.tests || {}).forEach(function (k) {
        var x = src.tests[k], o = out.tests[k] || (out.tests[k] = {});
        o.best = Math.max(o.best || 0, x.best || 0); o.total = x.total || o.total; o.passed = o.passed || x.passed; if (x.last && (!o.last || x.last.at > o.last.at)) o.last = x.last;
      });
    });
    return out;
  }
  var pushT = null;
  B.push = function (P) { if (!B.user) return; clearTimeout(pushT); pushT = setTimeout(function () { pushNow(P); }, 1500); };
  function pushNow(P) {
    if (!B.user) return Promise.resolve();
    return sb.from('progress').upsert({ user_id: B.user.id, data: P, updated_at: new Date().toISOString() }).then(function (r) { if (r.error) console.warn(r.error); });
  }
  window.addEventListener('pagehide', function () { if (pushT) { clearTimeout(pushT); pushNow(A.getP()); } });

  B.init = function (api) {
    A = api;
    return sb.auth.getSession().then(function (r) {
      B.user = r.data.session ? r.data.session.user : null;
      if (!B.user) return;
      return loadMe().then(mergeProgress);
    }).catch(function (e) { console.warn(e); });
  };
  function afterLogin() { return loadMe().then(mergeProgress).then(function () { location.hash = '#home'; A.route(); }); }
  B.logout = function () {
    return pushNow(A.getP()).then(function () { return sb.auth.signOut(); }).then(function () {
      B.user = B.me = B.status = null; B.isAdmin = B.isOwner = false;
      A.setP({ les: {}, q: {}, tests: {} }); try { localStorage.removeItem('vdc.owner'); } catch (e) {}
      location.hash = '#home'; A.route();
    });
  };

  // ---------- screens ----------
  B.loginView = function () {
    view().innerHTML = form('Вхід до курсу', 'Увійдіть під нікнеймом і паролем, які ви створили за посиланням групи.',
      [['nick', 'Нікнейм', 'text', 'username'], ['pass', 'Пароль', 'password', 'current-password']], 'Увійти',
      '<p class="small muted" style="margin:6px 0 0">Немає акаунта? Відкрийте посилання для приєднання, яке надав адміністратор групи.</p>' +
      '<p class="small muted" style="margin:4px 0 0">Забули пароль? Зверніться до адміністратора групи: він встановить новий.</p>');
    $('#authf').onsubmit = function (e) {
      e.preventDefault(); var nick = val('nick'), pass = $('#pass').value;
      if (!nick || !pass) return showErr('Заповніть обидва поля.');
      busy(true); showErr('');
      sb.auth.signInWithPassword({ email: emailOf(nick), password: pass }).then(function (r) {
        if (r.error) throw r.error; B.user = r.data.user; return afterLogin();
      }).catch(function (x) { busy(false); showErr(err(x)); });
    };
  };

  B.joinView = function (code) {
    view().innerHTML = '<p class="muted">Перевіряємо посилання…</p>';
    sb.rpc('invite_info', { p_code: code }).then(function (r) {
      var g = r.data;
      if (r.error || !g || !g.open) { view().innerHTML = '<h2 class="page">Посилання недійсне</h2><p class="lede">Це посилання не працює або термін його дії минув. Зверніться до адміністратора групи.</p><a class="btn quiet" href="#home">До входу</a>'; return; }
      if (B.user && B.status) { view().innerHTML = '<h2 class="page">Ви вже в групі</h2><p class="lede">Ваш акаунт уже приєднано до групи «' + esc(B.me.group) + '».</p><a class="btn" href="#home">До курсу</a>'; return; }
      var full = g.taken >= g.seats;
      view().innerHTML = form('Приєднання до групи «' + esc(g.name) + '»',
        full ? 'Усі місця в групі зайняті. Ви можете створити акаунт — адміністратор отримає запит і, якщо погодить, додасть вас до групи.' : 'Вільних місць: ' + (g.seats - g.taken) + ' з ' + g.seats + '. Придумайте нікнейм і пароль — за ними ви входитимете до курсу.',
        [['nick', 'Нікнейм (3–24 символи)', 'text', 'username'], ['pass', 'Пароль (щонайменше 6 символів)', 'password', 'new-password'], ['pass2', 'Повторіть пароль', 'password', 'new-password']],
        full ? 'Надіслати запит' : 'Створити акаунт',
        '<p class="small muted" style="margin:6px 0 0">Пошта не потрібна. Запам’ятайте нікнейм і пароль.</p>');
      $('#authf').onsubmit = function (e) {
        e.preventDefault(); var nick = val('nick'), pass = $('#pass').value, pass2 = $('#pass2').value;
        if (!/^[A-Za-zА-Яа-яЇїІіЄєҐґ0-9_.-]{3,24}$/.test(nick)) return showErr('Нікнейм: 3–24 символи, літери, цифри, «_», «-», «.».');
        if (pass.length < 6) return showErr('Пароль має містити щонайменше 6 символів.');
        if (pass !== pass2) return showErr('Паролі не збігаються.');
        busy(true); showErr('');
        sb.rpc('nickname_taken', { p_nickname: nick }).then(function (t) {
          if (t.error) throw t.error; if (t.data) throw new Error('duplicate');
          return sb.auth.signUp({ email: emailOf(nick), password: pass, options: { data: { nickname: nick } } });
        }).then(function (s) {
          if (s.error) throw s.error;
          if (!s.data.session) return sb.auth.signInWithPassword({ email: emailOf(nick), password: pass }).then(function (x) { if (x.error) throw x.error; return x.data; });
          return s.data;
        }).then(function (d) {
          B.user = d.user; return sb.rpc('join_group', { p_code: code });
        }).then(function (j) {
          if (j.error) throw j.error; return afterLogin();
        }).catch(function (x) { busy(false); showErr(err(x)); });
      };
    });
  };

  B.inviteView = function (code) {
    view().innerHTML = '<p class="muted">Перевіряємо посилання…</p>';
    sb.rpc('admin_invite_info', { p_code: code }).then(function (r) {
      var i = r.data;
      if (r.error || !i || !i.open) { view().innerHTML = '<h2 class="page">Посилання недійсне</h2><p class="lede">Це запрошення вже використане або термін його дії минув. Попросіть нове.</p><a class="btn quiet" href="#home">До входу</a>'; return; }
      var title = i.role === 'owner' ? 'Акаунт головного адміністратора' : 'Запрошення адміністратора';
      view().innerHTML = form(title, 'Придумайте нікнейм і пароль для входу. Пошта не потрібна. Посилання одноразове.',
        [['nick', 'Нікнейм (3–24 символи)', 'text', 'username'], ['pass', 'Пароль (щонайменше 6 символів)', 'password', 'new-password'], ['pass2', 'Повторіть пароль', 'password', 'new-password']], 'Створити акаунт');
      $('#authf').onsubmit = function (e) {
        e.preventDefault(); var nick = val('nick'), pass = $('#pass').value, pass2 = $('#pass2').value;
        if (!/^[A-Za-zА-Яа-яЇїІіЄєҐґ0-9_.-]{3,24}$/.test(nick)) return showErr('Нікнейм: 3–24 символи, літери, цифри, «_», «-», «.».');
        if (pass.length < 6) return showErr('Пароль має містити щонайменше 6 символів.');
        if (pass !== pass2) return showErr('Паролі не збігаються.');
        busy(true); showErr('');
        sb.rpc('nickname_taken', { p_nickname: nick }).then(function (t) {
          if (t.error) throw t.error; if (t.data) throw new Error('duplicate');
          return sb.auth.signUp({ email: emailOf(nick), password: pass, options: { data: { nickname: nick } } });
        }).then(function (s) {
          if (s.error) throw s.error;
          if (!s.data.session) return sb.auth.signInWithPassword({ email: emailOf(nick), password: pass }).then(function (x) { if (x.error) throw x.error; return x.data; });
          return s.data;
        }).then(function (d) { B.user = d.user; return sb.rpc('claim_admin_invite', { p_code: code }); })
          .then(function (c) { if (c.error) throw c.error; return loadMe().then(mergeProgress); })
          .then(function () { location.hash = '#admin'; A.route(); })
          .catch(function (x) { busy(false); showErr(err(x)); });
      };
    });
  };

  B.waitView = function () {
    var st = B.status;
    view().innerHTML = '<h2 class="page">' + (st === 'pending' ? 'Запит надіслано' : st === 'rejected' ? 'Доступ не надано' : 'Акаунт без групи') + '</h2>' +
      '<p class="lede">' + (st === 'pending' ? 'Усі місця в групі «' + esc(B.me.group) + '» зайняті. Адміністратор бачить ваш запит і може додати вас до групи. Спробуйте зайти пізніше.' : st === 'rejected' ? 'Адміністратор відхилив запит на приєднання до групи. Якщо це помилка, зверніться до нього.' : 'Цей акаунт не прив’язаний до жодної групи. Відкрийте посилання для приєднання від адміністратора.') + '</p>' +
      '<div class="row"><button class="btn" type="button" id="recheck">Перевірити ще раз</button><button class="btn quiet" type="button" id="lo">Вийти</button></div>';
    $('#recheck').onclick = function () { loadMe().then(function () { A.route(); }); };
    $('#lo').onclick = B.logout;
  };

  B.settingsHtml = function () {
    return '<div class="set"><h3>Акаунт</h3><p style="margin:0"><b>' + esc(B.me && B.me.nickname) + '</b>' + (B.me && B.me.group ? ' · група «' + esc(B.me.group) + '»' : '') + (B.isAdmin ? ' · адміністратор' : '') + '</p>' +
      '<p class="small muted" style="margin:0">Поступ зберігається на сервері: можна продовжити з будь-якого пристрою.</p>' +
      '<div class="row">' + (B.isAdmin ? '<a class="btn" href="#admin">Панель адміністратора</a>' : '') + '<button class="btn quiet" type="button" id="lo">Вийти</button></div></div>' +
      '<form class="set" id="cpw" novalidate><h3>Змінити пароль</h3><label class="fld"><span>Новий пароль (щонайменше 6 символів)</span><input id="cp1" type="password" autocomplete="new-password"></label>' +
      '<label class="fld"><span>Повторіть пароль</span><input id="cp2" type="password" autocomplete="new-password"></label><p class="ferr" id="ferr"></p><button class="btn quiet" type="submit">Зберегти пароль</button></form>';
  };
  B.bindSettings = function () {
    var b = $('#lo'); if (b) b.onclick = B.logout;
    var f = $('#cpw');
    if (f) f.onsubmit = function (e) {
      e.preventDefault(); var p1 = $('#cp1').value, p2 = $('#cp2').value;
      if (p1.length < 6) return showErr('Щонайменше 6 символів.'); if (p1 !== p2) return showErr('Паролі не збігаються.');
      sb.auth.updateUser({ password: p1 }).then(function (r) { if (r.error) return showErr(err(r.error)); f.reset(); showErr(''); A.toast('Пароль змінено'); });
    };
  };

  // ---------- tests ----------
  B.attempts = function (mod) {
    return Promise.all([
      sb.from('test_attempts').select('id', { count: 'exact', head: true }).eq('user_id', B.user.id).eq('module_id', mod),
      sb.from('test_grants').select('extra,requested_at').eq('user_id', B.user.id).eq('module_id', mod).maybeSingle()
    ]).then(function (r) {
      var extra = (r[1].data && r[1].data.extra) || 0, rt = B.isAdmin ? 1000 : ((B.me && B.me.retakes) != null ? B.me.retakes : 2);
      return { used: r[0].count || 0, allowed: 1 + rt + extra, requested: !!(r[1].data && r[1].data.requested_at) };
    });
  };
  B.startTest = function (mod) {
    return sb.rpc('start_test', { p_module: mod }).then(function (r) { if (r.error) throw r.error; return r.data; });
  };
  B.finishTest = function (id, score, total, rate) {
    return sb.rpc('finish_test', { p_attempt: id, p_score: score, p_total: total, p_pass_rate: rate }).then(function (r) { if (r.error) console.warn(r.error); });
  };
  B.requestExtra = function (mod) { return sb.rpc('request_extra_attempt', { p_module: mod }); };

  // ---------- admin ----------
  function joinLink(code) { return location.origin + location.pathname + '#join-' + code; }
  function lessonsList() { var L = A.lessons(); return Object.keys(L).map(function (k) { return L[k]; }).filter(function (l) { return !l.soon; }); }
  function fmtDate(s) { if (!s) return '—'; var d = new Date(s); return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); }
  function stats(data, attempts) {
    var les = lessonsList(), done = 0, qs = 0, qn = 0;
    les.forEach(function (l) { var p = (data.les || {})[l.id]; if (!p) return; if ((l.quiz && l.quiz.length) ? (p.quiz && p.quiz.done) : p.seen) done++; if (p.quiz && p.quiz.total) { qs += p.quiz.best / p.quiz.total; qn++; } });
    var mods = {}; (attempts || []).forEach(function (a) { var m = mods[a.module_id] || (mods[a.module_id] = { used: 0, best: null, passed: false }); m.used++; if (a.score != null && (m.best == null || a.score > m.best.score)) m.best = a; if (a.passed) m.passed = true; });
    return { done: done, total: les.length, quiz: qn ? Math.round(qs / qn * 100) : null, mods: mods };
  }
  function copy(text, btn) {
    var ok = function () { btn.textContent = 'Скопійовано'; setTimeout(function () { btn.textContent = 'Копіювати'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () { prompt('Скопіюйте посилання:', text); }); else prompt('Скопіюйте посилання:', text);
  }

  B.adminView = function (parts) {
    if (parts && parts[0]) return groupView(parts.join('-'));
    view().innerHTML = '<p class="muted">Завантаження…</p>';
    Promise.all([
      sb.from('groups').select('*').order('created_at', { ascending: false }),
      sb.from('memberships').select('user_id,group_id,status,created_at'),
      sb.from('profiles').select('id,nickname'),
      sb.from('test_grants').select('*').not('requested_at', 'is', null)
    ]).then(function (r) {
      var groups = r[0].data || [], mem = r[1].data || [], prof = {}, reqs = r[3].data || [];
      (r[2].data || []).forEach(function (p) { prof[p.id] = p.nickname; });
      var gname = {}; groups.forEach(function (g) { gname[g.id] = g.name; });
      var pend = mem.filter(function (m) { return m.status === 'pending'; });
      var html = '<h2 class="page">Панель адміністратора</h2>';
      if (pend.length) html += '<div class="set"><h3>Запити на приєднання понад ліміт (' + pend.length + ')</h3>' + pend.map(function (m) {
        return '<div class="arow"><span><b>' + esc(prof[m.user_id]) + '</b> → «' + esc(gname[m.group_id]) + '» <span class="muted small">' + fmtDate(m.created_at) + '</span></span><span class="row"><button class="btn" data-ok="' + m.user_id + '">Додати</button><button class="btn quiet" data-no="' + m.user_id + '">Відхилити</button></span></div>';
      }).join('') + '<p class="small muted" style="margin:0">«Додати» збільшує кількість місць у групі на одне.</p></div>';
      if (reqs.length) html += '<div class="set"><h3>Потрібна додаткова спроба тесту (' + reqs.length + ')</h3>' + reqs.map(function (g) {
        return '<div class="arow"><span><b>' + esc(prof[g.user_id]) + '</b> · тест ' + esc(g.module_id) + ' <span class="muted small">' + fmtDate(g.requested_at) + '</span></span><button class="btn" data-grant="' + g.user_id + '|' + g.module_id + '">+1 спроба</button></div>';
      }).join('') + '</div>';
      html += '<div class="set"><h3>Нова група</h3><form id="ng" class="grid2" novalidate>' +
        '<label class="fld" style="grid-column:1/-1"><span>Назва групи</span><input id="g_name" required value="' + esc(defaultName(groups)) + '"></label>' +
        '<label class="fld"><span>Кількість місць</span><input id="g_seats" type="number" min="1" max="500" value="20"></label>' +
        '<label class="fld"><span>Перескладань тесту модуля</span><input id="g_ret" type="number" min="0" max="20" value="2"></label>' +
        '<label class="fld" style="grid-column:1/-1"><span>Посилання діє до (необов’язково)</span><input id="g_exp" type="date"></label>' +
        '<p class="ferr" id="ferr" style="grid-column:1/-1"></p><button class="btn" type="submit" style="grid-column:1/-1">Створити групу і посилання</button></form></div>';
      if (B.isOwner) html += '<div class="set" id="admins"><h3>Адміністратори</h3><p class="muted small" style="margin:0">Завантаження…</p></div>';
      html += '<div class="part-h" style="margin-top:22px"><h3>Групи</h3><span>' + groups.length + '</span></div><div class="lessons">' + (groups.length ? groups.map(function (g) {
        var act = mem.filter(function (m) { return m.group_id === g.id && m.status === 'active'; }).length;
        return '<div class="set" style="margin-top:8px"><div class="arow"><a href="#admin-' + g.id + '"><b>' + esc(g.name) + '</b></a><span class="chip ' + (g.active ? 'ok' : 'lock') + '">' + (g.active ? 'відкрита' : 'закрита') + '</span></div>' +
          '<p class="small muted" style="margin:0">Учнів: ' + act + ' з ' + g.seats + ' · перескладань: ' + g.retakes + (g.expires_at ? ' · посилання до ' + new Date(g.expires_at).toLocaleDateString('uk-UA') : '') + '</p>' +
          '<div class="mail">' + esc(joinLink(g.invite_code)) + '</div><div class="row"><button class="btn quiet" data-copy="' + esc(joinLink(g.invite_code)) + '">Копіювати</button><a class="btn quiet" href="#admin-' + g.id + '">Учні й поступ</a><button class="btn quiet" data-toggle="' + g.id + '|' + (g.active ? 0 : 1) + '">' + (g.active ? 'Закрити посилання' : 'Відкрити посилання') + '</button></div></div>';
      }).join('') : '<p class="muted">Груп ще немає.</p>') + '</div>';
      view().innerHTML = html;
      bindAdmin();
      if (B.isOwner) adminsBlock();
    });
  };
  function adminsBlock() {
    Promise.all([
      sb.from('profiles').select('id,nickname,role,created_at').in('role', ['admin', 'owner']).order('created_at'),
      sb.from('admin_invites').select('*').is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
    ]).then(function (r) {
      var box = $('#admins'); if (!box) return;
      var inv = r[1].data || [];
      box.innerHTML = '<h3>Адміністратори</h3>' + (r[0].data || []).map(function (p) {
        return '<div class="arow"><span><b>' + esc(p.nickname) + '</b> <span class="chip ' + (p.role === 'owner' ? 'go' : 'new') + '">' + (p.role === 'owner' ? 'головний' : 'адміністратор') + '</span></span>' + (p.role === 'admin' ? '<button class="btn quiet" data-unadmin="' + p.id + '">Забрати права</button>' : '') + '</div>';
      }).join('') +
        (inv.length ? '<p class="small muted" style="margin:6px 0 0">Невикористані запрошення (діють 14 днів, одноразові):</p>' + inv.map(function (i) {
          var link = location.origin + location.pathname + '#invite-' + i.code;
          return '<div class="mail">' + esc(link) + '</div><div class="row">' + (i.note ? '<span class="small muted">' + esc(i.note) + '</span>' : '') + '<button class="btn quiet" data-copy="' + esc(link) + '">Копіювати</button><button class="btn quiet" data-revoke="' + i.code + '">Скасувати</button></div>';
        }).join('') : '') +
        '<form class="row" id="ainv" novalidate style="margin-top:6px"><label class="fld" style="flex:1"><span>Для кого (необов’язково)</span><input id="ai_note" placeholder="Наприклад: інструктор Олег"></label><button class="btn" type="submit" style="align-self:flex-end">Створити запрошення адміністратора</button></form>';
      box.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { copy(b.dataset.copy, b); }; });
      box.querySelectorAll('[data-revoke]').forEach(function (b) { b.onclick = function () { sb.rpc('revoke_admin_invite', { p_code: b.dataset.revoke }).then(adminsBlock); }; });
      box.querySelectorAll('[data-unadmin]').forEach(function (b) {
        b.onclick = function () { if (b.dataset.sure) { sb.rpc('set_admin_role', { p_user: b.dataset.unadmin, p_admin: false }).then(adminsBlock); } else { b.dataset.sure = 1; b.textContent = 'Так, забрати'; } };
      });
      $('#ainv').onsubmit = function (e) { e.preventDefault(); sb.rpc('create_admin_invite', { p_note: val('ai_note') }).then(function (x) { if (x.error) A.toast(err(x.error)); adminsBlock(); }); };
    });
  }
  function defaultName(groups) {
    var d = new Date(), base = 'Group-' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), n = base, k = 2;
    var names = groups.map(function (g) { return g.name; });
    while (names.indexOf(n) >= 0) n = base + '-' + (k++);
    return n;
  }
  function bindAdmin() {
    var v = view();
    v.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { copy(b.dataset.copy, b); }; });
    v.querySelectorAll('[data-ok],[data-no]').forEach(function (b) { b.onclick = function () { b.disabled = true; sb.rpc('admin_decide', { p_user: b.dataset.ok || b.dataset.no, p_approve: !!b.dataset.ok }).then(function (r) { if (r.error) A.toast(err(r.error)); A.route(); }); }; });
    v.querySelectorAll('[data-grant]').forEach(function (b) { b.onclick = function () { var x = b.dataset.grant.split('|'); b.disabled = true; sb.rpc('admin_grant_attempt', { p_user: x[0], p_module: x[1], p_n: 1 }).then(function (r) { A.toast(r.error ? err(r.error) : 'Додаткову спробу надано'); A.route(); }); }; });
    v.querySelectorAll('[data-toggle]').forEach(function (b) { b.onclick = function () { var x = b.dataset.toggle.split('|'); sb.from('groups').update({ active: x[1] === '1' }).eq('id', x[0]).then(function () { A.route(); }); }; });
    var f = $('#ng');
    if (f) f.onsubmit = function (e) {
      e.preventDefault(); var name = val('g_name'), seats = +val('g_seats'), ret = +val('g_ret'), exp = val('g_exp');
      if (!name) return showErr('Вкажіть назву групи.');
      if (!(seats >= 1 && seats <= 500)) return showErr('Кількість місць: від 1 до 500.');
      if (!(ret >= 0 && ret <= 20)) return showErr('Перескладань: від 0 до 20.');
      sb.from('groups').insert({ name: name, seats: seats, retakes: ret, expires_at: exp ? new Date(exp + 'T23:59:59').toISOString() : null, created_by: B.user.id }).then(function (r) {
        if (r.error) return showErr(err(r.error)); A.toast('Групу створено'); A.route();
      });
    };
  }

  function groupView(gid) {
    view().innerHTML = '<p class="muted">Завантаження…</p>';
    Promise.all([
      sb.from('groups').select('*').eq('id', gid).maybeSingle(),
      sb.from('memberships').select('user_id,status,created_at').eq('group_id', gid)
    ]).then(function (r) {
      var g = r[0].data, mem = r[1].data || [], ids = mem.map(function (m) { return m.user_id; });
      if (!g) { view().innerHTML = '<p>Групу не знайдено.</p><a class="btn quiet" href="#admin">Назад</a>'; return; }
      if (!ids.length) { view().innerHTML = '<div class="crumbs"><a href="#admin">Панель</a></div><h2 class="page">' + esc(g.name) + '</h2><p class="muted">У групі ще немає учнів. Надішліть їм посилання:</p><div class="mail">' + esc(joinLink(g.invite_code)) + '</div>'; return; }
      return Promise.all([
        sb.from('profiles').select('id,nickname,last_seen').in('id', ids),
        sb.from('progress').select('user_id,data,updated_at').in('user_id', ids),
        sb.from('test_attempts').select('user_id,module_id,score,total,passed,started_at').in('user_id', ids),
        sb.from('test_grants').select('*').in('user_id', ids)
      ]).then(function (x) {
        var prof = {}, prog = {}, att = {}, gr = {};
        (x[0].data || []).forEach(function (p) { prof[p.id] = p; });
        (x[1].data || []).forEach(function (p) { prog[p.user_id] = p; });
        (x[2].data || []).forEach(function (a) { (att[a.user_id] = att[a.user_id] || []).push(a); });
        (x[3].data || []).forEach(function (t) { gr[t.user_id + '|' + t.module_id] = t; });
        var mods = A.modules(), rows = mem.map(function (m) {
          var s = stats((prog[m.user_id] || {}).data || {}, att[m.user_id]);
          return { m: m, p: prof[m.user_id] || {}, s: s, upd: (prog[m.user_id] || {}).updated_at };
        }).sort(function (a, b) { return (a.p.nickname || '').localeCompare(b.p.nickname || ''); });
        var active = rows.filter(function (r) { return r.m.status === 'active'; });
        var avgDone = active.length ? Math.round(active.reduce(function (a, r) { return a + r.s.done / (r.s.total || 1); }, 0) / active.length * 100) : 0;
        var passed = {}; mods.forEach(function (md) { passed[md.id] = active.filter(function (r) { return r.s.mods[md.id] && r.s.mods[md.id].passed; }).length; });
        var html = '<div class="crumbs"><a href="#admin">Панель адміністратора</a></div><h2 class="page">' + esc(g.name) + '</h2>' +
          '<div class="tools"><div><b>' + active.length + ' / ' + g.seats + '</b><span>учнів у групі</span></div><div><b>' + avgDone + '%</b><span>середній поступ уроків</span></div>' +
          mods.map(function (md) { return '<div><b>' + passed[md.id] + ' / ' + active.length + '</b><span>склали тест модуля ' + md.n + '</span></div>'; }).join('') + '</div>' +
          '<div class="row"><button class="btn quiet" type="button" id="csv">Завантажити CSV</button><button class="btn quiet" data-copy="' + esc(joinLink(g.invite_code)) + '">Копіювати посилання</button></div>' +
          '<div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Нікнейм</th><th>Уроки</th><th>Питання</th>' + mods.map(function (md) { return '<th>Тест М' + md.n + '</th>'; }).join('') + '<th>Активність</th><th></th></tr></thead><tbody>' +
          rows.map(function (r) {
            var cells = mods.map(function (md) {
              var t = r.s.mods[md.id], used = t ? t.used : 0, allowed = 1 + g.retakes + ((gr[r.m.user_id + '|' + md.id] || {}).extra || 0), req = (gr[r.m.user_id + '|' + md.id] || {}).requested_at;
              var txt = t && t.best ? Math.round(t.best.score / t.best.total * 100) + '%' : '—';
              var flag = !t || !t.passed ? (used >= allowed ? ' <span class="chip bad">спроби вичерпано</span>' : '') : ' <span class="chip ok">складено</span>';
              return '<td style="white-space:normal">' + txt + ' <span class="muted small">(' + used + '/' + allowed + ')</span>' + flag + (req || (t && !t.passed && used >= allowed) ? ' <button class="tog" data-grant="' + r.m.user_id + '|' + md.id + '">+1 спроба</button>' : '') + '</td>';
            }).join('');
            return '<tr' + (r.m.status !== 'active' ? ' class="muted"' : '') + '><td>' + esc(r.p.nickname) + (r.m.status !== 'active' ? ' <span class="chip lock">' + (r.m.status === 'pending' ? 'очікує' : 'відхилено') + '</span>' : '') + '</td>' +
              '<td>' + r.s.done + ' / ' + r.s.total + '</td><td>' + (r.s.quiz != null ? r.s.quiz + '%' : '—') + '</td>' + cells +
              '<td class="small">' + fmtDate(r.upd) + '</td><td><button class="tog" data-pw="' + r.m.user_id + '|' + esc(r.p.nickname) + '">Новий пароль</button></td></tr>';
          }).join('') + '</tbody></table></div><div id="pwbox"></div>';
        view().innerHTML = html;
        bindAdmin();
        view().querySelectorAll('[data-pw]').forEach(function (b) {
          b.onclick = function () {
            var x = b.dataset.pw.split('|'), box = $('#pwbox');
            box.innerHTML = '<form class="set" id="pwf"><h3>Новий пароль для «' + esc(x[1]) + '»</h3><label class="fld"><span>Пароль (щонайменше 6 символів)</span><input id="np" type="text" autocomplete="off"></label><p class="ferr" id="ferr"></p><div class="row"><button class="btn" type="submit">Зберегти</button><button class="btn quiet" type="button" id="pwc">Скасувати</button></div></form>';
            box.scrollIntoView({ behavior: 'smooth' });
            $('#pwc').onclick = function () { box.innerHTML = ''; };
            $('#pwf').onsubmit = function (e) {
              e.preventDefault(); var p = val('np'); if (p.length < 6) return showErr('Щонайменше 6 символів.');
              sb.rpc('admin_set_password', { p_user: x[0], p_password: p }).then(function (r) { if (r.error) return showErr(err(r.error)); box.innerHTML = '<div class="set"><b>Пароль змінено.</b> Передайте учню «' + esc(x[1]) + '» новий пароль: <span class="mail">' + esc(p) + '</span></div>'; });
            };
          };
        });
        $('#csv').onclick = function () {
          var head = ['Нікнейм', 'Статус', 'Уроків пройдено', 'Уроків усього', 'Питання, %'].concat(mods.map(function (md) { return 'Тест М' + md.n + ', %'; })).concat(mods.map(function (md) { return 'Спроб М' + md.n; })).concat(['Остання активність']);
          var lines = [head].concat(rows.map(function (r) {
            return [r.p.nickname, r.m.status, r.s.done, r.s.total, r.s.quiz == null ? '' : r.s.quiz]
              .concat(mods.map(function (md) { var t = r.s.mods[md.id]; return t && t.best ? Math.round(t.best.score / t.best.total * 100) : ''; }))
              .concat(mods.map(function (md) { var t = r.s.mods[md.id]; return t ? t.used : 0; })).concat([r.upd || '']);
          })).map(function (row) { return row.map(function (c) { c = String(c == null ? '' : c); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\r\n');
          var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' })); a.download = g.name.replace(/[^\wА-Яа-яЇїІіЄєҐґ-]+/g, '_') + '.csv'; a.click();
        };
      });
    });
  }

  return B;
})();
