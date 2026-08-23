"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import CargadorFCC from "@/components/CargadorFCC";

const EVENTO_INICIO = "fcc:navegacion-inicio";
const EVENTO_FIN = "fcc:navegacion-fin";
const CLAVE_PENDIENTE = "fcc:navegacion-pendiente";
const DURACION_MINIMA_MS = 1_050;
const VENTANA_ESTABLE_MS = 220;
const INTERVALO_REVISION_MS = 80;
const LIMITE_ESPERA_MS = 30_000;

type ModoIndicador = "pagina" | "pantalla";

type OpcionesIndicador = {
  pantallaCompleta?: boolean;
  destino?: string;
};

type DetalleInicio = {
  mensaje?: string;
  modo?: ModoIndicador;
  destino?: string;
};

type NavegacionPendiente = DetalleInicio & {
  creadaEn: number;
};

function rutaConBusqueda(pathname: string, search = "") {
  return `${pathname}${search ? `?${search}` : ""}`;
}

function guardarPendiente(detalle: DetalleInicio) {
  try {
    const registro: NavegacionPendiente = {
      ...detalle,
      creadaEn: Date.now(),
    };

    window.sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(registro));
  } catch {
    // La navegación sigue funcionando aunque el almacenamiento esté bloqueado.
  }
}

function retirarPendiente() {
  try {
    window.sessionStorage.removeItem(CLAVE_PENDIENTE);
  } catch {
    // sessionStorage es sólo un puente para navegaciones completas.
  }
}

function leerPendiente() {
  try {
    const raw = window.sessionStorage.getItem(CLAVE_PENDIENTE);
    if (!raw) return null;

    const registro = JSON.parse(raw) as NavegacionPendiente;
    if (!registro.creadaEn || Date.now() - registro.creadaEn > 60_000) {
      retirarPendiente();
      return null;
    }

    return registro;
  } catch {
    retirarPendiente();
    return null;
  }
}

function mensajeParaRuta(pathname: string) {
  if (pathname.includes("/ranking")) return "Actualizando el ranking";
  if (pathname.includes("/cursos")) return "Actualizando cursos";
  if (pathname.includes("/amigos")) return "Actualizando amigos";
  if (pathname.includes("/profesores")) return "Actualizando profesores";
  if (pathname.includes("/perfil")) return "Preparando tu perfil";
  if (pathname.includes("/configuracion")) return "Preparando configuración";
  if (pathname.startsWith("/curso/")) return "Sincronizando el curso";
  if (pathname.startsWith("/dashboard/")) return "Preparando tu panel";
  return "Abriendo la sección";
}

function esRutaInterna(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/curso/");
}

export function iniciarIndicadorNavegacionFCC(
  mensaje = "Abriendo la sección",
  opciones: OpcionesIndicador = {}
) {
  if (typeof window === "undefined") return;

  const detalle: DetalleInicio = {
    mensaje,
    modo: opciones.pantallaCompleta ? "pantalla" : "pagina",
    destino: opciones.destino,
  };

  guardarPendiente(detalle);
  window.dispatchEvent(new CustomEvent(EVENTO_INICIO, { detail: detalle }));
}

export function finalizarIndicadorNavegacionFCC() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_FIN));
}

