// Estética base: spec/estetica.md. Los dos temas comparten estructura; solo cambian los tokens.
export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: "Segoe UI", -apple-system, system-ui, Roboto, sans-serif; }
.sf {
  --fondo: #FAF9F5; --superficie: #FFFFFF; --hundido: #F0EDE6; --borde: #E5E1D8; --borde-fuerte: #D6D1C6;
  --texto: #2B2A27; --tenue: #7A776F; --acento: #E2A82B; --acento-suave: rgba(226,168,43,.14);
  --acento-texto: #2B2A27; --ok: #6E9F6B; --bug: #C8553D; --sug: #4A7FB5;
  --sombra: 0 12px 32px rgba(40,35,25,.14), 0 2px 6px rgba(40,35,25,.06);
  color: var(--texto); font-size: 13px; line-height: 1.45;
}
.sf[data-tema="oscuro"] {
  --fondo: #262624; --superficie: #2C2B28; --hundido: #30302D; --borde: #3A3936; --borde-fuerte: #4A4945;
  --texto: #ECE9E2; --tenue: #9B978E; --acento: #F2C14E; --acento-suave: rgba(242,193,78,.14);
  --acento-texto: #1F1E1C; --ok: #7FB27B; --bug: #E07A62; --sug: #6FA3D6;
  --sombra: 0 14px 36px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.3);
}
button { font: inherit; color: inherit; }
svg { display: block; }

/* El punto */
.punto { position: fixed; width: 40px; height: 40px; padding: 0; border: 0; background: none; cursor: grab;
  pointer-events: auto; touch-action: none; user-select: none; border-radius: 50%; }
.punto:active { cursor: grabbing; }
.punto svg { width: 40px; height: 40px; transition: transform .15s ease; }
.punto:hover svg, .punto.activo svg { transform: scale(1.08); }

/* Contenedores flotantes */
.menu, .panel { position: fixed; background: var(--fondo); border: 1px solid var(--borde); box-shadow: var(--sombra); pointer-events: auto; }
.menu { border-radius: 12px; padding: 6px; min-width: 220px; display: flex; flex-direction: column; gap: 1px; }
.menu button { all: unset; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer;
  color: var(--texto); font-size: 13px; }
.menu button:hover { background: var(--hundido); }
.menu button svg { width: 16px; height: 16px; color: var(--tenue); flex: none; }
.menu .sep { height: 1px; background: var(--borde); margin: 4px 6px; }

/* Altura máxima: si el contenido no cabe, el cuerpo hace scroll (cabecera y pie quedan fijos). */
.panel { width: min(400px, calc(100vw - 24px)); max-height: min(640px, calc(100vh - 24px)); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; }
.cabeza { flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 12px; border-bottom: 1px solid var(--borde); }
.cabeza .espacio { flex: 1; }
.icono { all: unset; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; cursor: pointer; color: var(--tenue); }
.icono:hover { background: var(--hundido); color: var(--texto); }
.icono.on { color: var(--texto); background: var(--hundido); }
.icono svg { width: 17px; height: 17px; }

