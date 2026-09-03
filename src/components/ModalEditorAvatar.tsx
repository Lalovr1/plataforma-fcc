/**
 * Editor de avatar V2 para estudiantes de FCC Academy.
 *
 * Las opciones salen exclusivamente del catalogo generado desde
 * public/elementos_avatar_nuevo. No contiene listas hardcodeadas ni migra
 * identificadores del sistema anterior.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RenderizadorAvatar, {
  type AvatarConfig,
  prepararRecursosAvatarFCC,
} from "./RenderizadorAvatar";
import ModalEditorAvatarPersonalizado from "./ModalEditorAvatarPersonalizado";
import ModalEditorAvatarProfesor from "./ModalEditorAvatarProfesor";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";
import { obtenerUrlImagenOptimizada } from "@/lib/imagenes";
import {
  completarAvatarConfigBaseEstudiante,
  crearAvatarConfigInicialEstudiante,
  esAvatarConfigV2,
  establecerColorItemAvatarV2,
  establecerVarianteImagenAvatarV2,
  obtenerSlotItemAvatar,
  quitarSeleccionAvatarV2,
  seleccionarItemAvatarV2,
  type AvatarConfigV2,
} from "@/lib/avatarConfig";
import {
  obtenerColoresPielAvatar,
  obtenerItemAvatarPorId,
  obtenerEstudiantePersonalizadoAvatar,
  obtenerProfesorAvatar,
  obtenerRecompensasInicialesAvatar,
  obtenerSeccionesEstudianteAvatar,
  resolverOpcionImagenAvatar,
  resolverVarianteItemAvatar,
  type CapaSimpleAvatar,
  type CapaTintAvatar,
  type GeneroAvatar,
  type ItemCatalogoAvatar,
  type SeccionEstudianteAvatar,
  type VarianteItemAvatar,
  type UsuarioAvatarPersonalizado,
} from "@/lib/avatarCatalogo";
import { supabase } from "@/utils/supabaseClient";

const DURACION_MINIMA_PREPARACION_EDITOR_MS = 280;
const RETRASO_LOADER_CAMBIO_MS = 2_000;
const DURACION_MINIMA_LOADER_CAMBIO_MS = 1_050;
const LIMITE_CAMBIO_AVATAR_MS = 30_000;
const TAMANO_AVATAR_EDITOR = 380;
const PRENDA_VISUAL_INICIAL_ESTUDIANTE_ID = "ropa/playeras+camisas/PlayeraTirantes";

function esperar(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

const PRIORIDAD_RAREZA: Record<string, number> = {
  inicial: 0,
  comun: 1,
  epico: 2,
  raro: 3,
  legendario: 4,
};

function prioridadRareza(item: ItemCatalogoAvatar) {
  return PRIORIDAD_RAREZA[item.rarity ?? ""] ?? 99;
}

function prioridadVarianteGenero(
  item: ItemCatalogoAvatar,
  gender: GeneroAvatar
) {
  if (item.customization.type === "image_variants") {
    const tienePropia = item.customization.options.some(
      (option) => Boolean(option.variants[gender])
    );
    return tienePropia ? 0 : 1;
  }

  return item.variants[gender] ? 0 : 1;
}

function compararItemsEditor(
  a: ItemCatalogoAvatar,
  b: ItemCatalogoAvatar,
  gender: GeneroAvatar
) {
  // PlayeraTirantes es la prenda mas basica del estudiante:
  // dentro de Playeras / Camisas debe aparecer SIEMPRE como primera tarjeta,
  // independientemente del orden alfabetico o de otras prendas iniciales.
  if (
    a.id === PRENDA_VISUAL_INICIAL_ESTUDIANTE_ID &&
    b.id !== PRENDA_VISUAL_INICIAL_ESTUDIANTE_ID
  ) {
    return -1;
  }

  if (
    b.id === PRENDA_VISUAL_INICIAL_ESTUDIANTE_ID &&
    a.id !== PRENDA_VISUAL_INICIAL_ESTUDIANTE_ID
  ) {
    return 1;
  }

  const generoA = prioridadVarianteGenero(a, gender);
  const generoB = prioridadVarianteGenero(b, gender);

  if (generoA !== generoB) return generoA - generoB;

  const rarezaA = prioridadRareza(a);
  const rarezaB = prioridadRareza(b);

  if (rarezaA !== rarezaB) return rarezaA - rarezaB;

  return a.name.localeCompare(b.name, "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function ordenarItemsEditor(
  items: ItemCatalogoAvatar[],
  gender: GeneroAvatar
) {
  return [...items].sort((a, b) => compararItemsEditor(a, b, gender));
}
const ETIQUETAS_SLOT: Record<string, string> = {
  cabello: "Cabello",
  ojos: "Ojos",
};

function etiquetaSlot(slot: string) {
  if (slot.startsWith("ropa/")) return "Ropa";
  if (slot.startsWith("accesorios/")) return "Accesorios";
  return ETIQUETAS_SLOT[slot] ?? slot;
}

function listaNatural(valores: string[]) {
  const unicos = Array.from(new Set(valores));

  if (unicos.length <= 1) return unicos[0] ?? "";
  if (unicos.length === 2) return `${unicos[0]} y ${unicos[1]}`;

  return `${unicos.slice(0, -1).join(", ")} y ${unicos.at(-1)}`;
}


type GrupoColorRopa = {
  familia: string;
  items: ItemCatalogoAvatar[];
};

function separarFamiliaColorRopa(item: ItemCatalogoAvatar) {
  if (item.customization.type !== "none") return null;

  const indice = item.name.lastIndexOf("__");
  if (indice <= 0 || indice >= item.name.length - 2) return null;

  return {
    familia: item.name.slice(0, indice),
    color: item.name.slice(indice + 2),
  };
}

function etiquetaSimple(valor: string) {
  return valor
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();
}

function swatchColorRopa(color: string) {
  const normalizado = color
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const colores: Record<string, string> = {
    azul: "#2563eb",
    verde: "#3f7f4f",
    gris: "#a3a3a3",
    mostaza: "#d4a017",
    negra: "#171717",
    negro: "#171717",
    roja: "#b91c1c",
    rojo: "#b91c1c",
    cafe: "#8b5e3c",
    blanco: "#f5f5f5",
    blanca: "#f5f5f5",
    beige: "#e7d3ac",
    olivo: "#6b7034",
    naranja: "#f97316",
    azulmarino: "#1e3a5f",
  };

  return colores[normalizado] ?? null;
}

function estiloSwatch(color?: string | null) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) {
    return {};
  }

  const r = Number.parseInt(color.slice(1, 3), 16);
  const g = Number.parseInt(color.slice(3, 5), 16);
  const b = Number.parseInt(color.slice(5, 7), 16);
  const luminosidad = (r * 299 + g * 587 + b * 114) / 255000;

  if (luminosidad < 0.78) {
    return {};
  }

  return {
    borderColor: "#94a3b8",
    boxShadow: "inset 0 0 0 1px rgba(100,116,139,.42)",
  };
}

function agruparItemsRopa(
  items: ItemCatalogoAvatar[],
  gender: GeneroAvatar
): Array<ItemCatalogoAvatar | GrupoColorRopa> {
  const resultado: Array<ItemCatalogoAvatar | GrupoColorRopa> = [];
  const grupos = new Map<string, ItemCatalogoAvatar[]>();

  for (const item of items) {
    const agrupable = separarFamiliaColorRopa(item);

    if (!agrupable) {
      resultado.push(item);
      continue;
    }

    const lista = grupos.get(agrupable.familia) ?? [];
    lista.push(item);
    grupos.set(agrupable.familia, lista);
  }

  for (const [familia, itemsGrupo] of grupos.entries()) {
    resultado.push({
      familia,
      items: ordenarItemsEditor(itemsGrupo, gender),
    });
  }

  return resultado.sort((a, b) => {
    const itemsA = "familia" in a ? a.items : [a];
    const itemsB = "familia" in b ? b.items : [b];

    const representanteA = ordenarItemsEditor(itemsA, gender)[0];
    const representanteB = ordenarItemsEditor(itemsB, gender)[0];

    if (representanteA && representanteB) {
      const comparacion = compararItemsEditor(
        representanteA,
        representanteB,
        gender
      );

      if (comparacion !== 0) return comparacion;
    }

    const nombreA = "familia" in a ? a.familia : a.name;
    const nombreB = "familia" in b ? b.familia : b.name;

    return nombreA.localeCompare(nombreB, "es", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialConfig: AvatarConfig;
  onSave: (newConfig: AvatarConfig) => void | boolean | Promise<void | boolean>;
  forzado?: boolean;
  onReady?: () => void;
  /**
   * Permite que un flujo externo desvanezca el overlay antes de desmontarlo.
   * Por defecto es false, así que el editor normal conserva su comportamiento.
   */
  desvanecerSalida?: boolean;
  /**
   * Duración del fade del overlay. El valor por defecto mantiene los 180 ms actuales.
   */
  duracionTransicionMs?: number;
  /**
   * Desactiva únicamente las animaciones internas de zoom/entrada.
   * Se usa en el tutorial para que toda la aparición dependa de un único
   * fade sincronizado. Por defecto es false y Perfil conserva su animación.
   */
  desactivarAnimacionEntrada?: boolean;
}

