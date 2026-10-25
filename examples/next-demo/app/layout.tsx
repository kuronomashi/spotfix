import type { ReactNode } from 'react';
import { Header } from '../components/Header';
import './globals.css';
import { Spotfix } from 'spotfix/react';

export const metadata = { title: 'spotfix demo' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main>{children}</main>
        <Spotfix />
      </body>
    </html>
  );
}
