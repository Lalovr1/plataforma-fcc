import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getAIProvider } from "@/lib/ai";
import { interpretarErrorIA } from "@/lib/ai/errorPublico";

import {
  contenidoQuizATextoIA,
  construirFormulasQuizIA,
  construirImagenesQuizIA,
  construirRecursosAdicionalesIA,
} from "@/lib/ai/quizMedia";

export const runtime = "nodejs";
export const maxDuration = 180;

const LIMITE_ANALISIS_IA_MS = 165_000;
const LIMITE_CARGA_IMAGEN_MS = 15_000;

class ErrorTiempoAnalisisIA extends Error {
  constructor() {
    super("El análisis superó el tiempo máximo permitido.");
    this.name = "ErrorTiempoAnalisisIA";
  }
}

function normalizarContenidoComparacionIA(
  value: unknown
) {
  return contenidoQuizATextoIA(value)
    .replace(/\$/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLocaleLowerCase("es-MX");
}

async function ejecutarConLimiteIA<T>(
  operacion: Promise<T>,
  tiempoMs: number
): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const limite = new Promise<never>((_, reject) => {
    temporizador = setTimeout(
      () => reject(new ErrorTiempoAnalisisIA()),
      Math.max(1, tiempoMs)
    );
  });

  try {
    return await Promise.race([operacion, limite]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

type AccionRevisionIA = {
  tipo:
    | "cambiar_respuesta_correcta"
    | "reescribir_pregunta"
    | "reescribir_respuesta";

  respuesta_objetivo_id: string;

  texto_actual: string;
  texto_propuesto: string;
  motivo: string;

  impacto:
    | "editorial"
    | "academico";
};

type AnalisisPregunta = {
  pregunta_id: string;
  concepto_principal: string;
  conceptos_secundarios: string[];
  contexto_suficiente: boolean;
  retroalimentacion_correcta: string;
  retroalimentacion_incorrecta: string;
  estado_respuesta_correcta:
    | "coherente"
    | "revisar";
  motivo_revision: string;
  advertencias: string[];
  acciones: AccionRevisionIA[];
};

type AnalisisQuiz = {
  resumen: string;

  conceptos: {
    nombre: string;
    descripcion: string;
  }[];

  preguntas: AnalisisPregunta[];

  advertencias_generales: string[];
};

const schemaAnalisis = {
  type: "object",

  properties: {
    resumen: {
      type: "string",
      description:
        "Resumen académico breve del quiz analizado.",
    },

    conceptos: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
          },

          descripcion: {
            type: "string",
          },
        },

        required: [
          "nombre",
          "descripcion",
        ],

        additionalProperties: false,
      },
    },

    preguntas: {
      type: "array",

      items: {
        type: "object",

        properties: {
          pregunta_id: {
            type: "string",
          },

          concepto_principal: {
            type: "string",
          },

          conceptos_secundarios: {
            type: "array",
            maxItems: 4,
            items: {
              type: "string",
            },
          },

          contexto_suficiente: {
            type: "boolean",
          },

          retroalimentacion_correcta: {
            type: "string",
            description:
              "Retroalimentación educativa breve para una respuesta correcta.",
          },

          retroalimentacion_incorrecta: {
            type: "string",
            description:
              "Retroalimentación educativa breve para una respuesta incorrecta.",
          },

          estado_respuesta_correcta: {
            type: "string",
            enum: [
              "coherente",
              "revisar",
            ],
          },

          motivo_revision: {
            type: "string",
          },

          advertencias: {
            type: "array",
            maxItems: 5,
            items: {
              type: "string",
            },
          },

          acciones: {
            type: "array",
            maxItems: 6,

            items: {
              type: "object",

              properties: {
                tipo: {
                  type: "string",

                  enum: [
                    "cambiar_respuesta_correcta",
                    "reescribir_pregunta",
                    "reescribir_respuesta",
                  ],
                },

                respuesta_objetivo_id: {
                  type: "string",

                  description:
                    "ID de la respuesta afectada. Usa cadena vacía cuando la acción modifica la pregunta completa.",
                },

                texto_actual: {
                  type: "string",
                },

                texto_propuesto: {
                  type: "string",
                },

                motivo: {
                  type: "string",
                },

                impacto: {
                  type: "string",

                  enum: [
                    "editorial",
                    "academico",
                  ],
                },
              },

              required: [
                "tipo",
                "respuesta_objetivo_id",
                "texto_actual",
                "texto_propuesto",
                "motivo",
                "impacto",
              ],

              additionalProperties: false,
            },
          },
        },

        required: [
          "pregunta_id",
          "concepto_principal",
          "conceptos_secundarios",
          "contexto_suficiente",
          "retroalimentacion_correcta",
          "retroalimentacion_incorrecta",
          "estado_respuesta_correcta",
          "motivo_revision",
          "advertencias",
          "acciones",
        ],

        additionalProperties: false,
      },
    },

    advertencias_generales: {
      type: "array",
      maxItems: 10,
      items: {
        type: "string",
      },
    },
  },

  required: [
    "resumen",
    "conceptos",
    "preguntas",
    "advertencias_generales",
  ],

  additionalProperties: false,
};


