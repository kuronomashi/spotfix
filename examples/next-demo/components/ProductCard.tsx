'use client';

import { useState } from 'react';

export function ProductCard({ nombre, precio }: { nombre: string; precio: number }) {
  const [enCarrito, setEnCarrito] = useState(false);
  return (
    <div className="card">
      <h3>{nombre}</h3>
      <p>${precio}</p>
      <button onClick={() => setEnCarrito(!enCarrito)}>{enCarrito ? 'Quitar' : 'Añadir al carrito'}</button>
    </div>
  );
}
