/* Pantalla: panel del tutor (solicitudes, sesiones confirmadas y estadísticas) */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);

  TOL.arrancar('tutor', async usuario => {
    const msg = $('mensaje');
    let reservas = [];

    const datos = r => '<span class="muted">' + TOL.esc(r.materia) + ' · ' + TOL.esc(TOL.descripcionReserva(r)) + ' · ' + r.modalidad + ' · ' + TOL.pesos(r.precio) + '</span>';
    const avatar = r => '<span class="avatar" aria-hidden="true">' + TOL.esc(TOL.iniciales(r.estudianteNombre)) + '</span>';
    const marca = r => r.inmediata ? '<span class="etiqueta-ahora">Ahora</span>' : '';

    async function pintar() {
      const [rs, perfil] = await Promise.all([TOL.reservas.delTutor(), TOL.tutores.obtener(usuario.id)]);
      reservas = rs;
      const pend = rs.filter(r => r.estado === 'pendiente');
      const conf = rs.filter(r => r.estado === 'confirmada');

      $('pendientes').innerHTML = pend.length ? pend.map(r =>
        '<div class="caja">' + avatar(r) + '<div class="info"><strong>' + TOL.esc(r.estudianteNombre) + marca(r) + '</strong>' + datos(r) + '</div>' +
        '<div class="acciones"><button class="btn-sm" type="button" data-aceptar="' + TOL.esc(r.id) + '">Aceptar</button>' +
        '<button class="btn-out" type="button" data-rechazar="' + TOL.esc(r.id) + '">Rechazar</button></div></div>').join('')
        : '<p class="vacio">No tienes solicitudes pendientes.</p>';

      $('confirmadas').innerHTML = conf.length ? conf.map(r => {
        const l = TOL.notificaciones.enlacesContacto(r, 'tutor');
        return '<div class="caja">' + avatar(r) + '<div class="info"><strong>' + TOL.esc(r.estudianteNombre) + marca(r) + '</strong>' + datos(r) +
          '<p class="acciones" style="margin-top:8px"><a class="btn-out" href="calificacion.html?id=' + encodeURIComponent(r.id) + '">Entrar a la sesión</a>' +
          '<a class="btn-out" target="_blank" rel="noopener" href="' + TOL.esc(l.whatsapp) + '">WhatsApp</a>' +
          '<button class="btn-out" type="button" data-cancelar="' + TOL.esc(r.id) + '">Cancelar</button></p></div>' +
          '<span class="estado ok">✓ Confirmada</span></div>';
      }).join('') : '<p class="vacio">Aún no tienes sesiones confirmadas.</p>';

      $('st-rep').textContent = perfil && perfil.totalResenas ? '★ ' + perfil.reputacion.toFixed(1) : '—';
      $('st-ses').textContent = perfil ? perfil.sesiones : 0;
      $('st-ing').textContent = TOL.pesosCortos(TOL.reservas.ingresosDelMes(rs));
    }

    document.addEventListener('click', async e => {
      const b = e.target.closest('[data-aceptar],[data-rechazar],[data-cancelar]');
      if (!b) return;
      const id = b.dataset.aceptar || b.dataset.rechazar || b.dataset.cancelar;
      const r = reservas.find(x => x.id === id);
      if (!r) return;
      b.disabled = true;
      try {
        if (b.dataset.aceptar) { await TOL.reservas.aceptar(r); TOL.aviso(msg, 'Solicitud aceptada. El estudiante ya puede entrar a la sesión.'); }
        else if (b.dataset.rechazar) { await TOL.reservas.rechazar(r); TOL.aviso(msg, 'Solicitud rechazada.'); }
        else { await TOL.reservas.cancelar(r); TOL.aviso(msg, 'Sesión cancelada.'); }
        await pintar();
      } catch (err) { TOL.aviso(msg, err.message, 'error'); b.disabled = false; }
    });

    await pintar();
    TOL.cadaSegundos(5, pintar); // llegan solicitudes nuevas casi en tiempo real
  });
})();
