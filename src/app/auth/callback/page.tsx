/**
 * Callback de autenticación: valida el usuario con Supabase
 * y redirige al dashboard si la sesión es válida.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      router.push("/dashboard");
    };

    checkUser();
  }, [router, supabase]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3 text-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div
        className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
        style={{
          borderColor: "var(--color-primary)",
          borderTopColor: "transparent",
        }}
      />
      <p style={{ color: "var(--color-muted)" }}>Redirigiendo...</p>
    </div>
  );
}
