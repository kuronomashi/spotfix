// Adaptador de los handlers (Request/Response web) a Node http / Connect.
// Lo usan el plugin de Vite y `npx spotfix serve`.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { OpcionesSpotfix } from '../next/index.js';
import { createSpotfixHandlers } from '../next/handlers.js';

export interface OpcionesMiddleware extends OpcionesSpotfix {
  /** Ruta de la API. Por defecto /api/spotfix. */
  endpoint?: string;
  /** Añade cabeceras CORS para orígenes localhost (servidor suelto en otro puerto). */
  cors?: boolean;
}

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

async function leer(req: IncomingMessage): Promise<Buffer> {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(t as Buffer);
  return Buffer.concat(trozos);
}

type Siguiente = (err?: unknown) => void;

/** Middleware estilo Connect. Si la URL no es la de spotfix, pasa al siguiente. */
export function crearMiddleware(opciones: OpcionesMiddleware = {}) {
  const endpoint = opciones.endpoint ?? '/api/spotfix';
  const handlers = createSpotfixHandlers(opciones);

  return async (req: IncomingMessage, res: ServerResponse, siguiente?: Siguiente) => {
    const ruta = (req.url ?? '').split('?')[0];
    if (ruta !== endpoint) {
      if (siguiente) return siguiente();
      res.statusCode = 404;
      return res.end('Not found');
    }
    try {
      const origen = req.headers.origin;
      if (opciones.cors && origen && LOCAL.test(origen)) {
        res.setHeader('access-control-allow-origin', origen);
        res.setHeader('access-control-allow-headers', 'content-type, x-spotfix');
        res.setHeader('access-control-allow-methods', 'GET, POST, PATCH');
        res.setHeader('vary', 'origin');
      }
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }
      const metodo = req.method === 'POST' || req.method === 'PATCH' ? req.method : 'GET';
      const cabeceras = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') cabeceras.set(k, v);
        else if (Array.isArray(v)) cabeceras.set(k, v.join(', '));
      }
      const cuerpo = metodo === 'GET' ? undefined : new Uint8Array(await leer(req));
      const peticion = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo,
      });
      const r = await handlers[metodo](peticion);
      res.statusCode = r.status;
      r.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      if (siguiente) return siguiente(e);
      res.statusCode = 500;
      res.end('Error interno de spotfix');
    }
  };
}
