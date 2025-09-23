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
    <div className="flex items-center justify-center h-screen text-gray-100">
      Redirigiendo...
    </div>
  );
}
