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
    <html lang="es">
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  );
}