export default function IndicadorNavegacionFCC() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [visible, setVisible] = useState(false);
  const [mensaje, setMensaje] = useState("Abriendo la sección");
  const [modo, setModo] = useState<ModoIndicador>("pagina");
  const activoRef = useRef(false);
  const montadoRef = useRef(false);
  const inicioRef = useRef(0);
  const estableDesdeRef = useRef<number | null>(null);
  const rutaOrigenRef = useRef("");
  const destinoRef = useRef<string | null>(null);
  const comprobacionRef = useRef<number | null>(null);
  const limiteRef = useRef<number | null>(null);
  const historialDiferidoRef = useRef<number | null>(null);

  const detenerComprobacion = useCallback(() => {
    if (comprobacionRef.current !== null) {
      window.clearTimeout(comprobacionRef.current);
      comprobacionRef.current = null;
    }
  }, []);

  const limpiarTemporizadores = useCallback(() => {
    detenerComprobacion();

    if (limiteRef.current !== null) {
      window.clearTimeout(limiteRef.current);
      limiteRef.current = null;
    }
  }, [detenerComprobacion]);

  const finalizar = useCallback(() => {
    limpiarTemporizadores();
    activoRef.current = false;
    estableDesdeRef.current = null;
    destinoRef.current = null;
    setVisible(false);
    document.documentElement.removeAttribute("data-fcc-navigation-pending");
    document.documentElement.removeAttribute("data-fcc-navigation-boot");
    retirarPendiente();
  }, [limpiarTemporizadores]);

  const comprobarEstabilidad = useCallback(
    function comprobar() {
      if (!activoRef.current) return;

      const ahora = performance.now();
      const cumplioMinimo = ahora - inicioRef.current >= DURACION_MINIMA_MS;
      const hayBloqueadores = Boolean(
        document.querySelector(
          [
            ".fcc-loader:not(.fcc-navigation-indicator)",
            '[data-avatar-status="loading"]',
            '[data-avatar-status="updating"]',
            '[class*="skeleton"]',
          ].join(",")
        )
      );

      if (!cumplioMinimo || hayBloqueadores) {
        estableDesdeRef.current = null;
      } else if (estableDesdeRef.current === null) {
        estableDesdeRef.current = ahora;
      } else if (ahora - estableDesdeRef.current >= VENTANA_ESTABLE_MS) {
        finalizar();
        return;
      }

      comprobacionRef.current = window.setTimeout(
        comprobar,
        INTERVALO_REVISION_MS
      );
    },
    [finalizar]
  );

  const confirmarDestino = useCallback(() => {
    if (!activoRef.current) return;

    detenerComprobacion();
    estableDesdeRef.current = null;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!activoRef.current) return;
        comprobarEstabilidad();
      });
    });
  }, [comprobarEstabilidad, detenerComprobacion]);

  const iniciar = useCallback(
    (
      texto?: string,
      nuevoModo: ModoIndicador = "pagina",
      destino?: string,
      destinoYaConfirmado = false
    ) => {
      limpiarTemporizadores();
      activoRef.current = true;
      inicioRef.current = performance.now();
      estableDesdeRef.current = null;
      rutaOrigenRef.current = rutaConBusqueda(
        window.location.pathname,
        window.location.search.replace(/^\?/, "")
      );
      destinoRef.current = destino || null;

      const detalle: DetalleInicio = {
        mensaje: texto?.trim() || "Abriendo la sección",
        modo: nuevoModo,
        destino,
      };

      setMensaje(detalle.mensaje || "Abriendo la sección");
      setModo(nuevoModo);
      setVisible(true);
      document.documentElement.setAttribute(
        "data-fcc-navigation-pending",
        "true"
      );
      guardarPendiente(detalle);

      limiteRef.current = window.setTimeout(finalizar, LIMITE_ESPERA_MS);

      if (destinoYaConfirmado) {
        confirmarDestino();
      }
    },
    [confirmarDestino, finalizar, limpiarTemporizadores]
  );

  useLayoutEffect(() => {
    const rutaActual = rutaConBusqueda(pathname, search);

    if (!montadoRef.current) {
      montadoRef.current = true;
      const pendiente = leerPendiente();

      if (
        pendiente &&
        (!pendiente.destino || pendiente.destino === rutaActual)
      ) {
        iniciar(
          pendiente.mensaje,
          pendiente.modo || "pagina",
          pendiente.destino,
          true
        );
      } else if (esRutaInterna(pathname)) {
        iniciar(mensajeParaRuta(pathname), "pagina", rutaActual, true);
      }

      return;
    }

    if (!activoRef.current) return;

    const destino = destinoRef.current;
    if (
      !destino ||
      destino === rutaActual ||
      rutaActual !== rutaOrigenRef.current
    ) {
      confirmarDestino();
    }
  }, [pathname, search, confirmarDestino, iniciar]);

  useLayoutEffect(() => {
    if (visible) {
      document.documentElement.removeAttribute("data-fcc-navigation-boot");
    }
  }, [visible]);

  useEffect(() => {
    const iniciarPorEvento = (event: Event) => {
      const detail = (event as CustomEvent<DetalleInicio>).detail;
      const destinoYaConfirmado =
        Boolean(detail?.destino) &&
        detail.destino ===
          rutaConBusqueda(
            window.location.pathname,
            window.location.search.replace(/^\?/, "")
          );

      iniciar(
        detail?.mensaje,
        detail?.modo || "pagina",
        detail?.destino,
        destinoYaConfirmado
      );
    };

    const iniciarPorEnlace = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      // El quiz muestra primero una confirmación de salida. Su navegación
      // real activa el indicador después de que el usuario confirma.
      if ((window as any).__fccQuizIntentoActivo?.quizId) return;

      const enlace = target.closest<HTMLAnchorElement>("a[href]");
      if (!enlace) return;
      if (enlace.target && enlace.target !== "_self") return;
      if (enlace.hasAttribute("download")) return;
      if (enlace.dataset.sinIndicadorCarga === "true") return;

      const href = enlace.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let destino: URL;

      try {
        destino = new URL(enlace.href, window.location.href);
      } catch {
        return;
      }

      if (destino.origin !== window.location.origin) return;

      const actual = new URL(window.location.href);
      const destinoRuta = rutaConBusqueda(
        destino.pathname,
        destino.search.replace(/^\?/, "")
      );
      const actualRuta = rutaConBusqueda(
        actual.pathname,
        actual.search.replace(/^\?/, "")
      );

      if (destinoRuta === actualRuta) return;

      const etiqueta = enlace.textContent?.replace(/\s+/g, " ").trim();
      iniciar(
        etiqueta ? `Preparando ${etiqueta}` : mensajeParaRuta(destino.pathname),
        "pagina",
        destinoRuta,
        false
      );
    };

    const iniciarPorHistorial = () => {
      const destino = rutaConBusqueda(
        window.location.pathname,
        window.location.search.replace(/^\?/, "")
      );
      iniciar("Regresando a la sección", "pagina", destino, true);
    };

    const pushStateOriginal = window.history.pushState;
    const replaceStateOriginal = window.history.replaceState;

    const envolverHistorial = (original: History["pushState"]) =>
      function (
        this: History,
        data: unknown,
        unused: string,
        url?: string | URL | null
      ) {
        const pathnameAnterior = window.location.pathname;
        original.call(this, data, unused, url);

        if (window.location.pathname === pathnameAnterior) return;

        const destino = rutaConBusqueda(
          window.location.pathname,
          window.location.search.replace(/^\?/, "")
        );

        if (activoRef.current) {
          destinoRef.current = destino;
          confirmarDestino();
          return;
        }

        const pathnameDestino = window.location.pathname;
        const usarPantallaCompleta =
          pathnameAnterior === "/login" ||
          pathnameAnterior.startsWith("/auth/") ||
          pathnameDestino === "/login";

        // Next.js puede ejecutar pushState/replaceState dentro de
        // useInsertionEffect. React no permite setState en esa fase,
        // asi que diferimos unicamente el inicio originado por History.
        if (historialDiferidoRef.current !== null) {
          window.clearTimeout(historialDiferidoRef.current);
        }

        historialDiferidoRef.current = window.setTimeout(() => {
          historialDiferidoRef.current = null;

          if (activoRef.current) {
            destinoRef.current = destino;
            confirmarDestino();
            return;
          }

          iniciar(
            mensajeParaRuta(pathnameDestino),
            usarPantallaCompleta ? "pantalla" : "pagina",
            destino,
            true
          );
        }, 0);
      };

    const pushStateFCC = envolverHistorial(pushStateOriginal);
    const replaceStateFCC = envolverHistorial(replaceStateOriginal);

    window.history.pushState = pushStateFCC;
    window.history.replaceState = replaceStateFCC;

    document.addEventListener("click", iniciarPorEnlace, true);
    window.addEventListener(EVENTO_INICIO, iniciarPorEvento);
    window.addEventListener(EVENTO_FIN, finalizar);
    window.addEventListener("popstate", iniciarPorHistorial);

    return () => {
      document.removeEventListener("click", iniciarPorEnlace, true);
      window.removeEventListener(EVENTO_INICIO, iniciarPorEvento);
      window.removeEventListener(EVENTO_FIN, finalizar);
      window.removeEventListener("popstate", iniciarPorHistorial);

      if (window.history.pushState === pushStateFCC) {
        window.history.pushState = pushStateOriginal;
      }

      if (window.history.replaceState === replaceStateFCC) {
        window.history.replaceState = replaceStateOriginal;
      }


      if (historialDiferidoRef.current !== null) {
        window.clearTimeout(historialDiferidoRef.current);
        historialDiferidoRef.current = null;
      }

      limpiarTemporizadores();
      document.documentElement.removeAttribute("data-fcc-navigation-pending");
    };
  }, [confirmarDestino, finalizar, iniciar, limpiarTemporizadores]);

  if (!visible) return null;

  return (
    <CargadorFCC
      pagina={modo === "pagina"}
      pantallaCompleta={modo === "pantalla"}
      mensaje={mensaje}
      detalle="Confirmando la información antes de mostrarla…"
      className="fcc-navigation-indicator"
    />
  );
}
