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
  var temaDefault = "claro";

  var temasValidos = [
    "claro",
    "blanco",
    "oscuro",
    "gris",
    "esmeralda",
    "morado",
    "indigo",
    "rojo",
    "rosa"
  ];

  var clasesTema = temasValidos.map(function (tema) {
    return "theme-" + tema;
  });

  function aplicarTema(tema) {
    var clase = "theme-" + tema;

    document.documentElement.classList.remove.apply(
      document.documentElement.classList,
      clasesTema
    );

    document.documentElement.classList.add(clase);

    if (document.body) {
      document.body.classList.remove.apply(document.body.classList, clasesTema);
      document.body.classList.add(clase);
    }
  }

  try {
    var tema = temaDefault;

    var rutasPublicas = ["/login", "/register", "/reset-password"];
    var esRutaPublica = rutasPublicas.some(function (ruta) {
      return window.location.pathname === ruta || window.location.pathname.startsWith(ruta + "/");
    });

    if (!esRutaPublica) {
      var saved = localStorage.getItem("preferencias_usuario");

      if (saved) {
        var prefs = JSON.parse(saved);

        if (prefs && temasValidos.indexOf(prefs.tema) >= 0) {
          tema = prefs.tema;
        } else {
          console.error("[FCC Academy] Tema inválido en preferencias_usuario:", prefs && prefs.tema);
        }
      }
    }

    aplicarTema(tema);
  } catch (e) {
    console.error("[FCC Academy] No se pudo aplicar el tema inicial:", e);
    aplicarTema(temaDefault);
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
          <Toaster
            position="bottom-right"
            gutter={10}
            containerStyle={{
              zIndex: 999999,
            }}
            toastOptions={{
              duration: 3200,
              style: {
                maxWidth: "420px",
                borderRadius: "16px",
                padding: "12px 14px",
                background: "var(--fcc-premium-surface)",
                color: "var(--fcc-premium-text)",
                border: "1px solid var(--fcc-premium-border)",
                boxShadow: "var(--fcc-premium-shadow-hover)",
                fontWeight: 750,
                lineHeight: 1.25,
              },
              success: {
                iconTheme: {
                  primary: "var(--fcc-premium-accent)",
                  secondary: "var(--fcc-premium-surface)",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "var(--fcc-premium-surface)",
                },
                style: {
                  border: "1px solid color-mix(in srgb, #ef4444 34%, var(--fcc-premium-border))",
                },
              },
            }}
          />
      </body>
    </html>
  );
}