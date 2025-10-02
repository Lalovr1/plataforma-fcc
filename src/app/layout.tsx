/**
 * RootLayout:
 * - Define la fuente principal y estilos globales.
 * - Incluye el Toaster para mostrar notificaciones en toda la app.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FCC Maths",
  description: "Plataforma educativa FCC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className="theme-claro" // 🚀 Arranca siempre en tema claro por defecto
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} bg-[#f8fafc] text-gray-900`} // 🚀 Fondo claro inicial
      >
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  );
}
