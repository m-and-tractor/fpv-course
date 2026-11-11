/* Module 2 — Засоби прийому та передачі сигналу.
   Lesson ids are permanent (progress is stored by them). */
(function () {
  var M02 = window.M02 || {};
  function soon(id, title, minutes) { return { id: id, title: title, minutes: minutes, soon: true }; }
  APP.part({
    id: 'm02', kind: 'module', order: 2, n: 2, title: 'Засоби прийому та передачі сигналу',
    lessons: [
      M02.l01 || soon('m02l01', 'Пульти'),
      M02.l02 || soon('m02l02', 'Рев’ю пультів'),
      M02.l03 || soon('m02l03', 'Окуляри, шоломи, монітори')
    ]
  });
})();
