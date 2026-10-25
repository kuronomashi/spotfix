export function Tarjeta({ titulo, precio }: { titulo: string; precio: number }) {
  return (
    <div className="card" style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
      <h3>{titulo}</h3>
      <p>${precio}</p>
    </div>
  );
}