function inferirGenero(config: AvatarConfig): GeneroAvatar {
  return config?.gender === "femenino" ? "femenino" : "masculino";
}

function esCapaSimple(
  variante: VarianteItemAvatar
): variante is CapaSimpleAvatar {
  return typeof variante.image === "string";
}

function esCapaTint(
  variante: VarianteItemAvatar
): variante is CapaTintAvatar {
  return (
    typeof variante.image === "object" &&
    "fill" in variante.image
  );
}

function itemCompatibleConGenero(
  item: ItemCatalogoAvatar,
  gender: GeneroAvatar
) {
  if (item.customization.type === "image_variants") {
    return item.customization.options.some((option) =>
      Boolean(option.variants[gender] ?? option.variants.universal)
    );
  }

  return Boolean(resolverVarianteItemAvatar(item, gender));
}

function tieneMultiplesVariantesImagen(
  item: ItemCatalogoAvatar | null | undefined,
  gender: GeneroAvatar
) {
  if (
    !item ||
    item.customization.type !== "image_variants"
  ) {
    return false;
  }

  return (
    item.customization.options.filter((option) =>
      Boolean(
        option.variants[gender] ??
          option.variants.universal
      )
    ).length > 1
  );
}

function crearConfigInicialEditor(initialConfig: AvatarConfig): AvatarConfigV2 {
  if (esAvatarConfigV2(initialConfig)) {
    return completarAvatarConfigBaseEstudiante(initialConfig);
  }

  return crearAvatarConfigInicialEstudiante(inferirGenero(initialConfig));
}

function cambiarGenero(
  config: AvatarConfigV2,
  gender: GeneroAvatar
): AvatarConfigV2 {
  const selections: Record<string, string> = {};
  const colors: Record<string, string> = {};
  const imageVariants: Record<string, string> = {};

  for (const [slot, itemId] of Object.entries(config.selections)) {
    const item = obtenerItemAvatarPorId(itemId);
    if (!item || !itemCompatibleConGenero(item, gender)) continue;

    selections[slot] = itemId;

    if (config.colors[itemId]) {
      colors[itemId] = config.colors[itemId];
    }

    if (config.imageVariants[itemId]) {
      imageVariants[itemId] = config.imageVariants[itemId];
    }
  }

  return completarAvatarConfigBaseEstudiante({
    ...config,
    gender,
    selections,
    colors,
    imageVariants,
  });
}

function esSlotRopa(slot: string) {
  return slot.startsWith("ropa/");
}

function seleccionarItemExclusivo(
  config: AvatarConfigV2,
  item: ItemCatalogoAvatar
) {
  let siguiente = config;
  const slot = obtenerSlotItemAvatar(item);

  // Toda la ropa ocupa una unica eleccion visual. La playera inicial no se
  // conserva debajo de camisas, sueteres, chamarras ni prendas unicas.
  if (esSlotRopa(slot)) {
    for (const slotActual of Object.keys(
      siguiente.selections
    )) {
      if (esSlotRopa(slotActual)) {
        siguiente =
          quitarSeleccionAvatarV2(
            siguiente,
            slotActual
          );
      }
    }
  }

  return seleccionarItemAvatarV2(
    siguiente,
    item
  );
}

function obtenerFuentePreviewSimple(
  item: ItemCatalogoAvatar,
  config: AvatarConfigV2,
  imageVariantOverride?: string | null
) {
  if (item.customization.type === "image_variants") {
    const resolved = resolverOpcionImagenAvatar(
      item,
      imageVariantOverride ?? config.imageVariants[item.id],
      config.gender
    );

    if (!resolved?.layer) return null;
    return resolved.layer.preview ?? resolved.layer.image;
  }

  const variante = resolverVarianteItemAvatar(item, config.gender);
  if (!variante) return null;

  if (!esCapaSimple(variante)) return null;
  return variante.preview ?? variante.image;
}

function obtenerFuentesPreviewItemEditor(
  item: ItemCatalogoAvatar,
  config: AvatarConfigV2
) {
  const fuentes: string[] = [];

  if (item.customization.type === "image_variants") {
    const resolved = resolverOpcionImagenAvatar(
      item,
      config.imageVariants[item.id],
      config.gender
    );

    const src = resolved?.layer?.preview ?? resolved?.layer?.image;
    if (src) fuentes.push(src);

    return fuentes;
  }

  const variante = resolverVarianteItemAvatar(item, config.gender);
  if (!variante) return fuentes;

  if (esCapaSimple(variante)) {
    fuentes.push(variante.preview ?? variante.image);
    return fuentes;
  }

  if (esCapaTint(variante)) {
    fuentes.push(variante.preview.fill ?? variante.image.fill);
    fuentes.push(variante.preview.outline ?? variante.image.outline);
  }

  return fuentes;
}

function obtenerItemsSeccionEditor(seccion: SeccionEstudianteAvatar) {
  if (seccion.type === "body") return [];

  if (seccion.type === "collection") {
    return seccion.items;
  }

  return seccion.subsections.flatMap((subseccion) => subseccion.items);
}

