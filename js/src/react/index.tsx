'use client';
// <Spotfix /> en el layout raíz. En producción no renderiza nada y el overlay no entra al bundle.

import { useEffect } from 'react';

export interface SpotfixProps {
  /** Ruta de la API. Por defecto /api/spotfix. */
  endpoint?: string;
}

export function Spotfix({ endpoint }: SpotfixProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    let desmontar: (() => void) | null = null;
    let vivo = true;
    import('../core/index.js').then(async ({ montar }) => {
      if (!vivo) return;
      const fn = await montar({ endpoint });
      if (vivo) desmontar = fn;
      else fn();
    });
    return () => {
      vivo = false;
      if (desmontar) desmontar();
      else window.__spotfix?.desmontar();
    };
  }, [endpoint]);
  return null;
}

export default Spotfix;
