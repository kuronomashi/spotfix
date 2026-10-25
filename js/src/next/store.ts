// Lectura y escritura en disco. config.json y LEEME-IA.md viven siempre en <raiz>/.spotfix;
// las notas van a la carpeta de config.json (por defecto <raiz>/.spotfix/notas).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LEEME_IA } from '../shared/leeme.js';
import {
  dia, fechaSegura, fileBase, makeId, parseNote, serializeNote,
  type Estado, type Note, type NoteInput, type NoteMeta,
} from '../shared/note.js';

const MAX_TEXTO = 50_000;
const MAX_CAMPO = 500;
const MAX_IMAGEN = 5 * 1024 * 1024;
const MAX_CAPTURAS = 5;
export const CARPETA_DEFECTO = '.spotfix/notas';

export type Tema = 'claro' | 'oscuro' | 'sistema';

export interface Config {
  enabled: boolean;
  tema: Tema;
  /** Relativa a la raíz del proyecto o absoluta. */
  carpeta: string;
}

export class ErrorSpotfix extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

export function carpeta(raiz: string): string {
  return path.join(raiz, '.spotfix');
}

const rutaConfig = (raiz: string) => path.join(carpeta(raiz), 'config.json');

export async function leerConfig(raiz: string): Promise<Config> {
  let c: any = {};
  try {
    c = JSON.parse(await fs.readFile(rutaConfig(raiz), 'utf8'));
  } catch {}
  return {
    enabled: c.enabled !== false,
    tema: c.tema === 'claro' || c.tema === 'oscuro' ? c.tema : 'sistema',
    carpeta: typeof c.carpeta === 'string' && c.carpeta.trim() ? c.carpeta.trim() : CARPETA_DEFECTO,
  };
}

/** Mezcla los cambios con la config actual y la guarda. Valida cada campo. */
export async function escribirConfig(raiz: string, cambios: Partial<Config>): Promise<Config> {
  const actual = await leerConfig(raiz);
  const nueva: Config = { ...actual };
  if (typeof cambios.enabled === 'boolean') nueva.enabled = cambios.enabled;
  if (cambios.tema === 'claro' || cambios.tema === 'oscuro' || cambios.tema === 'sistema') nueva.tema = cambios.tema;
  if (typeof cambios.carpeta === 'string') {
    const c = cambios.carpeta.trim();
    if (c.length > 300 || c.includes('\0')) throw new ErrorSpotfix(400, 'Carpeta inválida');
    nueva.carpeta = c || CARPETA_DEFECTO;
  }
  await fs.mkdir(carpeta(raiz), { recursive: true });
  await fs.writeFile(rutaConfig(raiz), JSON.stringify(nueva, null, 2) + '\n');
  return nueva;
}

/** Carpeta absoluta de las notas según config.json. */
export async function dirNotas(raiz: string): Promise<string> {
  return path.resolve(raiz, (await leerConfig(raiz)).carpeta);
}

/** Ruta para mostrar y guardar en `archivo`: relativa a la raíz con /, o absoluta si está fuera. */
function mostrar(raiz: string, absoluta: string): string {
  const rel = path.relative(raiz, absoluta);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : absoluta;
}

export async function asegurarCarpeta(raiz: string): Promise<void> {
  const c = carpeta(raiz);
  await fs.mkdir(c, { recursive: true });
  const leeme = path.join(c, 'LEEME-IA.md');
  // Lo genera spotfix: se actualiza si cambia la versión de la librería.
  const actual = await fs.readFile(leeme, 'utf8').catch(() => null);
  if (actual !== LEEME_IA) await fs.writeFile(leeme, LEEME_IA);
  try {
    await fs.access(rutaConfig(raiz));
  } catch {
    await escribirConfig(raiz, {});
  }
  await fs.mkdir(await dirNotas(raiz), { recursive: true });
}

const recorta = (s: unknown, max = MAX_CAMPO): string | null =>
  typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : null;

function decodificarImagen(dataUrl: unknown): { ext: string; datos: Buffer } {
  if (typeof dataUrl !== 'string') throw new ErrorSpotfix(400, 'Captura inválida');
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ErrorSpotfix(400, 'Solo se aceptan capturas PNG o JPEG');
  const datos = Buffer.from(m[2], 'base64');
  if (datos.length > MAX_IMAGEN) throw new ErrorSpotfix(413, 'Captura de más de 5 MB');
  return { ext: m[1] === 'png' ? 'png' : 'jpg', datos };
}

