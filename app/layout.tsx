import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Boletera',
  description: 'Plataforma de boletos para eventos en México',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
