// Modo "señalar": resalta el elemento bajo el ratón y lo fija con un clic. Esc cancela.

import { etiqueta, localizar } from './locate.js';

export interface Resalte {
  /** Mueve el recuadro sobre un elemento (o lo oculta con null). */
  mostrar(el: Element | null, texto?: string, fijo?: boolean): void;
}

export function crearResalte(raiz: ShadowRoot): Resalte {
  const caja = document.createElement('div');
  caja.className = 'resalte';
  caja.style.display = 'none';
  const tag = document.createElement('div');
  tag.className = 'etiqueta';
  caja.append(tag);
  raiz.querySelector('.sf')!.append(caja);
  let actual: Element | null = null;

  const colocar = () => {
    if (!actual || !actual.isConnected) {
      caja.style.display = 'none';
      return;
    }
    const r = actual.getBoundingClientRect();
    Object.assign(caja.style, {
      display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    });
    tag.style.top = r.top < 24 ? `${r.height + 2}px` : '-22px';
  };
  window.addEventListener('scroll', colocar, true);
  window.addEventListener('resize', colocar);

  return {
    mostrar(el, texto = '', fijo = false) {
      actual = el;
      tag.textContent = texto;
      caja.classList.toggle('fijo', fijo);
      colocar();
    },
  };
}

/** Espera a que el usuario elija un elemento. Resuelve null si cancela. */
export function elegirElemento(host: Element, raiz: ShadowRoot, resalte: Resalte): Promise<Element | null> {
  const aviso = document.createElement('div');
  aviso.className = 'aviso';
  aviso.textContent = 'Haz clic en la parte de la página que quieres comentar · Esc para cancelar';
  raiz.querySelector('.sf')!.append(aviso);
  const cursorAnterior = document.documentElement.style.cursor;
  document.documentElement.style.cursor = 'crosshair';

  return new Promise((resolver) => {
    let bajo: Element | null = null;

    const objetivo = (e: PointerEvent | MouseEvent): Element | null => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      return !el || el === host || el === document.documentElement ? null : el;
    };
    const mover = (e: PointerEvent) => {
      const el = objetivo(e);
      if (el === bajo) return;
      bajo = el;
      resalte.mostrar(el, el ? etiqueta(localizar(el), el) : '');
    };
    // Mientras se señala, la app no recibe clics.
    const bloquear = (e: Event) => {
      if ((e as MouseEvent).composedPath?.().includes(host)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const clic = (e: MouseEvent) => {
      if (e.composedPath().includes(host)) return;
      bloquear(e);
      const el = objetivo(e);
      if (el) terminar(el);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        terminar(null);
      }
    };
    const terminar = (el: Element | null) => {
      document.removeEventListener('pointermove', mover, true);
      for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) document.removeEventListener(t, bloquear, true);
      document.removeEventListener('click', clic, true);
      document.removeEventListener('keydown', tecla, true);
      document.documentElement.style.cursor = cursorAnterior;
      aviso.remove();
      if (!el) resalte.mostrar(null);
      resolver(el);
    };

    document.addEventListener('pointermove', mover, true);
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) document.addEventListener(t, bloquear, true);
    document.addEventListener('click', clic, true);
    document.addEventListener('keydown', tecla, true);
  });
}
