/* TutoresOn-Line · IA generativa. Nunca se pone la API key de Gemini en el navegador. */
(function () {
  'use strict';
  const TOL = window.TOL;
  const $ = id => document.getElementById(id);
  const historial = [];
  const boton = $('ia-enviar');

  function aviso(texto, error) { TOL.aviso($('ia-estado'), texto, error ? 'error' : undefined); }
  function mensaje(rol, contenido) {
    $('ia-inicio')?.remove();
    const div = document.createElement('article');
    div.className = 'ia-mensaje ' + rol;
    const autor = document.createElement('strong');
    autor.textContent = rol === 'estudiante' ? 'Tú' : 'Asistente IA';
    const p = document.createElement('p');
    p.textContent = contenido; // Nunca insertar HTML procedente del modelo.
    div.append(autor, p);
    $('ia-historial').appendChild(div);
    div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function tokenDeSupabase() {
    if (TOL.modo !== 'supabase' || !TOL.repo || !TOL.repo.sb) return '';
    try {
      const resultado = await TOL.repo.sb.auth.getSession();
      return resultado.data?.session?.access_token || '';
    } catch { return ''; }
  }

  $('ia-limpiar').addEventListener('click', () => {
    historial.length = 0;
    $('ia-historial').replaceChildren();
    const p = document.createElement('p'); p.id = 'ia-inicio'; p.className = 'muted';
    p.textContent = 'Conversación limpia. Puedes hacer una nueva pregunta.';
    $('ia-historial').appendChild(p);
    aviso('');
  });

  $('form-ia').addEventListener('submit', async e => {
    e.preventDefault();
    const pregunta = $('ia-pregunta').value.trim();
    if (pregunta.length < 5) return aviso('Escribe una pregunta un poco más detallada.', true);
    boton.disabled = true;
    boton.textContent = 'Generando respuesta…';
    aviso('Consultando al asistente…');
    const body = {
      pregunta, materia: $('ia-materia').value, nivel: $('ia-nivel').value,
      tipo: $('ia-tipo').value, codigo: $('ia-codigo').value,
      historial: historial.slice(-6)
    };
    try {
      const token = await tokenDeSupabase();
      const r = await fetch('/.netlify/functions/asistente-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body)
      });
      let datos;
      try { datos = await r.json(); } catch { throw new Error('No se encontró la función de IA. Publica el proyecto en Netlify (no en GitHub Pages).'); }
      if (!r.ok) throw new Error(datos.error || 'No se pudo generar la respuesta.');
      if (!datos.respuesta || typeof datos.respuesta !== 'string') throw new Error('El servicio de IA devolvió una respuesta vacía.');
      mensaje('estudiante', pregunta);
      mensaje('asistente', datos.respuesta);
      historial.push({ rol: 'estudiante', texto: pregunta }, { rol: 'asistente', texto: datos.respuesta });
      if (historial.length > 6) historial.splice(0, historial.length - 6);
      $('ia-pregunta').value = '';
      aviso('Respuesta generada correctamente.');
    } catch (err) {
      aviso(err.message || 'Error al consultar la IA.', true);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Generar respuesta con IA';
    }
  });

  TOL.arrancar('cualquiera', async () => {});
})();
