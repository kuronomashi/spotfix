// Comunicación con la ruta de desarrollo (app/api/spotfix).

import type { Estado, Note, NoteInput } from '../shared/note.js';

export type Tema = 'claro' | 'oscuro' | 'sistema';

export interface Config {
  enabled: boolean;
  tema: Tema;
  carpeta: string;
}

export class Transporte {
  constructor(private endpoint: string) {}

  /** La config si el servidor tiene spotfix activo; null si no (en producción o apagado responde 404). */
  async activo(): Promise<Config | null> {
    try {
      const r = await fetch(`${this.endpoint}?accion=estado`, { cache: 'no-store' });
      if (!r.ok) return null;
      const d = await r.json();
      return d.ok === true ? d.config : null;
    } catch {
      return null;
    }
  }

  async guardar(nota: NoteInput): Promise<Note> {
    return (await this.enviar('POST', nota)).nota;
  }

  async estado(id: string, estado: Estado): Promise<Note> {
    return (await this.enviar('PATCH', { id, estado })).nota;
  }

  async configurar(cambios: Partial<Omit<Config, 'enabled'>>): Promise<Config> {
    return (await this.enviar('PATCH', { config: cambios })).config;
  }

  async listar(): Promise<Note[]> {
    const r = await fetch(this.endpoint, { cache: 'no-store' });
    if (!r.ok) throw new Error(`No se pudieron leer las notas (${r.status})`);
    return (await r.json()).notas;
  }

  private async enviar(metodo: string, cuerpo: unknown): Promise<any> {
    const r = await fetch(this.endpoint, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-spotfix': '1' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error || `Error ${r.status}`);
    return datos;
  }
}
