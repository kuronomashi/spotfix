import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { fuenteDePila, resolverComponentes, resolverPagina } from './resolve.js';
import { guardarNota, listarNotas, cambiarEstado, escribirConfig, leerConfig } from './store.js';

let raiz = '';
const escribir = (rel: string, texto = '') => {
  const p = path.join(raiz, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, texto);
};

beforeAll(() => {
  raiz = mkdtempSync(path.join(tmpdir(), 'spotfix-'));
  escribir('app/page.tsx');
  escribir('app/(tienda)/productos/page.tsx');
  escribir('app/(tienda)/productos/[id]/page.tsx');
  escribir('app/(tienda)/productos/nuevo/page.tsx');
  escribir('app/docs/[...slug]/page.tsx');
  escribir('components/Header.tsx', "import x from 'y';\n\nexport function Header() {\n  return null;\n}\n");
  escribir('components/Card.tsx', 'export const Card = ({ a }: P) => null;\n');
  escribir('node_modules/lib/Header.tsx', 'export function Header() {}');
});

describe('resolverPagina', () => {
  it('ruta raíz', async () => expect(await resolverPagina(raiz, '/')).toBe('app/page.tsx'));
  it('grupos transparentes', async () =>
    expect(await resolverPagina(raiz, '/productos')).toBe('app/(tienda)/productos/page.tsx'));
  it('prefiere exacta a dinámica', async () =>
    expect(await resolverPagina(raiz, '/productos/nuevo')).toBe('app/(tienda)/productos/nuevo/page.tsx'));
  it('segmento dinámico', async () =>
    expect(await resolverPagina(raiz, '/productos/42')).toBe('app/(tienda)/productos/[id]/page.tsx'));
  it('catch-all', async () => expect(await resolverPagina(raiz, '/docs/a/b/c')).toBe('app/docs/[...slug]/page.tsx'));
  it('sin coincidencia', async () => expect(await resolverPagina(raiz, '/nada/aqui')).toBeNull());
});

describe('resolverComponentes', () => {
  it('encuentra el primero propio y descarta internos', async () => {
    const r = await resolverComponentes(raiz, ['InnerLayoutRouter', 'Card', 'Header', 'Router']);
    expect(r.componentes).toEqual(['Card', 'Header']);
    expect(r.fuente).toBe('components/Card.tsx:1');
  });
  it('línea correcta', async () => {
    const r = await resolverComponentes(raiz, ['Header']);
    expect(r.fuente).toBe('components/Header.tsx:3');
  });
});

describe('fuenteDePila', () => {
  it('webpack-internal, salta node_modules', async () => {
    const pila = `Error: react-stack-top-frame
    at exports.jsxDEV (webpack-internal:///(app-pages-browser)/./node_modules/react/jsx-dev-runtime.js:10:5)
    at Page (webpack-internal:///(app-pages-browser)/./components/Header.tsx:7:9)`;
    expect(await fuenteDePila(raiz, pila)).toBe('components/Header.tsx:7');
  });
  it('ruta absoluta de _debugSource', async () => {
    expect(await fuenteDePila(raiz, `${path.join(raiz, 'components', 'Card.tsx')}:1`)).toBe('components/Card.tsx:1');
  });
  it('chunks sin mapa: null', async () => {
    expect(await fuenteDePila(raiz, 'at X (http://localhost:3000/_next/static/chunks/a.js:3:1)')).toBeNull();
  });
});

describe('store', () => {
  it('guarda, lista y marca como hecha', async () => {
    const png = 'data:image/png;base64,' + Buffer.from('fake').toString('base64');
    const n = await guardarNota(
      raiz,
      { tipo: 'bug', texto: 'Hola', seccion: '/productos', capturas: [png], fecha: '2026-10-24T10:00:00-05:00' },
      { plataforma: 'next', componente: 'Card' },
    );
    expect(n.archivo).toBe('.spotfix/notas/2026-10-24/2026-10-24T10-00-00_productos_card.md');
    expect(n.capturas).toEqual(['img/2026-10-24T10-00-00_productos_card_1.png']);
    const lista = await listarNotas(raiz);
    expect(lista).toHaveLength(1);
    expect((await cambiarEstado(raiz, n.id, 'hecha')).estado).toBe('hecha');
    expect((await listarNotas(raiz))[0].estado).toBe('hecha');
  });
  it('config: tema y carpeta propia', async () => {
    const c = await escribirConfig(raiz, { tema: 'oscuro', carpeta: 'docs/notas-ia' });
    expect(c).toEqual({ enabled: true, tema: 'oscuro', carpeta: 'docs/notas-ia' });
    const n = await guardarNota(raiz, { tipo: 'bug', texto: 'otra', seccion: '/' }, { plataforma: 'next' });
    expect(n.archivo.startsWith('docs/notas-ia/')).toBe(true);
    expect((await listarNotas(raiz)).map((x) => x.texto)).toEqual(['otra']);
    expect((await cambiarEstado(raiz, n.id, 'hecha')).estado).toBe('hecha');
    await escribirConfig(raiz, { carpeta: '' });
    expect((await leerConfig(raiz)).carpeta).toBe('.spotfix/notas');
  });
  it('rechaza imágenes que no son png/jpeg', async () => {
    await expect(
      guardarNota(raiz, { tipo: 'bug', texto: 'x', seccion: '/', capturas: ['data:image/svg+xml;base64,AAA='] }, { plataforma: 'next' }),
    ).rejects.toThrow(/PNG o JPEG/);
  });
});
