/**
 * Página para resolver un quiz: carga preguntas y respuestas desde Supabase,
 * controla intentos, guarda resultados y actualiza progreso y XP del usuario.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";

type Pregunta = { id: string; enunciado: string };
type Respuesta = { id: string; texto: string; es_correcta: boolean };

export default function ResolverQuizPage() {
  const params = useParams();
  const router = useRouter();
  const materiaId = params?.id as string;
  const quizId = params?.quizId as string;

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta[]>>({});
  const [seleccionadas, setSeleccionadas] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<{ correctas: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizInfo, setQuizInfo] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [intentosRealizados, setIntentosRealizados] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/login");
        return;
      }
      setUserId(userData.user.id);

      const { data: qz } = await supabase
        .from("quizzes")
        .select("id,titulo,descripcion,xp,intentos_max,tiempo_limite_seg")
        .eq("id", quizId)
        .single();
      setQuizInfo(qz);

      const { count: intentosCount } = await supabase
        .from("intentos_quiz")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quizId)
        .eq("usuario_id", userData.user.id);

      setIntentosRealizados(intentosCount || 0);

      const { data: preg } = await supabase
        .from("preguntas")
        .select("id,enunciado")
        .eq("quiz_id", quizId)
        .order("orden", { ascending: true });

      if (!preg) {
        setLoading(false);
        return;
      }

      setPreguntas(preg as Pregunta[]);

      const mapa: Record<string, Respuesta[]> = {};
      for (const p of preg as Pregunta[]) {
        const { data: resp } = await supabase
          .from("respuestas")
          .select("id,texto,es_correcta")
          .eq("pregunta_id", p.id);
        mapa[p.id] = (resp || []) as Respuesta[];
      }
      setRespuestas(mapa);

      setLoading(false);
    };

    fetchData();
  }, [quizId, router]);

  const enviarQuiz = async () => {
    if (!userId || !quizInfo) return;

    if (intentosRealizados >= (quizInfo.intentos_max ?? 1)) {
      alert("❌ Ya alcanzaste el número máximo de intentos para este quiz.");
      return;
    }

    let correctas = 0;
    preguntas.forEach((p) => {
      const respuesta = respuestas[p.id]?.find((r) => r.id === seleccionadas[p.id]);
      if (respuesta?.es_correcta) correctas++;
    });

    const total = preguntas.length;
    setResultado({ correctas, total });

    const puntaje = Math.round((correctas / total) * 100);

    await supabase.from("intentos_quiz").insert({
      quiz_id: quizId,
      usuario_id: userId,
      puntaje,
      completado: true,
    });

    setIntentosRealizados((prev) => prev + 1);

    if (puntaje >= 70) {
      await supabase.rpc("sumar_xp", {
        user_id: userId,
        xp_extra: quizInfo.xp,
      });
    }

    const { count: totalQuizzes } = await supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("materia_id", materiaId);

    const { count: quizzesCompletados } = await supabase
      .from("intentos_quiz")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", userId)
      .eq("completado", true)
      .in(
        "quiz_id",
        (
          await supabase.from("quizzes").select("id").eq("materia_id", materiaId)
        ).data?.map((q) => q.id) || []
      );

    const progreso = totalQuizzes
      ? Math.round(((quizzesCompletados || 0) / totalQuizzes) * 100)
      : 0;

    await supabase
      .from("progreso")
      .update({ progreso })
      .eq("usuario_id", userId)
      .eq("materia_id", materiaId);
  };

  if (loading) {
    return (
      <LayoutGeneral>
        <p className="text-gray-400">Cargando quiz...</p>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral>
      <div className="bg-gray-900 p-6 rounded-xl shadow space-y-6">
        <h1 className="text-2xl font-bold">
          {quizInfo?.titulo || "Resolver Quiz"}
        </h1>
        {quizInfo?.descripcion && (
          <p className="text-gray-400">{quizInfo.descripcion}</p>
        )}
        <p className="text-sm text-gray-400">
          Intentos realizados: {intentosRealizados} / {quizInfo?.intentos_max ?? 1}
        </p>

        {preguntas.map((p, idx) => (
          <div key={p.id} className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">
              {idx + 1}. {p.enunciado}
            </h3>
            <div className="space-y-2">
              {(respuestas[p.id] || []).map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={p.id}
                    value={r.id}
                    checked={seleccionadas[p.id] === r.id}
                    onChange={() =>
                      setSeleccionadas((prev) => ({ ...prev, [p.id]: r.id }))
                    }
                  />
                  {r.texto}
                </label>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={enviarQuiz}
          disabled={intentosRealizados >= (quizInfo?.intentos_max ?? 1)}
          className={`px-4 py-2 rounded text-white ${
            intentosRealizados >= (quizInfo?.intentos_max ?? 1)
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          Enviar respuestas
        </button>

        {resultado && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <p>
              Respuestas correctas:{" "}
              <span className="font-bold text-green-400">
                {resultado.correctas}
              </span>{" "}
              de {resultado.total}
            </p>
            <p>
              Puntaje final:{" "}
              <span className="font-bold text-blue-400">
                {Math.round((resultado.correctas / resultado.total) * 100)}%
              </span>
            </p>
            {resultado.correctas / resultado.total >= 0.7 ? (
              <p className="text-green-400 font-semibold">
                ¡Felicidades! Ganaste {quizInfo?.xp ?? 0} XP 🎉
              </p>
            ) : (
              <p className="text-red-400 font-semibold">
                No alcanzaste el mínimo para XP. Inténtalo de nuevo.
              </p>
            )}
          </div>
        )}
      </div>
    </LayoutGeneral>
  );
}
