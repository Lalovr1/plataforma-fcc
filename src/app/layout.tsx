/**
 * RootLayout:
 * - Define la fuente principal y estilos globales.
 * - Aplica el tema guardado antes de renderizar la app.
 * - Incluye el Toaster para mostrar notificaciones en toda la app.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FCC Academy",
  description: "Plataforma educativa FCC",
};

const themeScript = `
(function () {
  try {
    var tema = "claro";
    var saved = localStorage.getItem("preferencias_usuario");

    if (saved) {
      var prefs = JSON.parse(saved);
      if (prefs && (prefs.tema === "oscuro" || prefs.tema === "claro")) {
        tema = prefs.tema;
      }
    }

    document.documentElement.classList.remove("theme-claro", "theme-oscuro");
    document.documentElement.classList.add("theme-" + tema);

    if (document.body) {
      document.body.classList.remove("theme-claro", "theme-oscuro");
      document.body.classList.add("theme-" + tema);
    }
  } catch (e) {
    document.documentElement.classList.remove("theme-claro", "theme-oscuro");
    document.documentElement.classList.add("theme-claro");

    if (document.body) {
      document.body.classList.remove("theme-claro", "theme-oscuro");
      document.body.classList.add("theme-claro");
    }
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.className} overflow-x-hidden min-w-0`}
        style={{
          backgroundColor: "var(--color-bg)",
          color: "var(--color-text)",
        }}
        suppressHydrationWarning
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  );
}