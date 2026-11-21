/* TutoresOn-Line · Fábrica de repositorio
   Elige Supabase si js/config.js está completo; si no, el modo demostración. */
(function () {
  'use strict';
  const TOL = window.TOL;
  const c = window.TOL_CONFIG || {};
  if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase) {
    TOL.modo = 'supabase';
    TOL.repo = new TOL.RepoSupabase(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  } else {
    if (c.SUPABASE_URL && !window.supabase) console.warn('No se pudo cargar supabase-js (¿sin internet?). Se usa el modo demostración.');
    TOL.modo = 'local';
    TOL.repo = new TOL.RepoLocal();
  }
})();
