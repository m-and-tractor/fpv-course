/* Course certificate: issued by the server (issue_certificate checks every module test was passed), drawn here as a PDF
   with the cadet's full name, a unique code and a QR link to the public check page #verify-<code>.
   Until the designer's template arrives this draws a clean white certificate. To use the template later, set in config.js:
   window.COURSE_CERT = { template: 'img/cert/template.png', name: { x: 0.5, y: 0.47, size: 0.045 }, date: {...}, code: {...}, qr: { x, y, size } }
   (positions as fractions of the page width/height). */
var CERT = (function () {
  var A, LIBS = null, W = 2480, H = 1754;            // A4 landscape at ~212 dpi
  var NAVY = '#243260', CYAN = '#05aac8', INK = '#18213f', MUTED = '#5b6585';
  function api() { return A || (A = window.APP && APP._api); }
  function esc(s) { return api().esc(s == null ? '' : s); }
  function verifyUrl(code) { return location.origin + location.pathname + '#verify-' + code; }
  function kyiv(ts, withTime) {
    var o = { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' };
    if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return new Date(ts).toLocaleString('uk-UA', o).replace(',', ' о');
  }
  function load(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function libs() { return LIBS || (LIBS = Promise.all([load('lib/jspdf.umd.min.js'), load('lib/qrcode.js')])); }
  function img(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function fonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['700 80px Unbounded', '500 80px Unbounded', '400 40px Montserrat', '500 40px Montserrat', '600 40px Montserrat', '700 40px Montserrat'].map(function (f) { return document.fonts.load(f, 'АБВ abc'); })).catch(function () {});
  }
  function fit(ctx, text, font, size, maxW) { var s = size; do { ctx.font = font.replace('#', s); s -= 4; } while (ctx.measureText(text).width > maxW && s > 20); }
  function qrCanvas(text, px) {
    var q = window.qrcode(0, 'M'); q.addData(text); q.make();
    var n = q.getModuleCount(), cell = Math.floor(px / (n + 2)), size = cell * (n + 2), c = document.createElement('canvas');
    c.width = c.height = size; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = INK;
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + 1) * cell, (r + 1) * cell, cell, cell);
    return c;
  }

  // draws the certificate; returns { canvas, links: [{x,y,w,h}] in page fractions } for clickable areas in the PDF
  function draw(c) {
    var T = window.COURSE_CERT || {}, url = verifyUrl(c.code);
    return Promise.all([fonts(), T.template ? img(T.template) : null, img('img/brand/vd-full.png'), img('img/brand/arm-drones.png')]).then(function (r) {
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var g = cv.getContext('2d'), links = [];
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (r[1]) {                                     // designer's template: only the variable fields are drawn
        g.drawImage(r[1], 0, 0, W, H);
        var put = function (f, text, font, color) { if (!f) return; g.fillStyle = color || INK; fit(g, text, font, Math.round((f.size || 0.03) * W), W * (f.maxW || 0.8)); g.fillText(text, f.x * W, f.y * H); };
        put(T.name, c.full_name, '700 #px Montserrat'); put(T.date, kyiv(c.issued_at), '500 #px Montserrat'); put(T.code, '№ ' + c.code, '500 #px Montserrat', MUTED);
        var qf = T.qr || { x: 0.86, y: 0.8, size: 0.11 }, qs = qf.size * W, q = qrCanvas(url, qs); g.drawImage(q, qf.x * W - qs / 2, qf.y * H - qs / 2, qs, qs);
        links.push({ x: qf.x - qf.size / 2, y: qf.y - qf.size * W / H / 2, w: qf.size, h: qf.size * W / H });
        return { canvas: cv, links: links };
      }
      // clean temporary design
      var grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, NAVY); grad.addColorStop(1, CYAN);
      g.fillStyle = grad; g.fillRect(0, 0, W, 26); g.fillRect(0, H - 26, W, 26);
      g.strokeStyle = '#d9e1ef'; g.lineWidth = 4; g.strokeRect(90, 110, W - 180, H - 220);
      if (r[2]) { var lh = 120, lw = r[2].width / r[2].height * lh; g.drawImage(r[2], W / 2 - lw - 40, 190, lw, lh); }
      if (r[3]) { g.drawImage(r[3], W / 2 + 40, 175, 150, 150); }
      g.fillStyle = '#d9e1ef'; g.fillRect(W / 2 - 2, 190, 4, 120);
      g.fillStyle = NAVY; g.font = '700 150px Unbounded'; g.fillText('СЕРТИФІКАТ', W / 2, 520);
      g.fillStyle = MUTED; g.font = '500 48px Montserrat'; g.fillText('засвідчує, що', W / 2, 640);
      g.fillStyle = INK; fit(g, c.full_name, '700 #px Montserrat', 104, W - 400); g.fillText(c.full_name, W / 2, 790);
      g.fillStyle = CYAN; g.fillRect(W / 2 - 260, 830, 520, 6);
      g.fillStyle = MUTED; g.font = '500 48px Montserrat'; g.fillText('успішно завершив(ла) онлайн-курс і склав(ла) підсумкові тести всіх модулів', W / 2, 940);
      g.fillStyle = NAVY; fit(g, '«' + c.course + '»', '500 #px Unbounded', 76, W - 400); g.fillText('«' + c.course + '»', W / 2, 1060);
      g.fillStyle = MUTED; g.font = '500 40px Montserrat'; g.fillText('Victory Drones × ARM Drones', W / 2, 1140);
      // footer: date and number left, QR right
      g.textAlign = 'left'; g.fillStyle = MUTED; g.font = '500 38px Montserrat';
      g.fillText('Дата видачі', 220, 1380); g.fillText('Номер сертифіката', 220, 1500);
      g.fillStyle = INK; g.font = '700 50px Montserrat'; g.fillText(kyiv(c.issued_at), 220, 1440); g.fillText(c.code, 220, 1560);
      var qs = 300, qx = W - 220 - qs, qy = 1270; g.drawImage(qrCanvas(url, qs), qx, qy, qs, qs);
      g.textAlign = 'right'; g.fillStyle = MUTED; g.font = '500 34px Montserrat';
      g.fillText('Перевірити справжність:', qx - 40, qy + 120); g.fillText('наведіть камеру на QR-код', qx - 40, qy + 170);
      g.fillStyle = CYAN; g.font = '600 30px Montserrat'; var short = url.replace(/^https?:\/\//, '').replace('/index.html', '');
      fit(g, short, '600 #px Montserrat', 30, 1100); g.fillText(short, qx - 40, qy + 230);
      links.push({ x: qx / W, y: qy / H, w: qs / W, h: qs / H });
      links.push({ x: (qx - 40 - g.measureText(short).width) / W, y: (qy + 195) / H, w: g.measureText(short).width / W, h: 45 / H });
      return { canvas: cv, links: links };
    });
  }
  function pdf(c) {
    return libs().then(function () { return draw(c); }).then(function (d) {
      var J = window.jspdf.jsPDF, doc = new J({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true }), url = verifyUrl(c.code);
      doc.setProperties({ title: 'Сертифікат ' + c.code, subject: c.course, author: 'Victory Drones × ARM Drones', keywords: 'verify ' + url });
      doc.addImage(d.canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210);
      d.links.forEach(function (l) { doc.link(l.x * 297, l.y * 210, l.w * 297, l.h * 210, { url: url }); });
      return { doc: doc, canvas: d.canvas };
    });
  }
  function fileName(c) { return 'Certificate-FPV-' + c.code + '.pdf'; }

  // ---------- screens ----------
  function allPassed() {
    var P = api().getP(); return api().modules().filter(function (m) { return m.lessons.some(function (l) { return !l.soon; }); })
      .every(function (m) { return ((P.tests || {})[m.id] || {}).passed; });
  }
  function homeCard() {
    if (!window.BACKEND || !BACKEND.enabled || !BACKEND.user) return '';
    var has = BACKEND.me && BACKEND.me.certificate;
    if (!has && !allPassed()) return '';
    return '<a class="certcard" href="#cert"><span class="ci">★</span><span><b>' + (has ? 'Ваш сертифікат' : 'Курс завершено — отримайте сертифікат') + '</b><span>' + (has ? 'Завантажити PDF або поділитися посиланням для перевірки' : 'Ви склали тести всіх модулів') + '</span></span><span class="go" aria-hidden="true">→</span></a>';
  }
  function view() {
    var v = api().view();
    v.innerHTML = '<div class="crumbs"><a href="#home">Головна</a></div><h2 class="page">Сертифікат</h2><p class="muted">Готуємо сертифікат…</p>';
    BACKEND.rpc('issue_certificate').then(function (r) {
      if (r.error) throw r.error;
      var c = r.data; if (BACKEND.me) BACKEND.me.certificate = c.code;
      var url = verifyUrl(c.code);
      v.innerHTML = '<div class="crumbs"><a href="#home">Головна</a></div><h2 class="page">Сертифікат</h2>' +
        '<p class="lede">Вітаємо із завершенням курсу! Сертифікат № <b>' + esc(c.code) + '</b> видано ' + esc(kyiv(c.issued_at, true)) + ' (за київським часом).</p>' +
        '<div class="certprev" id="certprev"><p class="muted small">Малюємо…</p></div>' +
        '<div class="row" style="margin-top:12px"><button class="btn" type="button" id="certdl" disabled>Завантажити PDF</button><button class="btn quiet" type="button" id="certcp">Копіювати посилання для перевірки</button></div>' +
        '<div class="set"><h3>Як перевірити справжність</h3><p style="margin:0">QR-код на сертифікаті та посилання нижче відкривають сторінку перевірки: вона показує, що сертифікат справді виданий системою курсу, на чиє ім’я і коли.</p><div class="mail">' + esc(url) + '</div><a class="btn quiet" href="#verify-' + esc(c.code) + '" style="align-self:flex-start">Відкрити перевірку</a></div>';
      api().$('#certcp').onclick = function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = 'Скопійовано'; }, function () { prompt('Посилання для перевірки:', url); }); };
      return pdf(c).then(function (p) {
        var box = api().$('#certprev'); if (!box) return;
        box.innerHTML = ''; p.canvas.style.width = '100%'; p.canvas.style.height = 'auto'; box.appendChild(p.canvas);
        var dl = api().$('#certdl'); dl.disabled = false; dl.onclick = function () {
          var blob = p.doc.output('blob'), u = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = u; a.download = fileName(c); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
        };
      });
    }).catch(function (e) {
      var m = String((e && e.message) || e), mods = api().modules();
      if (/modules_not_passed:(.*)/.test(m)) {
        var ids = RegExp.$1.split(','), left = mods.filter(function (x) { return ids.indexOf(x.id) >= 0; });
        v.innerHTML = '<div class="crumbs"><a href="#home">Головна</a></div><h2 class="page">Сертифікат</h2><p class="lede">Сертифікат видається після того, як складено підсумкові тести всіх модулів. Ще залишилось:</p><ul>' +
          left.map(function (x) { return '<li><a href="#t-' + x.id + '">Модуль ' + x.n + '. ' + esc(x.title) + '</a></li>'; }).join('') + (left.length ? '' : '<li>' + esc(ids.join(', ')) + '</li>') + '</ul><a class="btn quiet" href="#home">До курсу</a>';
      } else if (/name_missing/.test(m)) {
        v.innerHTML = '<h2 class="page">Сертифікат</h2><p class="lede">Спершу вкажіть ПІБ у профілі.</p><a class="btn" href="#home">Заповнити</a>';
      } else {
        v.innerHTML = '<h2 class="page">Сертифікат</h2><p class="lede">Не вдалося отримати сертифікат: ' + esc(m) + '. Перевірте інтернет і спробуйте ще раз.</p><a class="btn quiet" href="#home">До курсу</a>';
      }
    });
  }
  function verifyView(code) {
    var a = api(); a.setTop(false, false);
    var v = a.view();
    v.innerHTML = '<h2 class="page">Перевірка сертифіката</h2><p class="muted">Перевіряємо…</p>';
    if (!window.BACKEND || !BACKEND.enabled) { v.innerHTML = '<h2 class="page">Перевірка сертифіката</h2><p class="lede">Перевірка недоступна.</p>'; return; }
    BACKEND.rpc('verify_certificate', { p_code: code }).then(function (r) {
      if (r.error) throw r.error;
      var c = r.data, head = '<h2 class="page">Перевірка сертифіката</h2>';
      if (!c) { v.innerHTML = head + '<div class="set verify bad"><b>✕ Сертифікат не знайдено</b><p style="margin:0">Сертифіката з номером <b>' + esc(code) + '</b> у системі курсу немає. Перевірте посилання або номер.</p></div>'; return; }
      v.innerHTML = head + '<div class="set verify ' + (c.revoked ? 'bad' : 'ok') + '"><b>' + (c.revoked ? '✕ Сертифікат анульовано' : '✓ Сертифікат дійсний') + '</b>' +
        '<p style="margin:0">' + (c.revoked ? 'Цей сертифікат був виданий системою курсу, але згодом анульований адміністратором ' + esc(kyiv(c.revoked_at, true)) + '.' : 'Сертифікат справді виданий системою онлайн-курсу Victory Drones × ARM Drones.') + '</p>' +
        '<dl class="vd"><dt>Ім’я</dt><dd>' + esc(c.full_name) + '</dd><dt>Курс</dt><dd>' + esc(c.course) + '</dd><dt>Видано</dt><dd>' + esc(kyiv(c.issued_at, true)) + ' (за київським часом)</dd><dt>Номер</dt><dd>' + esc(c.code) + '</dd></dl></div>';
    }).catch(function () { v.innerHTML = '<h2 class="page">Перевірка сертифіката</h2><p class="lede">Немає з’єднання з сервером. Спробуйте ще раз.</p>'; });
  }
  return { homeCard: homeCard, view: view, verifyView: verifyView, _draw: draw, _pdf: pdf };
})();
