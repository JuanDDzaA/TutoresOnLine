/* TutoresOn-Line · Núcleo
   Constantes y utilidades comunes (fechas, formato, avisos) y el arranque de cada pantalla.
   No conoce la base de datos: eso vive en los repositorios. */
(function () {
  'use strict';
  const TOL = (window.TOL = window.TOL || {});

  TOL.FRANJAS = {
    manana: { etiqueta: 'Mañana', hora: '9:00 a.m.', h: 9 },
    tarde: { etiqueta: 'Tarde', hora: '3:00 p.m.', h: 15 },
    ahora: { etiqueta: 'Ahora', hora: 'Ahora', h: null }
  };
  TOL.DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  TOL.NIVELES = ['Primaria', 'Bachillerato', 'Universitario'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* ---------- Texto y formato ---------- */
  TOL.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TOL.iniciales = nombre => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  TOL.estrellas = n => { const r = Math.max(0, Math.min(5, Math.round(n || 0))); return '★'.repeat(r) + '☆'.repeat(5 - r); };
  TOL.pesos = n => '$' + Number(n || 0).toLocaleString('es-CO');
  TOL.pesosCortos = n => n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : '$' + (n || 0);
  TOL.capitalizar = t => { t = String(t || '').trim(); return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : ''; };
  TOL.listaDeTexto = texto => {
    const vistos = new Set();
    return String(texto || '').split(',').map(TOL.capitalizar).filter(x => x && !vistos.has(x.toLowerCase()) && vistos.add(x.toLowerCase()));
  };
  TOL.unicos = lista => [...new Set(lista)].sort((a, b) => a.localeCompare(b, 'es'));

  /* ---------- Fechas (siempre en hora local) ---------- */
  TOL.isoLocal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  TOL.fechaDeISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  TOL.diaSemana = d => (d.getDay() + 6) % 7; // 0 = lunes … 6 = domingo
  TOL.etiquetaFecha = iso => { const d = TOL.fechaDeISO(iso); return TOL.DIAS[TOL.diaSemana(d)] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]; };
  TOL.descripcionReserva = r => r.inmediata ? 'Ahora (solicitud inmediata)' : TOL.etiquetaFecha(r.fecha) + ' · ' + TOL.FRANJAS[r.franja].hora;
  TOL.inicioReserva = r => { const d = TOL.fechaDeISO(r.fecha); d.setHours(TOL.FRANJAS[r.franja].h || 0, 0, 0, 0); return d.getTime(); };

  /* ---------- Enlaces de contacto ---------- */
  TOL.enlaceWhatsApp = (tel, texto) => {
    let n = String(tel || '').replace(/\D/g, '');
    if (n.length === 10) n = '57' + n; // celular colombiano sin indicativo
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto);
  };
  TOL.enlaceCorreo = (correo, asunto, texto) => 'mailto:' + (correo || '') + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(texto);

  /* ---------- Interfaz ---------- */
  TOL.param = nombre => new URLSearchParams(location.search).get(nombre);
  TOL.inicioDe = rol => rol === 'tutor' ? 'panel-tutor.html' : 'buscar.html';
  TOL.aviso = (el, texto, tipo) => {
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'aviso' + (tipo === 'error' ? ' error' : '');
    el.hidden = !texto;
  };
  TOL.cadaSegundos = (n, fn) => setInterval(() => { if (!document.hidden) fn().catch(console.error); }, n * 1000);

  function bannerModo() {
    if (TOL.modo !== 'local') return;
    const main = document.querySelector('main');
    if (!main) return;
    const div = document.createElement('div');
    div.className = 'modo-demo';
    div.textContent = 'Modo demostración: los datos se guardan solo en este navegador. Para usar la base de datos real configura Supabase en js/config.js.';
    main.prepend(div);
  }

  // Pantallas compartidas (sesión, reseñas): el menú depende del rol de quien entra.
  function menuSegunRol(usuario) {
    const barra = document.querySelector('.topbar-in');
    if (!barra || barra.querySelector('nav') || !usuario) return;
    const items = usuario.rol === 'tutor'
      ? [['panel-tutor.html', 'Panel'], ['disponibilidad.html', 'Disponibilidad'], ['ia.html', 'Asistente IA']]
      : [['buscar.html', 'Buscar'], ['mis-tutorias.html', 'Mis tutorías'], ['ia.html', 'Asistente IA']];
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Principal');
    nav.innerHTML = items.map(i => '<a href="' + i[0] + '">' + i[1] + '</a>').join('') + '<a href="login.html" data-salir>Salir</a>';
    barra.appendChild(nav);
  }

  function activarSalir() {
    document.querySelectorAll('[data-salir]').forEach(a => a.addEventListener('click', async e => {
      e.preventDefault();
      try { await TOL.auth.salir(); } finally { location.href = 'login.html'; }
    }));
  }

  /* Arranque común de todas las pantallas.
     rolRequerido: null (pública) | 'estudiante' | 'tutor' | 'cualquiera' */
  TOL.arrancar = async function (rolRequerido, principal) {
    try {
      const usuario = await TOL.auth.actual();
      if (rolRequerido) {
        if (!usuario) { location.replace('login.html'); return; }
        if (rolRequerido !== 'cualquiera' && usuario.rol !== rolRequerido) { location.replace(TOL.inicioDe(usuario.rol)); return; }
      }
      menuSegunRol(usuario);
      activarSalir();
      bannerModo();
      await principal(usuario);
    } catch (e) {
      console.error(e);
      const main = document.querySelector('main');
      if (main) {
        const p = document.createElement('p');
        p.className = 'aviso error';
        p.textContent = 'Ocurrió un problema: ' + (e.message || 'inténtalo de nuevo.');
        main.prepend(p);
      }
    }
  };
})();
