// Panel único con cabecera: [Nota | Almacenadas] ... [ajustes] [×]

import { compileMarkdown, localIso, type Note, type NoteInput, type Tipo } from '../shared/note.js';
import { capturarElemento, capturarVentana, imagenADataUrl } from './capture.js';
import { copiar, h } from './dom.js';
import { icono } from './icons.js';
import type { Localizacion } from './locate.js';
import type { Config, Tema, Transporte } from './transport.js';

export type Vista = 'nota' | 'notas' | 'ajustes';

export interface Contexto {
  host: Element;
  transporte: Transporte;
  config: Config;
  cerrarPanel(): void;
  /** Cierra el panel, deja elegir un elemento y vuelve a abrir la nota sobre él. */
  senalar(): void;
  aplicarTema(tema: Tema): void;
  avisar(texto: string): void;
}

export interface Objetivo {
  el: Element | null;
  loc: Localizacion | null;
  nombre: string;
}

const MAX_CAPTURAS = 5;

interface Borrador {
  tipo: Tipo;
  texto: string;
  capturas: string[];
}

export function crearPanel(ctx: Contexto, vistaInicial: Vista, obj: Objetivo): HTMLElement {
  let vista = vistaInicial;
  const borrador: Borrador = { tipo: 'bug', texto: '', capturas: [] };
  let detenerDictado: (() => void) | null = null;

  // Sin chip de estado: los errores y las confirmaciones salen como aviso; lo transitorio no se muestra.
  const ponerEstado = (texto: string, clase: '' | 'ocupado' | 'error' = '') => {
    if (clase === 'error' || texto === 'Copiado' || texto === 'Guardado') ctx.avisar(texto);
  };

  const pestanas = h('div', { className: 'seg' });
  const btnAjustes = h('button', { className: 'icono', title: 'Ajustes' }, icono('ajustes'));
  const cuerpo = h('div', { className: 'cuerpo' });
  const pie = h('div', { className: 'pie' });

  const pintar = () => {
    detenerDictado?.();
    pestanas.replaceChildren(
      ...(['nota', 'notas'] as const).map((v) =>
        h('button', { className: vista === v ? 'on' : '', onclick: () => { vista = v; pintar(); } }, v === 'nota' ? 'Nota' : 'Almacenadas'),
      ),
    );
    btnAjustes.classList.toggle('on', vista === 'ajustes');
    if (vista === 'nota') vistaNota();
    else if (vista === 'notas') vistaNotas();
    else vistaAjustes();
  };
  btnAjustes.addEventListener('click', () => {
    vista = vista === 'ajustes' ? 'nota' : 'ajustes';
    pintar();
  });

  // ---------- Nota ----------
  function vistaNota() {
    const objetivo = obj.el
      ? h('div', { className: 'objetivo' },
          icono('objetivo'),
          h('div', { className: 'info' },
            h('div', { className: 'nombre' }, obj.nombre),
            h('div', { className: 'ruta' }, `${location.pathname} · ${obj.loc?.selector ?? ''}`),
          ),
          h('button', { className: 'btn', onclick: () => ctx.senalar() }, 'Cambiar'),
        )
      : h('div', { className: 'objetivo' },
          icono('pagina'),
          h('div', { className: 'info' },
            h('div', { className: 'nombre' }, 'Esta página'),
            h('div', { className: 'ruta' }, location.pathname),
          ),
          h('button', { className: 'btn', onclick: () => ctx.senalar() }, icono('objetivo'), 'Señalar'),
        );

    const tipos = h('div', { className: 'seg ancho' });
    const pintarTipos = () =>
      tipos.replaceChildren(
        ...([['bug', 'Bug', 'bug'], ['sugerencia', 'Sugerencia', 'sug']] as const).map(([v, t, c]) =>
          h('button', { className: borrador.tipo === v ? 'on' : '', onclick: () => { borrador.tipo = v; pintarTipos(); } },
            h('span', { className: c }, t)),
        ),
      );
    pintarTipos();

    const area = h('textarea', { placeholder: 'Escribe o dicta qué pasa aquí, o qué te gustaría cambiar…' });
    area.value = borrador.texto;
    area.addEventListener('input', () => { borrador.texto = area.value; });
    area.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar.click();
    });
    area.addEventListener('paste', async (e) => {
      const items = Array.from(e.clipboardData?.items ?? []).filter((i) => i.type.startsWith('image/'));
      if (!items.length) return;
      e.preventDefault();
      for (const it of items) {
        const f = it.getAsFile();
        if (f) agregar(await imagenADataUrl(f));
      }
    });

    const caja = h('div', { className: 'caja' }, area);
    const mic = botonDictado(area, (t) => { borrador.texto = t; }, ponerEstado, (fn) => { detenerDictado = fn; });
    if (mic) caja.append(h('div', { className: 'flotante' }, mic));

    const miniaturas = h('div', { className: 'miniaturas' });
    const pintarMiniaturas = () =>
      miniaturas.replaceChildren(
        ...borrador.capturas.map((src, i) =>
          h('div', { className: 'mini' },
            h('img', { src, alt: `Captura ${i + 1}` }),
            h('button', { title: 'Quitar', onclick: () => { borrador.capturas.splice(i, 1); pintarMiniaturas(); } }, '×'),
          ),
        ),
      );
    const agregar = (src: string) => {
      if (borrador.capturas.length >= MAX_CAPTURAS) return ponerEstado(`Máximo ${MAX_CAPTURAS}`, 'error');
      borrador.capturas.push(src);
      pintarMiniaturas();
    };
    pintarMiniaturas();
    const conCaptura = async (fn: () => Promise<string>) => {
      ponerEstado('Capturando…', 'ocupado');
      try {
        agregar(await fn());
        ponerEstado('Listo');
      } catch (e) {
        ponerEstado('Error al capturar', 'error');
        console.warn('[spotfix]', e);
      }
    };

    const archivo = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none' });
    archivo.addEventListener('change', async () => {
      for (const f of Array.from(archivo.files ?? [])) agregar(await imagenADataUrl(f));
      archivo.value = '';
    });

    const herramientas = h('div', { className: 'herramientas' },
      obj.el && h('button', { className: 'btn', onclick: () => conCaptura(() => capturarElemento(obj.el!, ctx.host)) }, icono('camara'), 'Elemento'),
      h('button', { className: 'btn', onclick: () => conCaptura(() => capturarVentana(ctx.host)) }, icono('pantalla'), 'Pantalla'),
      h('button', { className: 'btn', onclick: () => archivo.click() }, icono('imagen'), 'Imagen'),
      archivo,
    );

    const guardar = h('button', { className: 'btn primario' }, icono('check'), 'Guardar');
    guardar.addEventListener('click', async () => {
      if (!borrador.texto.trim() && borrador.capturas.length === 0) return ponerEstado('Nota vacía', 'error');
      guardar.setAttribute('disabled', '');
      ponerEstado('Guardando…', 'ocupado');
      const nota: NoteInput = {
        tipo: borrador.tipo,
        texto: borrador.texto,
        seccion: location.pathname,
        componentes: obj.loc?.componentes ?? [],
        fuente_cruda: obj.loc?.fuente_cruda ?? null,
        selector: obj.loc?.selector ?? null,
        texto_visible: obj.loc?.texto_visible ?? null,
        ventana: `${window.innerWidth}x${window.innerHeight}`,
        url: location.href,
        capturas: borrador.capturas,
        fecha: localIso(),
      };
      try {
        await ctx.transporte.guardar(nota);
        ctx.avisar('Nota guardada');
        ctx.cerrarPanel();
      } catch (e) {
        ponerEstado('Error', 'error');
        ctx.avisar((e as Error).message);
        guardar.removeAttribute('disabled');
      }
    });

    cuerpo.replaceChildren(
      objetivo,
      tipos,
      caja,
      herramientas,
      miniaturas,
      h('div', { className: 'acciones' },
        h('button', { className: 'btn', onclick: () => ctx.cerrarPanel() }, 'Cancelar'),
        guardar,
      ),
    );
    pie.textContent = `Las notas se guardan en ${ctx.config.carpeta} de este proyecto.`;
    setTimeout(() => area.focus(), 0);
  }

  // ---------- Notas ----------
  let soloSeccion = true;
  let verHechas = false;
  function vistaNotas() {
    const lista = h('div', { className: 'lista' }, h('div', { className: 'vacio' }, 'Cargando…'));
    let notas: Note[] = [];

    const filtradas = () =>
      notas
        .filter((n) => !soloSeccion || n.seccion === location.pathname)
        .filter((n) => verHechas || n.estado !== 'hecha');

    const pintarLista = () => {
      const ns = filtradas();
      if (!ns.length) {
        lista.replaceChildren(h('div', { className: 'vacio' }, verHechas ? 'No hay notas.' : 'No hay notas abiertas.'));
        return;
      }
      const grupos = new Map<string, Note[]>();
      for (const n of [...ns].reverse()) {
        if (!grupos.has(n.seccion)) grupos.set(n.seccion, []);
        grupos.get(n.seccion)!.push(n);
      }
      const hijos: HTMLElement[] = [];
      for (const [sec, g] of grupos) {
        if (!soloSeccion) hijos.push(h('div', { className: 'grupo' }, sec));
        for (const n of g) hijos.push(tarjeta(n));
      }
      lista.replaceChildren(...hijos);
    };

    const tarjeta = (n: Note) => {
      const marcar = h('input', { type: 'checkbox', className: 'casilla', checked: n.estado === 'hecha' });
      marcar.addEventListener('change', async () => {
        try {
          const nueva = await ctx.transporte.estado(n.id, marcar.checked ? 'hecha' : 'abierta');
          notas = notas.map((x) => (x.id === n.id ? nueva : x));
          pintarLista();
        } catch (e) {
          ponerEstado(`No se pudo marcar: ${(e as Error).message}`, 'error');
        }
      });
      return h('div', { className: `nota ${n.estado === 'hecha' ? 'hecha' : ''}` },
        h('div', { className: 'fila' },
          h('span', { className: `etq ${n.tipo}` }, n.tipo === 'bug' ? 'BUG' : 'SUGERENCIA'),
          h('label', { className: 'check' }, marcar, 'Hecha'),
        ),
        h('div', { className: 'txt' }, n.texto),
        h('div', { className: 'meta' },
          `${n.fecha.slice(0, 16).replace('T', ' ')} · ${n.componente ?? 'página'}${n.fuente ? ` · ${n.fuente}` : ''}` +
          (n.capturas?.length ? ` · ${n.capturas.length} captura(s)` : '')),
      );
    };

    const alcance = h('div', { className: 'seg' });
    const pintarAlcance = () =>
      alcance.replaceChildren(
        h('button', { className: soloSeccion ? 'on' : '', onclick: () => { soloSeccion = true; pintarAlcance(); pintarLista(); } }, 'Esta sección'),
        h('button', { className: soloSeccion ? '' : 'on', onclick: () => { soloSeccion = false; pintarAlcance(); pintarLista(); } }, 'Todas'),
      );
    pintarAlcance();
    const hechas = h('input', { type: 'checkbox', className: 'casilla', checked: verHechas });
    hechas.addEventListener('change', () => { verHechas = hechas.checked; pintarLista(); });

    const btnCopiar = h('button', { className: 'btn primario' }, icono('copiar'), 'Copiar para la IA');
    btnCopiar.addEventListener('click', async () => {
      await copiar(compileMarkdown(notas, { todas: verHechas, seccion: soloSeccion ? location.pathname : undefined }));
      ponerEstado('Copiado');
    });

    cuerpo.replaceChildren(
      h('div', { className: 'filtros' }, alcance, h('label', { className: 'check' }, hechas, 'Ver hechas')),
      lista,
      h('div', { className: 'acciones' }, btnCopiar),
    );
    pie.textContent = 'Cuando la IA resuelve una nota la marca como hecha y desaparece de aquí.';

    ponerEstado('Cargando…', 'ocupado');
    ctx.transporte.listar().then(
      (r) => { notas = r; pintarLista(); ponerEstado('Listo'); },
      (e) => { lista.replaceChildren(h('div', { className: 'vacio' }, (e as Error).message)); ponerEstado('Error', 'error'); },
    );
  }

  // ---------- Ajustes ----------
  function vistaAjustes() {
    const temas = h('div', { className: 'seg ancho' });
    const pintarTemas = () =>
      temas.replaceChildren(
        ...([['claro', 'Claro'], ['oscuro', 'Oscuro'], ['sistema', 'Sistema']] as const).map(([v, t]) =>
          h('button', {
            className: ctx.config.tema === v ? 'on' : '',
            onclick: async () => {
              ctx.config = { ...ctx.config, tema: v };
              ctx.aplicarTema(v);
              pintarTemas();
              try {
                ctx.config = await ctx.transporte.configurar({ tema: v });
                ponerEstado('Guardado');
              } catch {
                ponerEstado('Error', 'error');
              }
            },
          }, t),
        ),
      );
    pintarTemas();

    const carpeta = h('input', { type: 'text', value: ctx.config.carpeta, spellcheck: 'false' });
    carpeta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') guardarCarpeta.click();
    });
    const guardarCarpeta = h('button', { className: 'btn primario' }, 'Guardar');
    guardarCarpeta.addEventListener('click', async () => {
      ponerEstado('Guardando…', 'ocupado');
      try {
        ctx.config = await ctx.transporte.configurar({ carpeta: carpeta.value });
        carpeta.value = ctx.config.carpeta;
        ponerEstado('Guardado');
      } catch (e) {
        ponerEstado((e as Error).message, 'error');
      }
    });

    cuerpo.replaceChildren(
      h('div', { className: 'campo' }, h('label', {}, 'Tema'), temas),
      h('div', { className: 'campo' },
        h('label', {}, 'Carpeta de las notas'),
        h('div', { className: 'fila-campo' }, carpeta, guardarCarpeta),
        h('div', { className: 'ayuda' },
          'Relativa a la raíz del proyecto o absoluta. Las notas nuevas se guardan ahí; las anteriores se quedan donde estaban.'),
      ),
    );
    pie.textContent = 'Los ajustes se guardan en .spotfix/config.json.';
  }

  const panel = h('div', { className: 'panel' },
    h('div', { className: 'cabeza' },
      pestanas,
      h('div', { className: 'espacio' }),
      btnAjustes,
      h('button', { className: 'icono', title: 'Cerrar', onclick: () => ctx.cerrarPanel() }, icono('cerrar')),
    ),
    cuerpo,
    pie,
  );
  pintar();
  return panel;
}

