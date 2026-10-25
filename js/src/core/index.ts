// Monta el punto flotante dentro de un Shadow DOM para no chocar con los estilos de la app.

import { compileMarkdown } from '../shared/note.js';
import { copiar, h } from './dom.js';
import { icono, punto, ICONOS } from './icons.js';
import { etiqueta, localizar } from './locate.js';
import { crearPanel, type Contexto, type Objetivo, type Vista } from './panel.js';
import { crearResalte, elegirElemento } from './picker.js';
import { CSS } from './styles.js';
import { Transporte, type Tema } from './transport.js';

export interface OpcionesMontaje {
  /** Ruta de la API. Por defecto /api/spotfix. */
  endpoint?: string;
}

const CLAVE_POS = 'spotfix:posicion';
const TAM = 40;

declare global {
  interface Window {
    __spotfix?: { desmontar(): void };
  }
}

function leerPosicion(): { x: number; y: number } {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_POS) || 'null');
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
  } catch {}
  return { x: window.innerWidth - TAM - 20, y: window.innerHeight - TAM - 20 };
}

function guardarPosicion(p: { x: number; y: number }) {
  try {
    localStorage.setItem(CLAVE_POS, JSON.stringify(p));
  } catch {}
}

const limitar = (p: { x: number; y: number }) => ({
  x: Math.max(4, Math.min(window.innerWidth - TAM - 4, p.x)),
  y: Math.max(4, Math.min(window.innerHeight - TAM - 4, p.y)),
});