async function libre(dir: string, base: string): Promise<string> {
  for (let i = 1; ; i++) {
    const nombre = i === 1 ? base : `${base}-${i}`;
    try {
      await fs.access(path.join(dir, `${nombre}.md`));
    } catch {
      return nombre;
    }
  }
}

export interface Extras {
  plataforma: string;
  archivo_ruta?: string | null;
  componente?: string | null;
  fuente?: string | null;
}

export async function guardarNota(raiz: string, entrada: NoteInput, extras: Extras): Promise<Note> {
  const texto = typeof entrada.texto === 'string' ? entrada.texto.slice(0, MAX_TEXTO) : '';
  const capturas = Array.isArray(entrada.capturas) ? entrada.capturas : [];
  if (!texto.trim() && capturas.length === 0) throw new ErrorSpotfix(400, 'La nota está vacía');
  if (capturas.length > MAX_CAPTURAS) throw new ErrorSpotfix(400, `Máximo ${MAX_CAPTURAS} capturas`);
  const imagenes = capturas.map(decodificarImagen);

  const fecha = fechaSegura(entrada.fecha);
  const seccion = recorta(entrada.seccion, 300) ?? '/';
  await asegurarCarpeta(raiz);
  const dirDia = path.join(await dirNotas(raiz), dia(fecha));
  await fs.mkdir(dirDia, { recursive: true });
  const base = await libre(dirDia, fileBase(fecha, seccion, extras.componente));

  const rutasImg: string[] = [];
  if (imagenes.length) {
    await fs.mkdir(path.join(dirDia, 'img'), { recursive: true });
    for (const [i, img] of imagenes.entries()) {
      const rel = `img/${base}_${i + 1}.${img.ext}`;
      await fs.writeFile(path.join(dirDia, rel), img.datos);
      rutasImg.push(rel);
    }
  }

  const meta: NoteMeta = {
    id: makeId(fecha),
    fecha,
    tipo: entrada.tipo === 'sugerencia' ? 'sugerencia' : 'bug',
    estado: 'abierta',
    plataforma: extras.plataforma,
    seccion,
    archivo_ruta: extras.archivo_ruta ?? null,
    componente: extras.componente ?? null,
    fuente: extras.fuente ?? null,
    selector: recorta(entrada.selector),
    texto_visible: recorta(entrada.texto_visible, 200),
    ventana: typeof entrada.ventana === 'string' && /^\d+x\d+$/.test(entrada.ventana) ? entrada.ventana : null,
    url: recorta(entrada.url),
    capturas: rutasImg,
  };
  const textoFinal = texto.trim() || '(Solo captura)';
  const destino = path.join(dirDia, `${base}.md`);
  await fs.writeFile(destino, serializeNote(meta, textoFinal));
  return { ...meta, texto: textoFinal, archivo: mostrar(raiz, destino) };
}

export async function listarNotas(raiz: string): Promise<Note[]> {
  const dir = await dirNotas(raiz);
  let dias: string[];
  try {
    dias = (await fs.readdir(dir)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  } catch {
    return [];
  }
  const notas: Note[] = [];
  for (const d of dias.sort()) {
    let archivos: string[];
    try {
      archivos = (await fs.readdir(path.join(dir, d))).filter((f) => f.endsWith('.md'));
    } catch {
      continue;
    }
    for (const f of archivos.sort()) {
      const abs = path.join(dir, d, f);
      try {
        const n = parseNote(await fs.readFile(abs, 'utf8'), mostrar(raiz, abs));
        if (n) notas.push(n);
      } catch {}
    }
  }
  return notas;
}

export async function cambiarEstado(raiz: string, id: string, estado: Estado): Promise<Note> {
  const nota = (await listarNotas(raiz)).find((n) => n.id === id);
  if (!nota) throw new ErrorSpotfix(404, 'Nota no encontrada');
  const { texto, archivo, ...meta } = nota;
  meta.estado = estado;
  // `archivo` sale de listarNotas, así que siempre está dentro de la carpeta de notas.
  await fs.writeFile(path.resolve(raiz, archivo), serializeNote(meta, texto));
  return { ...nota, estado };
}
