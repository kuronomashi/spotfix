#!/usr/bin/env node
// npx spotfix init | serve | on | off | remove | status | copy

import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { compileMarkdown } from './shared/note.js';
import { asegurarCarpeta, escribirConfig, leerConfig, listarNotas } from './next/store.js';

const IMPORT = "import { Spotfix } from 'spotfix/react';";
const ETIQUETA = '<Spotfix />';
const RUTA = "export { GET, POST, PATCH } from 'spotfix/next';\n";

const raiz = process.cwd();
const rel = (p: string) => path.relative(raiz, p).split(path.sep).join('/');

function carpetaApp(): string | null {
  for (const c of ['app', 'src/app']) if (existsSync(path.join(raiz, c))) return path.join(raiz, c);
  return null;
}

function archivoLayout(app: string): string | null {
  for (const e of ['tsx', 'jsx', 'js', 'ts']) {
    const p = path.join(app, `layout.${e}`);
    if (existsSync(p)) return p;
  }
  return null;
}

function archivoRuta(app: string): string | null {
  for (const e of ['ts', 'js']) {
    const p = path.join(app, 'api', 'spotfix', `route.${e}`);
    if (existsSync(p)) return p;
  }
  return null;
}

async function preguntar(texto: string, porDefecto: boolean): Promise<boolean> {
  if (!process.stdin.isTTY) return porDefecto;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`${texto} ${porDefecto ? '[S/n]' : '[s/N]'} `)).trim().toLowerCase();
  rl.close();
  return r ? r.startsWith('s') || r.startsWith('y') : porDefecto;
}

// ---------- Vite (React u otro) ----------

const IMPORT_VITE = "import spotfix from 'spotfix/vite';";
const IMPORT_AUTO = "import 'spotfix/auto';";

function primero(dir: string, nombres: string[]): string | null {
  for (const n of nombres) if (existsSync(path.join(dir, n))) return path.join(dir, n);
  return null;
}

