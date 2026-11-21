-- =====================================================================
-- TutoresOn-Line · Esquema de base de datos (PostgreSQL / Supabase)
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Es seguro ejecutarlo una sola vez en un proyecto nuevo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- Un perfil por cada usuario de Supabase Auth (estudiante o tutor).
create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) > 0),
  correo     text not null,
  telefono   text,
  rol        text not null check (rol in ('estudiante', 'tutor')),
  creado_en  timestamptz not null default now()
);

-- Catálogos
create table public.materias (
  id     serial primary key,
  nombre text not null unique
);
create table public.niveles (
  id     serial primary key,
  nombre text not null unique
);

-- Datos propios de los tutores (1 a 1 con perfiles)
create table public.tutores (
  perfil_id          uuid primary key references public.perfiles(id) on delete cascade,
  biografia          text,
  tarifa_hora        integer not null default 0 check (tarifa_hora >= 0),
  ciudad             text,
  modalidad_virtual  boolean not null default true,
  modalidad_presencial boolean not null default false,
  disponible_ahora   boolean not null default false,
  suma_estrellas     integer not null default 0,
  total_resenas      integer not null default 0,
  sesiones_dictadas  integer not null default 0,
  -- Reputación tipo marketplace: promedio de estrellas (0 si aún no tiene reseñas)
  reputacion         numeric(3,2) generated always as (
                       case when total_resenas > 0
                            then round(suma_estrellas::numeric / total_resenas, 2)
                            else 0 end) stored
);

-- Relaciones muchos a muchos
create table public.tutor_materias (
  tutor_id   uuid    not null references public.tutores(perfil_id) on delete cascade,
  materia_id integer not null references public.materias(id) on delete cascade,
  primary key (tutor_id, materia_id)
);
create table public.tutor_niveles (
  tutor_id uuid    not null references public.tutores(perfil_id) on delete cascade,
  nivel_id integer not null references public.niveles(id) on delete cascade,
  primary key (tutor_id, nivel_id)
);

-- Disponibilidad semanal: día (0 = lunes … 6 = domingo) y franja (mañana 9:00 a.m. / tarde 3:00 p.m.)
create table public.disponibilidad (
  id         serial primary key,
  tutor_id   uuid not null references public.tutores(perfil_id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  franja     text not null check (franja in ('manana', 'tarde')),
  unique (tutor_id, dia_semana, franja)
);

-- Reservas de tutoría
create table public.reservas (
  id            uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.perfiles(id) on delete cascade,
  tutor_id      uuid not null references public.perfiles(id) on delete cascade,
  materia_id    integer references public.materias(id),
  fecha         date not null,
  franja        text not null check (franja in ('manana', 'tarde', 'ahora')),
  modalidad     text not null check (modalidad in ('Virtual', 'Presencial')),
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'confirmada', 'rechazada', 'cancelada', 'finalizada')),
  inmediata     boolean not null default false,   -- true = "tutor ahora" (tipo Uber)
  precio        integer not null default 0 check (precio >= 0),
  creado_en     timestamptz not null default now(),
  check (estudiante_id <> tutor_id)
);
-- Un tutor no puede tener dos reservas activas en la misma fecha y franja (evita doble reserva).
create unique index reservas_sin_cruce
  on public.reservas (tutor_id, fecha, franja)
  where estado in ('pendiente', 'confirmada') and not inmediata;
create index reservas_estudiante_idx on public.reservas (estudiante_id);
create index reservas_tutor_idx on public.reservas (tutor_id);

-- Reseñas: una por reserva
create table public.resenas (
  id            uuid primary key default gen_random_uuid(),
  reserva_id    uuid not null unique references public.reservas(id) on delete cascade,
  estudiante_id uuid not null references public.perfiles(id) on delete cascade,
  tutor_id      uuid not null references public.perfiles(id) on delete cascade,
  estrellas     smallint not null check (estrellas between 1 and 5),
  comentario    text not null default '' check (char_length(comentario) <= 300),
  autor_nombre  text not null default '',          -- se llena solo (trigger), para no exponer perfiles
  creado_en     timestamptz not null default now()
);
create index resenas_tutor_idx on public.resenas (tutor_id, creado_en desc);