// Las tarjetas sólo muestran thumbnails optimizados. El editor los calienta
// en segundo plano por lotes para que el scroll no tenga que descargar y
// decodificar imágenes justo cuando entran al viewport.
function VistaPreviaItem({
  item,
  config,
  imageVariantOverride,
  colorOverride,
}: {
  item: ItemCatalogoAvatar;
  config: AvatarConfigV2;
  imageVariantOverride?: string | null;
  colorOverride?: string | null;
}) {
  const optimizar = (src: string) => obtenerUrlImagenOptimizada(src, 240, 80);

  if (item.customization.type === "image_variants") {
    const src = obtenerFuentePreviewSimple(item, config, imageVariantOverride);
    if (!src) return <span className="avatar-v2-empty">Sin preview</span>;

    return (
      <img
        src={optimizar(src)}
        alt={item.name}
        className="h-full w-full object-contain"
        decoding="async"
      />
    );
  }

  const variante = resolverVarianteItemAvatar(item, config.gender);
  if (!variante) return <span className="avatar-v2-empty">Sin preview</span>;

  if (esCapaSimple(variante)) {
    const src = variante.preview ?? variante.image;

    return (
      <img
        src={optimizar(src)}
        alt={item.name}
        className="h-full w-full object-contain"
        decoding="async"
      />
    );
  }

  if (esCapaTint(variante)) {
    const fill = variante.preview.fill ?? variante.image.fill;
    const outline = variante.preview.outline ?? variante.image.outline;
    const color = colorOverride ?? config.colors[item.id] ?? item.customization.colors[0] ?? "#ffffff";
    const fillOptimizado = optimizar(fill);

    return (
      <div className="relative h-full w-full">
        <img
          src={fillOptimizado}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          decoding="async"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: color,
            opacity: 0.62,
            maskImage: `url(${fillOptimizado})`,
            WebkitMaskImage: `url(${fillOptimizado})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
        <img
          src={optimizar(outline)}
          alt={item.name}
          className="absolute inset-0 h-full w-full object-contain"
          decoding="async"
        />
      </div>
    );
  }

  return <span className="avatar-v2-empty">Sin preview</span>;
}

function etiquetaRareza(item: ItemCatalogoAvatar) {
  if (!item.rarity) return null;

  const etiquetas: Record<string, string> = {
    inicial: "Inicial",
    comun: "Común",
    raro: "Raro",
    epico: "Épico",
    legendario: "Legendario",
  };

  return etiquetas[item.rarity] ?? item.rarity;
}

export default function ModalEditorAvatar({
  open,
  onClose,
  initialConfig,
  onSave,
  forzado = false,
  onReady,
  desvanecerSalida = false,
  duracionTransicionMs = 180,
  desactivarAnimacionEntrada = false,
}: Props) {
  const [config, setConfig] = useState<AvatarConfigV2>(() =>
    crearConfigInicialEditor(initialConfig)
  );
  const [tab, setTab] = useState("cuerpo");
  const [inventario, setInventario] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [avatarListo, setAvatarListo] = useState(false);
  const [avatarActualizando, setAvatarActualizando] = useState(false);
  const [mostrarLoaderCambio, setMostrarLoaderCambio] = useState(false);
  const [itemPersonalizacionId, setItemPersonalizacionId] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const [modoEspecial, setModoEspecial] = useState<
    "profesor" | "personalizado" | null
  >(null);
  const [usuarioPersonalizado, setUsuarioPersonalizado] =
    useState<UsuarioAvatarPersonalizado | null>(null);
  const readyRef = useRef(false);
  const solicitudVisualRef = useRef(0);
  const esperandoCommitVisualRef = useRef(false);
  const loaderCambioTimerRef = useRef<number | null>(null);
  const loaderCambioVisibleDesdeRef = useRef<number | null>(null);
  const variantesSesionRef = useRef<Record<string, string>>({});
  const coloresSesionRef = useRef<Record<string, string>>({});
  const familiasRopaSesionRef = useRef<Record<string, string>>({});

  const secciones = useMemo(() => obtenerSeccionesEstudianteAvatar(), []);
  const iniciales = useMemo(() => obtenerRecompensasInicialesAvatar(), []);
  const idsIniciales = useMemo(
    () => new Set(iniciales.map((item) => item.id)),
    [iniciales]
  );
  const tonosPiel = useMemo(() => obtenerColoresPielAvatar(), []);
  const claveInicial = JSON.stringify(initialConfig);

  useEffect(() => {
    if (!open) {
      solicitudVisualRef.current += 1;

      if (loaderCambioTimerRef.current !== null) {
        window.clearTimeout(loaderCambioTimerRef.current);
        loaderCambioTimerRef.current = null;
      }

      loaderCambioVisibleDesdeRef.current = null;
      setMostrarLoaderCambio(false);
      setAvatarActualizando(false);
      return;
    }

    const nueva = crearConfigInicialEditor(initialConfig);
    setConfig(nueva);
    setTab("cuerpo");
    setMensaje("");
    setAvatarListo(false);
    setAvatarActualizando(false);
    setMostrarLoaderCambio(false);
    setItemPersonalizacionId(null);

    if (loaderCambioTimerRef.current !== null) {
      window.clearTimeout(loaderCambioTimerRef.current);
      loaderCambioTimerRef.current = null;
    }

    loaderCambioVisibleDesdeRef.current = null;
    solicitudVisualRef.current += 1;
    esperandoCommitVisualRef.current = false;
    variantesSesionRef.current = { ...nueva.imageVariants };
    coloresSesionRef.current = { ...nueva.colors };
    familiasRopaSesionRef.current = {};

    for (const itemId of Object.values(nueva.selections)) {
      const item = obtenerItemAvatarPorId(itemId);
      if (!item || item.section !== "ropa" || !item.subsection) continue;

      const datos = separarFamiliaColorRopa(item);
      if (!datos) continue;

      familiasRopaSesionRef.current[
        `${item.subsection}:${datos.familia}`
      ] = item.id;
    }

    setModoEspecial(null);
    setUsuarioPersonalizado(null);
    readyRef.current = false;
  }, [open, claveInicial]);

  useEffect(() => {
    if (!open) return;

    let activo = true;

    async function preparar() {
      setCargando(true);
      setErrorCarga(false);

      try {
        const configInicial = crearConfigInicialEditor(initialConfig);

        const prepararVisual = Promise.all([
          prepararRecursosAvatarFCC(configInicial, TAMANO_AVATAR_EDITOR),
          new Promise<void>((resolve) =>
            window.setTimeout(resolve, DURACION_MINIMA_PREPARACION_EDITOR_MS)
          ),
        ]);

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error("No se pudo confirmar el usuario.");

        const { data: perfil, error: perfilError } = await supabase
          .from("usuarios")
          .select("rol")
          .eq("id", authData.user.id)
          .single();

        if (perfilError) throw perfilError;

        if (perfil?.rol === "profesor") {
          const profesor =
            obtenerProfesorAvatar(authData.user.email);

          if (activo) {
            setUsuarioPersonalizado(profesor);
            setModoEspecial("profesor");
          }

          await prepararVisual;
          return;
        }

        const personalizado =
          obtenerEstudiantePersonalizadoAvatar(authData.user.email);

        if (personalizado) {
          if (activo) {
            setUsuarioPersonalizado(personalizado);
            setModoEspecial("personalizado");
          }
          await prepararVisual;
          return;
        }

        // Backfill de starter pack. Si por alguna razon la tabla central aun
        // no estuviera sincronizada, los elementos de rareza inicial siguen
        // habilitados por el catalogo local.
        const { error: inicialesError } = await supabase.rpc(
          "fcc_otorgar_iniciales_faltantes"
        );

        if (inicialesError) {
          console.warn(
            "[FCC Academy] No se pudo completar el backfill de iniciales:",
            inicialesError
          );
        }

        const { data: recompensas, error: recompensasError } = await supabase
          .from("recompensas_usuario")
          .select("nombre")
          .eq("user_id", authData.user.id);

        if (recompensasError) throw recompensasError;

        const [visualCompleto] = await prepararVisual;
        if (!visualCompleto) {
          throw new Error("No se pudieron precargar las capas iniciales.");
        }

        if (!activo) return;

        setInventario(
          new Set(
            (recompensas ?? [])
              .map((row) => row.nombre)
              .filter((value): value is string => typeof value === "string")
          )
        );
      } catch (error) {
        console.error("[FCC Academy] Error preparando editor V2:", error);
        if (activo) setErrorCarga(true);
      } finally {
        if (activo) setCargando(false);
      }
    }

    void preparar();

    return () => {
      activo = false;
    };
  }, [open, claveInicial, reintento]);

  if (!open) return null;

  if (errorCarga) {
    const error = (
      <div className="fixed bottom-4 right-4 z-[31000] w-[min(560px,calc(100vw-32px))]">
        <div className="w-full overflow-hidden rounded-[22px] bg-white/95 shadow-2xl">
          <EstadoErrorCargaFCC
            compacto
            titulo="No pudimos preparar el editor"
            detalle="No se mostrarán opciones incompletas hasta confirmar el inventario y las capas del avatar."
            onRetry={() => {
              setErrorCarga(false);
              setReintento((actual) => actual + 1);
            }}
          />
        </div>
      </div>
    );

    return typeof document === "undefined" ? error : createPortal(error, document.body);
  }

  if (cargando) {
    const loader = <CargadorFCC flotante mensaje="Preparando el editor de avatar" detalle="" />;
    return typeof document === "undefined" ? loader : createPortal(loader, document.body);
  }

  if (
    modoEspecial === "personalizado" &&
    usuarioPersonalizado
  ) {
    return (
      <ModalEditorAvatarPersonalizado
        open={open}
        onClose={onClose}
        initialConfig={initialConfig}
        onSave={onSave}
        usuario={usuarioPersonalizado}
        forzado={forzado}
        onReady={onReady}
      />
    );
  }

  if (
    modoEspecial === "profesor" &&
    usuarioPersonalizado
  ) {
    return (
      <ModalEditorAvatarProfesor
        open={open}
        onClose={onClose}
        initialConfig={initialConfig}
        onSave={onSave}
        usuario={usuarioPersonalizado}
        forzado={forzado}
        onReady={onReady}
      />
    );
  }

  if (modoEspecial === "profesor") {
    const especial = (
      <div
        className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={forzado ? undefined : onClose}
      >
        <div
          className="w-[min(92vw,520px)] rounded-[26px] border p-6 text-center shadow-2xl"
          style={{
            background: "var(--fcc-premium-surface)",
            borderColor: "var(--fcc-premium-border-strong)",
            color: "var(--fcc-premium-text)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <p
            className="mb-2 text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--fcc-premium-accent)" }}
          >
            Editor V2
          </p>
          <h2
            className="text-xl font-black"
            style={{ color: "var(--fcc-premium-heading)" }}
          >
            Avatar de profesor
          </h2>
          <p
            className="mt-3 text-sm font-semibold leading-6"
            style={{ color: "var(--fcc-premium-muted)" }}
          >
            Para activar el avatar personalizado del profesor se necesita
            Cuerpo.png y al menos una expresión PNG real en su carpeta.
          </p>
          {!forzado && (
            <button
              type="button"
              onClick={onClose}
              className="mt-5 min-h-11 rounded-xl px-5 text-sm font-black"
              style={{
                color: "var(--fcc-premium-text)",
                background: "var(--fcc-premium-surface-strong)",
                border: "1px solid var(--fcc-premium-border)",
              }}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    );

    return typeof document === "undefined"
      ? especial
      : createPortal(especial, document.body);
  }

  const estaDesbloqueado = (item: ItemCatalogoAvatar) =>
    idsIniciales.has(item.id) ||
    inventario.has(item.id) ||
    inventario.has(item.name);

  const estaDesbloqueadoPorId = (itemId: string) => {
    if (idsIniciales.has(itemId) || inventario.has(itemId)) return true;

    const item = obtenerItemAvatarPorId(itemId);
    return Boolean(item && inventario.has(item.name));
  };

  const esperarMinimoLoaderCambio = async () => {
    const visibleDesde = loaderCambioVisibleDesdeRef.current;
    if (visibleDesde === null) return;

    const restante =
      DURACION_MINIMA_LOADER_CAMBIO_MS - (performance.now() - visibleDesde);

    if (restante > 0) {
      await esperar(restante);
    }
  };

  const aplicarConfigAtomica = async (
    siguiente: AvatarConfigV2,
    itemIdActivo: string | null = itemPersonalizacionId
  ) => {
    if (JSON.stringify(siguiente) === JSON.stringify(config)) {
      if (itemIdActivo !== itemPersonalizacionId) {
        setItemPersonalizacionId(itemIdActivo);
      }
      return true;
    }

    if (avatarActualizando) {
      return false;
    }

    const solicitud = ++solicitudVisualRef.current;
    setAvatarActualizando(true);
    setMostrarLoaderCambio(false);
    loaderCambioVisibleDesdeRef.current = null;
    setMensaje("");

    if (loaderCambioTimerRef.current !== null) {
      window.clearTimeout(loaderCambioTimerRef.current);
    }

    loaderCambioTimerRef.current = window.setTimeout(() => {
      if (solicitudVisualRef.current !== solicitud) return;

      loaderCambioVisibleDesdeRef.current = performance.now();
      setMostrarLoaderCambio(true);
    }, RETRASO_LOADER_CAMBIO_MS);

    const resultado = await Promise.race([
      prepararRecursosAvatarFCC(
        siguiente,
        TAMANO_AVATAR_EDITOR
      ).then((completo) => ({
        tipo: "recursos" as const,
        completo,
      })),
      esperar(LIMITE_CAMBIO_AVATAR_MS).then(() => ({
        tipo: "timeout" as const,
        completo: false,
      })),
    ]);

    if (loaderCambioTimerRef.current !== null) {
      window.clearTimeout(loaderCambioTimerRef.current);
      loaderCambioTimerRef.current = null;
    }

    if (solicitud !== solicitudVisualRef.current) {
      return false;
    }

    if (resultado.tipo === "timeout" || !resultado.completo) {
      await esperarMinimoLoaderCambio();

      if (solicitud !== solicitudVisualRef.current) {
        return false;
      }

      setMostrarLoaderCambio(false);
      loaderCambioVisibleDesdeRef.current = null;
      setAvatarActualizando(false);
      setMensaje(
        resultado.tipo === "timeout"
          ? "⚠️ El cambio tardó demasiado y se canceló. Se mantuvo la apariencia anterior."
          : "⚠️ No se pudo preparar el cambio completo del avatar. Se mantuvo la apariencia anterior."
      );
      return false;
    }

    // Si la espera fue lo bastante larga como para mostrar el cargador,
    // dejamos que complete al menos un ciclo visible antes del cambio.
    await esperarMinimoLoaderCambio();

    if (solicitud !== solicitudVisualRef.current) {
      return false;
    }

    esperandoCommitVisualRef.current = true;
    setItemPersonalizacionId(itemIdActivo);
    setConfig(siguiente);
    return true;
  };

  const recordarFamiliaRopa = (item: ItemCatalogoAvatar) => {
    if (item.section !== "ropa" || !item.subsection) return;

    const datos = separarFamiliaColorRopa(item);
    if (!datos) return;

    familiasRopaSesionRef.current[
      `${item.subsection}:${datos.familia}`
    ] = item.id;
  };

  const seleccionar = (item: ItemCatalogoAvatar) => {
    if (avatarActualizando) return;

    let siguiente = seleccionarItemExclusivo(config, item);

    const slot = obtenerSlotItemAvatar(item);
    const varianteCabelloGlobal =
      slot === "cabello"
        ? obtenerVarianteGlobalCabelloEditor()
        : null;

    const varianteRecordada =
      varianteCabelloGlobal ??
      variantesSesionRef.current[item.id];

    if (
      item.customization.type === "image_variants" &&
      varianteRecordada
    ) {
      siguiente = establecerVarianteImagenAvatarV2(
        siguiente,
        item,
        varianteRecordada
      );
    }

    const colorRecordado = coloresSesionRef.current[item.id];
    if (item.customization.type === "tint" && colorRecordado) {
      siguiente = establecerColorItemAvatarV2(
        siguiente,
        item,
        colorRecordado
      );
    }

    recordarFamiliaRopa(item);
    void aplicarConfigAtomica(siguiente, item.id);
  };

  const guardar = async () => {
    if (guardando) return false;

    const slotsBloqueados = Object.entries(config.selections)
      .filter(([, itemId]) => !estaDesbloqueadoPorId(itemId))
      .map(([slot]) => etiquetaSlot(slot));

    const seccionesBloqueadas = Array.from(new Set(slotsBloqueados));

    if (seccionesBloqueadas.length === 1) {
      setMensaje(
        `⚠️ El elemento seleccionado en ${seccionesBloqueadas[0]} todavía está bloqueado.`
      );
      return false;
    }

    if (seccionesBloqueadas.length > 1) {
      setMensaje(
        `⚠️ Seleccionaste algunos elementos que todavía están bloqueados: ${listaNatural(
          seccionesBloqueadas
        )}.`
      );
      return false;
    }

    setGuardando(true);
    setMensaje("");

    try {
      const resultado = await onSave(config);

      if (resultado === false) {
        setMensaje(
          "⚠️ No se pudo confirmar el guardado. Revisa tu conexión e inténtalo de nuevo."
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("[FCC Academy] Error guardando avatar V2:", error);
      setMensaje(
        "⚠️ No se pudo confirmar el guardado. Revisa tu conexión e inténtalo de nuevo."
      );
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const cambiarGeneroEditor = (gender: GeneroAvatar) => {
    if (gender === config.gender) return;

    const sinContraparte = Object.entries(config.selections)
      .filter(([, itemId]) => {
        const item = obtenerItemAvatarPorId(itemId);
        return item ? !itemCompatibleConGenero(item, gender) : false;
      })
      .map(([slot]) => etiquetaSlot(slot));

    const siguiente = cambiarGenero(config, gender);
    void aplicarConfigAtomica(siguiente, itemPersonalizacionId);

    const secciones = Array.from(new Set(sinContraparte));

    if (secciones.length > 0) {
      setMensaje(
        `⚠️ No encontré la versión ${
          gender === "masculino" ? "masculina" : "femenina"
        } correspondiente en: ${listaNatural(secciones)}. Esos elementos volvieron a su opción base o se quitaron.`
      );
    } else {
      setMensaje("");
    }
  };

  const seccionActual: SeccionEstudianteAvatar | null =
    secciones.find((seccion) => seccion.key === tab) ?? null;

  const obtenerVarianteGlobalCabelloEditor = () => {
    const cabelloSeleccionadoId =
      config.selections.cabello ?? null;

    if (cabelloSeleccionadoId) {
      const recordada =
        variantesSesionRef.current[cabelloSeleccionadoId];
      if (recordada) return recordada;

      const actual =
        config.imageVariants[cabelloSeleccionadoId];
      if (typeof actual === "string" && actual) {
        return actual;
      }
    }

    for (const [itemId, optionKey] of Object.entries(
      variantesSesionRef.current
    )) {
      if (itemId.startsWith("cabello/") && optionKey) {
        return optionKey;
      }
    }

    for (const [itemId, optionKey] of Object.entries(
      config.imageVariants
    )) {
      if (
        itemId.startsWith("cabello/") &&
        typeof optionKey === "string" &&
        optionKey
      ) {
        return optionKey;
      }
    }

    const cabelloBase = obtenerItemAvatarPorId(
      "cabello/Cabello1"
    );

    return cabelloBase?.customization.type ===
      "image_variants"
      ? cabelloBase.customization.defaultOption ??
          cabelloBase.customization.options[0]
            ?.key ??
          null
      : null;
  };

  const renderTarjeta = (
    entrada: ItemCatalogoAvatar | GrupoColorRopa,
    seleccionadoId: string | null
  ) => {
    const esGrupo = "familia" in entrada;
    const itemsGrupo = esGrupo ? entrada.items : [entrada];
    const seleccionadoGrupo = itemsGrupo.find(
      (item) => item.id === seleccionadoId
    );

    const claveFamilia =
      esGrupo && itemsGrupo[0]?.subsection
        ? `${itemsGrupo[0].subsection}:${entrada.familia}`
        : null;

    const itemRecordadoId = claveFamilia
      ? familiasRopaSesionRef.current[claveFamilia]
      : null;

    const itemRecordado = itemRecordadoId
      ? itemsGrupo.find((item) => item.id === itemRecordadoId)
      : null;

    const representante =
      seleccionadoGrupo ??
      itemRecordado ??
      itemsGrupo.find((item) => estaDesbloqueado(item)) ??
      itemsGrupo[0];

    if (!representante) return null;

    const selected = Boolean(seleccionadoGrupo);
    const unlocked = itemsGrupo.some((item) => estaDesbloqueado(item));
    const clave = esGrupo ? `grupo:${entrada.familia}` : representante.id;
    const nombre = esGrupo ? entrada.familia : representante.name;

    return (
      <button
        key={clave}
        type="button"
        className={`avatar-editor-option group ${
          selected ? "is-selected" : ""
        } ${!unlocked ? "is-locked" : ""}`}
        style={{
          filter: unlocked
            ? "none"
            : "grayscale(100%) brightness(0.6)",
          opacity: unlocked ? 1 : 0.7,
        }}
        onClick={() => seleccionar(representante)}
        aria-label={nombre}
        disabled={avatarActualizando}
      >
        <div className="avatar-editor-option-inner">
          <VistaPreviaItem
            item={representante}
            config={config}
            imageVariantOverride={
              obtenerSlotItemAvatar(representante) ===
              "cabello"
                ? obtenerVarianteGlobalCabelloEditor()
                : variantesSesionRef.current[representante.id]
            }
            colorOverride={
              coloresSesionRef.current[representante.id]
            }
          />
        </div>

        {!unlocked && (
          <div className="avatar-editor-lock-layer absolute inset-0 flex items-center justify-center rounded-[18px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-6 w-6 text-white opacity-90"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z" />
            </svg>

            <div className="avatar-editor-tooltip absolute left-1/2 top-1/2 z-[120] px-3 py-1.5 text-center text-[11px]">
              Desbloquea cofres
              <br />
              para obtener este elemento
            </div>
          </div>
        )}
      </button>
    );
  };

  const renderItems = (items: ItemCatalogoAvatar[], slot: string) => {
    const compatibles = ordenarItemsEditor(
      items.filter((item) => itemCompatibleConGenero(item, config.gender)),
      config.gender
    );

    const permiteNinguno = slot.startsWith("accesorios/");
    const seleccionadoId = config.selections[slot] ?? null;
    const opcionesVisuales = compatibles;

    return (
      <div className="grid grid-cols-3 gap-3 overflow-hidden px-1">
        {permiteNinguno && (
          <button
            type="button"
            className={`avatar-editor-option group ${
              !seleccionadoId ? "is-selected" : ""
            }`}
            onClick={() => {
              if (avatarActualizando) return;
              const siguiente = quitarSeleccionAvatarV2(config, slot);
              void aplicarConfigAtomica(siguiente, null);
            }}
            aria-label="Ninguno"
            disabled={avatarActualizando}
          >
            <div className="avatar-editor-option-inner">
              <span className="avatar-editor-none-text">Ninguno</span>
            </div>
          </button>
        )}

        {opcionesVisuales.map((item) =>
          renderTarjeta(item, seleccionadoId)
        )}
      </div>
    );
  };

  const renderRopaItems = (
    items: ItemCatalogoAvatar[],
    seleccionadoVisualId: string | null = null
  ) => {
    const compatibles = ordenarItemsEditor(
      items.filter((item) =>
        itemCompatibleConGenero(
          item,
          config.gender
        )
      ),
      config.gender
    );

    const opcionesVisuales = agruparItemsRopa(
      compatibles,
      config.gender
    );

    const seleccionadoRealId =
      Object.entries(config.selections).find(
        ([slot]) => esSlotRopa(slot)
      )?.[1] ?? null;

    const seleccionadoId =
      seleccionadoRealId ?? seleccionadoVisualId;

    return (
      <div className="grid grid-cols-3 gap-3 overflow-hidden px-1">
        {opcionesVisuales.map((entrada) =>
          renderTarjeta(
            entrada,
            seleccionadoId
          )
        )}
      </div>
    );
  };

  const renderRopaAgrupada = (
    seccion: Extract<
      SeccionEstudianteAvatar,
      { type: "grouped" }
    >
  ) => {
    const subsecciones = [
      ...seccion.subsections,
    ].sort((a, b) => {
      if (a.key === "prendas_unicas") return 1;
      if (b.key === "prendas_unicas") return -1;

      return a.label.localeCompare(
        b.label,
        "es",
        {
          numeric: true,
          sensitivity: "base",
        }
      );
    });

    const ropaSeleccionadaReal =
      Object.entries(config.selections).find(
        ([slot]) => esSlotRopa(slot)
      )?.[1] ?? null;

    let primeraRopaVisualId: string | null = null;

    if (!ropaSeleccionadaReal) {
      const playeraTirantes = subsecciones
        .flatMap((sub) => sub.items)
        .find(
          (item) =>
            item.id ===
              PRENDA_VISUAL_INICIAL_ESTUDIANTE_ID &&
            itemCompatibleConGenero(
              item,
              config.gender
            )
        );

      primeraRopaVisualId =
        playeraTirantes?.id ?? null;
    }

    return (
      <>
        {subsecciones.map((sub) => (
          <div
            key={sub.key}
            className="mb-5 last:mb-0"
          >
            <h3 className="avatar-editor-section-title mb-3 text-center text-sm font-semibold">
              {sub.label}
            </h3>

            {renderRopaItems(
              sub.items,
              primeraRopaVisualId
            )}
          </div>
        ))}
      </>
    );
  };
  const itemSeleccionado = (() => {
    if (!seccionActual || seccionActual.type === "body") return null;

    if (itemPersonalizacionId) {
      const rastreado = obtenerItemAvatarPorId(itemPersonalizacionId);

      if (
        rastreado &&
        rastreado.section === seccionActual.key &&
        Object.values(config.selections).includes(rastreado.id)
      ) {
        return rastreado;
      }
    }

    if (seccionActual.type === "collection") {
      const id = config.selections[seccionActual.key];
      return id ? obtenerItemAvatarPorId(id) : null;
    }

    const subsecciones =
      seccionActual.subsections;

    for (const sub of subsecciones) {
      const id = config.selections[`${seccionActual.key}/${sub.key}`];

      if (id) {
        return obtenerItemAvatarPorId(id);
      }
    }

    return null;
  })();

  const grupoColorSeleccionado = (() => {
    if (
      !itemSeleccionado ||
      seccionActual?.type !== "grouped" ||
      itemSeleccionado.section !== "ropa"
    ) {
      return null;
    }

    const datos = separarFamiliaColorRopa(itemSeleccionado);
    if (!datos) return null;

    const sub = seccionActual.subsections.find(
      (subseccion) => subseccion.key === itemSeleccionado.subsection
    );

    if (!sub) return null;

    const items = ordenarItemsEditor(
      sub.items.filter((item) => {
        const otro = separarFamiliaColorRopa(item);

        return (
          otro?.familia === datos.familia &&
          itemCompatibleConGenero(item, config.gender)
        );
      }),
      config.gender
    );

    return items.length > 1
      ? {
          familia: datos.familia,
          items,
        }
      : null;
  })();


  const varianteCuerpoActual =
    seccionActual?.type === "body"
      ? seccionActual.variants[config.gender]
      : null;

  const cuerpoAdmiteColor = Boolean(
    varianteCuerpoActual?.fill &&
      varianteCuerpoActual?.outline &&
      tonosPiel.length > 0
  );

  const mostrarPersonalizacion =
    (tab === "cuerpo" && cuerpoAdmiteColor) ||
    Boolean(grupoColorSeleccionado) ||
    itemSeleccionado?.customization.type === "tint" ||
    tieneMultiplesVariantesImagen(
      itemSeleccionado,
      config.gender
    );

  const modal = createPortal(
    <div
      className="avatar-editor-overlay fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      style={{
        zIndex: 10020,
        opacity: avatarListo && !desvanecerSalida ? 1 : 0.001,
        pointerEvents:
          avatarListo && !desvanecerSalida ? "auto" : "none",
        transform: desactivarAnimacionEntrada
          ? undefined
          : avatarListo && !desvanecerSalida
            ? "scale(1)"
            : "scale(0.992)",
        transition: desactivarAnimacionEntrada
          ? `opacity ${duracionTransicionMs}ms ease`
          : `opacity ${duracionTransicionMs}ms ease, transform ${duracionTransicionMs}ms ease`,
        animation: "none",
      }}
      aria-hidden={!avatarListo}
      onClick={forzado ? undefined : onClose}
    >
      <div
        className="avatar-editor-modal relative flex max-h-[94vh] w-[96vw] max-w-[1240px] flex-col overflow-hidden rounded-[28px] p-3 sm:p-6"
        style={{
          animation: "none",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {!forzado && (
          <button
            type="button"
            onClick={onClose}
            className="avatar-editor-close absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none"
            title="Cerrar"
          >
            ×
          </button>
        )}

        <div className="mb-3 px-8 text-center sm:mb-5">
          <p className="avatar-editor-eyebrow">Personalización</p>
          <h2 className="avatar-editor-title">Editor de Avatar</h2>
        </div>

        <div className="avatar-editor-body flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:gap-5">
          <div className="avatar-editor-preview-shell flex min-h-0 w-full flex-shrink-0 flex-col items-center lg:w-[500px] xl:w-[520px]">
            <div className="avatar-editor-avatar-stage relative flex items-center justify-center">
              <span className="avatar-editor-avatar-orbit" />

              <div className="avatar-editor-avatar-render relative z-[2]">
                <RenderizadorAvatar
                  config={config}
                  size={TAMANO_AVATAR_EDITOR}
                  mantenerAnteriorDuranteCarga
                  onReady={() => {
                    setAvatarListo(true);

                    if (esperandoCommitVisualRef.current) {
                      esperandoCommitVisualRef.current = false;
                      setMostrarLoaderCambio(false);
                      loaderCambioVisibleDesdeRef.current = null;
                      setAvatarActualizando(false);
                    }

                    if (!readyRef.current) {
                      readyRef.current = true;
                      onReady?.();
                    }
                  }}
                />

                {mostrarLoaderCambio && (
                  <div
                    className="avatar-editor-update-overlay absolute inset-0 z-[8] flex items-center justify-center"
                    aria-live="polite"
                    aria-label="Actualizando avatar"
                  >
                    <div className="avatar-editor-update-loader">
                      <CargadorFCC
                        compacto
                        mensaje="Actualizando avatar"
                        detalle=""
                        className="avatar-editor-inline-loader"
                      />
                    </div>
                  </div>
                )}
              </div>

              {tab === "cuerpo" && cuerpoAdmiteColor && (
                <div
                  className="avatar-editor-side-palette"
                  aria-label="Tono de piel"
                >
                  <div className="avatar-editor-side-palette-list">
                    {tonosPiel.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`avatar-editor-color-dot ${
                          config.skinColor === color ? "is-selected" : ""
                        }`}
                        style={{
                          backgroundColor: color,
                          ...estiloSwatch(color),
                        }}
                        onClick={() => {
                          if (avatarActualizando) return;
                          void aplicarConfigAtomica(
                            {
                              ...config,
                              skinColor: color,
                            },
                            itemPersonalizacionId
                          );
                        }}
                        disabled={avatarActualizando}
                        title="Color de piel"
                      />
                    ))}
                  </div>
                </div>
              )}

              {tab !== "cuerpo" && mostrarPersonalizacion && (
                <div
                  className="avatar-editor-side-palette"
                  aria-label="Variantes de color"
                >
                  {grupoColorSeleccionado && (
                    <div className="avatar-editor-side-palette-list">
                      {grupoColorSeleccionado.items.map((item) => {
                        const datos = separarFamiliaColorRopa(item);
                        const color = datos?.color ?? item.name;
                        const swatch = swatchColorRopa(color);
                        const selected = itemSeleccionado?.id === item.id;
                        const unlocked = estaDesbloqueado(item);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`avatar-editor-color-dot relative ${
                              selected ? "is-selected" : ""
                            } ${!unlocked ? "is-locked-color" : ""}`}
                            style={{
                              backgroundColor: swatch ?? undefined,
                              opacity: unlocked ? 1 : 0.62,
                              ...estiloSwatch(swatch),
                            }}
                            onClick={() => seleccionar(item)}
                            disabled={avatarActualizando}
                            title={`${etiquetaSimple(color)}${
                              unlocked ? "" : " · Bloqueado"
                            }`}
                            aria-label={etiquetaSimple(color)}
                          >
                            {!swatch
                              ? etiquetaSimple(color).slice(0, 1).toUpperCase()
                              : null}

                            {!unlocked && (
                              <span className="avatar-editor-color-lock absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  className="h-2.5 w-2.5"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {itemSeleccionado?.customization.type === "tint" && (
                    <div className="avatar-editor-side-palette-list">
                      {itemSeleccionado.customization.colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`avatar-editor-color-dot ${
                            config.colors[itemSeleccionado.id] === color
                              ? "is-selected"
                              : ""
                          }`}
                          style={{
                            backgroundColor: color,
                            ...estiloSwatch(color),
                          }}
                          onClick={() => {
                            if (avatarActualizando) return;
                            coloresSesionRef.current[
                              itemSeleccionado.id
                            ] = color;

                            const siguiente =
                              establecerColorItemAvatarV2(
                                config,
                                itemSeleccionado,
                                color
                              );
                            void aplicarConfigAtomica(
                              siguiente,
                              itemSeleccionado.id
                            );
                          }}
                          disabled={avatarActualizando}
                          title="Color"
                        />
                      ))}
                    </div>
                  )}

                  {itemSeleccionado?.customization.type === "image_variants" && (
                    <div className="avatar-editor-side-palette-list">
                      {itemSeleccionado.customization.options
                        .filter((option) =>
                          Boolean(
                            option.variants[config.gender] ??
                              option.variants.universal
                          )
                        )
                        .map((option) => {
                          const slotActual = obtenerSlotItemAvatar(
                            itemSeleccionado
                          );
                          const valorSeleccionado =
                            slotActual === "cabello"
                              ? obtenerVarianteGlobalCabelloEditor()
                              : config.imageVariants[
                                  itemSeleccionado.id
                                ];

                          return (
                            <button
                              key={option.key}
                              type="button"
                              className={`avatar-editor-color-dot ${
                                valorSeleccionado === option.key
                                  ? "is-selected"
                                  : ""
                              }`}
                              style={
                                option.swatch
                                  ? {
                                      backgroundColor: option.swatch,
                                      ...estiloSwatch(option.swatch),
                                    }
                                  : undefined
                              }
                              onClick={() => {
                                if (avatarActualizando) return;
                                variantesSesionRef.current[
                                  itemSeleccionado.id
                                ] = option.key;

                                const siguiente =
                                  establecerVarianteImagenAvatarV2(
                                    config,
                                    itemSeleccionado,
                                    option.key
                                  );
                                void aplicarConfigAtomica(
                                  siguiente,
                                  itemSeleccionado.id
                                );
                              }}
                              disabled={avatarActualizando}
                              title={option.label}
                              aria-label={option.label}
                            >
                              {!option.swatch
                                ? option.label
                                    .slice(0, 1)
                                    .toUpperCase()
                                : null}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="avatar-editor-controls flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="avatar-editor-tabs mb-3 flex justify-start gap-2 overflow-x-auto">
              {secciones.map((seccion) => (
                <button
                  key={seccion.key}
                  type="button"
                  className={`avatar-editor-tab ${
                    tab === seccion.key ? "is-active" : ""
                  }`}
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    setTab(seccion.key);
                    setItemPersonalizacionId(null);
                  }}
                  disabled={avatarActualizando}
                >
                  {seccion.label}
                </button>
              ))}
            </div>

            <div
              className={`avatar-editor-options-scroll min-h-0 flex-1 overflow-y-auto pr-2 ${
                tab === "cuerpo" ? "is-gender-tab" : ""
              }`}
              style={{
                overflowX: "hidden",
                overflowY: tab === "cuerpo" ? "hidden" : "auto",
              }}
            >
              {seccionActual?.type === "body" && (
                <div className="avatar-editor-gender-grid grid h-full grid-cols-2 gap-3">
                  {(["masculino", "femenino"] as GeneroAvatar[]).map(
                    (gender) => (
                      <button
                        key={gender}
                        type="button"
                        className={`avatar-editor-option avatar-editor-gender-option group ${
                          config.gender === gender ? "is-selected" : ""
                        }`}
                        onClick={() => cambiarGeneroEditor(gender)}
                        disabled={avatarActualizando}
                      >
                        <span className="avatar-editor-gender-label">
                          {gender === "masculino"
                            ? "Masculino"
                            : "Femenino"}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}

              {seccionActual?.type === "collection" &&
                renderItems(seccionActual.items, seccionActual.key)}

              {seccionActual?.type === "grouped" &&
                (seccionActual.key === "ropa"
                  ? renderRopaAgrupada(seccionActual)
                  : [...seccionActual.subsections]
                      .sort((a, b) =>
                        a.label.localeCompare(b.label, "es", {
                          numeric: true,
                          sensitivity: "base",
                        })
                      )
                      .map((sub) => (
                        <div key={sub.key} className="mb-5 last:mb-0">
                          <h3 className="avatar-editor-section-title mb-3 text-center text-sm font-semibold">
                            {sub.label}
                          </h3>

                          {renderItems(
                            sub.items,
                            `${seccionActual.key}/${sub.key}`
                          )}
                        </div>
                      )))}
            </div>
          </div>
        </div>

        <div className="avatar-editor-footer mt-3 flex flex-col-reverse items-stretch justify-end gap-3 sm:mt-4 sm:flex-row sm:items-center sm:gap-4">
          {!forzado && (
            <button
              type="button"
              className="avatar-editor-secondary-button px-4 py-2"
              onClick={onClose}
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            className="fcc-premium-button px-5 py-2"
            disabled={guardando || !avatarListo || avatarActualizando}
            onClick={() => void guardar()}
          >
            {guardando
              ? "Confirmando…"
              : forzado
                ? "Crear avatar"
                : "Guardar cambios"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes avatar-editor-fade-zoom-in {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(10px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes avatar-editor-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .avatar-editor-overlay {
          background:
            radial-gradient(
              circle at 18% 16%,
              color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent),
              transparent 34%
            ),
            radial-gradient(
              circle at 84% 78%,
              color-mix(in srgb, var(--fcc-premium-cyan) 14%, transparent),
              transparent 36%
            ),
            rgba(2, 8, 23, 0.58);
          backdrop-filter: blur(7px);
          animation: avatar-editor-fade-zoom-in 0.28s ease-out;
        }

        .avatar-editor-modal {
          height: auto;
          max-height: calc(100dvh - 2rem);
          color: var(--fcc-premium-text);
          background:
            radial-gradient(
              circle at 88% 90%,
              color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface-strong),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow:
            0 30px 90px rgba(2, 8, 23, 0.28),
            var(--fcc-premium-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.72);
          animation: avatar-editor-fade-zoom-in 0.24s ease-out;
        }

        .theme-oscuro .avatar-editor-modal {
          box-shadow:
            0 34px 96px rgba(0, 0, 0, 0.72),
            var(--fcc-premium-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .avatar-editor-close {
          color: #ffffff;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: 1px solid color-mix(in srgb, #ef4444 70%, white);
          box-shadow: 0 8px 20px rgba(239, 68, 68, 0.22);
        }

        .avatar-editor-close:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, #ef4444 82%, white);
          color: #ffffff;
          filter: brightness(1.05);
        }

        .avatar-editor-eyebrow {
          margin-bottom: 0.2rem;
          color: var(--fcc-premium-accent);
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .avatar-editor-title {
          color: var(--fcc-premium-text);
          font-size: clamp(1.35rem, 3vw, 1.9rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .avatar-editor-preview-shell {
          --fcc-user-avatar-core: color-mix(
            in srgb,
            var(--fcc-premium-cyan) 18%,
            transparent
          );
          --fcc-user-avatar-a: color-mix(
            in srgb,
            var(--fcc-premium-accent) 34%,
            transparent
          );
          --fcc-user-avatar-b: color-mix(
            in srgb,
            var(--fcc-premium-cyan) 28%,
            transparent
          );
          --fcc-user-avatar-c: color-mix(
            in srgb,
            var(--fcc-premium-accent) 26%,
            transparent
          );
          --fcc-user-avatar-border: color-mix(
            in srgb,
            var(--fcc-premium-accent) 28%,
            transparent
          );
          --fcc-user-avatar-shadow-a: color-mix(
            in srgb,
            var(--fcc-premium-accent) 4%,
            transparent
          );
          --fcc-user-avatar-shadow-b: color-mix(
            in srgb,
            var(--fcc-premium-accent) 18%,
            transparent
          );
          --fcc-user-orbit-a: color-mix(
            in srgb,
            var(--fcc-premium-accent) 20%,
            transparent
          );
          --fcc-user-orbit-b: color-mix(
            in srgb,
            var(--fcc-premium-cyan) 22%,
            transparent
          );

          position: relative;
          justify-content: center;
          padding-top: 0;
          overflow: visible;
        }

        .avatar-editor-avatar-stage {
          --avatar-editor-stage-size: min(100%, 520px);
          --avatar-editor-render-scale: 1.48;
          --avatar-editor-render-bottom: -18px;
          --avatar-editor-avatar-circle-size: min(82%, 388px);
          --avatar-editor-avatar-ring-size: min(70%, 330px);
          --avatar-editor-avatar-orbit-size: min(66%, 310px);

          position: relative;
          flex: 0 0 auto;
          width: var(--avatar-editor-stage-size);
          height: var(--avatar-editor-stage-size);
          max-width: 100%;
          display: grid;
          place-items: end center;
          overflow: visible;
          isolation: isolate;
        }

        .avatar-editor-avatar-stage::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-circle-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          background:
            radial-gradient(
              circle,
              var(--fcc-user-avatar-core),
              transparent 62%
            ),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--fcc-user-avatar-a) 42deg,
              transparent 84deg,
              var(--fcc-user-avatar-b) 145deg,
              transparent 210deg,
              var(--fcc-user-avatar-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -3;
        }

        .avatar-editor-avatar-stage::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-ring-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          border: 1px solid var(--fcc-user-avatar-border);
          box-shadow:
            0 0 0 14px var(--fcc-user-avatar-shadow-a),
            0 0 42px var(--fcc-user-avatar-shadow-b);
          z-index: -2;
        }

        .avatar-editor-avatar-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-orbit-size);
          aspect-ratio: 1 / 1;
          z-index: -1;
          border-radius: 999px;
          transform: translate(-50%, -50%) rotate(-18deg);
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--fcc-user-orbit-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--fcc-user-orbit-b) 60% 64%,
              transparent 64% 100%
            );
          opacity: 0.95;
        }

        .avatar-editor-avatar-render {
          position: absolute !important;
          left: 50%;
          bottom: var(--avatar-editor-render-bottom);
          z-index: 2;
          display: grid;
          place-items: center;
          transform: translateX(-50%)
            scale(var(--avatar-editor-render-scale)) !important;
          transform-origin: center bottom;
        }

        .avatar-editor-avatar-render > * {
          max-width: none !important;
          max-height: none !important;
        }

        .avatar-editor-update-overlay {
          border-radius: 999px;
          pointer-events: none;
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 54%,
            transparent
          );
          backdrop-filter: blur(1.5px);
        }

        .avatar-editor-update-loader {
          width: 184px;
          max-width: 58%;
          transform: scale(0.72);
          transform-origin: center;
        }

        .avatar-editor-inline-loader {
          min-height: 0 !important;
          padding: 8px !important;
        }

        .avatar-editor-side-palette {
          position: absolute;
          right: clamp(2px, 1.5vw, 14px);
          top: 50%;
          z-index: 7;
          display: flex;
          max-height: 88%;
          align-items: center;
          justify-content: center;
          transform: translateY(-50%);
          pointer-events: auto;
        }

        .avatar-editor-side-palette-list {
          display: flex;
          max-height: 100%;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 7px;
          overflow-y: auto;
          overflow-x: visible;
          padding: 4px;
          scrollbar-width: none;
        }

        .avatar-editor-side-palette-list::-webkit-scrollbar {
          display: none;
        }

        .avatar-editor-side-palette .avatar-editor-color-dot {
          width: 2.1rem;
          height: 2.1rem;
          flex: 0 0 auto;
        }

        .avatar-editor-color-dot {
          display: grid;
          place-items: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 999px;
          color: var(--fcc-premium-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 92%,
            transparent
          );
          border: 2px solid var(--fcc-premium-border);
          box-shadow: none;
          opacity: 0.96;
          font-size: 0.72rem;
          font-weight: 900;
        }

        .avatar-editor-color-dot:hover {
          transform: translateY(-1px) scale(1.04);
        }

        .avatar-editor-color-dot.is-selected {
          transform: scale(1.08);
          border: 4px solid var(--fcc-premium-accent);
          box-shadow: none;
        }

        .avatar-editor-color-dot.is-locked-color {
          filter: grayscale(35%);
        }

        .avatar-editor-color-lock {
          color: #ffffff;
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.82);
          pointer-events: none;
        }

        .avatar-editor-tabs {
          scrollbar-width: thin;
          box-sizing: border-box;
          padding: 6px 4px 8px;
          scroll-padding-inline: 4px;
        }

        .avatar-editor-tab {
          min-height: 34px;
          border-radius: 999px;
          padding: 0 0.85rem;
          color: var(--fcc-premium-muted);
          background: transparent;
          border: 1px solid transparent;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .avatar-editor-tab:hover {
          color: var(--fcc-premium-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-accent) 8%,
            transparent
          );
          border-color: var(--fcc-premium-border);
        }

        .avatar-editor-tab.is-active {
          color: white;
          background: var(--fcc-premium-button);
          border-color: color-mix(
            in srgb,
            var(--fcc-premium-accent) 32%,
            transparent
          );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .theme-oscuro .avatar-editor-tab.is-active {
          color: #050505;
        }

        .avatar-editor-options-scroll {
          box-sizing: border-box;
          min-height: 0;
          flex: 1 1 auto;
          height: auto !important;
          padding: 4px 6px 8px 4px;
          scroll-padding-top: 4px;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          scroll-behavior: auto;
          contain: paint;
        }

        .avatar-editor-section-title {
          color: var(--fcc-premium-text);
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .avatar-editor-option {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          cursor: pointer;
          overflow: hidden;
          border-radius: 18px;
          contain: layout paint;
          isolation: isolate;
          padding: 0;
          border: 1px solid var(--fcc-premium-border);
          background:
            radial-gradient(
              circle at 72% 18%,
              color-mix(in srgb, var(--fcc-premium-cyan) 8%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
          transition:
            box-shadow var(--fcc-transition),
            border-color var(--fcc-transition),
            filter var(--fcc-transition),
            opacity var(--fcc-transition);
        }

        .theme-oscuro .avatar-editor-option {
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .avatar-editor-option:hover {
          border-color: var(--fcc-premium-border-strong);
        }

        .avatar-editor-option.is-selected {
          border-width: 2px;
          border-color: var(--fcc-premium-accent);
          box-shadow:
            inset 0 0 0 3px
              color-mix(
                in srgb,
                var(--fcc-premium-accent) 20%,
                transparent
              ),
            inset 0 0 0 1px
              color-mix(
                in srgb,
                var(--fcc-premium-accent) 18%,
                transparent
              );
        }

        .avatar-editor-option-inner {
          position: relative;
          display: flex;
          width: 100%;
          height: 100%;
          aspect-ratio: 1 / 1;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--fcc-premium-surface-strong) 88%,
                transparent
              ),
              color-mix(
                in srgb,
                var(--fcc-premium-surface-soft) 94%,
                transparent
              )
            );
        }

        .avatar-editor-option-inner img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .avatar-editor-none-text,
        .avatar-v2-empty {
          color: var(--fcc-premium-muted);
          font-size: 0.88rem;
          font-weight: 700;
        }

        .avatar-editor-options-scroll.is-gender-tab {
          overflow-y: hidden !important;
          padding: 0.35rem;
        }

        .avatar-editor-gender-grid {
          width: 100%;
          min-width: 0;
          min-height: 100%;
          height: 100%;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: stretch;
          overflow: visible;
          padding: 0.25rem;
          box-sizing: border-box;
        }

        .avatar-editor-gender-option {
          display: flex !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          height: 100% !important;
          min-height: 0;
          align-items: center !important;
          justify-content: center !important;
          text-align: center;
          box-sizing: border-box;
        }

        .avatar-editor-gender-label {
          display: block;
          width: 100%;
          color: var(--fcc-premium-text);
          font-size: 1rem;
          font-weight: 900;
          text-align: center;
        }

        .avatar-editor-option.is-locked {
          z-index: 1;
        }

        .avatar-editor-option.is-locked:hover {
          z-index: 80;
        }

        .avatar-editor-lock-layer {
          z-index: 30;
          background: rgba(0, 0, 0, 0.28);
          overflow: visible;
          pointer-events: none;
        }

        .avatar-editor-tooltip {
          width: max-content;
          max-width: 124px;
          white-space: normal;
          word-break: normal;
          line-height: 1.08rem;
          color: var(--fcc-premium-text);
          background: var(--fcc-premium-surface-strong);
          border: 1px solid var(--fcc-premium-border);
          border-radius: 10px;
          box-shadow: none;
          opacity: 0;
          transform: translate(-50%, -50%);
          transition: opacity var(--fcc-transition);
        }

        .group:hover .avatar-editor-tooltip {
          opacity: 1;
          transform: translate(-50%, -50%);
        }

        .avatar-editor-secondary-button {
          min-height: 40px;
          border-radius: 12px;
          color: var(--fcc-premium-text);
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--fcc-premium-surface-strong) 94%,
                transparent
              ),
              color-mix(
                in srgb,
                var(--fcc-premium-surface-soft) 94%,
                transparent
              )
            );
          border: 1px solid var(--fcc-premium-border);
          font-weight: 850;
          box-shadow: var(--fcc-premium-shadow-soft);
        }

        .avatar-editor-secondary-button:hover {
          transform: translateY(-1px);
          color: var(--fcc-premium-accent);
          border-color: var(--fcc-premium-border-strong);
        }

        .avatar-editor-toast {
          animation: avatar-editor-fade-in 0.3s ease-out;
        }


        @media (min-width: 1024px) {
          .avatar-editor-modal {
            height: min(760px, calc(100dvh - 28px));
            max-height: min(760px, calc(100dvh - 28px));
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            height: 100%;
            min-height: 0;
            justify-content: center;
            overflow: visible;
          }

          .avatar-editor-controls {
            height: 100%;
            min-height: 0;
            overflow: hidden !important;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            flex: 1 1 auto;
            height: auto !important;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            overflow-y: hidden !important;
          }

          .avatar-editor-gender-grid {
            height: 100%;
            min-height: 100%;
          }

          .avatar-editor-gender-option {
            min-height: 0 !important;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
          }
        }

        @media (min-width: 1180px) {
          .avatar-editor-tabs {
            justify-content: center !important;
            overflow-x: visible !important;
            gap: 0.3rem !important;
          }

          .avatar-editor-tab {
            padding-left: 0.58rem;
            padding-right: 0.58rem;
            font-size: 0.73rem;
          }
        }

        @media (min-width: 641px) and (max-width: 1023px) {
          .avatar-editor-modal {
            height: calc(100dvh - 1.5rem) !important;
            max-height: calc(100dvh - 1.5rem) !important;
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            gap: 0.75rem !important;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            flex: 0 0 auto;
            margin: 0 auto;
            overflow: visible;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(62vw, 300px);
            --avatar-editor-render-scale: 0.74;
            --avatar-editor-render-bottom: 0px;
          }

          .avatar-editor-side-palette {
            right: 2px;
            max-height: 90%;
          }

          .avatar-editor-side-palette-list {
            gap: 6px;
          }

          .avatar-editor-side-palette .avatar-editor-color-dot {
            width: 1.9rem;
            height: 1.9rem;
          }

          .avatar-editor-controls {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-tabs {
            flex: 0 0 auto;
            margin-bottom: 0.5rem !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            height: auto !important;
            flex: 1 1 auto;
            padding: 0.25rem 0.35rem 0.55rem;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            padding: 0.35rem;
            overflow-y: hidden !important;
          }

          .avatar-editor-option.is-selected {
            transform: none;
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 128px !important;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
            flex-direction: row !important;
            align-items: stretch !important;
            margin-top: 0.75rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 42px;
            flex: 1 1 0;
            white-space: nowrap;
          }

          .avatar-editor-footer .fcc-premium-button {
            flex-grow: 1.18;
          }
        }

        @media (max-width: 640px) {
          .avatar-editor-overlay {
            align-items: center;
            padding: 0.5rem;
          }

          .avatar-editor-modal {
            width: calc(100vw - 1rem) !important;
            height: calc(100dvh - 1rem) !important;
            max-height: calc(100dvh - 1rem) !important;
            border-radius: 24px;
            padding: 0.75rem !important;
            overflow: hidden;
          }

          .avatar-editor-close {
            right: 0.75rem;
            top: 0.75rem;
            height: 2.5rem;
            width: 2.5rem;
          }

          .avatar-editor-modal > .mb-3 {
            margin-bottom: 0.35rem !important;
            padding-left: 3rem !important;
            padding-right: 3rem !important;
          }

          .avatar-editor-eyebrow {
            margin-bottom: 0.08rem;
            font-size: 0.64rem;
            letter-spacing: 0.18em;
          }

          .avatar-editor-title {
            font-size: clamp(1.18rem, 5.7vw, 1.42rem);
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            gap: 0.45rem !important;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            flex: 0 0 auto;
            margin: 0 auto;
            overflow: visible;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(76vw, 246px);
            --avatar-editor-render-scale: 0.62;
            --avatar-editor-render-bottom: 0px;
          }

          .avatar-editor-side-palette {
            right: 0;
            max-height: 92%;
          }

          .avatar-editor-side-palette-list {
            gap: 5px;
            padding: 3px;
          }

          .avatar-editor-side-palette .avatar-editor-color-dot {
            width: 1.62rem;
            height: 1.62rem;
            flex: 0 0 auto;
          }

          .avatar-editor-color-dot.is-selected {
            border-width: 3px;
          }

          .avatar-editor-controls {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-tabs {
            position: relative;
            z-index: 5;
            flex: 0 0 auto;
            margin-bottom: 0.35rem !important;
            padding-bottom: 0.35rem;
            gap: 0.42rem !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch;
          }

          .avatar-editor-tab {
            min-height: 30px;
            flex: 0 0 auto;
            padding: 0 0.68rem;
            font-size: 0.68rem;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            height: auto !important;
            flex: 1 1 auto;
            padding: 0.25rem 0.3rem 0.55rem;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            padding: 0.35rem;
            overflow-y: hidden !important;
          }

          .avatar-editor-options-scroll .grid {
            gap: 0.55rem !important;
          }

          .avatar-editor-section-title {
            margin-bottom: 0.5rem !important;
            font-size: 0.78rem;
          }

          .avatar-editor-option {
            border-radius: 16px;
          }

          .avatar-editor-option-inner {
            border-radius: 14px;
          }

          .avatar-editor-option.is-selected {
            transform: none;
          }

          .avatar-editor-gender-option {
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            height: 100% !important;
            min-height: 120px !important;
            margin: 0 !important;
          }

          .avatar-editor-gender-label {
            font-size: 0.9rem;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
            flex-direction: row !important;
            align-items: stretch !important;
            margin-top: 0.55rem !important;
            gap: 0.55rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 40px;
            flex: 1 1 0;
            border-radius: 14px;
            padding: 0.45rem 0.6rem !important;
            font-size: clamp(0.76rem, 3.4vw, 0.9rem);
            white-space: nowrap;
          }

          .avatar-editor-footer .fcc-premium-button {
            flex-grow: 1.18;
          }
        }

        @media (max-width: 640px) and (max-height: 760px) {
          .avatar-editor-modal {
            padding: 0.62rem !important;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(62vw, 198px);
            --avatar-editor-render-scale: 0.50;
            --avatar-editor-render-bottom: 0px;
          }

          .avatar-editor-side-palette .avatar-editor-color-dot {
            width: 1.45rem;
            height: 1.45rem;
          }

          .avatar-editor-tab {
            min-height: 28px;
            padding: 0 0.62rem;
            font-size: 0.64rem;
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 96px !important;
          }

          .avatar-editor-footer {
            margin-top: 0.42rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 36px;
            border-radius: 12px;
          }
        }
      `}</style>

      {mensaje && (
        <div className="avatar-editor-toast fixed bottom-4 left-4 right-4 z-[10030] rounded-2xl border px-4 py-3 text-sm shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md">
          {mensaje}
        </div>
      )}

      <style jsx global>{`
        .avatar-editor-toast {
          color: var(--fcc-premium-text);
          background: var(--fcc-premium-surface-strong);
          border-color: var(--fcc-premium-border);
          box-shadow: var(--fcc-premium-shadow);
        }
      `}</style>
    </div>,
    document.body
  );

  return (
    <>
      {modal}
      {!avatarListo && (
        <CargadorFCC
          flotante
          mensaje="Preparando el editor de avatar"
          detalle=""
        />
      )}
    </>
  );
}
