"use client";

const MAX_DOCUMENTO_WORD_BYTES = 25 * 1024 * 1024;
const MAX_IMAGENES_WORD = 50;
const MAX_IMAGEN_ORIGINAL_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_IMAGENES_BYTES = 60 * 1024 * 1024;
const UMBRAL_OPTIMIZACION_BYTES = 1200 * 1024;
const ANCHO_MAXIMO = 1920;
const ALTO_MAXIMO = 2560;
const OBJETIVO_IMAGEN_BYTES = 2 * 1024 * 1024;

type ImagenMammoth = {
  contentType?: string;
  readAsArrayBuffer: () => Promise<ArrayBuffer>;
};

type MammothBrowser = {
  convertToHtml: (
    input: { arrayBuffer: ArrayBuffer },
    options: Record<string, unknown>
  ) => Promise<{
    value: string;
    messages?: Array<{ type?: string; message?: string }>;
  }>;
  images: {
    imgElement: (
      converter: (
        image: ImagenMammoth
      ) => Promise<Record<string, string>>
    ) => unknown;
  };
};

type DocxPreviewBrowser = {
  renderAsync: (
    document: Blob | ArrayBuffer | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement | null,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
};

export type ResultadoImportacionWord = {
  html: string;
  imagenesDetectadas: number;
  imagenesSubidas: number;
  imagenesOptimizadas: number;
  imagenesOmitidas: number;
  bytesOriginales: number;
  bytesFinales: number;
  advertencias: number;
};

type ResultadoNormalizacionImagen = {
  file: File;
  optimizada: boolean;
  bytesOriginales: number;
  bytesFinales: number;
};

type FuenteCanvas = {
  source: CanvasImageSource;
  width: number;
  height: number;
  liberar: () => void;
};

const MIME_PERMITIDOS = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
]);

const extensionPorMime = (mime: string) => {
  const extensiones: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
  };

  return extensiones[mime] || "png";
};

const crearLimitador = (concurrencia: number) => {
  let activas = 0;
  const cola: Array<() => void> = [];

  const liberar = () => {
    activas -= 1;
    cola.shift()?.();
  };

  return async <T>(tarea: () => Promise<T>): Promise<T> => {
    if (activas >= concurrencia) {
      await new Promise<void>((resolve) => cola.push(resolve));
    }

    activas += 1;

    try {
      return await tarea();
    } finally {
      liberar();
    }
  };
};

const cargarFuenteCanvas = async (file: File): Promise<FuenteCanvas> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        liberar: () => bitmap.close(),
      };
    } catch {
      // Algunos SVG o formatos exportados por Word requieren el elemento img.
    }
  }

  const url = URL.createObjectURL(file);
  const imagen = new Image();
  imagen.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      imagen.onload = () => resolve();
      imagen.onerror = () =>
        reject(new Error("La imagen no se pudo decodificar."));
      imagen.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }

  if (!imagen.naturalWidth || !imagen.naturalHeight) {
    URL.revokeObjectURL(url);
    throw new Error("La imagen no tiene dimensiones válidas.");
  }

  return {
    source: imagen,
    width: imagen.naturalWidth,
    height: imagen.naturalHeight,
    liberar: () => URL.revokeObjectURL(url),
  };
};

const canvasAWebp = (
  canvas: HTMLCanvasElement,
  calidad: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("El navegador no pudo optimizar la imagen."));
      },
      "image/webp",
      calidad
    );
  });

