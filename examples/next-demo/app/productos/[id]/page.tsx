import { ProductCard } from '../../../components/ProductCard';

export default async function Producto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <h1>Producto {id}</h1>
      <ProductCard nombre={`Producto ${id}`} precio={10 * Number(id)} />
    </>
  );
}
