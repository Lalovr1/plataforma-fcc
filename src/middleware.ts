import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] || null;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const pathname = req.nextUrl.pathname;

  if (!pathname.startsWith("/dashboard")) return res;

  const projectRef = getProjectRef();
  if (!projectRef) {
    
    return res;
  }

  
  const authCookieName = `sb-${projectRef}-auth-token`;
  const hasSession = Boolean(req.cookies.get(authCookieName));


  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  
  return res;
}


export const config = {
  matcher: ["/dashboard/:path*"],
};
