import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  // spotfix se enlaza desde ../../js; Turbopack necesita ver esa carpeta.
  turbopack: { root: path.join(aqui, '..', '..') },
};
