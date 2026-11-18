/* Module 4 — Антени та основи радіозв’язку. Lesson ids are permanent. */
(function () {
  var M = window.M04 || {};
  function soon(id, title, minutes) { return { id: id, title: title, minutes: minutes, soon: true }; }
  APP.part({
    id: 'm04', kind: 'module', order: 4, n: 4, title: 'Антени та основи радіозв’язку',
    lessons: [
      M.l01 || soon('m04l01', 'Основи зв’язку'),
      M.l02 || soon('m04l02', 'Антени'),
      M.l03 || soon('m04l03', 'Ретранслятори та наземні станції керування'),
      M.l04 || soon('m04l04', 'Вплив РЕР/РЕБ')
    ]
  });
})();
