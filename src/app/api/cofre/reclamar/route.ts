import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "path";
import { rarezaConfig, type Rareza } from "@/lib/rarezaConfig";

export const runtime = "nodejs";

type ItemIndice = {
  nombre: string;
  preview: string;
  tipo: string;
};

type RecompensaDisponible = {
  nombre: string;
  imagen: string;
  tipo: string;
  rareza: Rareza;
};

const ORDEN_RAREZA: Rareza[] = [
  "comun",
  "raro",
  "epico",
  "legendario",
];

function normalizarNombre(nombre: string) {
  return nombre
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .trim();
}

function crearMapaVacio(): Record<Rareza, RecompensaDisponible[]> {
  return {
    comun: [],
    raro: [],
    epico: [],
    legendario: [],
  };
}

async function leerCatalogo() {
  const base = path.join(process.cwd(), "public", "recompensas");

  const catalogoTexto = await readFile(
    path.join(base, "catalogo.json"),
    "utf8"
  );

  const catalogo = JSON.parse(catalogoTexto) as Record<
    string,
    Record<string, Rareza>
  >;

  const previews = new Map<string, ItemIndice>();

  for (const rareza of ORDEN_RAREZA) {
    const texto = await readFile(
      path.join(base, rareza, "index.json"),
      "utf8"
    );

    const items = JSON.parse(texto) as ItemIndice[];

    for (const item of items) {
      previews.set(normalizarNombre(item.nombre), item);
    }
  }

  const resultado = crearMapaVacio();

  for (const [tipo, items] of Object.entries(catalogo)) {
    for (const [nombreCatalogo, rareza] of Object.entries(items)) {
      if (!ORDEN_RAREZA.includes(rareza)) continue;

      const itemIndice = previews.get(
        normalizarNombre(nombreCatalogo)
      );

      if (!itemIndice) continue;

      resultado[rareza].push({
        nombre: itemIndice.nombre,
        imagen: itemIndice.preview,
        tipo,
        rareza,
      });
    }
  }

  return resultado;
}

function elegirRareza(
  disponibles: Record<Rareza, RecompensaDisponible[]>
): Rareza | null {
  const candidatas = ORDEN_RAREZA.filter(
    (rareza) => disponibles[rareza].length > 0
  );

  if (candidatas.length === 0) return null;

  const pesoTotal = candidatas.reduce(
    (total, rareza) =>
      total + rarezaConfig[rareza].probabilidad,
    0
  );

  let valor = Math.random() * pesoTotal;

  for (const rareza of candidatas) {
    valor -= rarezaConfig[rareza].probabilidad;

    if (valor <= 0) {
      return rareza;
    }
  }

  return candidatas[candidatas.length - 1];
}

function extraerAleatoria(
  disponibles: Record<Rareza, RecompensaDisponible[]>,
  rareza: Rareza
) {
  const lista = disponibles[rareza];

  if (lista.length === 0) return null;

  const indice = Math.floor(Math.random() * lista.length);
  const [item] = lista.splice(indice, 1);

  return item;
}

function obtenerRarezaMaxima(
  recompensas: RecompensaDisponible[]
): Rareza {
  if (recompensas.length === 0) return "comun";

  return recompensas.reduce<Rareza>((maxima, actual) => {
    return ORDEN_RAREZA.indexOf(actual.rareza) >
      ORDEN_RAREZA.indexOf(maxima)
      ? actual.rareza
      : maxima;
  }, "comun");
}

