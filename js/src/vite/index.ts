// Plugin de Vite: sirve /api/spotfix solo con `vite` (dev). En `vite build` no hace nada.
//   vite.config.ts:  import spotfix from 'spotfix/vite';  plugins: [react(), spotfix()]

import type { OpcionesMiddleware } from '../server/node.js';

interface ServidorVite {
  middlewares: { use(fn: (req: any, res: any, next: (err?: unknown) => void) => void): void };
}

export default function spotfix(opciones: Omit<OpcionesMiddleware, 'cors'> = {}) {
  return {
    name: 'spotfix',
    apply: 'serve' as const,
    async configureServer(servidor: ServidorVite) {
      process.env.NODE_ENV ??= 'development';
      const { crearMiddleware } = await import('../server/node.js');
      const mw = crearMiddleware({ plataforma: 'react', ...opciones });
      servidor.middlewares.use((req, res, next) => void mw(req, res, next));
    },
  };
}
