// `import 'spotfix/auto'` en el punto de entrada (p. ej. src/main.tsx): monta spotfix sin componente.
// Solo en desarrollo; en producción el bundler elimina la importación del overlay.

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  void import('./core/index.js').then(({ montar }) => montar());
}

export {};
