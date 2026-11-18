/* Module 5, lesson 4 — Прошивки (EdgeTX на Radiomaster TX12 Mark II). Text from the video, author's notes for cross-reference; questions supplied by the author (q_l04.js). */
(function () {
  var photo = APP.photo, gallery = APP.gallery;
  (window.M05 = window.M05 || {}).l04 = {
    id: 'm05l04', title: 'Прошивки', sub: 'EdgeTX на Radiomaster TX12 Mark II: логіка меню, налаштування ExpressLRS, модель, телеметрія, бінд',
    minutes: 8, video: 'm05-l04.mp4', poster: 'm05/l04-poster',
    chapters: [[0, 'Вступ'], [45, 'Логіка кнопок і меню'], [101, 'SYS → Tools → ExpressLRS'], [124, 'Packet Rate'], [149, 'Telemetry Ratio'], [191, 'TX Power і вентилятор'], [223, 'Switch Mode'], [244, 'Wi-Fi і Bind Phrase'], [276, 'Меню моделі'], [313, 'Model Setup'], [336, 'Inputs, Mixes, Outputs'], [362, 'Телеметрія'], [388, 'Як збіндити пульт'], [444, 'Підсумок']],
    steps: [
      { t: 0, kind: 'Вступ', h: 'База для кожного FPV-пілота',
        body: '<p>Розбираємо пульт <b>Radiomaster TX12 Mark II</b> на прошивці EdgeTX: не просто «що натиснути», а як працює логіка пульта і чому саме так — щоб уникнути типових помилок на початку. Без зайвої теорії, тільки практика.</p>' },

      { t: 45, kind: 'Меню', h: 'Кнопки і логіка меню',
        body: photo('m05/l04-tx12', 'Кнопки TX12 Mark II: SYS, MDL, RTN, PAGE, TELE і ролик') +
          '<div class="tblwrap"><table class="tbl"><thead><tr><th>Кнопка</th><th>Що робить</th></tr></thead><tbody>' +
          '<tr><td>SYS</td><td style="white-space:normal">Системні налаштування пульта: скрипти, модулі, апаратні налаштування. Конкретний дрон тут не чіпаємо</td></tr>' +
          '<tr><td>MDL</td><td style="white-space:normal">Модель — усе про конкретний дрон: режими, канали, перемикачі</td></tr>' +
          '<tr><td>TELE</td><td style="white-space:normal">Екран телеметрії: напруга, RSSI, Link Quality — усе, що приходить з дрона</td></tr>' +
          '<tr><td>RTN</td><td style="white-space:normal">Крок назад у меню</td></tr>' +
          '<tr><td>PAGE</td><td style="white-space:normal">Гортати сторінки всередині меню</td></tr>' +
          '<tr><td>Ролик</td><td style="white-space:normal">Навігація і підтвердження</td></tr></tbody></table></div>' +
          '<div class="key">Коротко: <b>SYS — це пульт, MDL — це дрон.</b> Налаштування для всіх моделей шукайте в SYS, для конкретного дрона — в MDL.</div>' },

      { t: 101, kind: 'ExpressLRS', h: 'SYS → Tools → ExpressLRS',
        body: photo('m05/l04-tools', 'Сторінка Tools: Lua-скрипти') +
          '<p>У SYS одразу потрапляємо на сторінку <b>Tools</b>: тут запускаються Lua-скрипти — ExpressLRS, TBS Crossfire, аналізатори спектра та інші. Меню <b>ExpressLRS</b> — одне з найважливіших у всьому пульті.</p>' },

      { t: 124, kind: 'ExpressLRS', h: 'Packet Rate — швидкість керування',
        body: photo('m05/l04-packet', 'Packet Rate у скрипті ExpressLRS') +
          '<p><b>Packet Rate</b> — частота, з якою пульт надсилає команди. Фактично це швидкість вашого керування.</p>' +
          '<div class="cmp"><div><b>Більша частота</b><p>Менша затримка, але вища вимогливість до сигналу.</p></div><div><b>Менша частота</b><p>Трохи більша затримка, але значно краща дальність і стійкість.</p></div></div>' +
          '<div class="tblwrap"><table class="tbl"><thead><tr><th>Packet Rate</th><th>Для чого</th></tr></thead><tbody><tr><td>25 Гц</td><td>Максимальна дальність</td></tr><tr><td>50 Гц</td><td>Більшість польотів — «золота середина»</td></tr><tr><td>100 Гц</td><td>Фрістайл</td></tr><tr><td>250+ Гц</td><td>Спортивні польоти</td></tr></tbody></table></div>' },

      { t: 149, kind: 'ExpressLRS', h: 'Telemetry Ratio',
        body: '<p>Кожен телеметричний пакет — це час в ефірі, який міг би піти на керування. Тому канал не заливають телеметрією без потреби. <b>1:64</b> означає, що лише одне з 64 повідомлень — телеметрія.</p>' +
          '<ul><li>Звичайні польоти — <b>1:64</b>, більш ніж достатньо.</li><li>Дальні й бойові — <b>1:128</b>: менше телеметрії — стабільніший канал керування.</li></ul>' },

      { t: 191, kind: 'ExpressLRS', h: 'TX Power і вентилятор',
        body: photo('m05/l04-power', 'TX Power: Max Power, Dynamic, Fan Thresh') +
          '<ul><li><b>Max Power</b> — на бойових і дальніх системах завжди максимальна потужність.</li><li><b>Dynamic Power — OFF.</b> Автоматика звучить красиво, але змінює поведінку каналу; фіксована потужність передбачуваніша.</li><li><b>Fan Thresh</b> — з якої потужності вмикається вентилятор охолодження модуля. Хай краще шумить, ніж втратити дрон.</li></ul>' },

      { t: 223, kind: 'ExpressLRS', h: 'Switch Mode',
        body: '<p>Визначає, як ELRS перемикає режими модуляції:</p><ul><li><b>Wide</b> — універсальний стабільний варіант;</li><li><b>Hybrid</b> — трохи краще поводиться на дальності.</li></ul><p>Якщо не експериментуєте — залиште <b>Wide</b>.</p>' },

      { t: 244, kind: 'ExpressLRS', h: 'Wi-Fi і Bind Phrase',
        body: photo('m05/l04-wifi', 'Wi-Fi Connectivity і Bind у меню ExpressLRS') +
          '<p>ExpressLRS — не «стара школа з кнопками», а система, що працює через конфігурацію.</p>' +
          '<ul><li><b>Wi-Fi Connectivity</b> переводить модуль у режим Wi-Fi — для прошивки, зміни налаштувань і перевірки через веб-інтерфейс.</li><li><b>Bind Phrase</b> — це ключ. Однакова фраза на пульті й приймачі — і вони знайдуть одне одного автоматично: швидко, безпечно, зручно, особливо коли дронів багато.</li><li><b>Bind</b> — ручне підключення пульта до приймача.</li></ul>' },

      { t: 276, kind: 'Модель', h: 'Меню моделі',
        body: photo('m05/l04-models', 'Model Select: створити, скопіювати, видалити, перемкнути модель') +
          '<p>Тут ви кажете пульту, як працювати з конкретним дроном. Не плутайте системні налаштування з модельними.</p>' +
          '<div class="key">Ніколи не налаштовуйте модель з нуля: завжди копіюйте базову модель TX12 і змінюйте її. Це економить час і дає менше помилок.</div>' },

      { t: 313, kind: 'Модель', h: 'Model Setup',
        body: photo('m05/l04-setup', 'Model Setup: Internal RF — OFF, External RF — CRSF') +
          '<p>Задаємо назву моделі і налаштовуємо радіоканал. Для FPV-дрона із зовнішнім модулем ExpressLRS:</p>' +
          '<div class="pins"><div><b>Internal RF</b><span>OFF</span></div><div><b>External RF</b><span>CRSF</span></div><div><b>Trainer</b><span>OFF</span></div></div>' +
          '<p>CRSF (Crossfire) — протокол між пультом і модулем із низькою затримкою і двостороннім зв’язком.</p>' },

      { t: 336, kind: 'Логіка', h: 'Inputs → Mixes → Outputs',
        body: '<p>Логічне ядро пульта — шлях сигналу «рука → пульт → дрон»:</p>' +
          '<ol><li><b>Inputs</b> — ваші руки: рухи стиків і перемикачів.</li><li><b>Mixes</b> — логіка обробки.</li><li><b>Outputs</b> — фінальний сигнал каналів, що йде на приймач і польотний контролер.</li></ol>' +
          '<p>Для FPV нічого складного не потрібно: що простіше, то надійніше.</p>' },

      { t: 362, kind: 'Телеметрія', h: 'Телеметрія — очі на зв’язок',
        body: photo('m05/l04-telem', 'Вкладка Telemetry: RSSI, пороги попереджень') +
          '<p>Картинка може бути до останнього моменту, а от зв’язок — ні. Телеметрія показує, чи є запас на повернення:</p>' +
          '<ul><li><b>LQ (Link Quality)</b> — якість радіоканалу, найважливіший параметр для ELRS;</li><li><b>RSSI</b> — рівень прийнятого сигналу;</li><li><b>SNR</b> — співвідношення сигнал/шум.</li></ul>' },

      { t: 388, kind: 'Бінд', h: 'Як збіндити пульт із дроном',
        body: gallery([['m05/l04-bindrx', 'Приймач у режим Bind'], ['m05/l04-bindtx', 'Bind на пульті: SYS → Tools → ExpressLRS → Bind']]) +
          '<ol><li>Переведіть приймач у режим Bind: затисніть кнопку <b>Boot</b> або <b>тричі коротко подайте живлення</b> на дрон. Світлодіод подвійно блимає — RX готовий.</li><li>На пульті: <b>SYS → Tools → ExpressLRS → Bind</b>.</li><li>Світлодіод RX перестав блимати і світиться постійно — зв’язок встановлено. На пульті з’являється телеметрія і LQ.</li></ol>' +
          '<p>Якщо TX і RX прошиті з однаковою Bind Phrase, пульт і дрон з’єднуються автоматично — без кнопок.</p>' +
          '<h4>Типові помилки новачків</h4><ul><li>Увімкнений Internal RF разом із зовнішнім модулем.</li><li>Обрано не CRSF.</li><li>Різні версії ExpressLRS на TX і RX.</li><li>Різна Bind Phrase.</li><li>Модель налаштована «з нуля».</li></ul>' },

      { t: 444, kind: 'Підсумок', h: 'Підсумок',
        body: '<div class="simple">Коли розумієш логіку, пульт перестає бути страшним. Простота, стабільність і передбачуваність — головне у FPV.</div>' +
          '<h4>Пам’ятка перед польотом</h4><ul><li>Обрана правильна модель.</li><li>External RF працює в режимі CRSF.</li><li>LQ і телеметрія відображаються.</li><li>Перемикач ARM працює правильно.</li></ul>' }
    ],
    summary: [
      'SYS — пульт, MDL — конкретний дрон, TELE — телеметрія.',
      'Packet Rate 50 Гц — золота середина; 25 Гц — для дальності.',
      'Telemetry Ratio 1:64 для звичайних польотів, 1:128 — для дальніх.',
      'Бойові й дальні: Max Power, Dynamic Power OFF; Switch Mode — Wide.',
      'Модель — копія базової, Internal RF OFF, External RF CRSF.',
      'Bind: RX у режим Bind (кнопка Boot або тричі подати живлення) → SYS → Tools → ExpressLRS → Bind.'
    ],
    quiz: M05Q.l04
  };
})();
