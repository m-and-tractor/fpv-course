/* Module 5 — Відеозв’язок та керування. Lesson ids are permanent. */
(function () {
  var M = window.M05 || {};
  function soon(id, title, minutes) { return { id: id, title: title, minutes: minutes, soon: true }; }
  APP.part({
    id: 'm05', kind: 'module', order: 5, n: 5, title: 'Відеозв’язок та керування',
    lessons: [
      M.l01 || soon('m05l01', 'Приймачі відеосигналу'),
      M.l02 || soon('m05l02', 'VTX'),
      M.l03 || soon('m05l03', 'Скремблери'),
      M.l04 || soon('m05l04', 'Прошивки'),
      M.l05 || soon('m05l05', 'Оптоволоконний зв’язок')
    ]
  });
})();
