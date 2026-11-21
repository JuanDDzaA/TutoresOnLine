# TutoresOn-Line + Asistente académico con IA generativa

**Proyecto final** · Integrantes (según el README original): Keiner Baldovino, Juan Daza y Kevin Gomez. Product Owner: profesor Edgar Morillo.

Esta versión conserva las pantallas y reglas de negocio del proyecto entregado por el equipo y añade `public/ia.html`, con generación de respuestas académicas en español mediante la **API de Gemini**. La generación se realiza desde una **función de servidor Netlify** y NO desde el navegador. No hace falta modificar las tablas de PostgreSQL.

## Lo más importante: despliegue para entregar

**Usa Netlify con el repositorio de GitHub.** GitHub Pages sirve archivos estáticos, pero NO ejecuta la función de IA incluida. Un despliegue que muestre la pantalla de IA pero no ejecute su función no cumple el objetivo. No uses solo `index.html` ni solo `public/` al subir el proyecto a Netlify: sube el directorio completo al repositorio y conéctalo a Netlify.

1. Descomprime la carpeta **tutores_online_IA** y sube *el contenido de esta carpeta* a un repositorio público de GitHub, de modo que `netlify.toml`, `public/` y `netlify/` estén en la raíz. **No subas claves de Gemini**.
2. Entra a https://app.netlify.com/ → **Add new project** → **Import an existing project** → GitHub → elige el repositorio. Netlify debe leer `netlify.toml`, que publica `public/` e instala la función en `netlify/functions/`.
3. En **Project configuration / Environment variables** agrega:
   - `GEMINI_API_KEY` = la clave que crees en https://aistudio.google.com/api-keys
   - `IA_ACCESS_CODE` = código privado inventado por el equipo, por ejemplo uno largo y aleatorio. **No uses el ejemplo de tu README como código real**.
   - *Opcional:* `GEMINI_MODEL` = `gemini-3.8-flash` (es el predeterminado; si no está habilitado para tu clave, cambia al modelo que AI Studio permita, por ejemplo `gemini-3.5-flash-lite`).
   - *Opcional para acceso sin código cuando usas cuentas de Supabase:* `SUPABASE_URL` y `SUPABASE_ANON_KEY`, con los mismos valores públicos de `public/js/config.js`. El servidor validará el token del usuario con Supabase Auth antes de llamar a Gemini. Estas variables no son la clave privada de servicio.
4. **Vuelve a desplegar** después de añadir/cambiar las variables: Deploys → Trigger deploy → Deploy site. Las funciones acceden a las variables de entorno configuradas en Netlify durante el despliegue.
5. Abre la URL pública, inicia sesión con una cuenta de Supabase y entra en **Asistente IA**. Para la primera prueba puedes usar el `IA_ACCESS_CODE` definido en Netlify. Ejemplo: Matemáticas / Bachillerato / Explicación → `¿Cómo resuelvo 2x + 5 = 17?`.
6. **Verificación de funcionamiento real:** consulta la función desde la web; debe mostrar una respuesta nueva y relacionada con la pregunta. Si aparece `No se encontró la función de IA`, probablemente publicaste solo archivos estáticos o configuraste mal el directorio de funciones.

> **Importante:** crear una clave API y desplegar la función requiere entrar a tus cuentas de Google AI Studio y Netlify. Esos pasos no pueden completarse desde el ZIP sin tus credenciales. El modelo tiene cuotas; consulta los límites y costos de tu cuenta. No escribas la clave API ni secretos en `public/js/config.js` ni en GitHub.

## Qué hace la nueva IA

- Explica conceptos de matemáticas, física, programación, inglés y otras materias.
- Ajusta las explicaciones al nivel: primaria, bachillerato o universitario.
- Genera ejercicios originales resueltos y resúmenes para repasar.
- Permite preguntas de seguimiento usando el contexto de los últimos mensajes.
- Muestra errores si falta configuración, acceso o el proveedor está temporalmente no disponible. **No muestra respuestas falsas o precalculadas.**
- Protege el acceso a la función mediante un código privado de demostración, o valida un usuario de Supabase Auth si configuras las variables opcionales.

## Estructura de carpetas

