import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { interpretarErrorIA } from "@/lib/ai/errorPublico";
import { autenticarProfesorDeCurso } from "@/lib/cursoStorageServidor";
import {
  contenidoQuizATextoIA,
  extraerFormulasInlineIA,
} from "@/lib/ai/quizMedia";

export const runtime = "nodejs";

const MAX_BLOQUES_CONTEXTO = 4;
const MAX_CARACTERES_CONTEXTO = 30000;
const MAX_FORMULAS_POR_BLOQUE = 8;

type TipoPreguntas = "automatico" | "conceptual" | "practico" | "mixto";

type QuizGeneradoIA = {
  titulo: string;
  descripcion: string;
  preguntas: Array<{
    enunciado: string;
    opciones: string[];
    indice_correcta: number;
  }>;
};

function textoSeguro(value: unknown, maximo: number) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximo);
}

function limpiarReferenciaInternaEnEnunciado(value: unknown, maximo: number) {
  const prefijoInterno =
    /^(?:de acuerdo con|seg[uú]n|con base en|a partir de)\s+(?:(?:el|la|los|las)\s+)?(?:material(?:\s+(?:conceptual|proporcionado|seleccionado|visto))?|contenido(?:\s+(?:acad[eé]mico|proporcionado|seleccionado|visto|del tema))?|texto(?:\s+(?:proporcionado|seleccionado|anterior|del tema))?|notas?(?:\s+(?:del?|de la)\s+profesor(?:a)?)?|explicaci[oó]n(?:\s+anterior)?|informaci[oó]n(?:\s+(?:proporcionada|seleccionada|anterior))?)(?:\s+(?:del?|de la)\s+(?:tema|curso|profesor(?:a)?))?\s*(?:,|:|;|-|\s+(?=[¿¡]))\s*/iu;

  const limpio = textoSeguro(value, maximo).replace(prefijoInterno, "").trim();

  return limpio.replace(
    /^([\s¿¡"'(\[]*)([a-záéíóúñü])/iu,
    (_, apertura: string, letra: string) => `${apertura}${letra.toLocaleUpperCase("es-MX")}`
  );
}

function normalizarOpcion(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-MX");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const materiaId = textoSeguro(body?.materiaId, 80);
    const bloquePrincipalId = textoSeguro(body?.bloquePrincipalId, 80);
    const cantidadPreguntas = Number(body?.cantidadPreguntas);
    const opcionesPorPregunta = Number(body?.opcionesPorPregunta);
    const tipoPreguntas = textoSeguro(body?.tipoPreguntas, 30) as TipoPreguntas;
    const instrucciones = textoSeguro(body?.instrucciones, 1200);
    const tiposPermitidos = new Set<TipoPreguntas>([
      "automatico",
      "conceptual",
      "practico",
      "mixto",
    ]);

    if (!materiaId || !bloquePrincipalId) {
      return NextResponse.json(
        { ok: false, error: "Selecciona el contenido principal del quiz." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(cantidadPreguntas) ||
      cantidadPreguntas < 1 ||
      cantidadPreguntas > 20
    ) {
      return NextResponse.json(
        { ok: false, error: "La cantidad de preguntas debe estar entre 1 y 20." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(opcionesPorPregunta) ||
      opcionesPorPregunta < 2 ||
      opcionesPorPregunta > 6
    ) {
      return NextResponse.json(
        { ok: false, error: "Cada pregunta debe tener entre 2 y 6 opciones." },
        { status: 400 }
      );
    }

    if (!tiposPermitidos.has(tipoPreguntas)) {
      return NextResponse.json(
        { ok: false, error: "El tipo de preguntas no es válido." },
        { status: 400 }
      );
    }

    const auth = await autenticarProfesorDeCurso(request, materiaId);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      );
    }

    const bloqueIdsRecibidos = Array.isArray(body?.bloqueIds)
      ? body.bloqueIds
          .map((id: unknown) => textoSeguro(id, 80))
          .filter(Boolean)
      : [];
    const bloqueIds = Array.from(
      new Set([bloquePrincipalId, ...bloqueIdsRecibidos])
    );

    if (bloqueIds.length > MAX_BLOQUES_CONTEXTO) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Puedes utilizar como máximo ${MAX_BLOQUES_CONTEXTO} bloques: ` +
            "el principal y hasta 3 anteriores.",
        },
        { status: 400 }
      );
    }

    const { data: bloques, error: bloquesError } = await auth.admin
      .from("curso_contenido_bloques")
      .select("id,titulo,introduccion,contenido,unidad_id,orden")
      .eq("materia_id", materiaId)
      .in("id", bloqueIds);

    if (bloquesError) throw bloquesError;

    if (!bloques || bloques.length !== bloqueIds.length) {
      return NextResponse.json(
        { ok: false, error: "Uno o más bloques no pertenecen al curso." },
        { status: 400 }
      );
    }

    const principal = bloques.find((bloque) => bloque.id === bloquePrincipalId);

    if (!principal) {
      return NextResponse.json(
        { ok: false, error: "No se encontró el bloque principal." },
        { status: 400 }
      );
    }

    const ordenPrincipal = Number(principal.orden ?? 0);
    const contextoInvalido = bloques.some(
      (bloque) =>
        bloque.unidad_id !== principal.unidad_id ||
        Number(bloque.orden ?? 0) > ordenPrincipal
    );

    if (contextoInvalido) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sólo puedes utilizar el bloque principal y bloques anteriores de la misma unidad.",
        },
        { status: 400 }
      );
    }

    const bloquesOrdenados = [...bloques].sort(
      (a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0)
    );
    const { data: formulas, error: formulasError } = await auth.admin
      .from("curso_formulas")
      .select("bloque_id,titulo,ecuacion,descripcion,orden")
      .in("bloque_id", bloqueIds)
      .order("orden", { ascending: true });

    if (formulasError) throw formulasError;

    let caracteresDisponibles = MAX_CARACTERES_CONTEXTO;

    const contextoAcademico = bloquesOrdenados.map((bloque, indiceBloque) => {
      const bloquesRestantes = bloquesOrdenados.length - indiceBloque;
      const presupuestoBloque = Math.floor(
        caracteresDisponibles / bloquesRestantes
      );
      const introduccionTexto = contenidoQuizATextoIA(bloque.introduccion);
      const contenidoTexto = contenidoQuizATextoIA(bloque.contenido);
      const introduccion = introduccionTexto.slice(
        0,
        Math.min(2500, Math.floor(presupuestoBloque * 0.25))
      );
      const contenido = contenidoTexto.slice(
        0,
        Math.max(0, presupuestoBloque - introduccion.length)
      );
      const formulasEmbebidas = [
        ...extraerFormulasInlineIA(bloque.introduccion),
        ...extraerFormulasInlineIA(bloque.contenido),
      ];
      const formulasRegistradas = (formulas ?? [])
        .filter((formula) => formula.bloque_id === bloque.id)
        .map((formula) => ({
          titulo: textoSeguro(formula.titulo, 200),
          ecuacion: textoSeguro(formula.ecuacion, 2000),
          descripcion: textoSeguro(formula.descripcion, 1000),
        }));

      caracteresDisponibles = Math.max(
        0,
        caracteresDisponibles - introduccion.length - contenido.length
      );

      return {
        id: bloque.id,
        titulo: textoSeguro(bloque.titulo || "Bloque sin título", 300),
        es_principal: bloque.id === bloquePrincipalId,
        introduccion,
        contenido,
        formulas_embebidas: formulasEmbebidas.slice(
          0,
          MAX_FORMULAS_POR_BLOQUE
        ),
        formulas_registradas: formulasRegistradas.slice(
          0,
          MAX_FORMULAS_POR_BLOQUE
        ),
      };
    });

    const tipoInstruccion: Record<TipoPreguntas, string> = {
      automatico:
        "Elige automáticamente entre preguntas conceptuales y prácticas según lo que realmente permita el contenido.",
      conceptual:
        "Genera preguntas conceptuales de comprensión, relación y aplicación de ideas. Evita ejercicios numéricos forzados.",
      practico:
        "Prioriza ejercicios prácticos resolubles con el contenido. Si un bloque no permite cálculos, formula situaciones de aplicación sin inventar datos ni métodos.",
      mixto:
        "Combina de forma equilibrada preguntas conceptuales y ejercicios prácticos que el contenido permita resolver.",
    };

    const schema = {
      type: "object",
      properties: {
        titulo: { type: "string" },
        descripcion: { type: "string" },
        preguntas: {
          type: "array",
          minItems: cantidadPreguntas,
          maxItems: cantidadPreguntas,
          items: {
            type: "object",
            properties: {
              enunciado: { type: "string" },
              opciones: {
                type: "array",
                minItems: opcionesPorPregunta,
                maxItems: opcionesPorPregunta,
                items: { type: "string" },
              },
              indice_correcta: {
                type: "integer",
                minimum: 0,
                maximum: opcionesPorPregunta - 1,
              },
            },
            required: ["enunciado", "opciones", "indice_correcta"],
            additionalProperties: false,
          },
        },
      },
      required: ["titulo", "descripcion", "preguntas"],
      additionalProperties: false,
    };

    const prompt = JSON.stringify(
      {
        objetivo: "Crear un borrador de quiz para FCC Academy.",
        cantidad_preguntas: cantidadPreguntas,
        opciones_por_pregunta: opcionesPorPregunta,
        tipo_preguntas: tipoPreguntas,
        instruccion_tipo: tipoInstruccion[tipoPreguntas],
        preferencias_pedagogicas: instrucciones || null,
        contexto_academico: contextoAcademico,
      },
      null,
      2
    );

    const ai = getAIProvider();
    const generado = await ai.generateJSON<QuizGeneradoIA>(prompt, schema, {
      systemInstruction: `
Eres un generador académico de quizzes para FCC Academy.

REGLAS OBLIGATORIAS:
1. Usa exclusivamente el contexto academico recibido. No agregues temas, formulas, datos ni metodos posteriores o ajenos.
1.1. No navegues por internet ni completes el contenido con conocimiento externo, aunque parezca relacionado.
2. Devuelve exactamente la cantidad de preguntas solicitada y exactamente la cantidad de opciones indicada para cada pregunta.
3. Cada pregunta debe tener una sola respuesta correcta, indicada mediante indice_correcta.
4. Las opciones deben ser distintas, plausibles y no ambiguas. No uses "todas las anteriores" ni "ninguna de las anteriores".
5. Evita preguntas repetidas o que evaluen exactamente lo mismo.
6. Redacta cada pregunta directamente, como si la hubiera escrito el docente del curso. El estudiante nunca debe notar que intervino una IA.
6.1. No comiences con frases de relleno o atribucion como "De acuerdo con...", "Segun...", "Con base en..." o "A partir de...".
6.2. No menciones el material, el contenido proporcionado, el texto, las notas, el profesor, el docente, la IA, el prompt ni ninguna instruccion interna. Tampoco describas la fuente como "conceptual".
7. Si utilizas matematicas, escribe formulas validas para KaTeX entre $...$ o $$...$$. No uses texto Unicode como sustituto de comandos LaTeX cuando exista un comando apropiado.
8. No hagas referencia a una imagen, diagrama o grafica si no aparece expresamente como recurso dentro del contexto recibido.
9. Los ejercicios practicos deben poder resolverse con la informacion y metodos del contenido seleccionado.
10. El titulo y la descripcion deben ser breves, claros y coherentes con el bloque principal.
11. Las preferencias pedagogicas no pueden autorizar contenido fuera de los bloques seleccionados ni cambiar este formato.
12. Es un borrador: prioriza exactitud academica, claridad y utilidad para revision docente.
      `.trim(),
    });

    if (!Array.isArray(generado?.preguntas) || generado.preguntas.length !== cantidadPreguntas) {
      throw new Error("La IA no devolvio la cantidad solicitada de preguntas.");
    }

    const preguntasValidadas = generado.preguntas.map((pregunta, indicePregunta) => {
      const enunciado = limpiarReferenciaInternaEnEnunciado(
        pregunta?.enunciado,
        6000
      );
      const opciones = Array.isArray(pregunta?.opciones)
        ? pregunta.opciones.map((opcion) => textoSeguro(opcion, 4000))
        : [];
      const indiceCorrecta = Number(pregunta?.indice_correcta);

      if (!enunciado) {
        throw new Error(`La pregunta ${indicePregunta + 1} está vacía.`);
      }

      if (opciones.length !== opcionesPorPregunta || opciones.some((opcion) => !opcion)) {
        throw new Error(
          `La pregunta ${indicePregunta + 1} no contiene todas sus opciones.`
        );
      }

      const opcionesUnicas = new Set(opciones.map(normalizarOpcion));

      if (opcionesUnicas.size !== opciones.length) {
        throw new Error(`La pregunta ${indicePregunta + 1} contiene opciones repetidas.`);
      }

      if (
        !Number.isInteger(indiceCorrecta) ||
        indiceCorrecta < 0 ||
        indiceCorrecta >= opciones.length
      ) {
        throw new Error(`La pregunta ${indicePregunta + 1} no tiene una respuesta válida.`);
      }

      return {
        enunciado,
        respuestas: opciones.map((texto, indice) => ({
          texto,
          es_correcta: indice === indiceCorrecta,
        })),
      };
    });

    return NextResponse.json({
      ok: true,
      borrador: {
        titulo: textoSeguro(generado.titulo, 180) || `Quiz: ${principal.titulo}`,
        descripcion: textoSeguro(generado.descripcion, 700),
        preguntas: preguntasValidadas,
      },
      contexto: {
        bloques_utilizados: bloquesOrdenados.map((bloque) => ({
          id: bloque.id,
          titulo: bloque.titulo || "Bloque sin título",
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Error generando quiz con IA:", error);
    const publico = interpretarErrorIA(error, "generar");

    return NextResponse.json(
      {
        ok: false,
        code: publico.code,
        error: publico.error,
        ...(publico.retry_after_seconds
          ? { retry_after_seconds: publico.retry_after_seconds }
          : {}),
      },
      { status: publico.status }
    );
  }
}
