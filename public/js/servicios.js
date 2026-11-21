/* TutoresOn-Line · Servicios (reglas del negocio)
   Cada servicio tiene una sola responsabilidad y depende del repositorio por su
   contrato (TOL.repo), no de una base de datos concreta (principios S y D de SOLID). */
(function () {
  'use strict';
  const TOL = window.TOL;
  const repo = () => TOL.repo;
  const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------- Videollamada ---------- */
  TOL.video = {
    // Sala de Jitsi Meet única por reserva. No requiere cuenta ni clave de API.
    enlace: reservaId => 'https://meet.jit.si/TutoresOnLine-' + String(reservaId).replace(/[^a-zA-Z0-9]/g, '')
  };

  /* ---------- Autenticación ---------- */
  TOL.auth = {
    async registrar(d) {
      const nombre = String(d.nombre || '').trim();
      const correo = String(d.correo || '').trim();
      if (nombre.length < 3) throw new Error('Escribe tu nombre completo.');
      if (!CORREO.test(correo)) throw new Error('El correo no es válido.');
      if (String(d.clave || '').length < 6) throw new Error('La contraseña debe tener mínimo 6 caracteres.');
      const datos = { nombre, correo, clave: d.clave, rol: d.rol === 'tutor' ? 'tutor' : 'estudiante', telefono: String(d.telefono || '').trim() };
      if (datos.rol === 'tutor') {
        datos.materias = TOL.listaDeTexto(d.materias);
        datos.tarifa = Math.round(Number(d.tarifa));
        datos.ciudad = String(d.ciudad || '').trim();
        if (!datos.materias.length) throw new Error('Indica al menos una materia que dictas.');
        if (!(datos.tarifa >= 0)) throw new Error('Escribe tu tarifa por hora.');
      }
      return repo().registrar(datos);
    },
    ingresar(d) {
      if (!CORREO.test(String(d.correo || '').trim())) return Promise.reject(new Error('El correo no es válido.'));
      return repo().iniciarSesion({ correo: d.correo.trim(), clave: d.clave, rol: d.rol });
    },
    salir: () => repo().cerrarSesion(),
    actual: () => repo().usuarioActual()
  };

  /* ---------- Tutores y búsqueda ---------- */
  TOL.tutores = {
    listar: () => repo().listarTutores(),
    obtener: id => repo().obtenerTutor(id),

    // Búsqueda por materia, nivel, zona geográfica, modalidad y disponibilidad (función pura, fácil de probar).
    filtrar(tutores, f) {
      const texto = String(f.texto || '').trim().toLowerCase();
      return tutores.filter(t => {
        if (texto && !(t.nombre + ' ' + t.materias.join(' ')).toLowerCase().includes(texto)) return false;
        if (f.materia && !t.materias.includes(f.materia)) return false;
        if (f.nivel && !t.niveles.includes(f.nivel)) return false;
        if (f.ciudad && t.ciudad !== f.ciudad) return false;
        if (f.modalidad === 'virtual' && !t.virtual) return false;
        if (f.modalidad === 'presencial' && !t.presencial) return false;
        if (f.dia !== '' && f.dia != null && !t.disponibilidad.some(x => x.dia === Number(f.dia))) return false;
        if (f.ahora && !t.disponibleAhora) return false;
        return true;
      }).sort((a, b) => b.reputacion - a.reputacion || b.totalResenas - a.totalResenas);
    },

    // Franjas libres de los próximos días: disponibilidad del tutor menos lo ya reservado, solo a futuro.
    async franjas(tutor, dias) {
      const ahora = new Date();
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const ocupadas = await repo().franjasOcupadas(tutor.id, TOL.isoLocal(hoy));
      const ocup = new Set(ocupadas.map(o => o.fecha + '|' + o.franja));
      const salida = [];
      for (let i = 0; i < (dias || 14); i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
        const iso = TOL.isoLocal(d), dia = TOL.diaSemana(d);
        ['manana', 'tarde'].forEach(franja => {
          if (!tutor.disponibilidad.some(x => x.dia === dia && x.franja === franja)) return;
          if (ocup.has(iso + '|' + franja)) return;
          const inicio = new Date(d); inicio.setHours(TOL.FRANJAS[franja].h, 0, 0, 0);
          if (inicio <= ahora) return;
          salida.push({ fecha: iso, franja });
        });
      }
      return salida;
    },

    async guardarPerfil(id, d) {
      const materias = TOL.listaDeTexto(d.materias);
      if (!materias.length) throw new Error('Indica al menos una materia.');
      if (!(Number(d.tarifa) >= 0)) throw new Error('La tarifa no es válida.');
      if (!d.virtual && !d.presencial) throw new Error('Elige al menos una modalidad: virtual o presencial.');
      return repo().guardarPerfilTutor(id, {
        tarifa: Math.round(Number(d.tarifa)), ciudad: String(d.ciudad || '').trim(), virtual: !!d.virtual, presencial: !!d.presencial,
        disponibleAhora: !!d.disponibleAhora, materias, niveles: d.niveles || [], disponibilidad: d.disponibilidad || []
      });
    }
  };

  /* ---------- Notificaciones y registro de la tutoría ---------- */
  TOL.notificaciones = {
    mensaje(r, evento) {
      const cuando = TOL.descripcionReserva(r), mat = r.materia || 'tutoría';
      const video = r.modalidad === 'Virtual' ? ' Enlace de la videollamada: ' + TOL.video.enlace(r.id) : '';
      switch (evento) {
        case 'solicitud': return { para: r.tutorId, texto: 'Nueva solicitud de ' + r.estudianteNombre + ' para ' + mat + ' (' + cuando + ', ' + r.modalidad + ').' };
        case 'confirmada': return { para: r.estudianteId, texto: 'Tu tutoría de ' + mat + ' con ' + r.tutorNombre + ' quedó confirmada: ' + cuando + ', ' + r.modalidad + '.' + video };
        case 'rechazada': return { para: r.estudianteId, texto: r.tutorNombre + ' no pudo atender tu solicitud de ' + mat + ' (' + cuando + '). Puedes reservar otro horario.' };
        case 'cancelada': return { para: null, texto: 'La tutoría de ' + mat + ' (' + cuando + ') fue cancelada.' };
        case 'calificada': return { para: r.tutorId, texto: r.estudianteNombre + ' calificó la tutoría de ' + mat + '.' };
        default: return null;
      }
    },
    // Deja constancia en la tabla "notificaciones" (registro de la tutoría).
    async registrar(r, evento, usuarioActual) {
      const m = this.mensaje(r, evento);
      if (!m) return;
      const para = m.para || (usuarioActual.id === r.tutorId ? r.estudianteId : r.tutorId);
      try { await repo().registrarNotificacion({ reservaId: r.id, usuarioId: para, canal: 'whatsapp', mensaje: m.texto }); }
      catch (e) { console.warn('No se pudo registrar la notificación:', e.message); }
    },
    // Enlaces para enviar el registro de la tutoría por WhatsApp o correo a la otra persona.
    enlacesContacto(r, rolActual) {
      const aTutor = rolActual === 'estudiante';
      const tel = aTutor ? r.tutorTelefono : r.estudianteTelefono;
      const correo = aTutor ? r.tutorCorreo : r.estudianteCorreo;
      const texto = 'TutoresOn-Line · ' + (r.materia || 'Tutoría') + ': ' + TOL.descripcionReserva(r) + ', ' + r.modalidad + '. Tutor: ' + r.tutorNombre + '. Estudiante: ' + r.estudianteNombre + '.' +
        (r.modalidad === 'Virtual' ? ' Enlace: ' + TOL.video.enlace(r.id) : '');
      return { whatsapp: TOL.enlaceWhatsApp(tel, texto), correo: TOL.enlaceCorreo(correo, 'Tutoría ' + (r.materia || '') + ' · TutoresOn-Line', texto) };
    }
  };

  /* ---------- Reservas ---------- */
  TOL.reservas = {
    async reservar({ tutor, materia, fecha, franja, modalidad }) {
      const u = await TOL.auth.actual();
      if (!u || u.rol !== 'estudiante') throw new Error('Inicia sesión como estudiante para reservar.');
      if (!['Virtual', 'Presencial'].includes(modalidad)) throw new Error('Elige la modalidad.');
      if (modalidad === 'Virtual' && !tutor.virtual) throw new Error('Este tutor no da sesiones virtuales.');
      if (modalidad === 'Presencial' && !tutor.presencial) throw new Error('Este tutor no da sesiones presenciales.');
      if (!materia || !tutor.materias.includes(materia)) throw new Error('Elige la materia.');
      if (!fecha || !TOL.FRANJAS[franja] || franja === 'ahora') throw new Error('Elige una franja disponible.');
      const r = await repo().crearReserva({ estudianteId: u.id, tutorId: tutor.id, materia, fecha, franja, modalidad, inmediata: false, precio: tutor.tarifa });
      await TOL.notificaciones.registrar(r, 'solicitud', u);
      return r;
    },

    // Reserva "tipo Uber": el estudiante pide ayuda ya y se asigna el mejor tutor disponible en ese momento.
    async solicitarAhora(materia) {
      const u = await TOL.auth.actual();
      if (!u || u.rol !== 'estudiante') throw new Error('Inicia sesión como estudiante.');
      const candidatos = TOL.tutores.filtrar(await TOL.tutores.listar(), { materia: materia || '', modalidad: 'virtual', ahora: true, dia: '' });
      if (!candidatos.length) throw new Error('Ahora mismo no hay tutores disponibles para esa materia. Prueba reservando una franja.');
      const t = candidatos[0];
      const r = await repo().crearReserva({ estudianteId: u.id, tutorId: t.id, materia: materia || t.materias[0], fecha: TOL.isoLocal(new Date()), franja: 'ahora', modalidad: 'Virtual', inmediata: true, precio: t.tarifa });
      await TOL.notificaciones.registrar(r, 'solicitud', u);
      return r;
    },

    async delEstudiante() { const u = await TOL.auth.actual(); return ordenar(await repo().reservasDe(u.id, 'estudiante')); },
    async delTutor() { const u = await TOL.auth.actual(); return ordenar(await repo().reservasDe(u.id, 'tutor')); },
    obtener: id => repo().obtenerReserva(id),

    async aceptar(r) { return cambiar(r, 'confirmada', 'confirmada'); },
    async rechazar(r) { return cambiar(r, 'rechazada', 'rechazada'); },
    async cancelar(r) { return cambiar(r, 'cancelada', 'cancelada'); },

    // Ingresos del mes de un tutor: suma de sesiones finalizadas en el mes actual.
    ingresosDelMes(reservas) {
      const mes = TOL.isoLocal(new Date()).slice(0, 7);
      return reservas.filter(r => r.estado === 'finalizada' && r.fecha.slice(0, 7) === mes).reduce((s, r) => s + (r.precio || 0), 0);
    }
  };

  function ordenar(lista) { return lista.slice().sort((a, b) => TOL.inicioReserva(a) - TOL.inicioReserva(b)); }
  async function cambiar(r, estado, evento) {
    const u = await TOL.auth.actual();
    const nueva = await repo().cambiarEstadoReserva(r.id, estado);
    await TOL.notificaciones.registrar(nueva, evento, u);
    return nueva;
  }

  /* ---------- Reputación (reseñas y estrellas) ---------- */
  TOL.resenas = {
    deTutor: (id, limite) => repo().resenasDeTutor(id, limite),
    deReserva: id => repo().resenaDeReserva(id),
    async calificar(reserva, estrellas, comentario) {
      const n = Number(estrellas);
      if (!(n >= 1 && n <= 5)) throw new Error('Elige de 1 a 5 estrellas.');
      if (reserva.estado !== 'confirmada') throw new Error('Solo se pueden calificar sesiones confirmadas.');
      const u = await TOL.auth.actual();
      if (!u || u.id !== reserva.estudianteId) throw new Error('Solo el estudiante de la sesión puede calificarla.');
      await repo().crearResena({ reservaId: reserva.id, estrellas: n, comentario: String(comentario || '').trim().slice(0, 300) });
      await TOL.notificaciones.registrar(reserva, 'calificada', u);
    }
  };
})();
