/* Pantalla: sesión de tutoría (videollamada) y calificación al finalizar */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);

  TOL.arrancar('cualquiera', async usuario => {
    const msg = $('mensaje');
    const id = TOL.param('id');
    const r = id && await TOL.reservas.obtener(id);
    if (!r || (r.estudianteId !== usuario.id && r.tutorId !== usuario.id)) { TOL.aviso(msg, 'No encontramos esa sesión.', 'error'); $('video').hidden = true; return; }
    if (r.estado === 'finalizada') { location.replace('resenas.html?id=' + encodeURIComponent(id)); return; }
    if (r.estado !== 'confirmada') { TOL.aviso(msg, 'Esta sesión todavía no está confirmada.', 'error'); $('video').hidden = true; return; }

    const esTutor = usuario.id === r.tutorId;
    $('titulo').textContent = 'Tutoría con ' + (esTutor ? r.estudianteNombre : r.tutorNombre);
    $('detalle').textContent = r.materia + ' · ' + TOL.descripcionReserva(r) + ' · ' + r.modalidad;

    if (r.modalidad === 'Virtual') {
      const url = TOL.video.enlace(r.id);
      $('video').innerHTML = '<div><p>Videollamada con Jitsi Meet</p><p class="enlace-plano">' + TOL.esc(url) + '</p>' +
        '<a class="btn-sm" href="' + TOL.esc(url) + '" target="_blank" rel="noopener">Abrir videollamada</a></div>';
    } else {
      const l = TOL.notificaciones.enlacesContacto(r, esTutor ? 'tutor' : 'estudiante');
      $('video').innerHTML = '<div><p>Sesión presencial' + (r.tutorCiudad ? ' · ' + TOL.esc(r.tutorCiudad) : '') + '</p><p class="enlace-plano">Coordina el lugar y la hora exacta con la otra persona.</p>' +
        '<a class="btn-sm" href="' + TOL.esc(l.whatsapp) + '" target="_blank" rel="noopener">Escribir por WhatsApp</a></div>';
    }

    if (esTutor) { $('volver-tutor').hidden = false; return; }
    const form = $('form-calif');
    form.hidden = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      TOL.aviso(msg, '');
      const boton = form.querySelector('button[type=submit]');
      boton.disabled = true;
      try {
        await TOL.resenas.calificar(r, form.elements.estrellas.value, form.elements.comentario.value);
        location.href = 'resenas.html?id=' + encodeURIComponent(r.id);
      } catch (err) { TOL.aviso(msg, err.message, 'error'); boton.disabled = false; }
    });
  });
})();
