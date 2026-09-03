import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { interpretarErrorIA } from "@/lib/ai/errorPublico";
import { autenticarProfesorDeCurso } from "@/lib/cursoStorageServidor";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SEGMENTOS = 80;
const MAX_CARACTERES = 18_000;
const MAX_CARACTERES_SEGMENTO = 1_600;
const LIMITE_FORMATO_MS = 95_000;

type TamanoFormato = "pequeno" | "normal" | "grande" | "muy_grande";
type AlineacionFormato =
  | "izquierda"
  | "centro"
  | "derecha"
  | "justificado";

type SegmentoFormato = {
  id: string;
  texto: string;
};

type DecisionFormato = {
  id: string;
  tamano: TamanoFormato;
  alineacion: AlineacionFormato;
  negrita: boolean;
  cursiva: boolean;
  subrayado: boolean;
  mayusculas: boolean;
};

type RespuestaFormato = {
  decisiones: DecisionFormato[];
};

class ErrorTiempoFormato extends Error {
  constructor() {
    super("El formato automático superó el tiempo máximo permitido.");
    this.name = "ErrorTiempoFormato";
  }
}

function textoSeguro(value: unknown, maximo: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximo);
}

async function ejecutarConLimite<T>(operacion: Promise<T>): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const limite = new Promise<never>((_, reject) => {
    temporizador = setTimeout(
      () => reject(new ErrorTiempoFormato()),
      LIMITE_FORMATO_MS
    );
  });

  try {
    return await Promise.race([operacion, limite]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

function validarSegmentos(value: unknown): SegmentoFormato[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Agrega texto al contenido antes de mejorar su formato.");
  }

  if (value.length > MAX_SEGMENTOS) {
    throw new Error(
      `El contenido tiene demasiadas secciones para una sola pasada. ` +
        `Divídelo en bloques de hasta ${MAX_SEGMENTOS} párrafos.`
    );
  }

  const ids = new Set<string>();
  let caracteres = 0;

  const segmentos = value.map((item: any) => {
    const id = textoSeguro(item?.id, 120);
    const textoCompleto = textoSeguro(item?.texto, MAX_CARACTERES_SEGMENTO + 1);

    if (!/^\d+(?:\.\d+)*$/.test(id) || ids.has(id) || !textoCompleto) {
      throw new Error("El contenido no pudo prepararse de forma segura.");
    }

    if (textoCompleto.length > MAX_CARACTERES_SEGMENTO) {
      throw new Error(
        "Uno de los párrafos es demasiado extenso. Divídelo antes de mejorar el formato."
      );
    }

    ids.add(id);
    caracteres += textoCompleto.length;

    return { id, texto: textoCompleto };
  });

  if (caracteres > MAX_CARACTERES) {
    throw new Error(
      "El contenido es demasiado extenso para formatearlo en una sola pasada. Divídelo en dos bloques."
    );
  }

  return segmentos;
}

function validarDecisiones(
  value: unknown,
  segmentos: SegmentoFormato[]
): DecisionFormato[] {
  const recibidas = (value as RespuestaFormato | null)?.decisiones;
  const tamanos = new Set<TamanoFormato>([
    "pequeno",
    "normal",
    "grande",
    "muy_grande",
  ]);
  const alineaciones = new Set<AlineacionFormato>([
    "izquierda",
    "centro",
    "derecha",
    "justificado",
  ]);
  const segmentosPorId = new Map(segmentos.map((item) => [item.id, item]));

  if (!Array.isArray(recibidas) || recibidas.length !== segmentos.length) {
    throw new Error("La IA devolvió una respuesta incompleta para el formato.");
  }

  const ids = new Set<string>();
  let tituloPrincipalUtilizado = false;

  return recibidas.map((item: any) => {
    const id = textoSeguro(item?.id, 120);
    const segmento = segmentosPorId.get(id);

    if (!segmento || ids.has(id)) {
      throw new Error("La IA devolvió una respuesta inválida para el formato.");
    }

    if (!tamanos.has(item?.tamano) || !alineaciones.has(item?.alineacion)) {
      throw new Error("La IA devolvió una jerarquía visual inválida.");
    }

    if (
      typeof item?.negrita !== "boolean" ||
      typeof item?.cursiva !== "boolean" ||
      typeof item?.subrayado !== "boolean" ||
      typeof item?.mayusculas !== "boolean"
    ) {
      throw new Error("La IA devolvió estilos incompletos para el formato.");
    }

    ids.add(id);

    const cantidadPalabras = segmento.texto.split(/\s+/).filter(Boolean).length;
    const esTextoCorto = segmento.texto.length <= 100 && cantidadPalabras <= 12;
    const esParrafoLargo = segmento.texto.length > 260;
    let tamano = item.tamano as TamanoFormato;
    let alineacion = item.alineacion as AlineacionFormato;

    if (tamano === "muy_grande") {
      if (tituloPrincipalUtilizado || !esTextoCorto) {
        tamano = "grande";
      } else {
        tituloPrincipalUtilizado = true;
      }
    }

    if (esParrafoLargo && (alineacion === "centro" || alineacion === "derecha")) {
      alineacion = "justificado";
    }

    if (/^[•·▪◦*-]\s/.test(segmento.texto)) {
      alineacion = "izquierda";
    }

    return {
      id,
      tamano,
      alineacion,
      negrita: Boolean(item.negrita),
      cursiva: Boolean(item.cursiva),
      subrayado: Boolean(item.subrayado) && esTextoCorto,
      mayusculas: Boolean(item.mayusculas) && esTextoCorto,
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const materiaId = textoSeguro(body?.materiaId, 80);

    if (!materiaId) {
      return NextResponse.json(
        { ok: false, error: "No se pudo identificar el curso." },
        { status: 400 }
      );
    }

    const segmentos = validarSegmentos(body?.segmentos);
    const auth = await autenticarProfesorDeCurso(request, materiaId);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      );
    }

    const schema = {
      type: "object",
      properties: {
        decisiones: {
          type: "array",
          minItems: segmentos.length,
          maxItems: segmentos.length,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              tamano: {
                type: "string",
                enum: ["pequeno", "normal", "grande", "muy_grande"],
              },
              alineacion: {
                type: "string",
                enum: ["izquierda", "centro", "derecha", "justificado"],
              },
              negrita: { type: "boolean" },
              cursiva: { type: "boolean" },
              subrayado: { type: "boolean" },
              mayusculas: { type: "boolean" },
            },
            required: [
              "id",
              "tamano",
              "alineacion",
              "negrita",
              "cursiva",
              "subrayado",
              "mayusculas",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["decisiones"],
      additionalProperties: false,
    };

    const ai = getAIProvider();
    const respuesta = await ejecutarConLimite(
      ai.generateJSON<RespuestaFormato>(
        JSON.stringify({ segmentos }, null, 2),
        schema,
        {
          systemInstruction: `
Eres un clasificador de jerarquía visual para contenido educativo de FCC Academy.

Recibirás únicamente segmentos de texto con un id estable. No recibirás ni debes solicitar HTML, imágenes, videos, documentos o fórmulas.

Tu única tarea es devolver una decisión de formato por cada id recibido. No devuelvas texto reescrito ni explicaciones.

REGLAS OBLIGATORIAS:
1. Conserva exactamente todos los ids y devuelve cada id una sola vez.
2. No corrijas, resumas, traduzcas, completes ni inventes contenido.
3. Usa "muy_grande" sólo para un título principal real, breve y claramente identificable. Como máximo uno.
4. Usa "grande" para títulos de sección o subtítulos breves.
5. Usa "normal" para explicaciones, párrafos, listas y contenido general.
6. Usa "pequeno" sólo para notas, referencias, pies o aclaraciones secundarias.
7. Usa mayúsculas únicamente en títulos o etiquetas muy breves. Nunca en párrafos, preguntas completas ni listas extensas.
8. Centra únicamente el título principal o encabezados breves cuando ayude a la jerarquía. Mantén listas a la izquierda. Justifica sólo párrafos suficientemente largos. Usa derecha únicamente para fechas, firmas o atribuciones claras.
9. Negrita sirve para títulos, subtítulos o avisos relevantes. Cursiva para notas, citas o énfasis suave. Subrayado sólo cuando aporte una distinción clara.
10. No actives estilos por obligación. Cada decisión debe responder a la función real del segmento.
11. No existe ninguna fuente tipográfica, color, fondo ni estilo fuera de los valores del esquema.
          `.trim(),
        }
      )
    );

    const decisiones = validarDecisiones(respuesta, segmentos);

    return NextResponse.json({ ok: true, decisiones });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "";

    if (
      /Agrega texto|demasiadas secciones|demasiado extens|párrafo es demasiado|no pudo prepararse/i.test(
        mensaje
      )
    ) {
      return NextResponse.json({ ok: false, error: mensaje }, { status: 400 });
    }

    console.error("Error aplicando formato automático al contenido:", error);
    const publico = interpretarErrorIA(error, "formatear");

    return NextResponse.json(
      { ok: false, ...publico },
      { status: publico.status }
    );
  }
}