export async function POST(req: Request) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const authorization = req.headers.get("authorization");
    const bearerToken =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : null;

    let user: { id: string } | null = null;
    let authError: any = null;

    if (bearerToken) {
      const resultadoAuth = await admin.auth.getUser(bearerToken);

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    } else {
      const cookieStore = await cookies();

      const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(
                  ({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                  }
                );
              } catch {}
            },
          },
        }
      );

      const resultadoAuth = await supabaseAuth.auth.getUser();

      user = resultadoAuth.data.user
        ? { id: resultadoAuth.data.user.id }
        : null;
      authError = resultadoAuth.error;
    }

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const tipo =
      body?.tipo === "bienvenida"
        ? "bienvenida"
        : body?.tipo === "nivel"
        ? "nivel"
        : null;

    if (!tipo) {
      return NextResponse.json(
        { error: "Tipo de cofre no válido" },
        { status: 400 }
      );
    }

    const { data: perfil, error: perfilError } = await admin
      .from("usuarios")
      .select("rol,nivel,tutorial_visto")
      .eq("id", user.id)
      .single();

    if (perfilError || !perfil) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (perfil.rol !== "estudiante") {
      return NextResponse.json(
        { error: "Los cofres sólo aplican a estudiantes" },
        { status: 403 }
      );
    }

    const nivelActual = Number(perfil.nivel ?? 0);

    if (tipo === "bienvenida" && !perfil.tutorial_visto) {
      const { data: logrosTutorial, error: errorLogrosTutorial } = await admin
        .from("logros_usuarios")
        .select("logro_id")
        .eq("usuario_id", user.id);

      if (errorLogrosTutorial) {
        throw errorLogrosTutorial;
      }

      const tutorialCompletado = (logrosTutorial ?? []).some(
        (logro) =>
          logro.logro_id === "bcb1b071-5f6a-4c20-a72a-df7e2f8ab610" ||
          logro.logro_id === "tutorial"
      );

      if (!tutorialCompletado) {
        return NextResponse.json(
          {
            error:
              "Primero debe completarse el tutorial para preparar el cofre de bienvenida",
            codigo: "TUTORIAL_NO_COMPLETADO",
          },
          { status: 409 }
        );
      }
    }

    if (tipo === "nivel" && nivelActual < 1) {
      return NextResponse.json(
        { error: "No hay un cofre de nivel disponible" },
        { status: 403 }
      );
    }

    let consultaExistente = admin
      .from("cofres_reclamados")
      .select("id,recompensas")
      .eq("user_id", user.id)
      .eq("tipo", tipo);

    if (tipo === "nivel") {
      consultaExistente = consultaExistente.eq(
        "nivel",
        nivelActual
      );
    } else {
      consultaExistente = consultaExistente.is(
        "nivel",
        null
      );
    }

    const { data: existente, error: errorExistente } =
      await consultaExistente.maybeSingle();

    if (errorExistente) {
      throw errorExistente;
    }

    if (existente) {
      const recompensasExistentes = Array.isArray(
        existente.recompensas
      )
        ? (existente.recompensas as RecompensaDisponible[])
        : [];

      return NextResponse.json({
        rareza: obtenerRarezaMaxima(
          recompensasExistentes
        ),
        recompensas: recompensasExistentes,
        ya_reclamado: true,
        bloqueado_historico:
          recompensasExistentes.length === 0,
      });
    }

    const catalogo = await leerCatalogo();

    const { data: desbloqueadas, error: errorDesbloqueadas } =
      await admin
        .from("recompensas_usuario")
        .select("nombre")
        .eq("user_id", user.id);

    if (errorDesbloqueadas) {
      throw errorDesbloqueadas;
    }

    const yaTiene = new Set(
      (desbloqueadas ?? []).map((item) =>
        normalizarNombre(item.nombre)
      )
    );

    const disponibles = crearMapaVacio();

    for (const rareza of ORDEN_RAREZA) {
      disponibles[rareza] = catalogo[rareza].filter(
        (item) =>
          !yaTiene.has(normalizarNombre(item.nombre))
      );
    }

    const totalDisponibles = ORDEN_RAREZA.reduce(
      (total, rareza) =>
        total + disponibles[rareza].length,
      0
    );

    if (totalDisponibles === 0) {
      return NextResponse.json({
        rareza: "comun" as Rareza,
        recompensas: [],
        ya_reclamado: false,
        agotado: true,
      });
    }

    const seleccionadas: RecompensaDisponible[] = [];

    if (
      tipo === "bienvenida" &&
      disponibles.legendario.length > 0
    ) {
      const legendaria = extraerAleatoria(
        disponibles,
        "legendario"
      );

      if (legendaria) {
        seleccionadas.push(legendaria);
      }
    }

    while (seleccionadas.length < 3) {
      const rareza = elegirRareza(disponibles);

      if (!rareza) break;

      const item = extraerAleatoria(
        disponibles,
        rareza
      );

      if (!item) break;

      seleccionadas.push(item);
    }

    if (seleccionadas.length === 0) {
      return NextResponse.json(
        {
          error: "No se pudieron seleccionar recompensas para el cofre",
          codigo: "COFRE_SIN_SELECCION",
        },
        { status: 409 }
      );
    }

    const registroCofre = {
      user_id: user.id,
      tipo,
      nivel: tipo === "nivel" ? nivelActual : null,
      recompensas: seleccionadas,
    };

    const { error: errorCofre } = await admin
      .from("cofres_reclamados")
      .insert(registroCofre);

    if (errorCofre) {
      if (errorCofre.code === "23505") {
        let repetido = admin
          .from("cofres_reclamados")
          .select("recompensas")
          .eq("user_id", user.id)
          .eq("tipo", tipo);

        repetido =
          tipo === "nivel"
            ? repetido.eq("nivel", nivelActual)
            : repetido.is("nivel", null);

        const { data, error: errorRepetido } =
          await repetido.maybeSingle();

        if (errorRepetido) {
          throw errorRepetido;
        }

        const recompensasRepetidas = Array.isArray(
          data?.recompensas
        )
          ? (data.recompensas as RecompensaDisponible[])
          : [];

        return NextResponse.json({
          rareza: obtenerRarezaMaxima(
            recompensasRepetidas
          ),
          recompensas: recompensasRepetidas,
          ya_reclamado: true,
          bloqueado_historico:
            recompensasRepetidas.length === 0,
        });
      }

      throw errorCofre;
    }

    const fecha = new Date().toISOString();

    const registros = seleccionadas.map((item) => ({
      user_id: user.id,
      tipo: item.tipo,
      nombre: item.nombre,
      rareza: item.rareza,
      fecha_desbloqueo: fecha,
    }));

    const { error: errorRecompensas } = await admin
      .from("recompensas_usuario")
      .upsert(registros, {
        onConflict: "user_id,nombre",
        ignoreDuplicates: true,
      });

    if (errorRecompensas) {
      let limpiezaCofre = admin
        .from("cofres_reclamados")
        .delete()
        .eq("user_id", user.id)
        .eq("tipo", tipo);

      limpiezaCofre =
        tipo === "nivel"
          ? limpiezaCofre.eq("nivel", nivelActual)
          : limpiezaCofre.is("nivel", null);

      await limpiezaCofre;

      throw errorRecompensas;
    }

    return NextResponse.json({
      rareza: obtenerRarezaMaxima(seleccionadas),
      recompensas: seleccionadas,
      ya_reclamado: false,
      agotado: false,
    });
  } catch (error: any) {
    console.error("Error reclamando cofre:", error);

    const detalle =
      typeof error?.message === "string"
        ? error.message
        : undefined;

    return NextResponse.json(
      {
        error: "No se pudo reclamar el cofre",
        codigo: "COFRE_ERROR_INTERNO",
        ...(process.env.NODE_ENV === "development" && detalle
          ? { detalle }
          : {}),
      },
      { status: 500 }
    );
  }
}
