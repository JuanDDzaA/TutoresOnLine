/* Pantalla: crear cuenta (estudiante o tutor) */
(function () {
  'use strict';
  const TOL = window.TOL;
  const form = document.getElementById('form-registro');
  const msg = document.getElementById('mensaje');

  TOL.arrancar(null, async () => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      TOL.aviso(msg, '');
      const boton = form.querySelector('button[type=submit]');
      boton.disabled = true;
      const v = n => form.elements[n].value;
      try {
        const res = await TOL.auth.registrar({ rol: v('rol'), nombre: v('nombre'), correo: v('correo'), telefono: v('telefono'), clave: v('clave'), materias: v('materias'), ciudad: v('ciudad'), tarifa: v('tarifa') });
        if (res && res.requiereConfirmacion) {
          TOL.aviso(msg, 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
          form.reset();
        } else {
          location.href = 'login.html?registrado=1';
        }
      } catch (err) {
        TOL.aviso(msg, err.message, 'error');
      } finally { boton.disabled = false; }
    });
  });
})();
