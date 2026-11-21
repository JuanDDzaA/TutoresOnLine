/* TutoresOn-Line · Repositorio LOCAL (modo demostración)
   Guarda todo en localStorage. Implementa el mismo contrato que RepoSupabase,
   así el resto de la aplicación no sabe de dónde vienen los datos.
   Solo para demostración: las contraseñas aquí NO están protegidas. */
(function () {
  'use strict';
  const TOL = (window.TOL = window.TOL || {});

  const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const copia = x => JSON.parse(JSON.stringify(x));

  function semilla() {
    const dispLaura = [[0, 'tarde'], [1, 'manana'], [1, 'tarde'], [3, 'tarde'], [4, 'manana'], [5, 'tarde']];
    const dispTodos = [0, 1, 2, 3, 4].flatMap(d => [[d, 'manana'], [d, 'tarde']]);
    const arr = l => l.map(([dia, franja]) => ({ dia, franja }));
    const tutor = (id, extra) => Object.assign({ id, biografia: '', tarifa: 0, ciudad: '', virtual: true, presencial: false, disponibleAhora: false, sumaEstrellas: 0, totalResenas: 0, sesiones: 0, materias: [], niveles: [], disponibilidad: [] }, extra);
    return {
      usuarios: [
        { id: 'u-demo', nombre: 'Estudiante Demo', correo: 'estudiante@demo.com', clave: 'demo123', rol: 'estudiante', telefono: '3001234567' },
        { id: 'u-sara', nombre: 'Sara Torres', correo: 'sara@demo.com', clave: 'demo123', rol: 'estudiante', telefono: '' },
        { id: 'u-laura', nombre: 'Laura Méndez', correo: 'laura@demo.com', clave: 'tutor123', rol: 'tutor', telefono: '3015550101' },
        { id: 'u-carlos', nombre: 'Carlos Rey', correo: 'carlos@demo.com', clave: 'tutor123', rol: 'tutor', telefono: '3015550102' },
        { id: 'u-andrea', nombre: 'Andrea Pérez', correo: 'andrea@demo.com', clave: 'tutor123', rol: 'tutor', telefono: '3015550103' },
        { id: 'u-julian', nombre: 'Julián Ortega', correo: 'julian@demo.com', clave: 'tutor123', rol: 'tutor', telefono: '3015550104' }
      ],
      tutores: [
        tutor('u-laura', { biografia: 'Licenciada en Matemáticas con 6 años explicando cálculo paso a paso.', tarifa: 28000, ciudad: 'Barranquilla', virtual: true, presencial: true, disponibleAhora: true, sumaEstrellas: 627, totalResenas: 128, sesiones: 128, materias: ['Matemáticas', 'Cálculo'], niveles: ['Bachillerato', 'Universitario'], disponibilidad: arr(dispLaura) }),
        tutor('u-carlos', { biografia: 'Ingeniero físico. Física mecánica y electromagnetismo.', tarifa: 30000, ciudad: 'Barranquilla', virtual: true, presencial: false, disponibleAhora: false, sumaEstrellas: 90, totalResenas: 20, sesiones: 20, materias: ['Física'], niveles: ['Bachillerato', 'Universitario'], disponibilidad: arr(dispTodos) }),
        tutor('u-andrea', { biografia: 'Profesora de inglés certificada. Conversación y preparación de exámenes.', tarifa: 25000, ciudad: 'Cartagena', virtual: true, presencial: true, disponibleAhora: true, sumaEstrellas: 47, totalResenas: 10, sesiones: 10, materias: ['Inglés'], niveles: ['Primaria', 'Bachillerato', 'Universitario'], disponibilidad: arr(dispTodos) }),
        tutor('u-julian', { biografia: 'Desarrollador de software. Programación y bases de datos.', tarifa: 35000, ciudad: 'Barranquilla', virtual: true, presencial: true, disponibleAhora: false, sumaEstrellas: 0, totalResenas: 0, sesiones: 0, materias: ['Programación', 'Bases de datos'], niveles: ['Universitario'], disponibilidad: arr([[1, 'tarde'], [2, 'tarde'], [3, 'tarde'], [5, 'manana']]) })
      ],
      reservas: [],
      resenas: [
        { id: 'seed-1', reservaId: 'seed-1', estudianteId: 'u-sara', autor: 'Sara Torres', tutorId: 'u-laura', estrellas: 5, comentario: 'Muy clara explicando integrales, gracias!', creado: '2026-10-20T15:00:00' },
        { id: 'seed-2', reservaId: 'seed-2', estudianteId: 'u-demo', autor: 'Estudiante Demo', tutorId: 'u-laura', estrellas: 5, comentario: 'Me ayudó a entender la regla de la cadena.', creado: '2026-10-12T16:00:00' }
      ],
      notificaciones: [],
      sesion: null
    };
  }

  class RepoLocal {
    constructor() {
      this.clave = 'tol_db_v1';
      this.db = this._cargar();
    }
    _cargar() {
      try { const t = localStorage.getItem(this.clave); if (t) return JSON.parse(t); } catch (e) { /* sin almacenamiento */ }
      const db = semilla();
      try { localStorage.setItem(this.clave, JSON.stringify(db)); } catch (e) { /* memoria */ }
      return db;
    }
    _guardar() { try { localStorage.setItem(this.clave, JSON.stringify(this.db)); } catch (e) { /* memoria */ } }
    _recargar() { try { const t = localStorage.getItem(this.clave); if (t) this.db = JSON.parse(t); } catch (e) { /* memoria */ } }
    _usuario(id) { return this.db.usuarios.find(u => u.id === id); }
    _publico(u) { return u ? { id: u.id, nombre: u.nombre, correo: u.correo, telefono: u.telefono, rol: u.rol } : null; }

    /* ---------- Autenticación ---------- */
    async registrar(d) {
      this._recargar();
      if (this.db.usuarios.some(u => u.correo.toLowerCase() === d.correo.toLowerCase())) throw new Error('Ya existe una cuenta con ese correo.');
      const id = uid('u');
      this.db.usuarios.push({ id, nombre: d.nombre, correo: d.correo, clave: d.clave, rol: d.rol, telefono: d.telefono || '' });
      if (d.rol === 'tutor') {
        this.db.tutores.push({ id, biografia: '', tarifa: Number(d.tarifa) || 0, ciudad: d.ciudad || '', virtual: true, presencial: false, disponibleAhora: false, sumaEstrellas: 0, totalResenas: 0, sesiones: 0, materias: d.materias || [], niveles: [], disponibilidad: [] });
      }
      this._guardar();
      return { requiereConfirmacion: false };
    }
    async iniciarSesion({ correo, clave, rol }) {
      this._recargar();
      const u = this.db.usuarios.find(x => x.correo.toLowerCase() === correo.toLowerCase() && x.clave === clave);
      if (!u) throw new Error('Correo o contraseña incorrectos.');
      if (u.rol !== rol) throw new Error('Esa cuenta es de ' + (u.rol === 'tutor' ? 'tutor' : 'estudiante') + '. Cambia el tipo de cuenta arriba.');
      this.db.sesion = u.id;
      this._guardar();
      return this._publico(u);
    }
    async cerrarSesion() { this._recargar(); this.db.sesion = null; this._guardar(); }
    async usuarioActual() { this._recargar(); return this._publico(this._usuario(this.db.sesion)); }

    /* ---------- Tutores ---------- */
    _vistaTutor(t) {
      const u = this._usuario(t.id) || {};
      return Object.assign(copia(t), { nombre: u.nombre || '', telefono: u.telefono || '', reputacion: t.totalResenas ? Math.round(t.sumaEstrellas / t.totalResenas * 100) / 100 : 0 });
    }
    async listarTutores() { this._recargar(); return this.db.tutores.map(t => this._vistaTutor(t)); }
    async obtenerTutor(id) { this._recargar(); const t = this.db.tutores.find(x => x.id === id); return t ? this._vistaTutor(t) : null; }
    async guardarPerfilTutor(id, d) {
      this._recargar();
      const t = this.db.tutores.find(x => x.id === id);
      if (!t) throw new Error('Tutor no encontrado.');
      Object.assign(t, { tarifa: d.tarifa, ciudad: d.ciudad, virtual: d.virtual, presencial: d.presencial, disponibleAhora: d.disponibleAhora, materias: d.materias, niveles: d.niveles, disponibilidad: d.disponibilidad });
      this._guardar();
    }

    /* ---------- Reservas ---------- */
    async franjasOcupadas(tutorId, desde) {
      this._recargar();
      return this.db.reservas.filter(r => r.tutorId === tutorId && !r.inmediata && r.fecha >= desde && ['pendiente', 'confirmada'].includes(r.estado)).map(r => ({ fecha: r.fecha, franja: r.franja }));
    }
    _vistaReserva(r) {
      const est = this._usuario(r.estudianteId) || {}, tut = this._usuario(r.tutorId) || {};
      const t = this.db.tutores.find(x => x.id === r.tutorId) || {};
      return {
        id: r.id, estudianteId: r.estudianteId, estudianteNombre: est.nombre, estudianteCorreo: est.correo, estudianteTelefono: est.telefono,
        tutorId: r.tutorId, tutorNombre: tut.nombre, tutorCorreo: tut.correo, tutorTelefono: tut.telefono, tutorCiudad: t.ciudad || '',
        materia: r.materia, fecha: r.fecha, franja: r.franja, modalidad: r.modalidad, estado: r.estado, inmediata: !!r.inmediata, precio: r.precio,
        calificada: this.db.resenas.some(x => x.reservaId === r.id)
      };
    }
    async crearReserva(d) {
      this._recargar();
      if (!d.inmediata && this.db.reservas.some(r => r.tutorId === d.tutorId && r.fecha === d.fecha && r.franja === d.franja && !r.inmediata && ['pendiente', 'confirmada'].includes(r.estado))) {
        throw new Error('Ese horario ya fue reservado por otra persona.');
      }
      const r = { id: uid('r'), estudianteId: d.estudianteId, tutorId: d.tutorId, materia: d.materia || '', fecha: d.fecha, franja: d.franja, modalidad: d.modalidad, estado: 'pendiente', inmediata: !!d.inmediata, precio: d.precio || 0, creado: new Date().toISOString() };
      this.db.reservas.push(r);
      this._guardar();
      return this._vistaReserva(r);
    }
    async reservasDe(usuarioId, rol) {
      this._recargar();
      const campo = rol === 'tutor' ? 'tutorId' : 'estudianteId';
      return this.db.reservas.filter(r => r[campo] === usuarioId).map(r => this._vistaReserva(r));
    }
    async obtenerReserva(id) { this._recargar(); const r = this.db.reservas.find(x => x.id === id); return r ? this._vistaReserva(r) : null; }
    async cambiarEstadoReserva(id, estado) {
      this._recargar();
      const r = this.db.reservas.find(x => x.id === id);
      if (!r) throw new Error('Reserva no encontrada.');
      r.estado = estado;
      this._guardar();
      return this._vistaReserva(r);
    }

    /* ---------- Reseñas ---------- */
    async crearResena({ reservaId, estrellas, comentario }) {
      this._recargar();
      const r = this.db.reservas.find(x => x.id === reservaId);
      if (!r) throw new Error('Reserva no encontrada.');
      if (this.db.resenas.some(x => x.reservaId === reservaId)) throw new Error('Ya calificaste esta sesión.');
      const autor = (this._usuario(r.estudianteId) || {}).nombre || '';
      this.db.resenas.push({ id: uid('rs'), reservaId, estudianteId: r.estudianteId, autor, tutorId: r.tutorId, estrellas, comentario: comentario || '', creado: new Date().toISOString() });
      const t = this.db.tutores.find(x => x.id === r.tutorId);
      if (t) { t.sumaEstrellas += estrellas; t.totalResenas += 1; t.sesiones += 1; }
      r.estado = 'finalizada';
      this._guardar();
    }
    async resenasDeTutor(tutorId, limite) {
      this._recargar();
      return this.db.resenas.filter(x => x.tutorId === tutorId).sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, limite || 50)
        .map(x => ({ autor: x.autor, estrellas: x.estrellas, comentario: x.comentario, fecha: x.creado }));
    }
    async resenaDeReserva(reservaId) {
      this._recargar();
      const x = this.db.resenas.find(y => y.reservaId === reservaId);
      return x ? { autor: x.autor, estrellas: x.estrellas, comentario: x.comentario, fecha: x.creado } : null;
    }

    /* ---------- Registro de notificaciones ---------- */
    async registrarNotificacion({ reservaId, usuarioId, canal, mensaje }) {
      this._recargar();
      this.db.notificaciones.push({ id: uid('n'), reservaId, usuarioId, canal, mensaje, creado: new Date().toISOString() });
      this._guardar();
    }
    async listarNotificaciones(usuarioId) {
      this._recargar();
      return this.db.notificaciones.filter(n => n.usuarioId === usuarioId).sort((a, b) => b.creado.localeCompare(a.creado));
    }
  }

  TOL.RepoLocal = RepoLocal;
})();