const configVite = () => primero(raiz, ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs']);
const entradaVite = () => primero(path.join(raiz, 'src'), ['main.tsx', 'main.jsx', 'main.ts', 'main.js', 'index.tsx', 'index.jsx']);

/** Inserta una línea después del último import. */
function trasImports(texto: string, linea: string): string {
  const imports = [...texto.matchAll(/^import[^\n]*\n/gm)];
  const fin = imports.length ? imports[imports.length - 1].index! + imports[imports.length - 1][0].length : 0;
  return texto.slice(0, fin) + linea + '\n' + texto.slice(fin);
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sinLinea = (texto: string, linea: string) => texto.replace(new RegExp(`^[ \\t]*${escapar(linea)}[ \\t]*\\r?\\n`, 'm'), '');

async function initVite(config: string) {
  let texto = await fs.readFile(config, 'utf8');
  if (texto.includes('spotfix/vite')) {
    console.log(`= ${rel(config)} ya tiene el plugin`);
  } else {
    if (!/plugins\s*:\s*\[/.test(texto)) {
      throw new Error(`${rel(config)} no tiene "plugins: [". Añade a mano: ${IMPORT_VITE} y spotfix() en plugins.`);
    }
    texto = trasImports(texto, IMPORT_VITE).replace(/plugins\s*:\s*\[/, (m) => `${m}spotfix(), `);
    await fs.writeFile(config, texto);
    console.log(`+ ${rel(config)}: plugin spotfix() añadido`);
  }
  const entrada = entradaVite();
  if (!entrada) {
    console.log(`! No encuentro src/main.*: añade ${IMPORT_AUTO} a tu punto de entrada (o usa <Spotfix />).`);
  } else {
    const t = await fs.readFile(entrada, 'utf8');
    if (t.includes('spotfix/auto') || t.includes('spotfix/react')) {
      console.log(`= ${rel(entrada)} ya monta spotfix`);
    } else {
      await fs.writeFile(entrada, trasImports(t, IMPORT_AUTO));
      console.log(`+ ${rel(entrada)}: ${IMPORT_AUTO}`);
    }
  }
}

async function removeVite(config: string) {
  const antes = await fs.readFile(config, 'utf8');
  const despues = sinLinea(antes, IMPORT_VITE).replace(/spotfix\(\s*\)\s*,\s*/, '').replace(/,?\s*spotfix\(\s*\)/, '');
  if (despues !== antes) {
    await fs.writeFile(config, despues);
    console.log(`- ${rel(config)}: plugin quitado`);
  }
  const entrada = entradaVite();
  if (entrada) {
    const t = await fs.readFile(entrada, 'utf8');
    const s = sinLinea(t, IMPORT_AUTO);
    if (s !== t) {
      await fs.writeFile(entrada, s);
      console.log(`- ${rel(entrada)}: ${IMPORT_AUTO} quitado`);
    }
  }
}

async function terminarInit(siguiente: string) {
  await asegurarCarpeta(raiz);
  await escribirConfig(raiz, { enabled: true });
  console.log('+ .spotfix/ listo (config.json y LEEME-IA.md)');

  const gi = path.join(raiz, '.gitignore');
  const actual = existsSync(gi) ? await fs.readFile(gi, 'utf8') : '';
  if (!/^\/?\.spotfix\/?$/m.test(actual) && (await preguntar('¿Añadir .spotfix/ a .gitignore?', true))) {
    await fs.writeFile(gi, actual + (actual && !actual.endsWith('\n') ? '\n' : '') + '.spotfix/\n');
    console.log('+ .gitignore: .spotfix/');
  }
  console.log(`\nListo. Arranca ${siguiente} y verás el botón abajo a la derecha.`);
}

async function serve(args: string[]) {
  const i = args.indexOf('--puerto');
  const puerto = i >= 0 ? Number(args[i + 1]) : 5179;
  // Es una herramienta de desarrollo que se arranca a mano.
  process.env.NODE_ENV = 'development';
  const { createServer } = await import('node:http');
  const { crearMiddleware } = await import('./server/node.js');
  const mw = crearMiddleware({ cors: true, plataforma: 'react' });
  createServer((req, res) => void mw(req, res)).listen(puerto, '127.0.0.1', () => {
    console.log(`spotfix escuchando en http://localhost:${puerto}/api/spotfix (raíz: ${raiz})`);
    console.log(`En tu app:  <Spotfix endpoint="http://localhost:${puerto}/api/spotfix" />`);
  });
}

// ---------- Next ----------

async function init() {
  const vite = configVite();
  if (vite && !carpetaApp()) {
    await initVite(vite);
    return terminarInit('`npm run dev`');
  }
  const app = carpetaApp();
  if (!app) {
    throw new Error(
      'No encuentro app/ (Next) ni vite.config.* (Vite). Para otro bundler usa `npx spotfix serve` y <Spotfix endpoint=... />.',
    );
  }

  const layout = archivoLayout(app);
  if (!layout) throw new Error(`No encuentro ${rel(app)}/layout.*`);
  let texto = await fs.readFile(layout, 'utf8');
  if (texto.includes(ETIQUETA)) {
    console.log(`= ${rel(layout)} ya tiene <Spotfix />`);
  } else {
    if (!texto.includes('</body>')) throw new Error(`${rel(layout)} no tiene </body>; añade <Spotfix /> a mano.`);
    const imports = [...texto.matchAll(/^import[^\n]*\n/gm)];
    const fin = imports.length ? imports[imports.length - 1].index! + imports[imports.length - 1][0].length : 0;
    texto = texto.slice(0, fin) + IMPORT + '\n' + texto.slice(fin);
    texto = texto.replace(/(\s*)<\/body>/, `$1  ${ETIQUETA}$1</body>`);
    await fs.writeFile(layout, texto);
    console.log(`+ ${rel(layout)}: import y <Spotfix /> añadidos`);
  }

  if (archivoRuta(app)) {
    console.log('= la ruta app/api/spotfix ya existe');
  } else {
    const ext = existsSync(path.join(raiz, 'tsconfig.json')) ? 'ts' : 'js';
    const destino = path.join(app, 'api', 'spotfix', `route.${ext}`);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, RUTA);
    console.log(`+ ${rel(destino)} creado`);
  }
  await terminarInit('`next dev`');
}

async function remove() {
  await escribirConfig(raiz, { enabled: false });
  console.log('- spotfix desactivado (.spotfix/config.json)');
  const vite = configVite();
  if (vite) await removeVite(vite);
  const app = carpetaApp();
  if (app) {
    const layout = archivoLayout(app);
    if (layout) {
      const antes = await fs.readFile(layout, 'utf8');
      const despues = antes
        .replace(new RegExp(`^[ \\t]*${IMPORT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n`, 'm'), '')
        .replace(/^[ \t]*<Spotfix\s*\/>[ \t]*\r?\n/m, '')
        .replace(/<Spotfix\s*\/>/, '');
      if (despues !== antes) {
        await fs.writeFile(layout, despues);
        console.log(`- ${rel(layout)}: import y <Spotfix /> quitados`);
      }
    }
    const ruta = archivoRuta(app);
    if (ruta) {
      const dir = path.join(raiz, '.spotfix', 'retirado');
      await fs.mkdir(dir, { recursive: true });
      const destino = path.join(dir, `route-${Date.now()}${path.extname(ruta)}`);
      await fs.rename(ruta, destino);
      console.log(`- ${rel(ruta)} movido a ${rel(destino)}`);
      console.log(`  (la carpeta ${rel(path.dirname(ruta))} queda vacía; bórrala tú si quieres)`);
    }
  }
  console.log('\nLas notas siguen en .spotfix/notas. Para terminar: npm uninstall spotfix');
}

async function status() {
  const { enabled } = await leerConfig(raiz);
  const notas = await listarNotas(raiz);
  const abiertas = notas.filter((n) => n.estado !== 'hecha').length;
  const app = carpetaApp();
  console.log(`spotfix: ${enabled ? 'activo' : 'apagado'}`);
  console.log(`ruta API: ${app && archivoRuta(app) ? rel(archivoRuta(app)!) : 'no existe'}`);
  console.log(`notas: ${notas.length} (${abiertas} abiertas)`);
}

const AYUDA = `spotfix — notas sobre tu app para la IA

  npx spotfix init     integra spotfix: Next (layout + ruta API) o Vite (plugin + import en src/main)
  npx spotfix serve    servidor suelto para otros bundlers (CRA, webpack...); --puerto 5179
  npx spotfix off      lo apaga (botón y API dejan de responder; las notas se quedan)
  npx spotfix on       lo vuelve a encender
  npx spotfix remove   lo quita del código (las notas se quedan) y lo deja apagado
  npx spotfix status   estado y número de notas
  npx spotfix copy     imprime las notas abiertas en Markdown (añade --todas para incluir hechas)
`;

async function main() {
  const [orden, ...resto] = process.argv.slice(2);
  switch (orden) {
    case 'init': return init();
    case 'serve': return serve(resto);
    case 'on': await escribirConfig(raiz, { enabled: true }); return console.log('spotfix encendido');
    case 'off': await escribirConfig(raiz, { enabled: false }); return console.log('spotfix apagado');
    case 'remove': return remove();
    case 'status': return status();
    case 'copy': return void process.stdout.write(compileMarkdown(await listarNotas(raiz), { todas: resto.includes('--todas') }));
    default: console.log(AYUDA);
  }
}

main().catch((e) => {
  console.error(`spotfix: ${(e as Error).message}`);
  process.exit(1);
});
