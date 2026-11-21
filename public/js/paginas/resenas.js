/* Pantalla: sesión finalizada y reseñas del tutor */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);

  const tarjeta = (r, titulo) =>
    '<div class="resena"><div class="linea"><strong>' + TOL.esc(titulo || r.autor) + '</strong>' +
    '<span class="estrellas-txt" aria-label="' + r.estrellas + ' de 5">' + TOL.estrellas(r.estrellas) + '</span></div>' +
    (r.comentario ? '<em>"' + TOL.esc(r.comentario) + '"</em>' : '') + '</div>';

  TOL.arrancar('cualquiera', async usuario => {
    const msg = $('mensaje');
    const id = TOL.param('id');
    const r = id && await TOL.reservas.obtener(id);
    if (!r || (r.estudianteId !== usuario.id && r.tutorId !== usuario.id)) { TOL.aviso(msg, 'No encontramos esa sesión.', 'error'); return; }
    $('volver').href = usuario.rol === 'tutor' ? 'panel-tutor.html' : 'mis-tutorias.html';
    $('volver').textContent = usuario.rol === 'tutor' ? 'Volver al panel' : 'Volver a Mis tutorías';

    const propia = await TOL.resenas.deReserva(id);
    $('esta-resena').innerHTML = propia ? tarjeta(propia, propia.autor + ' calificó la sesión') : '<p class="vacio">Esta sesión aún no tiene calificación.</p>';
    $('t-otras').textContent = 'Reseñas recientes de ' + r.tutorNombre;
    const otras = await TOL.resenas.deTutor(r.tutorId, 5);
    $('otras').innerHTML = otras.length ? otras.map(x => tarjeta(x)).join('') : '<p class="vacio">Todavía no hay reseñas.</p>';
  });
})();