async function cargarImagenInlineIA(
  url: string,
  mimeEsperado: string
) {
  const controlador = new AbortController();
  const temporizador = setTimeout(
    () => controlador.abort(),
    LIMITE_CARGA_IMAGEN_MS
  );

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controlador.signal,
    });

    if (!response.ok) {
      throw new Error(
        "No se pudo leer una de las imágenes seleccionadas."
      );
    }

    const contentType =
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();

    const mimeType =
      contentType?.startsWith("image/")
        ? contentType
        : mimeEsperado;

    const permitidos =
      new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/bmp",
      ]);

    if (!permitidos.has(mimeType)) {
      throw new Error(
        "Una de las imágenes utiliza un formato no compatible con el análisis."
      );
    }

    const bytes =
      await response.arrayBuffer();

    const MAX_IMAGE_BYTES =
      5 * 1024 * 1024;

    if (
      bytes.byteLength >
      MAX_IMAGE_BYTES
    ) {
      throw new Error(
        "Una de las imágenes supera el límite de 5 MB para el análisis."
      );
    }

    return {
      type: "image",
      data:
        Buffer
          .from(bytes)
          .toString("base64"),
      mime_type:
        mimeType,
    };
  } catch (error) {
    if (controlador.signal.aborted) {
      throw new ErrorTiempoAnalisisIA();
    }

    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}
