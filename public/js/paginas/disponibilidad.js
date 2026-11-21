/* Pantalla: perfil y disponibilidad semanal del tutor */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);

  TOL.arrancar('tutor', async usuario => {
    const msg = $('mensaje');
    const form = $('form-disp');
    const t = await TOL.tutores.obtener(usuario.id);
    if (!t) { TOL.aviso(msg, 'No encontramos tu perfil de tutor.', 'error'); return; }

    $('avatar').textContent = TOL.iniciales(t.nombre);
    $('nombre').textContent = t.nombre;
    $('subtitulo').textContent = 'Así te ven los estudiantes cuando buscan tutor';
    form.elements.materias.value = t.materias.join(', ');
    form.elements.ciudad.value = t.ciudad;
    form.elements.tarifa.value = t.tarifa;
    form.elements.virtual.checked = t.virtual;
    form.elements.presencial.checked = t.presencial;
    form.elements.ahora.checked = t.disponibleAhora;
    form.querySelectorAll('input[name=nivel]').forEach(i => { i.checked = t.niveles.includes(i.value); });
    ['manana', 'tarde'].forEach(franja => {
      form.querySelectorAll('input[name=' + franja + ']').forEach(i => {
        i.checked = t.disponibilidad.some(x => x.dia === Number(i.value) && x.franja === franja);
      });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      TOL.aviso(msg, '');
      const disponibilidad = [];
      ['manana', 'tarde'].forEach(franja => form.querySelectorAll('input[name=' + franja + ']:checked').forEach(i => disponibilidad.push({ dia: Number(i.value), franja })));
      const boton = form.querySelector('button[type=submit]');
      boton.disabled = true;
      try {
        await TOL.tutores.guardarPerfil(usuario.id, {
          materias: form.elements.materias.value, ciudad: form.elements.ciudad.value, tarifa: form.elements.tarifa.value,
          virtual: form.elements.virtual.checked, presencial: form.elements.presencial.checked, disponibleAhora: form.elements.ahora.checked,
          niveles: [...form.querySelectorAll('input[name=nivel]:checked')].map(i => i.value), disponibilidad
        });
        TOL.aviso(msg, 'Disponibilidad guardada ✓');
        setTimeout(() => { location.href = 'panel-tutor.html'; }, 900);
      } catch (err) {
        TOL.aviso(msg, err.message, 'error');
        boton.disabled = false;
        window.scrollTo(0, 0);
      }
    });
  });
})();