/* Control segmentado */
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 9px; background: var(--hundido); border: 1px solid var(--borde); }
.seg button { all: unset; padding: 3px 11px; border-radius: 6px; cursor: pointer; color: var(--tenue); font-size: 12.5px; font-weight: 600; }
.seg button:hover { color: var(--texto); }
.seg button.on { background: var(--superficie); color: var(--texto); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.sf[data-tema="oscuro"] .seg button.on { background: var(--borde); }
.seg.ancho { display: flex; } .seg.ancho button { flex: 1; text-align: center; padding: 5px 0; }
.seg button.on .bug { color: var(--bug); } .seg button.on .sug { color: var(--sug); }

.cuerpo { flex: 1 1 auto; min-height: 0; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.pie { flex: none; padding: 8px 12px 10px; text-align: center; color: var(--tenue); font-size: 11px; }
/* Almacenadas: filtros y botón fijos, la lista hace scroll. */
.lista { flex: 1 1 auto; min-height: 60px; max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin: 0 -4px; padding: 0 4px; }
.cuerpo, .lista { scrollbar-width: thin; scrollbar-color: var(--borde-fuerte) transparent; }
.cuerpo::-webkit-scrollbar, .lista::-webkit-scrollbar { width: 8px; }
.cuerpo::-webkit-scrollbar-thumb, .lista::-webkit-scrollbar-thumb { background: var(--borde-fuerte); border-radius: 8px; border: 2px solid var(--fondo); }
.acciones { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
.acciones .estado { flex: 1; }

/* Objetivo señalado */
.objetivo { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--hundido); border: 1px solid var(--borde); }
.objetivo .info { flex: 1; min-width: 0; }
.objetivo .nombre { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.objetivo .ruta { color: var(--tenue); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.objetivo svg { width: 16px; height: 16px; color: var(--acento); flex: none; }

/* Texto */
.caja { position: relative; }
textarea, input[type=text] { width: 100%; background: var(--superficie); color: var(--texto); border: 1px solid var(--borde);
  border-radius: 10px; padding: 10px 12px; font: inherit; outline: none; transition: border-color .12s, box-shadow .12s; }
textarea { min-height: 150px; resize: vertical; padding-right: 44px; }
textarea::placeholder, input::placeholder { color: var(--tenue); }
textarea:focus, input[type=text]:focus { border-color: var(--acento); box-shadow: 0 0 0 3px var(--acento-suave); }
.caja .flotante { position: absolute; top: 8px; right: 8px; }
.icono.grabando { color: var(--bug); background: var(--acento-suave); }

/* Botones */
.btn { all: unset; display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 8px; cursor: pointer;
  background: var(--hundido); border: 1px solid var(--borde); color: var(--texto); font-size: 12.5px; font-weight: 500; }
.btn:hover { border-color: var(--borde-fuerte); }
.btn svg { width: 15px; height: 15px; color: var(--tenue); }
.btn.primario { background: var(--acento); border-color: var(--acento); color: var(--acento-texto); font-weight: 600; }
.btn.primario:hover { filter: brightness(1.05); }
.btn.primario svg { color: var(--acento-texto); }
.btn[disabled] { opacity: .5; pointer-events: none; }
.herramientas { display: flex; gap: 6px; flex-wrap: wrap; }

.miniaturas { display: flex; gap: 8px; flex-wrap: wrap; }
.mini { position: relative; width: 76px; height: 56px; border-radius: 8px; overflow: hidden; border: 1px solid var(--borde); background: var(--hundido); }
.mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mini button { all: unset; position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 50%; background: rgba(0,0,0,.6);
  color: #fff; display: grid; place-items: center; cursor: pointer; font-size: 12px; line-height: 1; }

.estado { color: var(--tenue); font-size: 12px; }
.estado.error { color: var(--bug); }
.estado.ok { color: var(--ok); }

/* Lista */
.filtros { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.check { display: inline-flex; align-items: center; gap: 6px; color: var(--tenue); font-size: 12px; cursor: pointer; user-select: none; }
/* Casilla propia: cuadro redondeado; marcada, fondo de acento con check blanco. */
.casilla { appearance: none; -webkit-appearance: none; margin: 0; width: 16px; height: 16px; flex: none; cursor: pointer;
  border: 1.5px solid var(--borde-fuerte); border-radius: 5px; background: var(--superficie); display: grid; place-items: center;
  transition: background .12s, border-color .12s; }
.casilla:hover { border-color: var(--acento); }
.casilla:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--acento-suave); }
.casilla:checked { background: var(--acento); border-color: var(--acento); }
.casilla:checked::after { content: ""; width: 4px; height: 8px; border: solid #FFFFFF; border-width: 0 2px 2px 0;
  transform: translateY(-1px) rotate(45deg); }
.grupo { color: var(--tenue); font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; word-break: break-all; }
.nota { border: 1px solid var(--borde); background: var(--superficie); border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; gap: 4px; }
.nota.hecha { opacity: .55; }
.nota .fila { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.nota .meta { color: var(--tenue); font-size: 11.5px; word-break: break-all; }
.nota .txt { white-space: pre-wrap; word-break: break-word; }
.etq { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; }
.etq.bug { color: var(--bug); } .etq.sugerencia { color: var(--sug); }
.vacio { color: var(--tenue); text-align: center; padding: 28px 0; }

/* Ajustes */
.campo { display: flex; flex-direction: column; gap: 6px; }
.campo label { font-weight: 600; font-size: 12.5px; }
.campo .ayuda { color: var(--tenue); font-size: 11.5px; }
.fila-campo { display: flex; gap: 8px; }
.fila-campo input { flex: 1; }

/* Señalar */
.resalte { position: fixed; border: 2px solid var(--acento); background: var(--acento-suave); pointer-events: none; border-radius: 4px; }
.etiqueta { position: absolute; left: -2px; top: -24px; background: var(--acento); color: var(--acento-texto); font-size: 11px;
  font-weight: 600; padding: 3px 7px; border-radius: 5px; white-space: nowrap; }
.aviso { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); background: var(--fondo); color: var(--texto);
  border: 1px solid var(--borde); box-shadow: var(--sombra); padding: 7px 14px; border-radius: 999px; pointer-events: none;
  display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.aviso svg { width: 16px; height: 16px; }
`;
