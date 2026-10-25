// Del elemento DOM señalado a: componentes de React, pista de archivo, selector y texto visible.

export interface Localizacion {
  /** Del más interno al más externo. Un nombre que empieza por '#' viene de data-spotfix. */
  componentes: string[];
  fuente_cruda: string | null;
  selector: string;
  texto_visible: string | null;
}

// Componentes internos de Next/React que no interesan para la etiqueta.
const INTERNOS = new Set([
  'InnerLayoutRouter', 'OuterLayoutRouter', 'RedirectBoundary', 'RedirectErrorBoundary', 'NotFoundBoundary',
  'NotFoundErrorBoundary', 'ErrorBoundary', 'ErrorBoundaryHandler', 'LoadingBoundary', 'ScrollAndFocusHandler',
  'InnerScrollAndFocusHandler', 'RenderFromTemplateContext', 'HTTPAccessFallbackBoundary',
  'HTTPAccessFallbackErrorBoundary', 'Router', 'AppRouter', 'ServerRoot', 'HotReload', 'ReactDevOverlay',
  'DevRootHTTPAccessFallbackBoundary', 'AppDevOverlay', 'AppDevOverlayErrorBoundary', 'Root', 'Suspense',
  'Fragment', 'StrictMode', 'Profiler', 'Provider', 'Consumer', 'SegmentViewNode', 'SegmentStateProvider',
  'ClientPageRoot', 'ClientSegmentRoot', 'MetadataBoundary', 'ViewportBoundary', 'OutletBoundary',
]);

export function esInterno(nombre: string): boolean {
  return INTERNOS.has(nombre) || nombre.startsWith('__next') || !/^[A-Z]/.test(nombre);
}

function fibraDe(el: Element): any {
  let nodo: Element | null = el;
  while (nodo) {
    for (const k of Object.keys(nodo)) {
      if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) {
        return (nodo as any)[k];
      }
    }
    nodo = nodo.parentElement;
  }
  return null;
}

function nombreDeTipo(t: any): string | null {
  if (!t || typeof t === 'string') return null;
  if (typeof t === 'function') return t.displayName || t.name || null;
  if (typeof t === 'object') {
    return t.displayName || nombreDeTipo(t.render) || nombreDeTipo(t.type) || null;
  }
  return null;
}

function textoDePila(f: any): string | null {
  const src = f._debugSource;
  if (src?.fileName) return `${src.fileName}:${src.lineNumber ?? 1}`;
  const pila = f._debugStack;
  if (pila) {
    const s = typeof pila === 'string' ? pila : pila.stack;
    if (typeof s === 'string') return s.slice(0, 3000);
  }
  return null;
}

export function localizar(el: Element): Localizacion {
  const componentes: string[] = [];
  const manual = el.closest('[data-spotfix]');
  if (manual) componentes.push('#' + (manual.getAttribute('data-spotfix') || '').slice(0, 80));

  let fuente_cruda: string | null = null;
  let f = fibraDe(el);
  let pasos = 0;
  while (f && pasos++ < 400) {
    const n = nombreDeTipo(f.type);
    if (n && !componentes.includes(n)) {
      componentes.push(n);
      if (!fuente_cruda && !esInterno(n)) fuente_cruda = textoDePila(f);
    }
    // Server Components: React 19 los deja en _debugInfo en desarrollo.
    if (Array.isArray(f._debugInfo)) {
      for (const info of f._debugInfo) {
        if (info && typeof info.name === 'string' && !componentes.includes(info.name)) componentes.push(info.name);
      }
    }
    f = f.return;
  }

  return {
    componentes: componentes.slice(0, 40),
    fuente_cruda,
    selector: selectorCorto(el),
    texto_visible: textoVisible(el),
  };
}

/** Primer nombre útil para mostrar en la etiqueta del resaltado. */
export function etiqueta(loc: Localizacion, el: Element): string {
  const propio = loc.componentes.find((n) => n.startsWith('#') || !esInterno(n));
  return propio ? propio.replace(/^#/, '') : el.tagName.toLowerCase();
}

const CLASE_OK = /^[A-Za-z][\w-]{0,30}$/;

function parte(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `${tag}#${el.id}`;
  const clases = Array.from(el.classList).filter((c) => CLASE_OK.test(c) && !/\d{3,}/.test(c)).slice(0, 2);
  if (clases.length) return `${tag}.${clases.join('.')}`;
  const padre = el.parentElement;
  if (!padre) return tag;
  const iguales = Array.from(padre.children).filter((c) => c.tagName === el.tagName);
  return iguales.length > 1 ? `${tag}:nth-of-type(${iguales.indexOf(el) + 1})` : tag;
}

export function selectorCorto(el: Element): string {
  const partes: string[] = [];
  let nodo: Element | null = el;
  while (nodo && nodo !== document.body && partes.length < 4) {
    partes.unshift(parte(nodo));
    if (nodo.id) break;
    nodo = nodo.parentElement;
  }
  return partes.join(' > ') || 'body';
}

function textoVisible(el: Element): string | null {
  const t = ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 200) : null;
}
