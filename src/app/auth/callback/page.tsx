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
    <div className="auth-callback-screen">
      <style>{`
        .auth-callback-screen {
          --auth-accent: var(--fcc-premium-accent, var(--color-primary));
          --auth-surface: var(--fcc-premium-surface, var(--color-bg));
          --auth-surface-soft: var(--fcc-premium-surface-soft, var(--color-bg));
          --auth-text: var(--fcc-premium-text, var(--color-text));
          --auth-muted: var(--fcc-premium-muted, var(--color-muted));
          --auth-border: var(--fcc-premium-border, var(--color-border));

          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 20px;
          color: var(--auth-text);
          background:
            radial-gradient(
              circle at 50% 18%,
              color-mix(in srgb, var(--auth-accent) 6%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--auth-surface),
              var(--auth-surface-soft)
            );
          text-align: center;
        }

        .auth-callback-spinner {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 4px solid color-mix(in srgb, var(--auth-accent) 22%, var(--auth-border));
          border-top-color: var(--auth-accent);
          animation: auth-callback-spin 760ms linear infinite;
        }

        .auth-callback-text {
          margin: 0;
          color: var(--auth-muted);
          font-size: 0.95rem;
          font-weight: 850;
        }

        @keyframes auth-callback-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div className="auth-callback-spinner" />
      <p className="auth-callback-text">Redirigiendo...</p>
    </div>
  );
}
