import { Cabecera } from './components/Cabecera';
import { Tarjeta } from './components/Tarjeta';

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <Cabecera />
      <main style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 800 }}>
        <Tarjeta titulo="Camiseta" precio={20} />
        <Tarjeta titulo="Gorra" precio={12} />
      </main>
    </div>
  );
}