-- Registro de notificaciones de cada tutoría (correo / SMS / WhatsApp)
create table public.notificaciones (
  id         uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  canal      text not null check (canal in ('correo', 'sms', 'whatsapp')),
  mensaje    text not null,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. DATOS INICIALES (catálogos)
-- ---------------------------------------------------------------------
insert into public.niveles (nombre) values ('Primaria'), ('Bachillerato'), ('Universitario');
insert into public.materias (nombre) values
  ('Matemáticas'), ('Cálculo'), ('Física'), ('Química'), ('Biología'),
  ('Inglés'), ('Programación'), ('Bases de datos'), ('Estadística'), ('Español');

-- ---------------------------------------------------------------------
-- 3. LÓGICA EN LA BASE DE DATOS (funciones y triggers)
-- ---------------------------------------------------------------------

-- 3.1 Al registrarse un usuario en Supabase Auth se crea su perfil (y su ficha de tutor).
--     Los datos viajan en los metadatos del registro (ver js/repo-supabase.js → registrar).
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := case when new.raw_user_meta_data->>'rol' = 'tutor' then 'tutor' else 'estudiante' end;
  v_materia text;
  v_materia_id integer;
begin
  insert into public.perfiles (id, nombre, correo, telefono, rol)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'telefono', ''),
    v_rol
  );

  if v_rol = 'tutor' then
    insert into public.tutores (perfil_id, tarifa_hora, ciudad)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'tarifa', '')::integer, 0),
      nullif(new.raw_user_meta_data->>'ciudad', '')
    );

    for v_materia in
      select distinct trim(m) from unnest(string_to_array(coalesce(new.raw_user_meta_data->>'materias', ''), ',')) as m
      where trim(m) <> ''
    loop
      insert into public.materias (nombre) values (v_materia) on conflict (nombre) do nothing;
      select id into v_materia_id from public.materias where nombre = v_materia;
      insert into public.tutor_materias (tutor_id, materia_id) values (new.id, v_materia_id) on conflict do nothing;
    end loop;
  end if;

  return new;
end;
$$;

create trigger al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- 3.2 Reglas de cambio de estado de una reserva (quién puede hacer qué)
create or replace function public.validar_cambio_reserva()
returns trigger
language plpgsql
as $$
begin
  -- Nadie puede alterar los datos de la reserva, solo su estado.
  if (new.estudiante_id, new.tutor_id, new.materia_id, new.fecha, new.franja, new.modalidad, new.precio, new.inmediata)
     is distinct from
     (old.estudiante_id, old.tutor_id, old.materia_id, old.fecha, old.franja, old.modalidad, old.precio, old.inmediata) then
    raise exception 'Los datos de la reserva no se pueden modificar.';
  end if;

  -- Cambios hechos por otro trigger (p. ej. al calificar → finalizada) se permiten.
  if pg_trigger_depth() > 1 or new.estado = old.estado then
    return new;
  end if;

  if auth.uid() = old.tutor_id then
    if old.estado = 'pendiente'  and new.estado in ('confirmada', 'rechazada') then return new; end if;
    if old.estado = 'confirmada' and new.estado = 'cancelada' then return new; end if;
  elsif auth.uid() = old.estudiante_id then
    if old.estado in ('pendiente', 'confirmada') and new.estado = 'cancelada' then return new; end if;
  end if;

  raise exception 'Cambio de estado no permitido.';
end;
$$;

create trigger validar_cambio_reserva
  before update on public.reservas
  for each row execute function public.validar_cambio_reserva();

-- 3.3 Reseñas: guarda el nombre del autor antes de insertar…
create or replace function public.preparar_resena()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.autor_nombre := coalesce((select nombre from public.perfiles where id = new.estudiante_id), '');
  return new;
end;
$$;

create trigger preparar_resena
  before insert on public.resenas
  for each row execute function public.preparar_resena();

-- … y después de insertar actualiza la reputación del tutor y finaliza la reserva.
create or replace function public.actualizar_reputacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tutores
     set suma_estrellas    = suma_estrellas + new.estrellas,
         total_resenas     = total_resenas + 1,
         sesiones_dictadas = sesiones_dictadas + 1
   where perfil_id = new.tutor_id;

  update public.reservas set estado = 'finalizada' where id = new.reserva_id;
  return new;
end;
$$;

create trigger actualizar_reputacion
  after insert on public.resenas
  for each row execute function public.actualizar_reputacion();

