/* Pantalla: perfil del tutor y reserva de una sesión (estudiante) */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);

  TOL.arrancar('estudiante', async () => {
    const msg = $('mensaje');
    const id = TOL.param('id');
    const tutor = id && await TOL.tutores.obtener(id);
    if (!tutor) { TOL.aviso(msg, 'No encontramos a ese tutor.', 'error'); return; }

    $('avatar').textContent = TOL.iniciales(tutor.nombre);
    $('nombre').textContent = tutor.nombre;
    $('reputacion').innerHTML = '<span class="estrellas-txt" aria-label="' + tutor.reputacion + ' de 5">' + TOL.estrellas(tutor.reputacion) + '</span> ' +
      (tutor.totalResenas ? tutor.reputacion.toFixed(1) + ' (' + tutor.totalResenas + ' reseñas)' : 'Sin reseñas todavía') +
      (tutor.ciudad ? ' · ' + TOL.esc(tutor.ciudad) : '');
    $('detalle').textContent = TOL.pesos(tutor.tarifa) + ' por hora · Niveles: ' + (tutor.niveles.join(', ') || 'todos') + ' · ' + tutor.sesiones + ' sesiones dictadas';
    $('bio').textContent = tutor.biografia;

    // Materia y modalidad
    $('materia').innerHTML = (tutor.materias.length > 1 ? '<option value="">Elige la materia</option>' : '') + tutor.materias.map(m => '<option>' + TOL.esc(m) + '</option>').join('');
    const mods = [tutor.virtual ? 'Virtual' : null, tutor.presencial ? 'Presencial' : null].filter(Boolean);
    $('modalidades').innerHTML = mods.map((m, i) => '<span class="chip-check"><input type="radio" name="modalidad" id="m-' + m + '" value="' + m + '"' + (i === 0 ? ' checked' : '') + '><label for="m-' + m + '">' + m + '</label></span>').join('');

    // Franjas disponibles de los próximos 14 días
    const franjas = await TOL.tutores.franjas(tutor, 14);
    $('franjas').innerHTML = franjas.length ? franjas.map((f, i) => {
      const d = TOL.fechaDeISO(f.fecha);
      return '<label class="franja"><span><strong>' + TOL.DIAS[TOL.diaSemana(d)] + '</strong><span class="fecha">' + TOL.etiquetaFecha(f.fecha).split(' ').slice(1).join(' ') + '</span></span>' +
        '<input type="radio" name="franja" value="' + f.fecha + '|' + f.franja + '"' + (i === 0 ? ' checked' : '') + '><span class="hora">' + TOL.FRANJAS[f.franja].hora + '</span></label>';
    }).join('') : '<p class="vacio">Este tutor no tiene franjas libres en los próximos 14 días.</p>';
    $('btn-reservar').disabled = !franjas.length;

    const form = $('form-reserva');
    const resumen = () => {
      const f = form.elements.franja && form.elements.franja.value;
      if (!f) { $('resumen-txt').textContent = 'Elige una franja'; return; }
      const [fecha, franja] = f.split('|');
      $('resumen-txt').textContent = TOL.etiquetaFecha(fecha) + ' · ' + TOL.FRANJAS[franja].hora + ' · Modalidad ' + form.elements.modalidad.value.toLowerCase() + ' · 1 hora · ' + TOL.pesos(tutor.tarifa);
    };
    form.addEventListener('change', resumen);
    resumen();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      TOL.aviso(msg, '');
      const [fecha, franja] = form.elements.franja.value.split('|');
      $('btn-reservar').disabled = true;
      try {
        await TOL.reservas.reservar({ tutor, materia: form.elements.materia.value, fecha, franja, modalidad: form.elements.modalidad.value });
        location.href = 'mis-tutorias.html?reservada=1';
      } catch (err) {
        TOL.aviso(msg, err.message, 'error');
        $('btn-reservar').disabled = false;
        window.scrollTo(0, 0);
      }
    });

    // Reseñas
    const rs = await TOL.resenas.deTutor(tutor.id, 5);
    $('resenas').innerHTML = rs.length ? rs.map(r =>
      '<div class="resena"><div class="linea"><strong>' + TOL.esc(r.autor) + '</strong><span class="estrellas-txt" aria-label="' + r.estrellas + ' de 5">' + TOL.estrellas(r.estrellas) + '</span></div>' +
      (r.comentario ? '<em>"' + TOL.esc(r.comentario) + '"</em>' : '') + '</div>').join('') : '<p class="vacio">Todavía no hay reseñas.</p>';

    $('perfil').hidden = false;
  });
})();
