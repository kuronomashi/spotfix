import { describe, expect, it } from 'vitest';
import { compileMarkdown, fechaSegura, fileBase, parseNote, serializeNote, slug, type NoteMeta } from './note.js';

const meta: NoteMeta = {
  id: '20261024-153210-a1b2',
  fecha: '2026-10-24T15:32:10-05:00',
  tipo: 'bug',
  estado: 'abierta',
  plataforma: 'next',
  seccion: '/ajustes/perfil',
  archivo_ruta: 'app/ajustes/perfil/page.tsx',
  componente: 'Header < PerfilLayout',
  fuente: 'components/Header.tsx:12',
  texto_visible: 'Línea con "comillas": y dos puntos',
  capturas: ['img/a_1.png'],
};

describe('nota', () => {
  it('serializa y vuelve a leer igual', () => {
    const md = serializeNote(meta, 'El botón se sale.\nSegunda línea');
    const n = parseNote(md, '.spotfix/notas/2026-10-24/a.md')!;
    expect(n).toMatchObject({ ...meta, texto: 'El botón se sale.\nSegunda línea' });
  });

  it('lee archivos con fin de línea de Windows', () => {
    const md = serializeNote(meta, 'Hola').replace(/\n/g, '\r\n');
    expect(parseNote(md, 'x.md')?.seccion).toBe('/ajustes/perfil');
  });

  it('slug quita acentos y símbolos', () => {
    expect(slug('/Ajustes/Perfil Público')).toBe('ajustes-perfil-publico');
    expect(slug('/')).toBe('raiz');
    expect(slug('../../etc')).toBe('etc');
  });

  it('nombre de archivo', () => {
    expect(fileBase(meta.fecha, meta.seccion, meta.componente)).toBe('2026-10-24T15-32-10_ajustes-perfil_header');
  });

  it('rechaza fechas raras', () => {
    expect(fechaSegura('2026-10-24T15:32:10-05:00')).toBe('2026-10-24T15:32:10-05:00');
    expect(fechaSegura('../../x')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('compila agrupado por día y sección y omite las hechas', () => {
    const notas = [
      { ...meta, texto: 'uno', archivo: '.spotfix/notas/2026-10-24/a.md' },
      { ...meta, id: 'b', estado: 'hecha' as const, texto: 'dos', archivo: '.spotfix/notas/2026-10-24/b.md' },
      { ...meta, id: 'c', seccion: '/', archivo_ruta: null, componente: null, fuente: null, capturas: [], texto: 'tres', fecha: '2026-10-25T09:00:00-05:00', archivo: '.spotfix/notas/2026-10-25/c.md' },
    ];
    const md = compileMarkdown(notas);
    expect(md).toContain('estado: "hecha"');
    expect(md).toContain('## 2026-10-24');
    expect(md).toContain('### /ajustes/perfil  (app/ajustes/perfil/page.tsx)');
    expect(md).toContain('`components/Header.tsx:12`');
    expect(md).toContain('Captura: .spotfix/notas/2026-10-24/img/a_1.png');
    expect(md).not.toContain('dos');
    expect(md).toContain('## 2026-10-25');
    expect(md).toContain('(página completa)');
    expect(compileMarkdown(notas, { todas: true })).toContain('dos');
  });
});
