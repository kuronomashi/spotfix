// Capturas de pantalla en el navegador. modern-screenshot se carga solo cuando se usa.

const MARGEN = 24;

interface Recorte {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * Renderiza la página entera y recorta la zona pedida (en coordenadas de la ventana).
 * Capturar el elemento suelto falla con elementos pequeños y pierde el contexto; así no.
 */
async function capturarZona(zona: Recorte, ignorar: Element): Promise<string> {
  const { domToCanvas } = await import('modern-screenshot');
  const escala = Math.min(window.devicePixelRatio || 1, 1.5);
  const doc = document.documentElement;
  const lienzo = await domToCanvas(doc, {
    scale: escala,
    width: doc.scrollWidth,
    height: doc.scrollHeight,
    filter: (n) => n !== ignorar,
  });
  const salida = document.createElement('canvas');
  salida.width = Math.round(zona.ancho * escala);
  salida.height = Math.round(zona.alto * escala);
  salida.getContext('2d')!.drawImage(
    lienzo,
    (window.scrollX + zona.x) * escala, (window.scrollY + zona.y) * escala, salida.width, salida.height,
    0, 0, salida.width, salida.height,
  );
  return salida.toDataURL('image/png');
}

/** El elemento con un margen alrededor, limitado a lo visible. */
export function capturarElemento(el: Element, ignorar: Element): Promise<string> {
  const r = el.getBoundingClientRect();
  const x = Math.max(0, r.left - MARGEN);
  const y = Math.max(0, r.top - MARGEN);
  const ancho = Math.min(window.innerWidth, r.right + MARGEN) - x;
  const alto = Math.min(window.innerHeight, r.bottom + MARGEN) - y;
  if (ancho < 2 || alto < 2) return capturarVentana(ignorar);
  return capturarZona({ x, y, ancho, alto }, ignorar);
}

/** Lo que se ve ahora mismo en la ventana. */
export function capturarVentana(ignorar: Element): Promise<string> {
  return capturarZona({ x: 0, y: 0, ancho: window.innerWidth, alto: window.innerHeight }, ignorar);
}

/** Archivo o imagen pegada → data URL PNG/JPEG (otros formatos se pasan a PNG). */
export async function imagenADataUrl(archivo: Blob): Promise<string> {
  const leida = await new Promise<string>((ok, mal) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = () => mal(fr.error);
    fr.readAsDataURL(archivo);
  });
  if (/^data:image\/(png|jpeg);/.test(leida)) return leida;
  const img = new Image();
  img.src = leida;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}
