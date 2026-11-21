/* Servidor Netlify: el navegador NUNCA recibe GEMINI_API_KEY.
 * Requiere un Supabase JWT validado en Auth o un código privado para la demostración.
 */
import { timingSafeEqual } from 'node:crypto';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
const comparar = (a, b) => {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};

async function accesoAutorizado(req, codigo) {
  if (process.env.IA_ACCESS_CODE && comparar(codigo, process.env.IA_ACCESS_CODE)) return true;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !anon || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return false;
  try {
    const res = await fetch(url + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(6500)
    });
    return res.ok;
  } catch { return false; }
}

const TIPOS = {
  explicar: 'Explica el tema paso a paso, con un ejemplo sencillo y una pregunta para comprobar comprensión.',
  ejercicio: 'Crea un ejercicio original y proporciona después la solución explicada paso a paso.',
  repasar: 'Crea un resumen breve y organizado con conceptos principales y 3 preguntas de repaso con respuestas.'
};

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Solo se permiten solicitudes POST.' }, 405);
  if (!(req.headers.get('content-type') || '').includes('application/json')) return json({ error: 'Envía datos JSON.' }, 415);

  let datos;
  try {
    const bruto = await req.text();
    if (bruto.length > 11500) return json({ error: 'La solicitud es demasiado extensa.' }, 413);
    datos = JSON.parse(bruto);
  } catch { return json({ error: 'Solicitud JSON inválida.' }, 400); }

  const pregunta = typeof datos?.pregunta === 'string' ? datos.pregunta.trim() : '';
  const materia = typeof datos?.materia === 'string' ? datos.materia.trim().slice(0, 70) : '';
  const nivel = typeof datos?.nivel === 'string' ? datos.nivel.trim() : '';
  const tipo = typeof datos?.tipo === 'string' ? datos.tipo : '';
  if (pregunta.length < 5 || pregunta.length > 1200 || !materia || !['Primaria', 'Bachillerato', 'Universitario'].includes(nivel) || !TIPOS[tipo]) {
    return json({ error: 'Revisa la pregunta, la materia, el nivel y la modalidad.' }, 400);
  }
  if (!process.env.GEMINI_API_KEY) return json({ error: 'Falta configurar GEMINI_API_KEY en Netlify.' }, 503);
  if (!(await accesoAutorizado(req, datos.codigo))) {
    return json({ error: 'Acceso no autorizado. Ingresa el código de IA de la demostración o entra con una cuenta Supabase válida.' }, 401);
  }

  const historial = Array.isArray(datos.historial)
    ? datos.historial.slice(-6).filter(m => m && ['estudiante','asistente'].includes(m.rol) && typeof m.texto === 'string')
      .map(m => `${m.rol === 'estudiante' ? 'Estudiante' : 'Asistente'}: ${m.texto.slice(0, 1250)}`).join('\n')
    : '';
  const prompt = [
    'Eres el asistente académico de TutoresOn-Line, una plataforma que conecta estudiantes con tutores.',
    'Responde siempre en español claro y amable; adapta la dificultad al nivel solicitado.',
    'Sé preciso. Si no sabes algo, dilo. No inventes fuentes. No pidas ni reveles datos personales.',
    'Prioriza aprendizaje y explicaciones, no suplantar la labor del tutor. Usa texto plano legible.',
    'Materia: ' + materia, 'Nivel: ' + nivel, 'Objetivo: ' + TIPOS[tipo],
    historial ? 'Contexto previo de esta conversación:\n' + historial : '',
    'Nueva pregunta del estudiante: ' + pregunta,
    'Da una respuesta útil de entre 120 y 400 palabras como máximo (puede ser menos si corresponde).'
  ].filter(Boolean).join('\n\n');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Api-Revision': '2026-05-20' },
      body: JSON.stringify({ model, input: prompt }),
      signal: AbortSignal.timeout(26000)
    });
    if (!r.ok) {
      if (r.status === 429) return json({ error: 'El proveedor de IA alcanzó su límite de solicitudes. Intenta nuevamente más tarde.' }, 429);
      if (r.status === 401 || r.status === 403) return json({ error: 'La clave de Gemini no tiene acceso. Revisa GEMINI_API_KEY y el proyecto en AI Studio.' }, 502);
      if (r.status === 404) return json({ error: 'El modelo de Gemini no está disponible para esta cuenta. Prueba otro GEMINI_MODEL en Netlify.' }, 502);
      console.error('Gemini HTTP', r.status);
      return json({ error: 'Gemini no pudo procesar la pregunta en este momento.' }, 502);
    }
    const salida = await r.json();
    const respuesta = (salida.steps || [])
      .filter(s => s.type === 'model_output')
      .flatMap(s => Array.isArray(s.content) ? s.content : [])
      .filter(c => c.type === 'text' && typeof c.text === 'string')
      .map(c => c.text).join('\n').trim();
    if (!respuesta) return json({ error: 'Gemini no devolvió texto. Intenta reformular tu pregunta.' }, 502);
    return json({ respuesta: respuesta.slice(0, 7000) });
  } catch (e) {
    console.error('Error al consultar Gemini:', e?.name || 'Error');
    return json({ error: e?.name === 'TimeoutError' ? 'La IA tardó demasiado. Intenta una pregunta más breve.' : 'No se pudo conectar con Gemini.' }, 502);
  }
}
