// Lógica de la ruta de desarrollo. Solo se carga desde index.ts cuando NODE_ENV es development.

import { compileMarkdown, type NoteInput } from '../shared/note.js';
import type { OpcionesSpotfix } from './index.js';
import { fuenteDePila, resolverComponentes, resolverPagina } from './resolve.js';
import { cambiarEstado, ErrorSpotfix, escribirConfig, guardarNota, leerConfig, listarNotas } from './store.js';

const LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MAX_CUERPO = 30 * 1024 * 1024;

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const noEncontrado = () => new Response('Not found', { status: 404 });

function esLocal(req: Request): boolean {
  const host = req.headers.get('host') ?? '';
  const nombre = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  if (!LOCALES.has(nombre)) return false;
  const origen = req.headers.get('origin');
  if (origen) {
    try {
      if (!LOCALES.has(new URL(origen).hostname)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function permitido(req: Request, raiz: string, escritura: boolean): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') return false;
  if (!esLocal(req)) return false;
  // Una cabecera propia obliga al navegador a hacer preflight: bloquea formularios de otras webs.
  if (escritura && req.headers.get('x-spotfix') !== '1') return false;
  return (await leerConfig(raiz)).enabled;
}

async function leerCuerpo(req: Request): Promise<any> {
  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > MAX_CUERPO) throw new ErrorSpotfix(413, 'Petición demasiado grande');
  const texto = await req.text();
  if (texto.length > MAX_CUERPO) throw new ErrorSpotfix(413, 'Petición demasiado grande');
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorSpotfix(400, 'JSON inválido');
  }
}

function errorARespuesta(e: unknown): Response {
  if (e instanceof ErrorSpotfix) return json({ error: e.message }, e.status);
  console.error('[spotfix]', e);
  return json({ error: 'Error interno de spotfix' }, 500);
}

export function createSpotfixHandlers(opciones: OpcionesSpotfix = {}) {
  const raiz = () => opciones.raiz ?? process.cwd();

  async function GET(req: Request): Promise<Response> {
    if (!(await permitido(req, raiz(), false))) return noEncontrado();
    try {
      const url = new URL(req.url);
      if (url.searchParams.get('accion') === 'estado') return json({ ok: true, config: await leerConfig(raiz()) });
      const notas = await listarNotas(raiz());
      if (url.searchParams.get('formato') === 'md') {
        const md = compileMarkdown(notas, {
          todas: url.searchParams.get('todas') === '1',
          seccion: url.searchParams.get('seccion') ?? undefined,
        });
        return new Response(md, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } });
      }
      return json({ notas });
    } catch (e) {
      return errorARespuesta(e);
    }
  }

  async function POST(req: Request): Promise<Response> {
    if (!(await permitido(req, raiz(), true))) return noEncontrado();
    try {
      const entrada = (await leerCuerpo(req)) as NoteInput;
      if (!entrada || typeof entrada !== 'object') throw new ErrorSpotfix(400, 'Nota inválida');
      const nombres = Array.isArray(entrada.componentes)
        ? entrada.componentes.filter((n): n is string => typeof n === 'string')
        : [];
      const [pagina, ubic, dePila] = await Promise.all([
        resolverPagina(raiz(), String(entrada.seccion ?? '/')),
        resolverComponentes(raiz(), nombres),
        fuenteDePila(raiz(), entrada.fuente_cruda),
      ]);
      // Un nombre puesto a mano con data-spotfix va primero aunque no sea un componente.
      const manual = nombres[0]?.startsWith('#') ? nombres[0].slice(1) : null;
      const cadena = [...(manual ? [manual] : []), ...ubic.componentes];
      const nota = await guardarNota(raiz(), entrada, {
        plataforma: opciones.plataforma ?? 'next',
        archivo_ruta: pagina,
        componente: cadena.length ? cadena.slice(0, 4).join(' < ') : null,
        fuente: ubic.fuente ?? dePila,
      });
      return json({ nota }, 201);
    } catch (e) {
      return errorARespuesta(e);
    }
  }

  async function PATCH(req: Request): Promise<Response> {
    if (!(await permitido(req, raiz(), true))) return noEncontrado();
    try {
      const cuerpo = await leerCuerpo(req);
      if (cuerpo && typeof cuerpo.config === 'object' && cuerpo.config) {
        // No se puede apagar desde el navegador: luego no habría forma de volver a encenderlo.
        const { enabled: _, ...cambios } = cuerpo.config;
        return json({ config: await escribirConfig(raiz(), cambios) });
      }
      const { id, estado } = cuerpo ?? {};
      if (typeof id !== 'string' || (estado !== 'abierta' && estado !== 'hecha')) {
        throw new ErrorSpotfix(400, 'Se espera { id, estado: "abierta" | "hecha" }');
      }
      return json({ nota: await cambiarEstado(raiz(), id, estado) });
    } catch (e) {
      return errorARespuesta(e);
    }
  }

  return { GET, POST, PATCH };
}
