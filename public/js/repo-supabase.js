/* TutoresOn-Line · Repositorio SUPABASE (base de datos real)
   Mismo contrato que RepoLocal. La seguridad (quién puede leer o escribir qué)
   no depende de este archivo: la imponen las políticas RLS de sql/01_esquema.sql. */
(function () {
  'use strict';
  const TOL = (window.TOL = window.TOL || {});

  const SELECT_RESERVA =
    '*, materias(nombre), resenas(id),' +
    ' tutor:perfiles!reservas_tutor_id_fkey(nombre,correo,telefono),' +
    ' estudiante:perfiles!reservas_estudiante_id_fkey(nombre,correo,telefono)';

  class RepoSupabase {
    constructor(url, key) {
      this.sb = window.supabase.createClient(url, key);
    }

    _error(e) {
      const m = (e && e.message) || 'Error desconocido';
      if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos.');   
      if (/already registered/i.test(m)) return new Error('Ya existe una cuenta con ese correo.');
      if (e && e.code === '23505') return new Error('Ese horario ya fue reservado, o ya existe ese registro.');
      return new Error(m);
    }
    _ok(res) { if (res.error) throw this._error(res.error); return res.data; }

    /* ---------- Autenticación ---------- */
    async registrar(d) {
      const res = await this.sb.auth.signUp({
        email: d.correo,
        password: d.clave,
        options: { data: { nombre: d.nombre, rol: d.rol, telefono: d.telefono || '', ciudad: d.ciudad || '', tarifa: String(d.tarifa || 0), materias: (d.materias || []).join(',') } }
      });
      if (res.error) throw this._error(res.error);
      if (res.data.user && res.data.user.identities && res.data.user.identities.length === 0) throw new Error('Ya existe una cuenta con ese correo.');
      const requiereConfirmacion = !res.data.session;
      if (res.data.session) await this.sb.auth.signOut();
      return { requiereConfirmacion };
    }
    async iniciarSesion({ correo, clave, rol }) {
      const res = await this.sb.auth.signInWithPassword({ email: correo, password: clave });
      if (res.error) throw this._error(res.error);
      const perfil = await this.usuarioActual();
      if (!perfil) { await this.sb.auth.signOut(); throw new Error('Tu cuenta no tiene perfil. Vuelve a registrarte.'); }
      if (perfil.rol !== rol) {
        await this.sb.auth.signOut();
        throw new Error('Esa cuenta es de ' + (perfil.rol === 'tutor' ? 'tutor' : 'estudiante') + '. Cambia el tipo de cuenta arriba.');
      }
      return perfil;
    }
    async cerrarSesion() { await this.sb.auth.signOut(); }
    async usuarioActual() {
      const { data } = await this.sb.auth.getSession();
      if (!data.session) return null;
      const res = await this.sb.from('perfiles').select('id,nombre,correo,telefono,rol').eq('id', data.session.user.id).maybeSingle();
      return this._ok(res);
    }

    /* ---------- Tutores ---------- */
    _tutor(t) {
      return {
        id: t.perfil_id, nombre: (t.perfiles && t.perfiles.nombre) || '', telefono: (t.perfiles && t.perfiles.telefono) || '',
        biografia: t.biografia || '', tarifa: t.tarifa_hora, ciudad: t.ciudad || '',
        virtual: t.modalidad_virtual, presencial: t.modalidad_presencial, disponibleAhora: t.disponible_ahora,
        reputacion: Number(t.reputacion || 0), totalResenas: t.total_resenas, sesiones: t.sesiones_dictadas,
        materias: (t.tutor_materias || []).map(x => x.materias.nombre),
        niveles: (t.tutor_niveles || []).map(x => x.niveles.nombre),
        disponibilidad: (t.disponibilidad || []).map(x => ({ dia: x.dia_semana, franja: x.franja }))
      };
    }
    _consultaTutores() {
      return this.sb.from('tutores').select(
        'perfil_id,biografia,tarifa_hora,ciudad,modalidad_virtual,modalidad_presencial,disponible_ahora,reputacion,total_resenas,sesiones_dictadas,' +
        'perfiles(nombre,telefono),tutor_materias(materias(nombre)),tutor_niveles(niveles(nombre)),disponibilidad(dia_semana,franja)');
    }
    async listarTutores() { return this._ok(await this._consultaTutores()).map(t => this._tutor(t)); }
    async obtenerTutor(id) {
      const t = this._ok(await this._consultaTutores().eq('perfil_id', id).maybeSingle());
      return t ? this._tutor(t) : null;
    }
    async guardarPerfilTutor(id, d) {
      const sb = this.sb;
      this._ok(await sb.from('tutores').update({ tarifa_hora: d.tarifa, ciudad: d.ciudad, modalidad_virtual: d.virtual, modalidad_presencial: d.presencial, disponible_ahora: d.disponibleAhora }).eq('perfil_id', id));

      // Materias: se crean las que no existan y se reemplazan los vínculos del tutor.
      if (d.materias.length) await sb.from('materias').upsert(d.materias.map(nombre => ({ nombre })), { onConflict: 'nombre', ignoreDuplicates: true });
      const mats = d.materias.length ? this._ok(await sb.from('materias').select('id').in('nombre', d.materias)) : [];
      this._ok(await sb.from('tutor_materias').delete().eq('tutor_id', id));
      if (mats.length) this._ok(await sb.from('tutor_materias').insert(mats.map(m => ({ tutor_id: id, materia_id: m.id }))));

      const nivs = d.niveles.length ? this._ok(await sb.from('niveles').select('id').in('nombre', d.niveles)) : [];
      this._ok(await sb.from('tutor_niveles').delete().eq('tutor_id', id));
      if (nivs.length) this._ok(await sb.from('tutor_niveles').insert(nivs.map(n => ({ tutor_id: id, nivel_id: n.id }))));

      this._ok(await sb.from('disponibilidad').delete().eq('tutor_id', id));
      if (d.disponibilidad.length) this._ok(await sb.from('disponibilidad').insert(d.disponibilidad.map(x => ({ tutor_id: id, dia_semana: x.dia, franja: x.franja }))));
    }

    /* ---------- Reservas ---------- */
    async franjasOcupadas(tutorId, desde) {
      return this._ok(await this.sb.rpc('franjas_ocupadas', { p_tutor: tutorId, p_desde: desde }));
    }
    _reserva(r) {
      const calificada = Array.isArray(r.resenas) ? r.resenas.length > 0 : !!r.resenas;
      return {
        id: r.id, estudianteId: r.estudiante_id, estudianteNombre: r.estudiante && r.estudiante.nombre, estudianteCorreo: r.estudiante && r.estudiante.correo, estudianteTelefono: r.estudiante && r.estudiante.telefono,
        tutorId: r.tutor_id, tutorNombre: r.tutor && r.tutor.nombre, tutorCorreo: r.tutor && r.tutor.correo, tutorTelefono: r.tutor && r.tutor.telefono, tutorCiudad: '',
        materia: (r.materias && r.materias.nombre) || '', fecha: r.fecha, franja: r.franja, modalidad: r.modalidad, estado: r.estado, inmediata: !!r.inmediata, precio: r.precio, calificada
      };
    }
    async crearReserva(d) {
      let materiaId = null;
      if (d.materia) {
        const m = this._ok(await this.sb.from('materias').select('id').eq('nombre', d.materia).maybeSingle());
        materiaId = m ? m.id : null;
      }
      const fila = this._ok(await this.sb.from('reservas').insert({
        estudiante_id: d.estudianteId, tutor_id: d.tutorId, materia_id: materiaId, fecha: d.fecha, franja: d.franja,
        modalidad: d.modalidad, inmediata: !!d.inmediata, precio: d.precio || 0
      }).select(SELECT_RESERVA).single());
      return this._reserva(fila);
    }
    async reservasDe(usuarioId, rol) {
      const campo = rol === 'tutor' ? 'tutor_id' : 'estudiante_id';
      const filas = this._ok(await this.sb.from('reservas').select(SELECT_RESERVA).eq(campo, usuarioId).order('fecha', { ascending: true }));
      return filas.map(r => this._reserva(r));
    }
    async obtenerReserva(id) {
      const r = this._ok(await this.sb.from('reservas').select(SELECT_RESERVA).eq('id', id).maybeSingle());
      return r ? this._reserva(r) : null;
    }
    async cambiarEstadoReserva(id, estado) {
      const filas = this._ok(await this.sb.from('reservas').update({ estado }).eq('id', id).select(SELECT_RESERVA));
      if (!filas.length) throw new Error('No tienes permiso para cambiar esta reserva.');
      return this._reserva(filas[0]);
    }

    /* ---------- Reseñas ---------- */
    async crearResena({ reservaId, estrellas, comentario }) {
      const reserva = this._ok(await this.sb.from('reservas').select('estudiante_id,tutor_id').eq('id', reservaId).maybeSingle());
      if (!reserva) throw new Error('Reserva no encontrada.');
      const res = await this.sb.from('resenas').insert({ reserva_id: reservaId, estudiante_id: reserva.estudiante_id, tutor_id: reserva.tutor_id, estrellas, comentario: comentario || '' });
      if (res.error && res.error.code === '23505') throw new Error('Ya calificaste esta sesión.');
      if (res.error) throw this._error(res.error);
    }
    _resena(x) { return { autor: x.autor_nombre, estrellas: x.estrellas, comentario: x.comentario, fecha: x.creado_en }; }
    async resenasDeTutor(tutorId, limite) {
      const filas = this._ok(await this.sb.from('resenas').select('estrellas,comentario,creado_en,autor_nombre').eq('tutor_id', tutorId).order('creado_en', { ascending: false }).limit(limite || 50));
      return filas.map(x => this._resena(x));
    }
    async resenaDeReserva(reservaId) {
      const x = this._ok(await this.sb.from('resenas').select('estrellas,comentario,creado_en,autor_nombre').eq('reserva_id', reservaId).maybeSingle());
      return x ? this._resena(x) : null;
    }

    /* ---------- Registro de notificaciones ---------- */
    async registrarNotificacion({ reservaId, usuarioId, canal, mensaje }) {
      this._ok(await this.sb.from('notificaciones').insert({ reserva_id: reservaId, usuario_id: usuarioId, canal, mensaje }));
    }
    async listarNotificaciones(usuarioId) {
      return this._ok(await this.sb.from('notificaciones').select('*').eq('usuario_id', usuarioId).order('creado_en', { ascending: false }));
    }
  }

  TOL.RepoSupabase = RepoSupabase;
})();