/** Monta spotfix si el servidor lo tiene activo. Devuelve una función para desmontarlo. */
export async function montar(opciones: OpcionesMontaje = {}): Promise<() => void> {
  if (typeof window === 'undefined') return () => {};
  if (window.__spotfix) return () => window.__spotfix?.desmontar();

  const transporte = new Transporte(opciones.endpoint ?? '/api/spotfix');
  // Se reserva el sitio antes del await para que dos montajes seguidos (StrictMode) no dupliquen.
  let cancelado = false;
  const reserva = {
    desmontar: () => {
      cancelado = true;
      if (window.__spotfix === reserva) delete window.__spotfix;
    },
  };
  window.__spotfix = reserva;
  const config = await transporte.activo();
  if (cancelado) return () => {};
  if (!config) {
    console.info('[spotfix] desactivado: la ruta /api/spotfix no responde (¿producción, apagado o falta route.ts?)');
    reserva.desmontar();
    return () => {};
  }

  const host = document.createElement('spotfix-root');
  host.setAttribute('data-spotfix-ui', '');
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '2147483646', pointerEvents: 'none' });
  const raiz = host.attachShadow({ mode: 'open' });
  raiz.append(h('style', {}, CSS));
  const capa = h('div', { className: 'sf' });
  raiz.append(capa);
  document.body.append(host);

  // Tema: claro, oscuro o el del sistema (y lo sigue si cambia).
  const oscuroSistema = window.matchMedia('(prefers-color-scheme: dark)');
  let tema: Tema = config.tema;
  const pintarTema = () => {
    const oscuro = tema === 'oscuro' || (tema === 'sistema' && oscuroSistema.matches);
    capa.dataset.tema = oscuro ? 'oscuro' : 'claro';
  };
  pintarTema();
  oscuroSistema.addEventListener('change', pintarTema);

  const resalte = crearResalte(raiz);
  let panel: HTMLElement | null = null;
  let menu: HTMLElement | null = null;
  let pos = limitar(leerPosicion());

  const boton = h('button', { className: 'punto', title: 'spotfix (arrastra para mover)' });
  boton.innerHTML = punto();
  const colocarBoton = () => {
    boton.style.left = `${pos.x}px`;
    boton.style.top = `${pos.y}px`;
  };
  colocarBoton();
  capa.append(boton);

  const avisar = (texto: string) => {
    const a = h('div', { className: 'aviso' });
    a.innerHTML = punto();
    a.append(texto);
    capa.append(a);
    setTimeout(() => a.remove(), 1800);
  };

  const cerrarMenu = () => {
    menu?.remove();
    menu = null;
  };
  const cerrarPanel = () => {
    panel?.remove();
    panel = null;
    resalte.mostrar(null);
    boton.classList.remove('activo');
  };

  // El panel va al lado del botón que tenga más sitio, para no taparlo.
  const colocarPanel = () => {
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const x = pos.x > window.innerWidth / 2 ? pos.x - r.width - 10 : pos.x + TAM + 10;
    const y = pos.y + TAM - r.height;
    panel.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, x))}px`;
    panel.style.top = `${Math.max(8, Math.min(window.innerHeight - r.height - 8, y))}px`;
  };

  const ctx: Contexto = {
    host,
    transporte,
    config,
    cerrarPanel,
    senalar: () => void senalarYAbrir(),
    aplicarTema: (t) => {
      tema = t;
      pintarTema();
    },
    avisar,
  };

  const abrir = (vista: Vista, obj: Objetivo = { el: null, loc: null, nombre: location.pathname }) => {
    cerrarMenu();
    cerrarPanel();
    panel = crearPanel(ctx, vista, obj);
    capa.append(panel);
    colocarPanel();
    new ResizeObserver(colocarPanel).observe(panel);
    boton.classList.add('activo');
    if (obj.el) resalte.mostrar(obj.el, obj.nombre, true);
  };

  async function senalarYAbrir() {
    cerrarMenu();
    cerrarPanel();
    boton.classList.add('activo');
    const el = await elegirElemento(host, raiz, resalte);
    if (!el) {
      boton.classList.remove('activo');
      return;
    }
    const loc = localizar(el);
    abrir('nota', { el, loc, nombre: etiqueta(loc, el) });
  }

  const copiarNotas = async (seccion?: string) => {
    try {
      await copiar(compileMarkdown(await transporte.listar(), { seccion }));
      avisar('Notas copiadas al portapapeles');
    } catch (e) {
      avisar((e as Error).message);
    }
  };

  const abrirMenu = () => {
    if (menu) return cerrarMenu();
    const item = (ic: keyof typeof ICONOS, texto: string, fn: () => void) =>
      h('button', { onclick: () => { cerrarMenu(); fn(); } }, icono(ic), texto);
    menu = h('div', { className: 'menu' },
      item('objetivo', 'Señalar componente', () => void senalarYAbrir()),
      item('pagina', 'Nota de esta página', () => abrir('nota')),
      item('lista', 'Notas almacenadas', () => abrir('notas')),
      h('div', { className: 'sep' }),
      item('copiar', 'Copiar esta sección', () => copiarNotas(location.pathname)),
      item('copiar', 'Copiar todo', () => copiarNotas()),
      h('div', { className: 'sep' }),
      item('ajustes', 'Ajustes', () => abrir('ajustes')),
      item('ocultar', 'Ocultar hasta recargar', () => desmontar()),
    );
    capa.append(menu);
    const r = menu.getBoundingClientRect();
    const izq = pos.x + TAM - r.width < 8 ? pos.x : pos.x + TAM - r.width;
    const arriba = pos.y - r.height - 8 < 8 ? pos.y + TAM + 8 : pos.y - r.height - 8;
    menu.style.left = `${Math.max(8, izq)}px`;
    menu.style.top = `${arriba}px`;
  };

  // Arrastrar: si el puntero se mueve más de 4 px es arrastre, si no es clic.
  let inicio: { x: number; y: number; px: number; py: number } | null = null;
  let arrastrando = false;
  boton.addEventListener('pointerdown', (e) => {
    inicio = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    arrastrando = false;
    boton.setPointerCapture(e.pointerId);
  });
  boton.addEventListener('pointermove', (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (!arrastrando && Math.hypot(dx, dy) < 4) return;
    arrastrando = true;
    cerrarMenu();
    pos = limitar({ x: inicio.px + dx, y: inicio.py + dy });
    colocarBoton();
    colocarPanel();
  });
  boton.addEventListener('pointerup', () => {
    if (arrastrando) guardarPosicion(pos);
    else abrirMenu();
    inicio = null;
  });

  const alRedimensionar = () => {
    pos = limitar(pos);
    colocarBoton();
    colocarPanel();
  };
  const clicFuera = (e: MouseEvent) => {
    if (menu && !e.composedPath().includes(menu) && !e.composedPath().includes(boton)) cerrarMenu();
  };
  window.addEventListener('resize', alRedimensionar);
  document.addEventListener('pointerdown', clicFuera, true);

  function desmontar() {
    window.removeEventListener('resize', alRedimensionar);
    document.removeEventListener('pointerdown', clicFuera, true);
    oscuroSistema.removeEventListener('change', pintarTema);
    host.remove();
    delete window.__spotfix;
  }
  window.__spotfix = { desmontar };
  return desmontar;
}