export async function POST(
  request: Request
) {
  const inicioSolicitud = Date.now();

  try {
    const authHeader =
      request.headers.get("authorization");

    const token =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

    if (!token) {
      return NextResponse.json(
        {
          error: "No autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Configuración de Supabase incompleta."
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },

        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Sesión inválida o expirada.",
        },
        {
          status: 401,
        }
      );
    }
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY no está configurada."
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
    const body =
      await request.json();

    const quizId =
      typeof body?.quizId ===
      "string"
        ? body.quizId.trim()
        : "";

    const bloqueIdsRecibidos =
      Array.isArray(
        body?.bloqueIds
      )
        ? body.bloqueIds.filter(
            (
              id: unknown
            ): id is string =>
              typeof id ===
                "string" &&
              id.length > 0
          )
        : [];

    const recursosSeleccionadosIds =
      Array.isArray(
        body?.recursosSeleccionados
      )
        ? body.recursosSeleccionados.filter(
            (
              id: unknown
            ): id is string =>
              typeof id ===
                "string" &&
              id.length > 0
          )
        : [];

    const contextoAdicional =
      typeof body?.contextoAdicional ===
      "string"
        ? body.contextoAdicional
            .trim()
            .slice(0, 1500)
        : "";
    if (!quizId) {
      return NextResponse.json(
        {
          error:
            "Falta quizId.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: quiz,
      error: quizError,
    } = await supabase
      .from("quizzes")
      .select(
        `
        id,
        materia_id,
        titulo,
        descripcion,
        bloque_id
      `
      )
      .eq("id", quizId)
      .single();

    if (
      quizError ||
      !quiz
    ) {
      return NextResponse.json(
        {
          error:
            "Quiz no encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: materia,
      error: materiaError,
    } = await supabase
      .from("materias")
      .select(
        "id,nombre,profesor_id"
      )
      .eq(
        "id",
        quiz.materia_id
      )
      .single();

    if (
      materiaError ||
      !materia
    ) {
      return NextResponse.json(
        {
          error:
            "Curso no encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      materia.profesor_id !==
      user.id
    ) {
      return NextResponse.json(
        {
          error:
            "No autorizado.",
        },
        {
          status: 403,
        }
      );
    }

    const {
      count: analisisUsados,
      error: usoError,
    } = await admin
      .from("ia_analisis_quiz")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("quiz_id", quiz.id)
      .eq("profesor_id", user.id);

    if (usoError) {
      throw usoError;
    }

    const usados =
      Number(analisisUsados ?? 0);

    if (usados >= 3) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este quiz ya utilizó sus 3 análisis con IA.",
          uso: {
            usados: 3,
            disponibles: 0,
            total: 3,
          },
        },
        {
          status: 429,
        }
      );
    }

    const {
      data: preguntas,
      error: preguntasError,
    } = await supabase
      .from("preguntas")
      .select(
        "id,enunciado,orden"
      )
      .eq(
        "quiz_id",
        quiz.id
      )
      .order(
        "orden",
        {
          ascending: true,
        }
      );

    if (
      preguntasError ||
      !preguntas ||
      preguntas.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "El quiz no tiene preguntas.",
        },
        {
          status: 400,
        }
      );
    }

    const preguntaIds =
      preguntas.map(
        (pregunta) =>
          pregunta.id
      );

    const {
      data: respuestas,
      error: respuestasError,
    } = await supabase
      .from("respuestas")
      .select(
        `
        id,
        pregunta_id,
        texto,
        es_correcta,
        orden
      `
      )
      .in(
        "pregunta_id",
        preguntaIds
      )
      .order(
        "orden",
        {
          ascending: true,
        }
      );

    if (
      respuestasError
    ) {
      throw respuestasError;
    }

    const snapshotRecibido =
      Array.isArray(body?.snapshot)
        ? body.snapshot
        : null;

    if (!snapshotRecibido) {
      return NextResponse.json(
        {
          error:
            "No se recibió la versión actual del quiz.",
        },
        {
          status: 400,
        }
      );
    }

    const snapshotGuardado =
      preguntas.map(
        (pregunta, preguntaIndex) => ({
          id: String(pregunta.id),

          enunciado:
            pregunta.enunciado || "",

          orden:
            preguntaIndex,

          respuestas:
            (respuestas ?? [])
              .filter(
                (respuesta) =>
                  respuesta.pregunta_id ===
                  pregunta.id
              )
              .map(
                (
                  respuesta,
                  respuestaIndex
                ) => ({
                  id:
                    String(
                      respuesta.id
                    ),

                  texto:
                    respuesta.texto ||
                    "",

                  es_correcta:
                    Boolean(
                      respuesta.es_correcta
                    ),

                  orden:
                    respuestaIndex,
                })
              ),
        })
      );

    if (
      JSON.stringify(snapshotRecibido) !==
      JSON.stringify(snapshotGuardado)
    ) {
      return NextResponse.json(
        {
          error:
            "El quiz tiene cambios sin guardar. Guarda los cambios antes de generar el análisis con IA.",
        },
        {
          status: 409,
        }
      );
    }

    const snapshotHash =
      createHash("sha256")
        .update(
          JSON.stringify(
            snapshotGuardado
          )
        )
        .digest("hex");
    const bloqueIds =
      Array.from(
        new Set([
          ...(
            quiz.bloque_id
              ? [
                  quiz.bloque_id,
                ]
              : []
          ),
          ...bloqueIdsRecibidos,
        ])
      );

    if (
      bloqueIds.length > 8
    ) {
      return NextResponse.json(
        {
          error:
            "Puedes usar como máximo 8 bloques de contexto.",
        },
        {
          status: 400,
        }
      );
    }

    let bloques:
      any[] = [];

    if (
      bloqueIds.length > 0
    ) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "curso_contenido_bloques"
        )
        .select(
          `
          id,
          titulo,
          introduccion,
          contenido,
          unidad_id,
          orden
        `
        )
        .eq(
          "materia_id",
          quiz.materia_id
        )
        .in(
          "id",
          bloqueIds
        )
        .order(
          "orden",
          {
            ascending: true,
          }
        );

      if (error) {
        throw error;
      }

      bloques =
        data ?? [];

      if (
        bloques.length !==
        bloqueIds.length
      ) {
        return NextResponse.json(
          {
            error:
              "Uno o más bloques no pertenecen al curso.",
          },
          {
            status: 400,
          }
        );
      }

      const unidades =
        new Set(
          bloques
            .map(
              (bloque) =>
                bloque.unidad_id
            )
            .filter(Boolean)
        );

      if (
        unidades.size > 1
      ) {
        return NextResponse.json(
          {
            error:
              "Los bloques de contexto deben pertenecer a la misma unidad.",
          },
          {
            status: 400,
          }
        );
      }

      const bloquePrincipal =
        bloques.find(
          (bloque) =>
            bloque.id === quiz.bloque_id
        );

      if (!bloquePrincipal) {
        return NextResponse.json(
          {
            error:
              "No se encontró el bloque principal del quiz.",
          },
          {
            status: 400,
          }
        );
      }

      const ordenPrincipal =
        Number(
          bloquePrincipal.orden ?? 0
        );

      if (
        bloques.some(
          (bloque) =>
            bloque.unidad_id !==
              bloquePrincipal.unidad_id ||
            Number(bloque.orden ?? 0) >
              ordenPrincipal
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Sólo puedes utilizar el bloque principal y bloques anteriores de la misma unidad.",
          },
          {
            status: 400,
          }
        );
      }
    }

    let formulas:
      any[] = [];

    if (
      bloques.length > 0
    ) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "curso_formulas"
        )
        .select(
          `
          bloque_id,
          titulo,
          ecuacion,
          descripcion,
          orden
        `
        )
        .in(
          "bloque_id",
          bloques.map(
            (bloque) =>
              bloque.id
          )
        )
        .order(
          "orden",
          {
            ascending: true,
          }
        );

      if (error) {
        throw error;
      }

      formulas =
        data ?? [];
    }

    const preguntasIA =
      preguntas.map(
        (pregunta) => {
          const opciones =
            (
              respuestas ??
              []
            )
              .filter(
                (respuesta) =>
                  respuesta
                    .pregunta_id ===
                  pregunta.id
              )
              .map(
                (
                  respuesta
                ) => ({
                  id:
                    respuesta.id,

                  texto:
                    contenidoQuizATextoIA(
                      respuesta.texto
                    ),

                  marcada_correcta:
                    Boolean(
                      respuesta.es_correcta
                    ),
                })
              );

          return {
            id:
              pregunta.id,

            enunciado:
              contenidoQuizATextoIA(
                pregunta.enunciado
              ),

            opciones,
          };
        }
      );

    const bloquesIA =
      bloques.map(
        (bloque) => ({
          id:
            bloque.id,

          titulo:
            bloque.titulo ||
            "",

          introduccion:
            contenidoQuizATextoIA(
              bloque.introduccion
            ),

          contenido:
            contenidoQuizATextoIA(
              bloque.contenido
            ),

          formulas:
            formulas
              .filter(
                (formula) =>
                  formula
                    .bloque_id ===
                  bloque.id
              )
              .map(
                (formula) => ({
                  titulo:
                    formula.titulo ||
                    "",

                  ecuacion:
                    formula.ecuacion ||
                    "",

                  descripcion:
                    formula.descripcion ||
                    "",
                })
              ),
        })
      );

    const imagenesQuiz =
      construirImagenesQuizIA(
        preguntas,
        respuestas ?? []
      );

    const formulasQuiz =
      construirFormulasQuizIA(
        preguntas,
        respuestas ?? []
      );

    const recursosDisponibles =
      construirRecursosAdicionalesIA(
        bloques,
        formulas
      );

    const maxRecursosAdicionales =
      Math.min(
        preguntas.length,
        10
      );

    if (
      recursosSeleccionadosIds.length >
      maxRecursosAdicionales
    ) {
      return NextResponse.json(
        {
          error:
            `Puedes seleccionar como máximo ${maxRecursosAdicionales} recursos adicionales.`,
        },
        {
          status: 400,
        }
      );
    }

    const recursosPorId =
      new Map(
        recursosDisponibles.map(
          (recurso) => [
            recurso.id,
            recurso,
          ]
        )
      );

    const recursosSeleccionados =
      recursosSeleccionadosIds.map(
        (id) =>
          recursosPorId.get(id)
      );

    if (
      recursosSeleccionados.some(
        (recurso) => !recurso
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Uno de los recursos seleccionados no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    const recursosFinales =
      recursosSeleccionados.filter(
        Boolean
      ) as typeof recursosDisponibles;

    const formulasAdicionales =
      recursosFinales
        .filter(
          (recurso) =>
            recurso.tipo ===
            "formula"
        )
        .map(
          (recurso) => ({
            fuente:
              recurso.bloque_titulo,

            titulo:
              recurso.titulo,

            formula:
              recurso.texto,
          })
        );

    const imagenesAdicionales =
      recursosFinales.filter(
        (recurso) =>
          recurso.tipo ===
            "imagen" &&
          recurso.url &&
          recurso.mime_type
      );

    const recursosQuizMeta =
      preguntas.map(
        (
          _pregunta,
          index
        ) => ({
          pregunta:
            `Pregunta ${index + 1}`,

          imagenes:
            imagenesQuiz.filter(
              (imagen) =>
                imagen.pregunta_orden ===
                index + 1
            ).length,

          formulas:
            formulasQuiz
              .filter(
                (formula) =>
                  formula.ubicacion.startsWith(
                    `Pregunta ${index + 1}`
                  )
              )
              .map(
                (formula) =>
                  formula.formula
              ),
        })
      );
    const prompt =
      JSON.stringify(
        {
          curso: {
            nombre:
              materia.nombre,
          },

          quiz: {
            id:
              quiz.id,

            titulo:
              quiz.titulo,

            descripcion:
              quiz.descripcion,
          },

          contexto_academico:
            bloquesIA,

          preguntas:
            preguntasIA,
        },
        null,
        2
      );

    const contextoMultimedia =
      JSON.stringify(
        {
          recursos_integrados_en_el_quiz:
            recursosQuizMeta,

          formulas_adicionales_seleccionadas:
            formulasAdicionales,

          contexto_adicional_del_profesor:
            contextoAdicional ||
            null,
        },
        null,
        2
      );

    const inputIA: any[] = [
      {
        type: "text",
        text:
          `${prompt}

INFORMACIÓN MULTIMEDIA Y ADICIONAL:
${contextoMultimedia}`,
      },
    ];

    for (
      const imagen
      of imagenesQuiz
    ) {
      inputIA.push({
        type: "text",

        text:
          `IMAGEN INCLUIDA DIRECTAMENTE EN EL QUIZ. Ubicación: ${imagen.ubicacion}. Debes analizar esta imagen como parte de esa pregunta u opción.`,
      });

      const contenidoImagen =
        await cargarImagenInlineIA(
          imagen.url,
          imagen.mime_type
        );

      inputIA.push(
        contenidoImagen
      );
    }

    for (
      const recurso
      of imagenesAdicionales
    ) {
      inputIA.push({
        type: "text",

        text:
          `IMAGEN ADICIONAL SELECCIONADA POR EL PROFESOR. Fuente: ${recurso.bloque_titulo}. Úsala únicamente como contexto académico de apoyo.`,
      });

      const contenidoImagen =
        await cargarImagenInlineIA(
          recurso.url!,
          recurso.mime_type!
        );

      inputIA.push(
        contenidoImagen
      );
    }
    const ai =
      getAIProvider();

    const tiempoRestante =
      LIMITE_ANALISIS_IA_MS -
      (Date.now() - inicioSolicitud);

    if (tiempoRestante <= 0) {
      throw new ErrorTiempoAnalisisIA();
    }

    const analisis =
      await ejecutarConLimiteIA(
        ai.generateJSON<AnalisisQuiz>(
        inputIA as any,
        schemaAnalisis,
        {
          systemInstruction: `
Eres un asistente académico de FCC Academy.

Ayudas a un profesor universitario a revisar un quiz que él mismo creó.

Tu función es detectar problemas reales y proponer correcciones concretas que la plataforma pueda aplicar.

REGLAS:

1. Usa lenguaje natural, directo y fácil de entender.

2. Evita expresiones técnicas innecesarias como:
   - "la clave marcada"
   - "la respuesta respaldada por el contexto"
   - "el identificador"
   - "la pregunta con ID"

Prefiere frases como:
   - "La respuesta marcada es incorrecta."
   - "Según el contenido del curso, la respuesta correcta es..."
   - "Esta parte de la pregunta puede escribirse de forma más clara."

3. Nunca escribas UUID, IDs de base de datos ni identificadores técnicos en ningún texto destinado al profesor.

pregunta_id y respuesta_objetivo_id son únicamente campos técnicos estructurados.

4. Una expresión como:
   - "según el diagrama"
   - "observa la siguiente imagen"
   - "según esta fórmula"
   - "en la gráfica anterior"

NO es un error por sí misma.

Estas referencias son normales en un cuestionario.

5. Mientras no recibas información explícita indicando que el recurso falta, asume que la imagen, gráfica, fórmula o diagrama mencionado puede estar disponible para el estudiante.

NO generes advertencias únicamente porque el recurso visual no aparece en el texto plano que recibiste.

6. No exijas que una fórmula tenga un nombre formal. Un profesor puede utilizar fórmulas propias o adaptadas para su curso.

7. Detecta solamente problemas útiles, como:
   - respuesta marcada realmente incorrecta;
   - error conceptual;
   - texto residual o accidental;
   - redacción claramente confusa;
   - error gramatical que afecte la comprensión;
   - respuesta mal redactada;
   - contradicción con el contenido académico.

8. No seas excesivamente estricto con estilo o preferencias de redacción.

9. Para cada problema que pueda corregirse automáticamente genera una acción.

10. Usa:

tipo = "cambiar_respuesta_correcta"

cuando el profesor marcó una respuesta equivocada.

respuesta_objetivo_id debe contener exactamente el ID de la opción que debería quedar marcada como correcta.

texto_actual debe describir brevemente la respuesta actualmente marcada.

texto_propuesto debe contener el texto de la respuesta que debería ser correcta.

11. Usa:

tipo = "reescribir_pregunta"

cuando haya que corregir el enunciado.

respuesta_objetivo_id debe ser "".

texto_actual debe contener el enunciado actual.

texto_propuesto debe contener la versión completa corregida.

12. Usa:

tipo = "reescribir_respuesta"

cuando una opción necesite una corrección de redacción.

respuesta_objetivo_id debe contener exactamente el ID de esa respuesta.

texto_actual debe contener su texto actual.

texto_propuesto debe contener la versión corregida completa.

13. Una misma observación no debe aparecer repetida en motivo_revision, advertencias y acciones.

Si existe una acción concreta, no repitas el mismo problema varias veces.

14. motivo debe ser una sola explicación corta y sencilla.

Ejemplo:
"La respuesta marcada contradice la explicación del curso."

No escribas párrafos largos.

15. Si una pregunta está correctamente construida, acciones debe ser [].

16. Identifica internamente el aprendizaje o conocimiento que evalúa cada pregunta.

Los conceptos se utilizarán después en analíticas docentes.

17. Los conceptos deben ser específicos y comprensibles fuera del quiz.

Evita:
"Interactividad"
"Gestión de datos"
"Aplicación web vs. página informativa"

Prefiere:
"Diferenciar una aplicación web de una página informativa"
"Identificar cómo una aplicación web permite la interacción del usuario"
"Reconocer cuándo una aplicación necesita persistencia de datos"

18. No incluyas información sobre estudiantes, nombres, matrículas, perfiles o resultados.

19. Debes devolver exactamente una entrada por cada pregunta recibida y conservar pregunta_id únicamente en su campo estructurado.

20. No cambies silenciosamente una respuesta correcta. Sólo propón la acción; el profesor tomará la decisión final.

21. Cuando recibas una imagen etiquetada como parte de una pregunta u opción, debes utilizarla para evaluar esa pregunta.

22. Si una pregunta menciona explícitamente una imagen, gráfica o diagrama y recibiste una imagen asociada a esa pregunta, NO señales la referencia visual como problema.

23. Si una pregunta menciona explícitamente una imagen, gráfica o diagrama pero la información de recursos_integrados_en_el_quiz indica que esa pregunta tiene 0 imágenes, puedes advertir de forma sencilla que parece faltar el recurso visual.

24. Si una pregunta menciona "esta fórmula" y recursos_integrados_en_el_quiz contiene una fórmula para esa pregunta u opción, considérala presente.

25. Las imágenes adicionales seleccionadas desde los bloques son contexto académico. No asumas que forman parte visual del enunciado del quiz.

26. No generes dos acciones que compitan sobre el mismo objetivo.

Por pregunta puede existir como máximo:
- una acción para cambiar la respuesta correcta;
- una acción para reescribir el enunciado;
- una acción de reescritura por cada opción de respuesta.

Si varios problemas pueden resolverse con una sola reescritura, entrega una única propuesta que los corrija juntos.

27. Cada acción debe indicar su impacto:

impacto = "editorial"
cuando corrige únicamente:
- ortografía;
- gramática;
- texto residual;
- claridad;
- redacción;
- formato;
- una mejora que no cambia qué conocimiento se considera correcto.

impacto = "academico"
cuando la acción cambia o cuestiona:
- cuál respuesta es correcta;
- un concepto académico;
- el significado de una respuesta;
- una contradicción con el contenido;
- una afirmación que podría enseñar información incorrecta.

28. Si propones cambiar la respuesta correcta, esa acción SIEMPRE debe tener impacto = "academico".

29. retroalimentacion_correcta y retroalimentacion_incorrecta deben corresponder al estado académicamente recomendado después de aplicar tus correcciones académicas.

Ejemplo:
si actualmente A está marcada pero determinas que B debería ser correcta, genera la retroalimentación tomando B como la respuesta correcta recomendada.

30. Si el profesor posteriormente ignora una corrección académica, FCC Academy no utilizará automáticamente esa retroalimentación. Por eso no intentes justificar una respuesta que consideras incorrecta.

31. Las correcciones editoriales no deben alterar innecesariamente la retroalimentación académica.

32. La retroalimentación debe explicar brevemente por qué una respuesta es correcta o qué debería revisar el estudiante cuando responde incorrectamente. Evita frases vacías como "revisa el tema" sin explicar qué concepto debe revisar.

33. Si una pregunta sólo tiene un problema de ortografía, gramática, claridad o redacción, conserva estado_respuesta_correcta = "coherente" y usa impacto = "editorial".

34. Si una pregunta no tiene problemas, devuelve estado_respuesta_correcta = "coherente", contexto_suficiente = true, motivo_revision = "", advertencias = [] y acciones = [].

35. Las fórmulas incluidas dentro de preguntas y opciones aparecen entre $...$. Son contenido real del quiz: nunca las interpretes como campos vacíos y no propongas completarlas sólo por estar escritas en LaTeX.

36. Cuando texto_actual o texto_propuesto contengan una fórmula, conserva una expresión válida para KaTeX entre $...$. No devuelvas comandos LaTeX sueltos sin delimitadores.

37. No generes cambiar_respuesta_correcta si respuesta_objetivo_id ya corresponde a la opción marcada como correcta. Una acción debe representar un cambio real.
          `.trim(),
        }
        ),
        tiempoRestante
      );

    if (
      !Array.isArray(
        analisis.preguntas
      )
    ) {
      throw new Error(
        "La IA no devolvió preguntas válidas."
      );
    }

    const idsEsperados =
      new Set(
        preguntaIds
      );

    const idsRecibidos =
      new Set(
        analisis.preguntas.map(
          (pregunta) =>
            pregunta.pregunta_id
        )
      );

    const idsValidos =
      idsEsperados.size ===
        idsRecibidos.size &&
      Array.from(
        idsEsperados
      ).every(
        (id) =>
          idsRecibidos.has(
            id
          )
      );

    if (!idsValidos) {
      throw new Error(
        "La IA no conservó correctamente los identificadores de las preguntas."
      );
    }

    const preguntasOriginalesPorId =
      new Map(
        preguntasIA.map(
          (pregunta) => [
            pregunta.id,
            pregunta,
          ]
        )
      );

    for (
      const preguntaAnalizada
      of analisis.preguntas
    ) {
      const original =
        preguntasOriginalesPorId.get(
          preguntaAnalizada.pregunta_id
        );

      if (!original) {
        throw new Error(
          "La IA devolvió una pregunta desconocida."
        );
      }

      const respuestasValidas =
        new Set(
          original.opciones.map(
            (opcion) => opcion.id
          )
        );

      const clavesAcciones =
        new Set<string>();

      const respuestaCorrectaActual =
        original.opciones.find(
          (opcion) =>
            opcion.marcada_correcta
        );

      preguntaAnalizada.acciones =
        (
          preguntaAnalizada.acciones ||
          []
        )
        .map((accion) =>
          accion.tipo === "cambiar_respuesta_correcta"
            ? { ...accion, impacto: "academico" as const }
            : accion
        )
        .filter((accion) => {
          if (
            accion.tipo ===
              "cambiar_respuesta_correcta" &&
            accion.respuesta_objetivo_id ===
              respuestaCorrectaActual?.id
          ) {
            return false;
          }

          if (
            accion.tipo ===
            "reescribir_pregunta"
          ) {
            const actual =
              normalizarContenidoComparacionIA(
                original.enunciado
              );
            const propuesta =
              normalizarContenidoComparacionIA(
                accion.texto_propuesto
              );

            if (
              actual &&
              actual === propuesta
            ) {
              return false;
            }
          }

          if (
            accion.tipo ===
            "reescribir_respuesta"
          ) {
            const respuestaActual =
              original.opciones.find(
                (opcion) =>
                  opcion.id ===
                  accion.respuesta_objetivo_id
              );
            const actual =
              normalizarContenidoComparacionIA(
                respuestaActual?.texto
              );
            const propuesta =
              normalizarContenidoComparacionIA(
                accion.texto_propuesto
              );

            if (
              actual &&
              actual === propuesta
            ) {
              return false;
            }
          }

          const clave =
            accion.tipo ===
            "cambiar_respuesta_correcta"
              ? "respuesta-correcta"
              : accion.tipo ===
                  "reescribir_pregunta"
                ? "pregunta"
                : `respuesta:${accion.respuesta_objetivo_id}`;

          if (
            clavesAcciones.has(clave)
          ) {
            return false;
          }

          clavesAcciones.add(clave);
          return true;
        });
      for (
        const accion
        of preguntaAnalizada.acciones || []
      ) {
        if (
          accion.tipo ===
            "cambiar_respuesta_correcta" ||
          accion.tipo ===
            "reescribir_respuesta"
        ) {
          if (
            !respuestasValidas.has(
              accion.respuesta_objetivo_id
            )
          ) {
            throw new Error(
              "La IA intentó modificar una respuesta que no pertenece a la pregunta."
            );
          }
        }
      }
    }

    if (
      Date.now() - inicioSolicitud >=
      LIMITE_ANALISIS_IA_MS
    ) {
      throw new ErrorTiempoAnalisisIA();
    }

    const {
      error: limpiarContextoError,
    } = await admin
      .from("quiz_bloques_contexto")
      .delete()
      .eq("quiz_id", quiz.id)
      .eq("origen", "analisis");

    if (limpiarContextoError) {
      throw limpiarContextoError;
    }

    const {
      error: guardarContextoError,
    } = await admin
      .from("quiz_bloques_contexto")
      .insert(
        bloques.map((bloque) => ({
          quiz_id: quiz.id,
          bloque_id: bloque.id,
          origen: "analisis",
        }))
      );

    if (guardarContextoError) {
      throw guardarContextoError;
    }

    if (
      Date.now() - inicioSolicitud >=
      LIMITE_ANALISIS_IA_MS
    ) {
      throw new ErrorTiempoAnalisisIA();
    }

    const numeroIntento =
      usados + 1;

    const {
      data: analisisGuardado,
      error: registrarUsoError,
    } = await admin
      .from("ia_analisis_quiz")
      .insert({
        quiz_id:
          quiz.id,

        profesor_id:
          user.id,

        numero_intento:
          numeroIntento,

        modelo:
          (ai as {
            modeloUtilizado?: string;
          }).modeloUtilizado ||
          process.env.GEMINI_QUIZ_MODEL ||
          "gemini-3.5-flash",

        resultado:
          analisis,

        snapshot:
          snapshotGuardado,

        snapshot_hash:
          snapshotHash,

        estado:
          "generado",
      })
      .select("id")
      .single();

    if (
      registrarUsoError ||
      !analisisGuardado
    ) {
      throw (
        registrarUsoError ||
        new Error(
          "No se pudo registrar el análisis."
        )
      );
    }
    return NextResponse.json(
      {
        ok: true,

        uso: {
          usados: numeroIntento,
          disponibles:
            Math.max(0, 3 - numeroIntento),
          total: 3,
        },

        analisis_id:
          analisisGuardado.id,

        analisis,

        contexto: {
          bloques_utilizados:
            bloques.map(
              (bloque) => ({
                id:
                  bloque.id,

                titulo:
                  bloque.titulo ||
                  "Sin título",
              })
            ),
        },
      }
    );
  } catch (error: unknown) {
    console.error(
      "Error analizando quiz con IA:",
      error
    );
    if (error instanceof ErrorTiempoAnalisisIA) {
      return NextResponse.json(
        {
          ok: false,
          code: "AI_TIMEOUT",
          error:
            "El análisis tardó más de lo esperado. Revisa tu conexión o vuelve a intentarlo más tarde. No se descontó ningún intento.",
        },
        { status: 504 }
      );
    }

    const publico = interpretarErrorIA(
      error,
      "analizar"
    );

    return NextResponse.json(
      {
        ok: false,
        code: publico.code,
        error: publico.error,
        ...(publico.retry_after_seconds
          ? {
              retry_after_seconds:
                publico.retry_after_seconds,
            }
          : {}),
      },
      {
        status: publico.status,
      }
    );
  }
}