```text
tutores_online_IA/
  netlify.toml                    configuración de despliegue
  netlify/functions/
    asistente-ia.mjs              backend de IA (Gemini, claves solo en servidor)
  public/                        carpeta publicada como sitio web
    index.html, login.html, ...  pantallas existentes
    ia.html                       NUEVA pantalla
    js/paginas/ia.js             NUEVO cliente de IA
    js/config.js                 configuración pública de Supabase original
    js/nucleo.js                 navegación actualizada
    css/styles.css               estilos + nuevos estilos de IA
  sql/01_esquema.sql              esquema original de Supabase
  docs/capturas/                 capturas originales de funcionamiento
  docs/Manual_Usuario_TutoresOnLine_IA.pdf   manual de usuario
  README.md
```

## Cuentas y modo demostración

El proyecto original incluye modo local cuando no hay configuración válida de Supabase; las cuentas de ese modo eran:

| Rol | Correo | Contraseña |
|---|---|---|
| Estudiante | estudiante@demo.com | demo123 |
| Tutor | laura@demo.com | tutor123 |

**Atención:** en la versión recibida `public/js/config.js` ya contiene URL y clave *publicable* de Supabase; por eso la app intentará usar la base real. Las cuentas `@demo.com` **no necesariamente sirven** en la base real. Para forzar el modo local, deja `SUPABASE_URL` y `SUPABASE_ANON_KEY` como cadenas vacías en `public/js/config.js`, y vuelve a desplegar. Esos datos de demostración se guardan en `localStorage` (solo para la sustentación; no son seguros para producción). El asistente IA sigue necesitando Netlify + la clave de Gemini + el código privado de IA incluso en modo local.

### Si tienes acceso a Supabase real

El archivo `sql/01_esquema.sql` permite crear el esquema y RLS. Las conexiones en `public/js/config.js` son datos públicos de cliente; **nunca pongas el service_role key ahí**. Para usuarios reales, usa Supabase Auth y revisa las políticas de acceso antes de aceptar usuarios externos.

## Desarrollo en tu computador (opcional)

Con Node.js instalado puedes usar Netlify CLI:

```bash
npm install -g netlify-cli
# En la raíz tutores_online_IA/:
netlify dev
```

Netlify CLI permite emular funciones localmente y usar variables configuradas localmente. Una alternativa es probar el frontend con un servidor estático (`python -m http.server -d public 8000`), pero en ese caso la parte de IA **no** funcionará porque no hay servidor Netlify.

## Funcionalidades originales conservadas

Registro e inicio de sesión, búsqueda de tutores y filtros, reseñas y reputación, reservas, disponibilidad, solicitudes inmediatas, enlaces de Jitsi Meet y notificaciones (manuales por WhatsApp/correo). No se ha confirmado el comportamiento de cada servicio sobre el proyecto Supabase real; pruébalos antes de entregar.

## Pruebas recomendadas antes de la sustentación

1. Entra como estudiante y busca un tutor por materia.
2. Reserva una franja futura y revisa “Mis tutorías”.
3. Entra como tutor y confirma o rechaza una solicitud.
4. Entra en “Asistente IA”, escribe un ejercicio y comprueba la respuesta del modelo.
5. Prueba una pregunta de seguimiento y verifica que se mantenga el contexto.
6. Verifica el sitio en móvil y ten el enlace público de Netlify y el repositorio de GitHub listos.

## Limitaciones conocidas

- La IA depende de la disponibilidad y la cuota de Gemini; sin API key o despliegue en Netlify no genera texto.
- Con solo un código compartido de demostración, su control de acceso es adecuado para una exposición pequeña, **no para un servicio público a gran escala**. Para producción, activa Supabase Auth, límites por usuario y controles de costos/uso.
- El historial de la IA solo vive en la pestaña actual; **no** se guarda en la base de datos.
- El sitio previo tiene otras limitaciones ya reconocidas en su README: notificaciones no automáticas, enlace Jitsi en pestaña externa y refresco por intervalos.

## Enlaces oficiales

- Clave de Gemini: https://aistudio.google.com/api-keys
- API Gemini: https://aistudio.google.com/docs/get-started
- Netlify Functions: https://docs.netlify.com/build/functions/get-started/
- Variables de Netlify: https://docs.netlify.com/build/functions/environment-variables/
