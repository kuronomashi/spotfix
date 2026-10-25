// Ruta de desarrollo para Next.js App Router.
//   app/api/spotfix/route.ts:  export { GET, POST, PATCH } from 'spotfix/next';
// Responde 404 fuera de `next dev`, si spotfix está apagado o si la petición no es local.
// El código que toca el disco se importa solo en desarrollo, así `next build` lo descarta.

export interface OpcionesSpotfix {
  /** Raíz del proyecto. Por defecto process.cwd(). */
  raiz?: string;
  /** Lo que se guarda en `plataforma` de cada nota. Por defecto "next". */
  plataforma?: string;
}

type Handler = (req: Request) => Promise<Response>;
type Metodo = 'GET' | 'POST' | 'PATCH';

export function createSpotfixHandlers(opciones: OpcionesSpotfix = {}): Record<Metodo, Handler> {
  let impl: Promise<Record<Metodo, Handler>> | null = null;
  const envolver = (metodo: Metodo): Handler => async (req) => {
    if (process.env.NODE_ENV === 'development') {
      impl ??= import('./handlers.js').then((m) => m.createSpotfixHandlers(opciones));
      return (await impl)[metodo](req);
    }
    return new Response('Not found', { status: 404 });
  };
  return { GET: envolver('GET'), POST: envolver('POST'), PATCH: envolver('PATCH') };
}

export const { GET, POST, PATCH } = createSpotfixHandlers();
