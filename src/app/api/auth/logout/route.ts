import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  if (error && error.name !== "AuthSessionMissingError") {
    console.error("[FCC Academy] Error cerrando sesion SSR:", error);
  }

  // Cinturón de seguridad: expira cualquier fragmento de la cookie Auth
  // aunque la sesión ya estuviera desincronizada.
  const projectRef = getProjectRef();

  if (projectRef) {
    const prefijo = `sb-${projectRef}-auth-token`;

    request.cookies.getAll().forEach(({ name }) => {
      if (name === prefijo || name.startsWith(`${prefijo}.`)) {
        response.cookies.set({
          name,
          value: "",
          expires: new Date(0),
          path: "/",
        });
      }
    });
  }

  return response;
}