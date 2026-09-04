"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import CargadorFCC, {
  DURACION_MINIMA_CARGADOR_FCC_MS,
} from "@/components/CargadorFCC";
import {
  CLASES_TEMA,
  TEMA_PREDETERMINADO,
} from "@/lib/temas";

const EVENTO_INICIO = "fcc:navegacion-inicio";
const EVENTO_FIN = "fcc:navegacion-fin";
const CLAVE_PENDIENTE = "fcc:navegacion-pendiente";
const VENTANA_ESTABLE_MS = 220;
const INTERVALO_REVISION_MS = 80;
const LIMITE_ESPERA_MS = 30_000;

const DETALLES_NAVEGACION_FCC = [
  "Acomodando los últimos detalles…",
  "Preparando los elementos visuales…",
  "Organizando la vista…",
  "Afinando la interfaz…",
] as const;

const CLASES_TEMA_ANTERIORES = [
  "theme-azul",
  "theme-grafito",
  "theme-lavanda",
  "theme-aurora",
  "theme-bosque",
  "theme-arena",
];

type ModoIndicador = "pagina" | "pantalla";

type OpcionesIndicador = {
  pantallaCompleta?: boolean;
  destino?: string;
  mantenerPantallaCompleta?: boolean;
};

type DetalleInicio = {
  mensaje?: string;
  modo?: ModoIndicador;
  destino?: string;
  mantenerPantallaCompleta?: boolean;
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

export function mensajeParaRutaFCC(pathname: string) {
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return "Preparando inicio de sesión";
  }

  if (pathname === "/register" || pathname.startsWith("/register/")) {
    return "Preparando registro";
  }

  if (
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  ) {
    return "Preparando la interfaz";
  }

  if (pathname.startsWith("/auth/")) return "Confirmando tu acceso";
  if (/^\/curso\/[^/]+\/quiz\//.test(pathname)) return "Cargando el quiz";
  if (pathname.startsWith("/curso/")) return "Cargando el curso";

  // Acciones concretas conservan un mensaje específico.
  if (pathname.includes("/agregar-curso")) return "Preparando nuevo curso";
  if (pathname.includes("/editar")) return "Cargando el editor del curso";
  if (pathname.includes("/perfil")) return "Abriendo tu perfil";

  // En la navegación ordinaria del estudiante evitamos describir cada sección
  // como si fuera una tarea distinta: el título se mantiene limpio y general.
  if (pathname.startsWith("/dashboard/estudiante")) {
    return "Preparando la interfaz";
  }

  // La parte profesor queda fuera de este lote y conserva sus mensajes actuales.
  if (pathname.includes("/ranking")) return "Cargando el ranking";
  if (pathname.includes("/cursos")) return "Cargando tus cursos";
  if (pathname.includes("/amigos")) return "Cargando tus amigos";
  if (pathname.includes("/profesores")) return "Cargando profesores";
  if (pathname.includes("/configuracion")) return "Cargando configuración";

  if (pathname === "/dashboard/profesor") return "Cargando tu inicio";
  if (pathname.startsWith("/dashboard/")) return "Cargando tu interfaz";
  return "Preparando la interfaz";
}

function esRutaInterna(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/curso/");
}

function esDashboardResolviendoRol(pathname: string) {
  return pathname === "/dashboard";
}

function esDashboardConBarra(pathname: string) {
  return (
    pathname.startsWith("/dashboard/estudiante") ||
    pathname.startsWith("/dashboard/profesor")
  );
}

function esRutaSinBarraNavegacion(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname.startsWith("/auth/")
  );
}

function esRutaAdministracionCursoProfesor(pathname: string) {
  return /^\/dashboard\/profesor\/cursos\/[^/]+\/editar(?:\/|$)/.test(
    pathname
  );
}

function aplicarTemaPublicoPredeterminado() {
  if (typeof document === "undefined") return;

  const clase = `theme-${TEMA_PREDETERMINADO}`;

  document.documentElement.classList.remove(
    ...CLASES_TEMA,
    ...CLASES_TEMA_ANTERIORES
  );
  document.documentElement.classList.add(clase);

  if (document.body) {
    document.body.classList.remove(
      ...CLASES_TEMA,
      ...CLASES_TEMA_ANTERIORES
    );
    document.body.classList.add(clase);
  }
}

