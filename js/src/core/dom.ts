type Hijo = Node | string | null | undefined | false;

/** Crea un elemento. Las claves `on…` se registran como eventos; el resto como atributos. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, any> = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'className') el.className = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of hijos) if (c) el.append(c);
  return el;
}

export async function copiar(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = document.createElement('textarea');
    t.value = texto;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}
