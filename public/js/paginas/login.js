/* Pantalla: iniciar sesión */
(function () {
  'use strict';
  const TOL = window.TOL;
  const form = document.getElementById('form-login');
  const msg = document.getElementById('mensaje');

  TOL.arrancar(null, async () => {
    const ya = await TOL.auth.actual();
    if (ya) { location.replace(TOL.inicioDe(ya.rol)); return; }
    if (TOL.param('registrado')) TOL.aviso(msg, 'Cuenta creada. Ya puedes iniciar sesión.');
    if (TOL.modo === 'local') document.getElementById('demo').hidden = false;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      TOL.aviso(msg, '');
      const boton = form.querySelector('button[type=submit]');
      boton.disabled = true;
      try {
        const u = await TOL.auth.ingresar({ correo: form.elements.correo.value, clave: form.elements.clave.value, rol: form.elements.rol.value });
        location.href = TOL.inicioDe(u.rol);
      } catch (err) {
        TOL.aviso(msg, err.message, 'error');
      } finally { boton.disabled = false; }
    });
  });
})();
