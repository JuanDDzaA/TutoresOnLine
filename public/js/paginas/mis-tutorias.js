/* Pantalla: mis tutorías (estudiante) */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);
  const ESTADOS = {
    pendiente: ['pend', 'Pendiente'], confirmada: ['ok', '✓ Confirmada'], rechazada: ['no', 'Rechazada'],
    cancelada: ['fin', 'Cancelada'], finalizada: ['fin', 'Finalizada']
  };

  function tarjeta(r) {
    const [clase, texto] = ESTADOS[r.estado];
    let extra = '';
    if (r.estado === 'confirmada') {
      const l = TOL.notificaciones.enlacesContacto(r, 'estudiante');
      extra = '<p class="acciones" style="margin-top:8px">' +
        '<a class="btn-out" href="calificacion.html?id=' + encodeURIComponent(r.id) + '">Entrar a la sesión</a>' +
        '<a class="btn-out" target="_blank" rel="noopener" href="' + TOL.esc(l.whatsapp) + '">Enviar por WhatsApp</a>' +
        '<a class="btn-out" href="' + TOL.esc(l.correo) + '">Enviar por correo</a>' +
        '<button class="btn-out" type="button" data-cancelar="' + TOL.esc(r.id) + '">Cancelar</button></p>';
    } else if (r.estado === 'pendiente') {
      extra = '<p class="muted">Esperando confirmación del tutor</p><p class="acciones" style="margin-top:8px"><button class="btn-out" type="button" data-cancelar="' + TOL.esc(r.id) + '">Cancelar</button></p>';
    } else if (r.estado === 'finalizada') {
      extra = '<p style="margin-top:8px"><a class="btn-out" href="resenas.html?id=' + encodeURIComponent(r.id) + '">Ver mi reseña</a></p>';
    }
    return '<div class="caja"><span class="avatar" aria-hidden="true">' + TOL.esc(TOL.iniciales(r.tutorNombre)) + '</span>' +
      '<div class="info"><strong>' + TOL.esc(r.tutorNombre) + (r.inmediata ? '<span class="etiqueta-ahora">Ahora</span>' : '') + '</strong>' +
      '<span class="muted">' + TOL.esc(r.materia) + '</span>' +
      '<p class="muted">' + TOL.esc(TOL.descripcionReserva(r)) + ' · ' + r.modalidad + ' · ' + TOL.pesos(r.precio) + '</p>' + extra + '</div>' +
      '<span class="estado ' + clase + '">' + texto + '</span></div>';
  }

  TOL.arrancar('estudiante', async () => {
    const msg = $('mensaje');
    if (TOL.param('reservada')) TOL.aviso(msg, 'Solicitud enviada. El tutor debe confirmarla; verás el cambio aquí.');

    async function pintar() {
      const todas = await TOL.reservas.delEstudiante();
      const proximas = todas.filter(r => ['pendiente', 'confirmada'].includes(r.estado));
      const historial = todas.filter(r => !['pendiente', 'confirmada'].includes(r.estado)).reverse();
      $('proximas').innerHTML = proximas.length ? proximas.map(tarjeta).join('') : '<p class="vacio">No tienes sesiones próximas. <a href="buscar.html">Busca un tutor</a>.</p>';
      $('historial').innerHTML = historial.length ? historial.map(tarjeta).join('') : '<p class="vacio">Aquí aparecerán tus sesiones anteriores.</p>';
    }

    document.addEventListener('click', async e => {
      const b = e.target.closest('[data-cancelar]');
      if (!b) return;
      b.disabled = true;
      try {
        const r = await TOL.reservas.obtener(b.dataset.cancelar);
        await TOL.reservas.cancelar(r);
        TOL.aviso(msg, 'Sesión cancelada.');
        await pintar();
      } catch (err) { TOL.aviso(msg, err.message, 'error'); b.disabled = false; }
    });

    // Reserva inmediata (tipo Uber): se asigna el mejor tutor disponible ahora.
    $('btn-ahora').addEventListener('click', async () => {
      const panel = $('panel-ahora');
      if (!panel.hidden) { panel.hidden = true; return; }
      const disp = (await TOL.tutores.listar()).filter(t => t.disponibleAhora && t.virtual);
      const materias = TOL.unicos(disp.flatMap(t => t.materias));
      if (!materias.length) { TOL.aviso(msg, 'Ahora mismo no hay tutores disponibles. Puedes reservar una franja desde Buscar.', 'error'); return; }
      TOL.aviso(msg, '');
      $('materia-ahora').innerHTML = materias.map(m => '<option>' + TOL.esc(m) + '</option>').join('');
      panel.hidden = false;
    });
    $('btn-ahora-ok').addEventListener('click', async () => {
      const b = $('btn-ahora-ok');
      b.disabled = true;
      try {
        const r = await TOL.reservas.solicitarAhora($('materia-ahora').value);
        $('panel-ahora').hidden = true;
        TOL.aviso(msg, 'Solicitud enviada a ' + r.tutorNombre + '. Esperando su confirmación.');
        await pintar();
      } catch (err) { TOL.aviso(msg, err.message, 'error'); }
      finally { b.disabled = false; }
    });

    await pintar();
    TOL.cadaSegundos(8, pintar); // refresca para ver cuando el tutor confirma
  });
})();