function botonDictado(
  area: HTMLTextAreaElement,
  alCambiar: (texto: string) => void,
  ponerEstado: (t: string, c?: '' | 'ocupado' | 'error') => void,
  registrarParada: (fn: (() => void) | null) => void,
): HTMLElement | null {
  const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Rec) return null;
  let rec: any = null;
  const btn = h('button', {
    className: 'icono',
    title: 'Dictar. Usa el reconocimiento de voz del navegador (en Chrome el audio lo transcribe Google).',
  }, icono('mic'));
  btn.addEventListener('click', () => {
    if (rec) return rec.stop();
    rec = new Rec();
    rec.lang = navigator.language || 'es-ES';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const t = e.results[i][0].transcript.trim();
        area.value += (area.value && !/\s$/.test(area.value) ? ' ' : '') + t;
        alCambiar(area.value);
      }
    };
    rec.onerror = (e: any) => ponerEstado(`Dictado: ${e.error}`, 'error');
    rec.onend = () => {
      rec = null;
      btn.classList.remove('grabando');
      registrarParada(null);
      ponerEstado('Listo');
    };
    rec.start();
    btn.classList.add('grabando');
    ponerEstado('Escuchando…', 'ocupado');
    registrarParada(() => rec?.stop());
  });
  return btn;
}