const normalizarImagenWord = async (
  file: File,
  indice: number
): Promise<ResultadoNormalizacionImagen> => {
  if (file.size <= 0 || file.size > MAX_IMAGEN_ORIGINAL_BYTES) {
    throw new Error("La imagen supera el límite permitido.");
  }

  const fuente = await cargarFuenteCanvas(file);

  try {
    const escala = Math.min(
      1,
      ANCHO_MAXIMO / fuente.width,
      ALTO_MAXIMO / fuente.height
    );
    const width = Math.max(1, Math.round(fuente.width * escala));
    const height = Math.max(1, Math.round(fuente.height * escala));
    const requiereEscala = escala < 1;
    const requiereRasterizar = [
      "image/svg+xml",
      "image/gif",
      "image/bmp",
    ].includes(file.type.toLowerCase());
    const requiereCompresion =
      file.size > UMBRAL_OPTIMIZACION_BYTES || requiereRasterizar;

    if (!requiereEscala && !requiereCompresion) {
      return {
        file,
        optimizada: false,
        bytesOriginales: file.size,
        bytesFinales: file.size,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const contexto = canvas.getContext("2d", { alpha: true });
    if (!contexto) {
      throw new Error("No se pudo preparar la imagen para el curso.");
    }

    contexto.imageSmoothingEnabled = true;
    contexto.imageSmoothingQuality = "high";
    contexto.drawImage(fuente.source, 0, 0, width, height);

    let mejorBlob: Blob | null = null;

    for (const calidad of [0.88, 0.82, 0.76]) {
      const candidato = await canvasAWebp(canvas, calidad);

      if (!mejorBlob || candidato.size < mejorBlob.size) {
        mejorBlob = candidato;
      }

      if (candidato.size <= OBJETIVO_IMAGEN_BYTES) break;
    }

    if (!mejorBlob) {
      throw new Error("No se pudo generar la imagen optimizada.");
    }

    if (!requiereEscala && mejorBlob.size >= file.size) {
      return {
        file,
        optimizada: false,
        bytesOriginales: file.size,
        bytesFinales: file.size,
      };
    }

    const normalizada = new File(
      [mejorBlob],
      `word-imagen-${Date.now()}-${indice}.webp`,
      { type: "image/webp", lastModified: Date.now() }
    );

    return {
      file: normalizada,
      optimizada: true,
      bytesOriginales: file.size,
      bytesFinales: normalizada.size,
    };
  } finally {
    fuente.liberar();
  }
};

const htmlSinImagenVacia = (html: string) =>
  html.replace(/<img\b[^>]*\bsrc=["']\s*["'][^>]*>/gi, "");

const limpiarValorCss = (value: string) =>
  value.trim().replace(/[;{}<>]/g, "").slice(0, 120);

const capturarFormatoCompatible = (elemento: HTMLElement) => {
  const calculado = window.getComputedStyle(elemento);
  const tag = elemento.tagName;
  const esBloque = [
    "P",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "TD",
    "TH",
    "BLOCKQUOTE",
  ].includes(tag);
  const estilos: string[] = [];

  if (esBloque && ["left", "center", "right", "justify"].includes(calculado.textAlign)) {
    estilos.push(`text-align:${calculado.textAlign}`);
  }

  if (calculado.fontSize) {
    estilos.push(`font-size:${limpiarValorCss(calculado.fontSize)}`);
  }

  const peso = Number(calculado.fontWeight);
  if (calculado.fontWeight === "bold" || (!Number.isNaN(peso) && peso >= 600)) {
    estilos.push(`font-weight:${calculado.fontWeight}`);
  }

  if (calculado.fontStyle === "italic" || calculado.fontStyle === "oblique") {
    estilos.push(`font-style:${calculado.fontStyle}`);
  }

  const decoracion = calculado.textDecorationLine || calculado.textDecoration;
  if (decoracion.includes("underline")) {
    estilos.push("text-decoration-line:underline");
  }

  return {
    css: estilos.join(";"),
    display: calculado.display,
    listStyleType: calculado.listStyleType,
  };
};

const convertirListasRenderizadas = (contenedor: HTMLElement) => {
  const parrafos = Array.from(
    contenedor.querySelectorAll<HTMLElement>("p[data-fcc-word-list]")
  );

  parrafos.forEach((parrafo) => {
    if (!parrafo.isConnected || !parrafo.parentElement) return;

    const tipo = parrafo.dataset.fccWordList === "ol" ? "ol" : "ul";
    const lista = document.createElement(tipo);
    parrafo.parentElement.insertBefore(lista, parrafo);

    let actual: Element | null = parrafo;

    while (
      actual instanceof HTMLElement &&
      actual.tagName === "P" &&
      actual.dataset.fccWordList === tipo
    ) {
      const siguiente: Element | null = actual.nextElementSibling;
      const item = document.createElement("li");

      while (actual.firstChild) {
        item.appendChild(actual.firstChild);
      }

      lista.appendChild(item);
      actual.remove();
      actual = siguiente;
    }
  });
};

const renderizarDocumentoConFormato = async (file: File) => {
  const modulo = (await import("docx-preview")) as unknown as DocxPreviewBrowser & {
    default?: DocxPreviewBrowser;
  };
  const docxPreview = modulo.default || modulo;
  const aislado = document.createElement("div");
  const estilos = document.createElement("div");
  const cuerpo = document.createElement("div");

  aislado.setAttribute("aria-hidden", "true");
  aislado.style.cssText =
    "position:fixed;left:-100000px;top:0;width:920px;visibility:hidden;pointer-events:none;z-index:-1;";
  aislado.append(estilos, cuerpo);
  document.body.appendChild(aislado);

  try {
    await docxPreview.renderAsync(file, cuerpo, estilos, {
      className: "fcc-word-import",
      inWrapper: false,
      ignoreWidth: true,
      ignoreHeight: true,
      ignoreFonts: true,
      breakPages: false,
      ignoreLastRenderedPageBreak: true,
      experimental: false,
      useBase64URL: true,
      renderChanges: false,
      renderHeaders: false,
      renderFooters: false,
      renderFootnotes: true,
      renderEndnotes: true,
      renderComments: false,
      renderAltChunks: false,
      debug: false,
    });

    const elementos = Array.from(cuerpo.querySelectorAll<HTMLElement>("*"));
    const formatos = elementos.map((elemento) => ({
      elemento,
      formato: capturarFormatoCompatible(elemento),
    }));

    formatos.forEach(({ elemento, formato }) => {
      if (formato.css) elemento.setAttribute("style", formato.css);
      else elemento.removeAttribute("style");

      if (elemento.tagName === "P" && formato.display === "list-item") {
        const tipoLista =
          formato.listStyleType && formato.listStyleType !== "none"
            ? formato.listStyleType.includes("decimal") ||
              formato.listStyleType.includes("roman") ||
              formato.listStyleType.includes("alpha")
              ? "ol"
              : "ul"
            : "ol";
        elemento.dataset.fccWordList = tipoLista;
      }
    });

    convertirListasRenderizadas(cuerpo);

    Array.from(cuerpo.querySelectorAll<HTMLElement>("*")).forEach((elemento) => {
      Array.from(elemento.attributes).forEach((atributo) => {
        if (
          ![
            "style",
            "href",
            "src",
            "alt",
            "title",
            "colspan",
            "rowspan",
          ].includes(atributo.name.toLowerCase())
        ) {
          elemento.removeAttribute(atributo.name);
        }
      });
    });

    return cuerpo.innerHTML;
  } finally {
    aislado.remove();
  }
};

const archivoDesdeImagenRenderizada = async (src: string, indice: number) => {
  if (!/^(?:data:image\/|blob:)/i.test(src)) {
    throw new Error("La imagen renderizada no es un recurso interno válido.");
  }

  const respuesta = await fetch(src);
  if (!respuesta.ok) {
    throw new Error("No se pudo leer una imagen integrada en Word.");
  }

  const blob = await respuesta.blob();
  const mime = blob.type.toLowerCase();
  if (!MIME_PERMITIDOS.has(mime)) {
    throw new Error("Word utilizó un formato de imagen no compatible.");
  }

  return new File(
    [blob],
    `word-render-${Date.now()}-${indice}.${extensionPorMime(mime)}`,
    { type: mime, lastModified: Date.now() }
  );
};

const importarHtmlRenderizado = async ({
  html,
  file,
  subirImagen,
  onProgress,
}: {
  html: string;
  file: File;
  subirImagen: (file: File) => Promise<{ url: string; name: string }>;
  onProgress?: (mensaje: string) => void;
}): Promise<ResultadoImportacionWord> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const imagenes = Array.from(doc.body.querySelectorAll<HTMLImageElement>("img"));
  const limitar = crearLimitador(3);

  let imagenesSubidas = 0;
  let imagenesOptimizadas = 0;
  let imagenesOmitidas = 0;
  let bytesOriginales = 0;
  let bytesFinales = 0;
  let totalImagenesLeidas = 0;

  await Promise.all(
    imagenes.map((imagen, posicion) =>
      limitar(async () => {
        const indice = posicion + 1;

        if (indice > MAX_IMAGENES_WORD) {
          imagen.remove();
          imagenesOmitidas += 1;
          return;
        }

        onProgress?.(`Procesando imagen ${indice} de ${Math.min(
          imagenes.length,
          MAX_IMAGENES_WORD
        )}...`);

        try {
          const original = await archivoDesdeImagenRenderizada(
            imagen.getAttribute("src") || "",
            indice
          );

          totalImagenesLeidas += original.size;
          if (totalImagenesLeidas > MAX_TOTAL_IMAGENES_BYTES) {
            throw new Error("Las imágenes integradas superan el límite total.");
          }

          const normalizada = await normalizarImagenWord(original, indice);
          const subida = await subirImagen(normalizada.file);

          imagen.setAttribute("src", subida.url);
          imagen.setAttribute(
            "alt",
            imagen.getAttribute("alt") ||
              `Imagen ${indice} importada desde ${file.name}`
          );
          imagenesSubidas += 1;
          if (normalizada.optimizada) imagenesOptimizadas += 1;
          bytesOriginales += normalizada.bytesOriginales;
          bytesFinales += normalizada.bytesFinales;
        } catch (error) {
          console.warn(`No se pudo importar la imagen ${indice} de Word.`, error);
          imagen.remove();
          imagenesOmitidas += 1;
        }
      })
    )
  );

  onProgress?.("Preparando el borrador editable...");

  const resultadoHtml = htmlSinImagenVacia(doc.body.innerHTML).trim();
  const contieneTexto = resultadoHtml.replace(/<[^>]+>/g, "").trim();
  const contieneImagen = /<img\b/i.test(resultadoHtml);

  if (!contieneTexto && !contieneImagen) {
    throw new Error("El documento no contiene texto o imágenes compatibles.");
  }

  return {
    html: resultadoHtml,
    imagenesDetectadas: imagenes.length,
    imagenesSubidas,
    imagenesOptimizadas,
    imagenesOmitidas,
    bytesOriginales,
    bytesFinales,
    advertencias: imagenesOmitidas,
  };
};

export async function importarDocumentoWord({
  file,
  subirImagen,
  onProgress,
}: {
  file: File;
  subirImagen: (file: File) => Promise<{ url: string; name: string }>;
  onProgress?: (mensaje: string) => void;
}): Promise<ResultadoImportacionWord> {
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Selecciona un documento de Word con extensión .docx.");
  }

  if (file.size <= 0 || file.size > MAX_DOCUMENTO_WORD_BYTES) {
    throw new Error("El documento debe pesar como máximo 25 MB.");
  }

  onProgress?.("Leyendo el documento...");

  try {
    const htmlConFormato = await renderizarDocumentoConFormato(file);
    return await importarHtmlRenderizado({
      html: htmlConFormato,
      file,
      subirImagen,
      onProgress,
    });
  } catch (error) {
    console.warn(
      "No se pudo utilizar la importación visual de Word; se usará la conversión compatible.",
      error
    );
    onProgress?.("Recuperando el contenido con el modo compatible...");
  }

  const modulo = (await import("mammoth")) as unknown as MammothBrowser & {
    default?: MammothBrowser;
  };
  const mammoth = modulo.default || modulo;
  const limitar = crearLimitador(3);

  let imagenesDetectadas = 0;
  let imagenesSubidas = 0;
  let imagenesOptimizadas = 0;
  let imagenesOmitidas = 0;
  let bytesOriginales = 0;
  let bytesFinales = 0;
  let totalImagenesLeidas = 0;

  const convertImage = mammoth.images.imgElement(async (image) => {
    imagenesDetectadas += 1;
    const indice = imagenesDetectadas;

    if (indice > MAX_IMAGENES_WORD) {
      imagenesOmitidas += 1;
      return { src: "" };
    }

    return limitar(async () => {
      onProgress?.(`Procesando imagen ${indice}...`);

      try {
        const mime = String(image.contentType || "").toLowerCase();
        if (!MIME_PERMITIDOS.has(mime)) {
          imagenesOmitidas += 1;
          return { src: "" };
        }

        const buffer = await image.readAsArrayBuffer();
        const original = new File(
          [buffer],
          `word-origen-${Date.now()}-${indice}.${extensionPorMime(mime)}`,
          { type: mime, lastModified: Date.now() }
        );

        totalImagenesLeidas += original.size;
        if (totalImagenesLeidas > MAX_TOTAL_IMAGENES_BYTES) {
          imagenesOmitidas += 1;
          return { src: "" };
        }

        const normalizada = await normalizarImagenWord(original, indice);
        const subida = await subirImagen(normalizada.file);

        imagenesSubidas += 1;
        if (normalizada.optimizada) imagenesOptimizadas += 1;
        bytesOriginales += normalizada.bytesOriginales;
        bytesFinales += normalizada.bytesFinales;

        return {
          src: subida.url,
          alt: `Imagen ${indice} importada desde ${file.name}`,
        };
      } catch (error) {
        console.warn(`No se pudo importar la imagen ${indice} de Word.`, error);
        imagenesOmitidas += 1;
        return { src: "" };
      }
    });
  });

  const resultado = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage,
      externalFileAccess: false,
      includeEmbeddedStyleMap: false,
      ignoreEmptyParagraphs: false,
      styleMap: ["u => u"],
    }
  );

  onProgress?.("Preparando el borrador editable...");

  const html = htmlSinImagenVacia(String(resultado.value || "")).trim();
  const contieneTexto = html.replace(/<[^>]+>/g, "").trim();
  const contieneImagen = /<img\b/i.test(html);

  if (!contieneTexto && !contieneImagen) {
    throw new Error("El documento no contiene texto o imágenes compatibles.");
  }

  return {
    html,
    imagenesDetectadas,
    imagenesSubidas,
    imagenesOptimizadas,
    imagenesOmitidas,
    bytesOriginales,
    bytesFinales,
    advertencias: (resultado.messages || []).filter(
      (mensaje) => mensaje.type === "warning" || mensaje.type === "error"
    ).length,
  };
}
