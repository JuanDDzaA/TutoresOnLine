/* Pantalla: buscar tutores (estudiante) */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);

  function llenar(select, valores) {
    valores.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; select.appendChild(o); });
  }

  TOL.arrancar('estudiante', async () => {
    const todos = await TOL.tutores.listar();
    llenar($('f-materia'), TOL.unicos(todos.flatMap(t => t.materias)));
    llenar($('f-ciudad'), TOL.unicos(todos.map(t => t.ciudad).filter(Boolean)));

    function pintar() {
      const lista = TOL.tutores.filtrar(todos, {
        texto: $('f-texto').value, materia: $('f-materia').value, nivel: $('f-nivel').value, ciudad: $('f-ciudad').value,
        modalidad: $('f-modalidad').value, dia: $('f-dia').value, ahora: $('f-ahora').checked
      });
      $('conteo').textContent = lista.length === 1 ? '1 tutor encontrado' : lista.length + ' tutores encontrados';
      $('resultados').innerHTML = lista.length ? lista.map(t => {
        const mod = [t.virtual ? 'Virtual' : '', t.presencial ? 'Presencial' : ''].filter(Boolean).join(', ');
        const rep = t.totalResenas ? t.reputacion.toFixed(1) + ' (' + t.totalResenas + ')' : 'Nuevo';
        return '<div class="fila">' +
          '<span class="avatar" aria-hidden="true">' + TOL.esc(TOL.iniciales(t.nombre)) + '</span>' +
          '<div class="info"><strong>' + TOL.esc(t.nombre) + (t.disponibleAhora ? '<span class="etiqueta-ahora">Disponible ahora</span>' : '') + '</strong>' +
          '<span class="estrellas-txt" aria-label="' + t.reputacion + ' de 5">' + TOL.estrellas(t.reputacion) + '</span> <span class="muted">' + rep + '</span><br>' +
          '<span class="muted">' + TOL.esc(t.materias.join(', ')) + (t.ciudad ? ' · ' + TOL.esc(t.ciudad) : '') + '</span><br>' +
          '<span class="muted">' + TOL.esc(t.niveles.join(', ') || 'Todos los niveles') + ' · ' + mod + '</span></div>' +
          '<div class="derecha"><span><span class="tarifa">' + TOL.pesos(t.tarifa) + '</span> <span class="muted">/hora</span></span>' +
          '<a class="btn-sm" href="tutor.html?id=' + encodeURIComponent(t.id) + '">Ver y reservar</a></div></div>';
      }).join('') : '<p class="vacio">No encontramos tutores con esos filtros. Prueba quitando alguno.</p>';
    }

    $('filtros').addEventListener('input', pintar);
    $('filtros').addEventListener('change', pintar);
    pintar();
  });
})();
