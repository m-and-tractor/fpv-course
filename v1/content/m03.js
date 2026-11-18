/* Module 3 — Живлення та електротехніка. Lesson ids are permanent (progress is stored by them). */
(function () {
  var M = window.M03 || {};
  function soon(id, title, minutes) { return { id: id, title: title, minutes: minutes, soon: true }; }
  APP.part({
    id: 'm03', kind: 'module', order: 3, n: 3, title: 'Живлення та електротехніка',
    lessons: [
      M.l01 || soon('m03l01', 'Фізичні принципи роботи батарей'),
      M.l02 || soon('m03l02', 'Системи живлення'),
      M.l03 || soon('m03l03', 'Генератори')
    ]
  });
})();