-- 3.4 Franjas ocupadas de un tutor (los estudiantes no pueden leer reservas ajenas,
--     pero necesitan saber qué horarios ya no están libres).
create or replace function public.franjas_ocupadas(p_tutor uuid, p_desde date)
returns table (fecha date, franja text)
language sql
stable
security definer
set search_path = public
as $$
  select r.fecha, r.franja
    from public.reservas r
   where r.tutor_id = p_tutor
     and r.fecha >= p_desde
     and r.estado in ('pendiente', 'confirmada')
     and not r.inmediata;
$$;

grant execute on function public.franjas_ocupadas(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4. SEGURIDAD: Row Level Security (RLS)
--    Sin una política que lo permita, nadie puede leer ni escribir.
-- ---------------------------------------------------------------------
alter table public.perfiles        enable row level security;
alter table public.materias        enable row level security;
alter table public.niveles         enable row level security;
alter table public.tutores         enable row level security;
alter table public.tutor_materias  enable row level security;
alter table public.tutor_niveles   enable row level security;
alter table public.disponibilidad  enable row level security;
alter table public.reservas        enable row level security;
alter table public.resenas         enable row level security;
alter table public.notificaciones  enable row level security;

-- Perfiles: cada quien ve el suyo, el de los tutores (catálogo público para usuarios con sesión)
-- y el de la otra persona de una reserva compartida.
create policy perfiles_select on public.perfiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from public.tutores t where t.perfil_id = perfiles.id)
  or exists (select 1 from public.reservas r
              where (r.estudiante_id = perfiles.id and r.tutor_id = auth.uid())
                 or (r.tutor_id = perfiles.id and r.estudiante_id = auth.uid()))
);
create policy perfiles_update on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Catálogos: lectura para usuarios con sesión; las materias nuevas las puede crear cualquier usuario con sesión.
create policy materias_select on public.materias for select to authenticated using (true);
create policy materias_insert on public.materias for insert to authenticated with check (true);
create policy niveles_select  on public.niveles  for select to authenticated using (true);

-- Tutores y sus relaciones: todos los usuarios con sesión pueden buscar; solo el dueño modifica.
create policy tutores_select on public.tutores for select to authenticated using (true);
create policy tutores_update on public.tutores for update to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy tutor_materias_select on public.tutor_materias for select to authenticated using (true);
create policy tutor_materias_todo   on public.tutor_materias for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

create policy tutor_niveles_select on public.tutor_niveles for select to authenticated using (true);
create policy tutor_niveles_todo   on public.tutor_niveles for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

create policy disponibilidad_select on public.disponibilidad for select to authenticated using (true);
create policy disponibilidad_todo   on public.disponibilidad for all to authenticated
  using (tutor_id = auth.uid()) with check (tutor_id = auth.uid());

-- Reservas: solo las ve quien participa; solo un estudiante crea reservas a su nombre y a un tutor real.
create policy reservas_select on public.reservas for select to authenticated
  using (estudiante_id = auth.uid() or tutor_id = auth.uid());
create policy reservas_insert on public.reservas for insert to authenticated with check (
  estudiante_id = auth.uid()
  and estado = 'pendiente'
  and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'estudiante')
  and exists (select 1 from public.tutores t where t.perfil_id = tutor_id)
);
create policy reservas_update on public.reservas for update to authenticated
  using (estudiante_id = auth.uid() or tutor_id = auth.uid())
  with check (estudiante_id = auth.uid() or tutor_id = auth.uid());

-- Reseñas: públicas para usuarios con sesión; solo el estudiante de una reserva CONFIRMADA puede calificar.
create policy resenas_select on public.resenas for select to authenticated using (true);
create policy resenas_insert on public.resenas for insert to authenticated with check (
  estudiante_id = auth.uid()
  and exists (select 1 from public.reservas r
               where r.id = reserva_id
                 and r.estudiante_id = auth.uid()
                 and r.tutor_id = resenas.tutor_id
                 and r.estado = 'confirmada')
);

-- Notificaciones: las ven y las crean quienes participan en la reserva.
create policy notificaciones_select on public.notificaciones for select to authenticated using (
  exists (select 1 from public.reservas r
           where r.id = reserva_id and (r.estudiante_id = auth.uid() or r.tutor_id = auth.uid()))
);
create policy notificaciones_insert on public.notificaciones for insert to authenticated with check (
  exists (select 1 from public.reservas r
           where r.id = reserva_id and (r.estudiante_id = auth.uid() or r.tutor_id = auth.uid()))
);
