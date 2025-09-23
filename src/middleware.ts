import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Extrae el ref del proyecto desde la URL pública de Supabase.
// Ej: https://wldjpaoiloizutskaqjc.supabase.co -> "wldjpaoiloizutskaqjc"
function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] || null;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const pathname = req.nextUrl.pathname;
  // Sólo protegemos rutas bajo /dashboard
  if (!pathname.startsWith("/dashboard")) return res;

  const projectRef = getProjectRef();
  if (!projectRef) {
    // Si por alguna razón no hay ref, no bloqueamos (para no romper flujo en dev)
    return res;
  }

  // Supabase coloca esta cookie cuando hay sesión en el navegador
  const authCookieName = `sb-${projectRef}-auth-token`;
  const hasSession = Boolean(req.cookies.get(authCookieName));

  // 🚫 Si NO hay sesión y quiere entrar a /dashboard -> login
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ✅ Si hay sesión, dejamos pasar tal cual
  return res;
}

// Sólo aplicar en rutas de dashboard
export const config = {
  matcher: ["/dashboard/:path*"],
};
