// Iconos en SVG (trazo de 1.8, estilo lucide). punto() es el logo de spotfix (spec/estetica.md).

/** Icono de esquinas (viewBox 512, contenido 64..448). El cuadro de arriba a la derecha tiene un hueco. */
const ESQUINAS =
  'M448 320v128H320v-42.667h85.333V320zm-341.333 0v85.333H192V448H64V320zM64 64v128h42.667v-85.333H192V64zm384 0v128H320V64zm-42.667 42.667h-42.666v42.666h42.666z';

/** El logo: círculo de color sólido con el icono en blanco ocupando el 45 % (spec/estetica.md). */
export function punto(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#F5A623"/>
<path fill="#FFFFFF" fill-rule="evenodd" transform="translate(12 12) scale(.028) translate(-256 -256)" d="${ESQUINAS}"/></svg>`;
}

const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONOS = {
  objetivo: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  pagina: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  lista: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
  copiar: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  ajustes: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  cerrar: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  camara: svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>'),
  pantalla: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  imagen: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  ocultar: svg('<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-2.7 3.6M6.2 6.2A12 12 0 0 0 2 12c1 2.5 5 7 10 7a10 10 0 0 0 4.2-.9"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
};

export function icono(nombre: keyof typeof ICONOS): HTMLElement {
  const s = document.createElement('span');
  s.style.display = 'contents';
  s.innerHTML = ICONOS[nombre];
  return s;
}
