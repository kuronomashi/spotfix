import { ProductCard } from '../components/ProductCard';

export default function Inicio() {
  return (
    <>
      <h1>Productos destacados</h1>
      <ProductCard nombre="Camiseta" precio={20} />
      <ProductCard nombre="Gorra" precio={12} />
      <section className="card" data-spotfix="Banner de ofertas">
        <h2>Ofertas de la semana</h2>
        <p>Este bloque usa data-spotfix para darle un nombre propio.</p>
      </section>
    </>
  );
}
