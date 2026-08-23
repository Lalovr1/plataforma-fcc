const ANCHOS_NEXT_IMAGE = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

function normalizarAncho(ancho: number) {
  const solicitado = Math.max(32, Math.ceil(ancho));
  return (
    ANCHOS_NEXT_IMAGE.find((candidato) => candidato >= solicitado) ??
    ANCHOS_NEXT_IMAGE[ANCHOS_NEXT_IMAGE.length - 1]
  );
}

/**
 * Devuelve exactamente la URL que servirá el optimizador de Next.
 * Es útil en imágenes compuestas con CSS (fondos y máscaras), donde no se
 * puede usar el componente <Image /> directamente.
 */
export function obtenerUrlImagenOptimizada(
  src: string,
  ancho: number,
  _calidad = 75
) {
  if (
    !src.startsWith("/") ||
    src.startsWith("/_next/image") ||
    src.endsWith(".svg")
  ) {
    return src;
  }

  const width = normalizarAncho(ancho);
  // Next 16 acepta 75 de forma predeterminada. Usar una calidad arbitraria
  // en /_next/image puede responder 400 si no fue declarada en next.config.
  const quality = 75;

  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

type VentanaConCache = Window & {
  __fccImageDecodeCache?: Map<string, Promise<boolean>>;
};

function obtenerCacheImagenes() {
  if (typeof window === "undefined") {
    return new Map<string, Promise<boolean>>();
  }

  const ventana = window as VentanaConCache;

  if (!ventana.__fccImageDecodeCache) {
    ventana.__fccImageDecodeCache = new Map<string, Promise<boolean>>();
  }

  return ventana.__fccImageDecodeCache;
}

/**
 * No considera lista una imagen hasta que el navegador terminó de
 * descargarla y decodificarla. Los fallos no se conservan en caché para que
 * un botón de reintento pueda recuperarse de una conexión inestable.
 */
export function precargarImagen(src: string, timeoutMs = 25_000) {
  if (typeof window === "undefined" || !src) {
    return Promise.resolve(false);
  }

  const cache = obtenerCacheImagenes();
  const existente = cache.get(src);
  if (existente) return existente;

  const promesaBase = new Promise<boolean>((resolve) => {
    const imagen = new Image();
    let terminado = false;
    let confirmando = false;

    const finalizar = (resultado: boolean) => {
      if (terminado) return;
      terminado = true;
      window.clearTimeout(timeout);
      imagen.onload = null;
      imagen.onerror = null;

      resolve(resultado);
    };

    const timeout = window.setTimeout(() => finalizar(false), timeoutMs);

    const confirmarCarga = async () => {
      if (confirmando || terminado) return;
      confirmando = true;

      if (!imagen.complete || imagen.naturalWidth <= 0) {
        confirmando = false;
        finalizar(false);
        return;
      }

      if (typeof imagen.decode !== "function") {
        finalizar(imagen.naturalWidth > 0);
        return;
      }

      try {
        await imagen.decode();
        finalizar(imagen.complete && imagen.naturalWidth > 0);
      } catch {
        // Algunos navegadores rechazan decode() durante el mismo cuadro del
        // evento load. Se permite un único reintento; nunca se marca lista una
        // capa cuya decodificación no pudo confirmarse.
        window.requestAnimationFrame(() => {
          void imagen
            .decode()
            .then(() =>
              finalizar(imagen.complete && imagen.naturalWidth > 0)
            )
            .catch(() => finalizar(false));
        });
      }
    };

    imagen.onerror = () => finalizar(false);
    imagen.onload = () => void confirmarCarga();

    imagen.decoding = "async";
    imagen.src = src;

    if (imagen.complete && imagen.naturalWidth > 0) {
      void confirmarCarga();
    }
  });

  let promesa: Promise<boolean>;

  promesa = promesaBase.then((resultado) => {
    if (!resultado && cache.get(src) === promesa) {
      cache.delete(src);
    }

    return resultado;
  });

  cache.set(src, promesa);
  return promesa;
}

export async function precargarImagenes(srcs: string[], timeoutMs = 25_000) {
  const unicas = Array.from(new Set(srcs.filter(Boolean)));
  const resultados = await Promise.all(
    unicas.map((src) => precargarImagen(src, timeoutMs))
  );

  return resultados.every(Boolean);
}

/** Extrae las fuentes exactas de etiquetas <img> guardadas como HTML. */
export function extraerFuentesImagenHtml(...contenidos: Array<string | null | undefined>) {
  const fuentes: string[] = [];
  const patron = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

  contenidos.forEach((contenido) => {
    if (!contenido) return;

    let coincidencia: RegExpExecArray | null;

    while ((coincidencia = patron.exec(contenido)) !== null) {
      const src = coincidencia[1]?.replace(/&amp;/g, "&").trim();
      if (src) fuentes.push(src);
    }

    patron.lastIndex = 0;
  });

  return Array.from(new Set(fuentes));
}
