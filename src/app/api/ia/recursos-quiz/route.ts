import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  construirFormulasQuizIA,
  construirImagenesQuizIA,
  construirRecursosAdicionalesIA,
} from "@/lib/ai/quizMedia";

export const runtime = "nodejs";

export async function POST(
  request: Request
) {
  try {
    const authHeader =
      request.headers.get(
        "authorization"
      );

    const token =
      authHeader?.startsWith(
        "Bearer "
      )
        ? authHeader
            .slice(7)
            .trim()
        : null;

    if (!token) {
      return NextResponse.json(
        {
          error:
            "No autenticado.",
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey
    ) {
      throw new Error(
        "Configuración de Supabase incompleta."
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        supabaseKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },

          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser(
        token
      );

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Sesión inválida.",
        },
        {
          status: 401,
        }
      );
    }

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
        "id,materia_id,bloque_id"
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
    } = await supabase
      .from("materias")
      .select(
        "id,profesor_id"
      )
      .eq(
        "id",
        quiz.materia_id
      )
      .single();

    if (
      !materia ||
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
      !preguntas
    ) {
      throw (
        preguntasError ||
        new Error(
          "No se pudieron cargar las preguntas."
        )
      );
    }

    const preguntaIds =
      preguntas.map(
        (pregunta) =>
          pregunta.id
      );

    let respuestas: any[] = [];

    if (
      preguntaIds.length > 0
    ) {
      const result =
        await supabase
          .from("respuestas")
          .select(
            "id,pregunta_id,texto,orden"
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

      if (result.error) {
        throw result.error;
      }

      respuestas =
        result.data ?? [];
    }

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

    if (bloqueIds.length > 8) {
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

    let bloques: any[] = [];

    if (
      bloqueIds.length > 0
    ) {
      const result =
        await supabase
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
          );

      if (result.error) {
        throw result.error;
      }

      bloques =
        result.data ?? [];

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

      const bloquePrincipal =
        bloques.find(
          (bloque) =>
            bloque.id ===
            quiz.bloque_id
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

    let formulas: any[] = [];

    if (
      bloqueIds.length > 0
    ) {
      const result =
        await supabase
          .from(
            "curso_formulas"
          )
          .select(
            `
            id,
            bloque_id,
            titulo,
            ecuacion
            `
          )
          .in(
            "bloque_id",
            bloqueIds
          );

      if (result.error) {
        throw result.error;
      }

      formulas =
        result.data ?? [];
    }

    const imagenesQuiz =
      construirImagenesQuizIA(
        preguntas,
        respuestas
      );

    const formulasQuiz =
      construirFormulasQuizIA(
        preguntas,
        respuestas
      );

    const normalizarFormula = (
      value: unknown
    ) =>
      String(value ?? "")
        .replace(/\s+/g, "")
        .replace(/\\left/g, "")
        .replace(/\\right/g, "")
        .trim()
        .toLowerCase();

    const urlsImagenesQuiz =
      new Set(
        imagenesQuiz.map(
          (imagen) =>
            imagen.url
        )
      );

    const formulasIncluidasQuiz =
      new Set(
        formulasQuiz.map(
          (formula) =>
            normalizarFormula(
              formula.formula
            )
        )
      );

    const recursos =
      construirRecursosAdicionalesIA(
        bloques,
        formulas
      ).filter(
        (recurso) => {
          if (
            recurso.tipo === "imagen" &&
            recurso.url &&
            urlsImagenesQuiz.has(
              recurso.url
            )
          ) {
            return false;
          }

          if (
            recurso.tipo === "formula" &&
            recurso.texto &&
            formulasIncluidasQuiz.has(
              normalizarFormula(
                recurso.texto
              )
            )
          ) {
            return false;
          }

          return true;
        }
      );

    return NextResponse.json({
      ok: true,

      imagenes_quiz:
        imagenesQuiz,

      formulas_quiz:
        formulasQuiz,

      recursos,

      max_recursos_adicionales:
        Math.min(
          preguntas.length,
          10
        ),
    });
  } catch (error) {
    console.error(
      "Error preparando recursos IA:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudieron preparar los recursos.",
      },
      {
        status: 500,
      }
    );
  }
}