function pathnameDeDestino(destino?: string | null) {
  if (!destino) return "";

  try {
    return new URL(destino, window.location.origin).pathname;
  } catch {
    return destino.split("?")[0] || "";
  }
}

function modoParaNavegacion(
  pathnameOrigen: string,
  pathnameDestino: string
): ModoIndicador {
  const tocaCurso =
    pathnameOrigen.startsWith("/curso/") ||
    pathnameDestino.startsWith("/curso/");

  const tocaRutaSinBarra =
    esRutaSinBarraNavegacion(pathnameOrigen) ||
    esRutaSinBarraNavegacion(pathnameDestino);
  const tocaAdministracionCursoProfesor =
    esRutaAdministracionCursoProfesor(pathnameOrigen) ||
    esRutaAdministracionCursoProfesor(pathnameDestino);

  return tocaCurso || tocaRutaSinBarra || tocaAdministracionCursoProfesor
    ? "pantalla"
    : "pagina";
}

export function iniciarIndicadorNavegacionFCC(
  mensaje = "Preparando la interfaz",
  opciones: OpcionesIndicador = {}
) {
  if (typeof window === "undefined") return;

  const detalle: DetalleInicio = {
    mensaje,
    modo: opciones.pantallaCompleta ? "pantalla" : "pagina",
    destino: opciones.destino,
    mantenerPantallaCompleta: opciones.mantenerPantallaCompleta,
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
  const [mensaje, setMensaje] = useState("Preparando la interfaz");
  const [detalleVisual, setDetalleVisual] = useState(
    DETALLES_NAVEGACION_FCC[0]
  );
  const [modo, setModo] = useState<ModoIndicador>("pagina");
  const [temaPublico, setTemaPublico] = useState(false);
  const detalleIndiceRef = useRef(-1);
  const activoRef = useRef(false);
  const montadoRef = useRef(false);
  const inicioRef = useRef(0);
  const estableDesdeRef = useRef<number | null>(null);
  const rutaOrigenRef = useRef("");
  const destinoRef = useRef<string | null>(null);
  const comprobacionRef = useRef<number | null>(null);
  const limiteRef = useRef<number | null>(null);
  const historialDiferidoRef = useRef<number | null>(null);
  const mantenerPantallaCompletaRef = useRef(false);
  const rutaConocidaRef = useRef(rutaConBusqueda(pathname, search));

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
    const destinoFinal = destinoRef.current;
    const rutaPublicaFinal =
      esRutaSinBarraNavegacion(window.location.pathname) ||
      esRutaSinBarraNavegacion(pathnameDeDestino(destinoFinal));

    limpiarTemporizadores();
    activoRef.current = false;
    estableDesdeRef.current = null;
    destinoRef.current = null;
    mantenerPantallaCompletaRef.current = false;

    // Durante logout el loader puede conservar el tema del usuario, pero la
    // ruta pública que queda detrás se normaliza a Azul antes de revelarse.
    if (rutaPublicaFinal) {
      aplicarTemaPublicoPredeterminado();
    }

    setVisible(false);
    setTemaPublico(false);
    document.documentElement.removeAttribute("data-fcc-navigation-pending");
    document.documentElement.removeAttribute("data-fcc-navigation-boot");
    retirarPendiente();
  }, [limpiarTemporizadores]);

  const comprobarEstabilidad = useCallback(
    function comprobar() {
      if (!activoRef.current) return;

      const ahora = performance.now();
      const hayBloqueadores = Boolean(
        document.querySelector(
          [
            ".fcc-loader:not(.fcc-navigation-indicator)",
            '[data-avatar-status="loading"]',
            '[data-avatar-status="updating"]',
            '[data-fcc-theme-pending="true"]',
            '[class*="skeleton"]',
          ].join(",")
        )
      );

      if (hayBloqueadores) {
        estableDesdeRef.current = null;
      } else if (estableDesdeRef.current === null) {
        estableDesdeRef.current = ahora;
      } else {
        const estable =
          ahora - estableDesdeRef.current >= VENTANA_ESTABLE_MS;
        const minimoCumplido =
          ahora - inicioRef.current >= DURACION_MINIMA_CARGADOR_FCC_MS;

        // El escudo conserva su animación de 2.2 s, pero la navegación ya no
        // espera obligatoriamente a completar el ciclo entero. 950 ms bastan
        // para que el progreso sea perceptible; si el trabajo real tarda más,
        // los bloqueadores mantienen el indicador naturalmente.
        if (estable && minimoCumplido) {
          finalizar();
          return;
        }
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
      destinoYaConfirmado = false,
      mantenerPantallaCompleta = false
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

      const pathnameDestino = pathnameDeDestino(destino);
      const tocaCurso =
        window.location.pathname.startsWith("/curso/") ||
        pathnameDestino.startsWith("/curso/");
      const tocaAdministracionCursoProfesor =
        esRutaAdministracionCursoProfesor(window.location.pathname) ||
        esRutaAdministracionCursoProfesor(pathnameDestino);
      const mantenerPantallaCompletaEfectivo =
        nuevoModo === "pantalla" &&
        (
          mantenerPantallaCompleta ||
          tocaCurso ||
          tocaAdministracionCursoProfesor
        );

      mantenerPantallaCompletaRef.current =
        mantenerPantallaCompletaEfectivo;

      // Si la navegación nace en una ruta pública, el loader de pantalla
      // completa queda fijado visualmente al Azul predeterminado aunque el
      // dashboard prepare el tema del usuario por debajo.
      setTemaPublico(
        nuevoModo === "pantalla" &&
          esRutaSinBarraNavegacion(window.location.pathname)
      );

      const detalle: DetalleInicio = {
        mensaje: texto?.trim() || "Preparando la interfaz",
        modo: nuevoModo,
        destino,
        mantenerPantallaCompleta:
          mantenerPantallaCompletaEfectivo,
      };

      detalleIndiceRef.current =
        (detalleIndiceRef.current + 1) % DETALLES_NAVEGACION_FCC.length;
      setDetalleVisual(
        DETALLES_NAVEGACION_FCC[detalleIndiceRef.current]
      );
      setMensaje(detalle.mensaje || "Preparando la interfaz");
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

      const pendienteDashboardResuelto =
        pendiente?.destino === "/dashboard" &&
        esDashboardConBarra(pathname);

      if (
        pendiente &&
        (!pendiente.destino ||
          pendiente.destino === rutaActual ||
          pendienteDashboardResuelto)
      ) {
        iniciar(
          pendiente.mensaje,
          pendienteDashboardResuelto &&
            !pendiente.mantenerPantallaCompleta
            ? "pagina"
            : pendiente.modo || "pagina",
          pendienteDashboardResuelto ? rutaActual : pendiente.destino,
          !esDashboardResolviendoRol(pathname),
          Boolean(pendiente.mantenerPantallaCompleta)
        );
      } else if (esRutaInterna(pathname)) {
        iniciar(
          mensajeParaRutaFCC(pathname),
          pathname.startsWith("/curso/") ||
            esRutaAdministracionCursoProfesor(pathname)
            ? "pantalla"
            : "pagina",
          rutaActual,
          true,
          pathname.startsWith("/curso/") ||
            esRutaAdministracionCursoProfesor(pathname)
        );
      }

      return;
    }

    if (!activoRef.current) return;

    // /dashboard solo resuelve el rol. El modo 1 sigue cubriendo la
    // interfaz hasta llegar al dashboard final.
    if (esDashboardResolviendoRol(pathname)) {
      detenerComprobacion();
      estableDesdeRef.current = null;
      return;
    }

    const destino = destinoRef.current;
    const destinoEsDashboard =
      destino === "/dashboard" || Boolean(destino?.startsWith("/dashboard/"));

    // Solo el relevo que REALMENTE entra a un dashboard con barra puede pasar
    // de pantalla completa a modo pagina. Un logout hacia /login o una salida
    // hacia /curso debe conservar pantalla completa aunque el pathname actual
    // siga siendo, durante unos milisegundos, el dashboard de origen.
    if (
      esDashboardConBarra(pathname) &&
      destinoEsDashboard &&
      !mantenerPantallaCompletaRef.current &&
      modo !== "pagina"
    ) {
      setModo("pagina");
    }
    if (
      !destino ||
      destino === rutaActual ||
      rutaActual !== rutaOrigenRef.current
    ) {
      confirmarDestino();
    }
  }, [
    pathname,
    search,
    modo,
    confirmarDestino,
    detenerComprobacion,
    iniciar,
  ]);

  useLayoutEffect(() => {
    rutaConocidaRef.current = rutaConBusqueda(pathname, search);
  }, [pathname, search]);

  useLayoutEffect(() => {
    // En una navegación SPA hacia una ruta pública el script de RootLayout no
    // vuelve a ejecutarse. Si no hay transición activa, normalizamos aquí el
    // tema para que Login/Register/Reset nunca hereden una sesión anterior.
    if (esRutaSinBarraNavegacion(pathname) && !activoRef.current) {
      aplicarTemaPublicoPredeterminado();
    }
  }, [pathname]);

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
        destinoYaConfirmado,
        Boolean(detail?.mantenerPantallaCompleta)
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

      // Los flujos protegidos muestran primero su confirmación de salida.
      // La navegación real activa el indicador después de que el usuario confirma.
      if ((window as any).__fccQuizIntentoActivo?.quizId) return;
      if ((window as any).__fccContenidoEdicionActiva?.cursoId) return;
      if ((window as any).__fccQuizEdicionActiva?.cursoId) return;

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

      const forzarPantallaCompleta =
        enlace.dataset.fccPantallaCompleta === "true";

      iniciar(
        mensajeParaRutaFCC(destino.pathname),
        forzarPantallaCompleta
          ? "pantalla"
          : modoParaNavegacion(actual.pathname, destino.pathname),
        destinoRuta,
        false,
        forzarPantallaCompleta
      );
    };

    const iniciarPorHistorial = () => {
      if ((window as any).__fccContenidoEdicionActiva?.cursoId) return;

      const pathnameDestino = window.location.pathname;
      const pathnameOrigen = pathnameDeDestino(rutaConocidaRef.current);
      const destino = rutaConBusqueda(
        pathnameDestino,
        window.location.search.replace(/^\?/, "")
      );
      const modalRapidoDestino = new URLSearchParams(
        window.location.search
      ).get("modal");
      const vuelveAModalRapido =
        pathnameDestino === "/dashboard/estudiante" &&
        (modalRapidoDestino === "horario" || modalRapidoDestino === "mapa");
      const tocaCurso =
        pathnameOrigen.startsWith("/curso/") ||
        pathnameDestino.startsWith("/curso/");
      const tocaAdministracionCursoProfesor =
        esRutaAdministracionCursoProfesor(pathnameOrigen) ||
        esRutaAdministracionCursoProfesor(pathnameDestino);
      const modoDestino =
        tocaCurso ||
        tocaAdministracionCursoProfesor ||
        esRutaSinBarraNavegacion(pathnameDestino) ||
        vuelveAModalRapido
          ? "pantalla"
          : "pagina";

      iniciar(
        mensajeParaRutaFCC(pathnameDestino),
        modoDestino,
        destino,
        true,
        tocaCurso ||
          tocaAdministracionCursoProfesor ||
          vuelveAModalRapido
      );
      rutaConocidaRef.current = destino;
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

        const pathnameDestino = window.location.pathname;
        const destino = rutaConBusqueda(
          pathnameDestino,
          window.location.search.replace(/^\?/, "")
        );
        rutaConocidaRef.current = destino;

        if (activoRef.current) {
          destinoRef.current = destino;

          if (esDashboardResolviendoRol(pathnameDestino)) {
            detenerComprobacion();
            estableDesdeRef.current = null;
            return;
          }

          confirmarDestino();
          return;
        }

        const modoHistorial = modoParaNavegacion(
          pathnameAnterior,
          pathnameDestino
        );

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

            if (esDashboardResolviendoRol(pathnameDestino)) {
              detenerComprobacion();
              estableDesdeRef.current = null;
              return;
            }

            confirmarDestino();
            return;
          }

          iniciar(
            mensajeParaRutaFCC(pathnameDestino),
            modoHistorial,
            destino,
            true,
            pathnameAnterior.startsWith("/curso/") ||
              pathnameDestino.startsWith("/curso/") ||
              esRutaAdministracionCursoProfesor(pathnameAnterior) ||
              esRutaAdministracionCursoProfesor(pathnameDestino)
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
  }, [
    confirmarDestino,
    detenerComprobacion,
    finalizar,
    iniciar,
    limpiarTemporizadores,
  ]);

  if (!visible) return null;

  return (
    <CargadorFCC
      pagina={modo === "pagina"}
      pantallaCompleta={modo === "pantalla"}
      mensaje={mensaje}
      detalle={detalleVisual}
      temaPublico={temaPublico}
      className="fcc-navigation-indicator"
    />
  );
}
