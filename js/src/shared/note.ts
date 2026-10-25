// Formato común de notas (ver spec/formato.md). Sin dependencias: lo usan el navegador y el servidor.

export type Tipo = 'bug' | 'sugerencia';
export type Estado = 'abierta' | 'hecha';

/** Lo que manda el navegador al guardar. */
export interface NoteInput {
  tipo: Tipo;
  texto: string;
  seccion: string;
  componentes?: string[];
  fuente_cruda?: string | null;
  selector?: string | null;
  texto_visible?: string | null;
  ventana?: string | null;
  url?: string | null;
  /** data:image/png;base64,... */
  capturas?: string[];
  /** Fecha local del navegador en ISO con zona. */
  fecha?: string;
}

/** Cabecera tal y como queda en disco. */
export interface NoteMeta {
  id: string;
  fecha: string;
  tipo: Tipo;
  estado: Estado;
  plataforma: string;
  seccion: string;
  archivo_ruta?: string | null;
  componente?: string | null;
  fuente?: string | null;
  selector?: string | null;
  texto_visible?: string | null;
  ventana?: string | null;
  url?: string | null;
  capturas?: string[];
}

export interface Note extends NoteMeta {
  texto: string;
  /** Ruta relativa a la raíz del proyecto, p. ej. .spotfix/notas/2026-10-24/x.md */
  archivo: string;
}

const ORDEN: (keyof NoteMeta)[] = [
  'id', 'fecha', 'tipo', 'estado', 'plataforma', 'seccion', 'archivo_ruta', 'componente',
  'fuente', 'selector', 'texto_visible', 'ventana', 'url', 'capturas',
];

export function serializeNote(meta: NoteMeta, texto: string): string {
  const lineas = ['---'];
  for (const k of ORDEN) {
    const v = meta[k];
    if (v === undefined) continue;
    lineas.push(`${k}: ${JSON.stringify(v)}`);
  }
  lineas.push('---', '', texto.trim(), '');
  return lineas.join('\n');
}

export function parseNote(contenido: string, archivo: string): Note | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(contenido);
  if (!m) return null;
  const meta: Record<string, unknown> = {};
  for (const linea of m[1].split(/\r?\n/)) {
    const i = linea.indexOf(':');
    if (i < 1) continue;
    const clave = linea.slice(0, i).trim();
    const crudo = linea.slice(i + 1).trim();
    try {
      meta[clave] = JSON.parse(crudo);
    } catch {
      meta[clave] = crudo;
    }
  }
  if (typeof meta.id !== 'string' || typeof meta.fecha !== 'string') return null;
  return { ...(meta as unknown as NoteMeta), texto: m[2].trim(), archivo };
}

export function slug(s: string, max = 40): string {
  const r = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return r || 'raiz';
}

const dos = (n: number) => String(n).padStart(2, '0');

/** ISO local con zona: 2026-10-24T15:32:10-05:00 */
export function localIso(d = new Date()): string {
  const off = -d.getTimezoneOffset();
  const signo = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return (
    `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` +
    `T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}` +
    `${signo}${dos(Math.floor(a / 60))}:${dos(a % 60)}`
  );
}

/** Acepta solo ISO con forma AAAA-MM-DDTHH:MM:SS(+zona); si no, usa la hora del servidor. */
export function fechaSegura(f: string | undefined): string {
  if (f && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/.test(f)) return f;
  return localIso();
}

export function dia(fecha: string): string {
  return fecha.slice(0, 10);
}

export function makeId(fecha: string): string {
  const azar = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${fecha.slice(0, 10).replace(/-/g, '')}-${fecha.slice(11, 19).replace(/:/g, '')}-${azar}`;
}

export function fileBase(fecha: string, seccion: string, componente?: string | null): string {
  const hora = fecha.slice(0, 19).replace(/:/g, '-');
  const comp = componente ? '_' + slug(componente.split(' < ')[0], 30) : '';
  return `${hora}_${slug(seccion)}${comp}`;
}

export interface CompileOptions {
  /** Incluir también las notas hechas. */
  todas?: boolean;
  /** Limitar a una sección. */
  seccion?: string;
}

/** Va al principio del texto copiado: así la IA cierra cada nota al terminarla. */
export const INSTRUCCION_IA =
  '> Al resolver cada nota, abre su archivo (línea "Nota:") y cambia `estado: "abierta"` por ' +
  '`estado: "hecha"`. No borres la nota. Las notas hechas dejan de aparecer en spotfix.';

/** Texto agrupado por día y sección para pegar a la IA. */
export function compileMarkdown(notas: Note[], opts: CompileOptions = {}): string {
  const elegidas = notas
    .filter((n) => opts.todas || n.estado !== 'hecha')
    .filter((n) => !opts.seccion || n.seccion === opts.seccion)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (elegidas.length === 0) return '# Notas de spotfix\n\n(No hay notas abiertas.)\n';

  const porDia = new Map<string, Map<string, Note[]>>();
  for (const n of elegidas) {
    const d = dia(n.fecha);
    if (!porDia.has(d)) porDia.set(d, new Map());
    const secciones = porDia.get(d)!;
    if (!secciones.has(n.seccion)) secciones.set(n.seccion, []);
    secciones.get(n.seccion)!.push(n);
  }

  const out = ['# Notas de spotfix', '', INSTRUCCION_IA, ''];
  for (const [d, secciones] of porDia) {
    out.push(`## ${d}`, '');
    for (const [sec, lista] of secciones) {
      const archivo = lista.find((n) => n.archivo_ruta)?.archivo_ruta;
      out.push(`### ${sec}${archivo ? `  (${archivo})` : ''}`, '');
      for (const n of lista) {
        const donde = [n.componente ? `**${n.componente}**` : null, n.fuente ? `\`${n.fuente}\`` : null]
          .filter(Boolean)
          .join(' — ');
        out.push(`- [${n.tipo}]${n.estado === 'hecha' ? ' (hecha)' : ''} ${donde || '(página completa)'}`);
        if (n.selector && !n.fuente) out.push(`  Selector: \`${n.selector}\``);
        for (const linea of n.texto.split(/\r?\n/)) out.push(`  ${linea}`);
        const carpeta = n.archivo.replace(/[^/]+$/, '');
        for (const c of n.capturas ?? []) out.push(`  Captura: ${carpeta}${c}`);
        out.push(`  Nota: ${n.archivo}`);
        out.push('');
      }
    }
  }
  return out.join('\n');
}
