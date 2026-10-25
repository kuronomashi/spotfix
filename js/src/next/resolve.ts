// Traduce lo que ve el navegador (ruta, nombres de componentes) a archivos del proyecto.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const PAGINAS = ['page.tsx', 'page.jsx', 'page.ts', 'page.js', 'page.mdx'];
const IGNORAR = new Set([
  'node_modules', '.next', '.git', '.spotfix', 'dist', 'build', 'out', 'coverage', 'public', '.turbo', '.vercel',
]);
const EXT = /\.(tsx|jsx|ts|js|mjs)$/;

const aPosix = (p: string) => p.split(path.sep).join('/');

async function hijos(dir: string): Promise<string[]> {
  try {
    const e = await fs.readdir(dir, { withFileTypes: true });
    return e.filter((x) => x.isDirectory()).map((x) => x.name);
  } catch {
    return [];
  }
}

async function paginaEn(dir: string): Promise<string | null> {
  for (const p of PAGINAS) {
    try {
      await fs.access(path.join(dir, p));
      return path.join(dir, p);
    } catch {}
  }
  return null;
}

/** Busca el page.* del App Router que atiende `segs`. Prefiere coincidencias exactas a dinámicas. */
async function buscar(dir: string, segs: string[]): Promise<string | null> {
  if (segs.length === 0) {
    const p = await paginaEn(dir);
    if (p) return p;
  }
  const nombres = await hijos(dir);
  const transparentes = nombres.filter((n) => /^\(.+\)$/.test(n) || n.startsWith('@'));
  const [primero, ...resto] = segs;

  if (primero !== undefined) {
    const exacto = nombres.find((n) => n === primero);
    if (exacto) {
      const r = await buscar(path.join(dir, exacto), resto);
      if (r) return r;
    }
  }
  for (const t of transparentes) {
    const r = await buscar(path.join(dir, t), segs);
    if (r) return r;
  }
  if (primero !== undefined) {
    for (const n of nombres.filter((n) => /^\[[^.\[\]]+\]$/.test(n))) {
      const r = await buscar(path.join(dir, n), resto);
      if (r) return r;
    }
    for (const n of nombres.filter((n) => /^\[\.\.\..+\]$/.test(n))) {
      const p = await paginaEn(path.join(dir, n));
      if (p) return p;
    }
  }
  for (const n of nombres.filter((n) => /^\[\[\.\.\..+\]\]$/.test(n))) {
    const p = await paginaEn(path.join(dir, n));
    if (p) return p;
  }
  return null;
}

export async function resolverPagina(raiz: string, pathname: string): Promise<string | null> {
  const segs = pathname
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  for (const base of ['app', 'src/app']) {
    const dir = path.join(raiz, base);
    try {
      await fs.access(dir);
    } catch {
      continue;
    }
    const r = await buscar(dir, segs);
    if (r) return aPosix(path.relative(raiz, r));
  }
  return null;
}

interface Archivo {
  rel: string;
  texto: string;
}

let cache: { raiz: string; hora: number; archivos: Archivo[] } | null = null;

async function leerProyecto(raiz: string): Promise<Archivo[]> {
  if (cache && cache.raiz === raiz && Date.now() - cache.hora < 5000) return cache.archivos;
  const archivos: Archivo[] = [];
  const pila = [raiz];
  while (pila.length && archivos.length < 5000) {
    const dir = pila.pop()!;
    let entradas;
    try {
      entradas = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (e.isSymbolicLink()) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!IGNORAR.has(e.name) && !e.name.startsWith('.')) pila.push(p);
      } else if (e.isFile() && EXT.test(e.name) && !e.name.endsWith('.d.ts')) {
        try {
          const st = await fs.stat(p);
          if (st.size > 500_000) continue;
          archivos.push({ rel: aPosix(path.relative(raiz, p)), texto: await fs.readFile(p, 'utf8') });
        } catch {}
      }
    }
  }
  cache = { raiz, hora: Date.now(), archivos };
  return archivos;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lineaDe(texto: string, indice: number): number {
  let n = 1;
  for (let i = 0; i < indice; i++) if (texto.charCodeAt(i) === 10) n++;
  return n;
}

export interface Ubicacion {
  /** Solo los componentes definidos en el proyecto, del más interno al más externo. */
  componentes: string[];
  fuente: string | null;
}

/** Busca dónde se define cada componente. Descarta los que no son del proyecto (Next, librerías). */
export async function resolverComponentes(raiz: string, nombres: string[]): Promise<Ubicacion> {
  const archivos = await leerProyecto(raiz);
  const propios: string[] = [];
  let fuente: string | null = null;
  for (const nombre of nombres.slice(0, 30)) {
    if (!/^[A-Z][A-Za-z0-9_$]*$/.test(nombre) || propios.includes(nombre)) continue;
    const n = escapar(nombre);
    const re = new RegExp(
      `(?:function\\s+${n}\\s*[(<]|(?:const|let|var)\\s+${n}\\s*(?::[^=]+)?=|class\\s+${n}\\b)`,
    );
    for (const a of archivos) {
      const m = re.exec(a.texto);
      if (m) {
        propios.push(nombre);
        if (!fuente) fuente = `${a.rel}:${lineaDe(a.texto, m.index)}`;
        break;
      }
    }
  }
  return { componentes: propios, fuente };
}

/**
 * Saca archivo:línea de una pila o de `_debugSource`: acepta `webpack-internal:///(x)/./ruta:12:3`
 * y rutas absolutas dentro del proyecto. Devuelve el primer marco que sea código del proyecto.
 */
export async function fuenteDePila(raiz: string, cruda: string | null | undefined): Promise<string | null> {
  if (!cruda) return null;
  const raizPosix = aPosix(path.resolve(raiz)).toLowerCase();
  const re = /((?:[A-Za-z]:)?[^\s()?]*?\.(?:tsx|jsx|ts|js)):(\d+)/g;
  for (const m of cruda.slice(0, 5000).matchAll(re)) {
    let p = m[1].replace(/\\/g, '/');
    let rel: string;
    const interno = p.indexOf('/./');
    const url = /^https?:\/\/[^/]+\/(.+)$/.exec(p);
    if (interno >= 0) rel = p.slice(interno + 3);
    // Vite sirve los fuentes tal cual: http://localhost:5173/src/App.tsx:12:5
    else if (url) rel = url[1];
    else if (p.toLowerCase().startsWith(raizPosix + '/')) rel = p.slice(raizPosix.length + 1);
    else continue;
    rel = path.posix.normalize(rel);
    if (rel.startsWith('..') || rel.includes('node_modules') || rel.startsWith('.next')) continue;
    try {
      await fs.access(path.join(raiz, rel));
      return `${rel}:${m[2]}`;
    } catch {}
  }
  return null;
}
