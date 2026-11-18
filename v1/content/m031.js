/* Module 3.1 — Електробезпека та правила поводження з електропристроями. Lesson ids are permanent. */
(function () {
  var M = window.M031 || {};
  function soon(id, title, minutes) { return { id: id, title: title, minutes: minutes, soon: true }; }
  APP.part({
    id: 'm031', kind: 'module', order: 3.5, n: '3.1', title: 'Електробезпека та правила поводження з електропристроями',
    lessons: [
      M.l01 || soon('m031l01', 'Електробезпека'),
      M.l02 || soon('m031l02', 'Батареї'),
      M.l03 || soon('m031l03', 'Кабелі та роз’єми'),
      M.l04 || soon('m031l04', 'Заземлення')
    ]
  });
})();
