export type ImagenIA = {
  id: string;
  url: string;
  mime_type: string;
  ubicacion: string;
  pregunta_orden?: number;
};

export type RecursoAdicionalIA = {
  id: string;
  tipo: "imagen" | "formula";
  bloque_id: string;
  bloque_titulo: string;
  titulo: string;
  url?: string;
  mime_type?: string;
  texto?: string;
};

function decodeEntities(value: string) {
  return (value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function attr(
  tag: string,
  name: string
): string {
  const match = tag.match(
    new RegExp(
      `${name}\\s*=\\s*["']([^"']+)["']`,
      "i"
    )
  );

  return match?.[1]
    ? decodeEntities(match[1]).trim()
    : "";
}

export function contenidoQuizATextoIA(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  return decodeEntities(
    value
      .replace(
        /<span\b[^>]*data-latex=["']([^"']+)["'][^>]*>(?:[\s\S]*?<\/span>)?/gi,
        (_match, latex: string) => {
          const formula = decodeEntities(latex).trim();
          return formula ? ` $${formula}$ ` : " ";
        }
      )
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function mimeImagenIA(
  url: string
): string | null {
  const clean = url
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();

  if (clean.endsWith(".png")) {
    return "image/png";
  }

  if (
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }

  if (clean.endsWith(".webp")) {
    return "image/webp";
  }

  if (clean.endsWith(".bmp")) {
    return "image/bmp";
  }

  return null;
}

export function extraerImagenesIA(
  value: unknown
): {
  url: string;
  mime_type: string;
  alt: string;
}[] {
  if (typeof value !== "string") {
    return [];
  }

  const resultados: {
    url: string;
    mime_type: string;
    alt: string;
  }[] = [];

  const vistos = new Set<string>();

  for (
    const match of value.matchAll(
      /<img\b[^>]*>/gi
    )
  ) {
    const tag = match[0];

    const url = attr(
      tag,
      "src"
    );

    if (
      !url ||
      !url.startsWith("https://") ||
      vistos.has(url)
    ) {
      continue;
    }

    const mime =
      mimeImagenIA(url);

    if (!mime) {
      continue;
    }

    vistos.add(url);

    resultados.push({
      url,
      mime_type: mime,
      alt:
        attr(tag, "alt") ||
        "Imagen",
    });
  }

  for (
    const match of value.matchAll(
      /!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/gi
    )
  ) {
    const url =
      decodeEntities(
        match[2] || ""
      ).trim();

    if (
      !url ||
      vistos.has(url)
    ) {
      continue;
    }

    const mime =
      mimeImagenIA(url);

    if (!mime) {
      continue;
    }

    vistos.add(url);

    resultados.push({
      url,
      mime_type: mime,
      alt:
        match[1]?.trim() ||
        "Imagen",
    });
  }

  return resultados;
}

export function extraerFormulasInlineIA(
  value: unknown
): string[] {
  if (typeof value !== "string") {
    return [];
  }

  const formulas: string[] = [];

  for (
    const match of value.matchAll(
      /data-latex=["']([^"']+)["']/gi
    )
  ) {
    const formula =
      decodeEntities(
        match[1] || ""
      ).trim();

    if (formula) {
      formulas.push(formula);
    }
  }

  for (
    const match of value.matchAll(
      /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
    )
  ) {
    const formula =
      (match[1] || match[2] || "").trim();

    if (formula) {
      formulas.push(formula);
    }
  }

  return Array.from(
    new Set(formulas)
  );
}

export function construirImagenesQuizIA(
  preguntas: any[],
  respuestas: any[]
): ImagenIA[] {
  const imagenes: ImagenIA[] = [];
  const vistos = new Set<string>();

  preguntas.forEach(
    (pregunta, preguntaIndex) => {
      extraerImagenesIA(
        pregunta.enunciado
      ).forEach(
        (imagen, imageIndex) => {
          const clave =
            `${pregunta.id}:${imagen.url}`;

          if (vistos.has(clave)) {
            return;
          }

          vistos.add(clave);

          imagenes.push({
            id:
              `quiz:q${preguntaIndex + 1}:img${imageIndex + 1}`,
            ...imagen,
            ubicacion:
              `Pregunta ${preguntaIndex + 1}`,
            pregunta_orden:
              preguntaIndex + 1,
          });
        }
      );

      const opciones =
        respuestas.filter(
          (respuesta) =>
            respuesta.pregunta_id ===
            pregunta.id
        );

      opciones.forEach(
        (respuesta, respuestaIndex) => {
          extraerImagenesIA(
            respuesta.texto
          ).forEach(
            (imagen, imageIndex) => {
              const clave =
                `${respuesta.id}:${imagen.url}`;

              if (
                vistos.has(clave)
              ) {
                return;
              }

              vistos.add(clave);

              imagenes.push({
                id:
                  `quiz:q${preguntaIndex + 1}:o${respuestaIndex + 1}:img${imageIndex + 1}`,
                ...imagen,
                ubicacion:
                  `Pregunta ${preguntaIndex + 1} · opción ${respuestaIndex + 1}`,
                pregunta_orden:
                  preguntaIndex + 1,
              });
            }
          );
        }
      );
    }
  );

  return imagenes;
}

export function construirFormulasQuizIA(
  preguntas: any[],
  respuestas: any[]
) {
  const resultado: {
    ubicacion: string;
    formula: string;
  }[] = [];

  preguntas.forEach(
    (pregunta, preguntaIndex) => {
      extraerFormulasInlineIA(
        pregunta.enunciado
      ).forEach((formula) => {
        resultado.push({
          ubicacion:
            `Pregunta ${preguntaIndex + 1}`,
          formula,
        });
      });

      respuestas
        .filter(
          (respuesta) =>
            respuesta.pregunta_id ===
            pregunta.id
        )
        .forEach(
          (
            respuesta,
            respuestaIndex
          ) => {
            extraerFormulasInlineIA(
              respuesta.texto
            ).forEach((formula) => {
              resultado.push({
                ubicacion:
                  `Pregunta ${preguntaIndex + 1} · opción ${respuestaIndex + 1}`,
                formula,
              });
            });
          }
        );
    }
  );

  return resultado;
}

export function construirRecursosAdicionalesIA(
  bloques: any[],
  formulas: any[]
): RecursoAdicionalIA[] {
  const recursos: RecursoAdicionalIA[] =
    [];

  const imagenesVistas =
    new Set<string>();

  const formulasVistas =
    new Set<string>();

  bloques.forEach(
    (bloque) => {
      const tituloBloque =
        bloque.titulo?.trim() ||
        "Bloque sin título";

      const contenidos = [
        bloque.introduccion || "",
        bloque.contenido || "",
      ];

      let indexImagen = 0;

      contenidos.forEach(
        (contenido) => {
          extraerImagenesIA(
            contenido
          ).forEach((imagen) => {
            if (
              imagenesVistas.has(
                imagen.url
              )
            ) {
              return;
            }

            imagenesVistas.add(
              imagen.url
            );

            indexImagen += 1;

            recursos.push({
              id:
                `imagen:${bloque.id}:${indexImagen}`,
              tipo: "imagen",
              bloque_id:
                bloque.id,
              bloque_titulo:
                tituloBloque,
              titulo:
                imagen.alt ||
                `Imagen ${indexImagen}`,
              url:
                imagen.url,
              mime_type:
                imagen.mime_type,
            });
          });

          extraerFormulasInlineIA(
            contenido
          ).forEach((formula) => {
            const clave =
              `${bloque.id}:${formula}`;

            if (
              formulasVistas.has(clave)
            ) {
              return;
            }

            formulasVistas.add(clave);

            recursos.push({
              id:
                `formula-inline:${bloque.id}:${recursos.length}`,
              tipo: "formula",
              bloque_id:
                bloque.id,
              bloque_titulo:
                tituloBloque,
              titulo:
                "Fórmula del contenido",
              texto:
                formula,
            });
          });
        }
      );

      formulas
        .filter(
          (formula) =>
            formula.bloque_id ===
            bloque.id
        )
        .forEach((formula) => {
          const ecuacion =
            String(
              formula.ecuacion ||
              ""
            ).trim();

          if (!ecuacion) {
            return;
          }

          const clave =
            `${bloque.id}:${ecuacion}`;

          if (
            formulasVistas.has(clave)
          ) {
            return;
          }

          formulasVistas.add(clave);

          recursos.push({
            id:
              `formula:${formula.id}`,
            tipo: "formula",
            bloque_id:
              bloque.id,
            bloque_titulo:
              tituloBloque,
            titulo:
              formula.titulo?.trim() ||
              "Fórmula",
            texto:
              ecuacion,
          });
        });
    }
  );

  return recursos;
}
