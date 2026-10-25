import Link from 'next/link';

export function Header() {
  return (
    <header className="top">
      <strong>Tienda demo</strong>
      <nav>
        <Link href="/">Inicio</Link>
        <Link href="/productos/1">Producto 1</Link>
        <Link href="/productos/2">Producto 2</Link>
      </nav>
    </header>
  );
}
