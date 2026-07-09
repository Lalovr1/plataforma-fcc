/**
 * Página para restablecer contraseña:
 * - Se abre desde el link enviado por Supabase al correo del usuario.
 * - Permite escribir una nueva contraseña.
 * - Actualiza la contraseña real del usuario en Supabase Auth.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

type TipoMensaje = "error" | "success" | "info";

export default function ResetPasswordPage() {
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<TipoMensaje>("info");
  const [cargando, setCargando] = useState(false);
  const [contrasenaActualizada, setContrasenaActualizada] = useState(false);

  const mostrarMensaje = (texto: string, tipo: TipoMensaje = "info") => {
    setMensaje(texto);
    setTipoMensaje(tipo);
  };

  const actualizarContrasena = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setMensaje("");

    try {
      if (nuevaContrasena.length < 6) {
        mostrarMensaje(
          "❌ La contraseña debe tener al menos 6 caracteres.",
          "error"
        );
        return;
      }

      if (nuevaContrasena !== confirmarContrasena) {
        mostrarMensaje(
          "❌ Las contraseñas no coinciden. Revisa que ambas sean iguales.",
          "error"
        );
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: nuevaContrasena,
      });

      if (error) {
        console.error(error);
        mostrarMensaje(
          "❌ No se pudo actualizar la contraseña. Abre nuevamente el enlace desde tu correo o solicita otro restablecimiento.",
          "error"
        );
        return;
      }

      setContrasenaActualizada(true);
      setNuevaContrasena("");
      setConfirmarContrasena("");

      mostrarMensaje(
        "✅ Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión con tu nueva contraseña.",
        "success"
      );
    } catch (err: any) {
      console.error(err);
      mostrarMensaje(
        "❌ Error inesperado al actualizar la contraseña: " + err.message,
        "error"
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <style>{`
        .reset-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 28px 18px;
          position: relative;
          overflow: hidden;
          color: #071d33;
          background:
            radial-gradient(
              circle at 50% 42%,
              rgba(37, 99, 235, 0.13),
              transparent 24%
            ),
            radial-gradient(
              circle at 24% 20%,
              rgba(56, 189, 248, 0.12),
              transparent 25%
            ),
            radial-gradient(
              circle at 82% 82%,
              rgba(37, 99, 235, 0.09),
              transparent 27%
            ),
            linear-gradient(135deg, #edf4ff, #f7fbff 48%, #e8f8ff);
        }

        .reset-page::before {
          content: "";
          position: absolute;
          inset: -100px;
          pointer-events: none;
          background:
            linear-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.14;
          mask-image: radial-gradient(circle at center, black 20%, transparent 74%);
        }

        .reset-page::after {
          content: "";
          position: absolute;
          width: clamp(680px, 82vw, 1080px);
          height: clamp(680px, 82vw, 1080px);
          border-radius: 999px;
          pointer-events: none;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.045), transparent 62%);
          border: 1px solid rgba(37, 99, 235, 0.13);
          box-shadow:
            0 0 0 22px rgba(37, 99, 235, 0.025),
            0 0 120px rgba(56, 189, 248, 0.12);
          opacity: 0.95;
        }

        .reset-card {
          position: relative;
          z-index: 2;
          width: min(100%, 430px);
          overflow: hidden;
          border-radius: 34px;
          padding: clamp(26px, 4vw, 36px);
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.9),
              rgba(245, 250, 255, 0.94)
            );
          border: 1px solid rgba(37, 99, 235, 0.2);
          box-shadow:
            0 30px 78px rgba(37, 99, 235, 0.12),
            0 18px 42px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(14px);
        }

        .reset-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              115deg,
              transparent 0 18%,
              rgba(37, 99, 235, 0.075) 18% 18.4%,
              transparent 18.4% 100%
            ),
            linear-gradient(
              155deg,
              transparent 0 72%,
              rgba(56, 189, 248, 0.095) 72% 72.4%,
              transparent 72.4% 100%
            ),
            radial-gradient(
              circle at 50% 0%,
              rgba(37, 99, 235, 0.08),
              transparent 38%
            );
        }

        .reset-card::after {
          content: "";
          position: absolute;
          inset: 14px;
          pointer-events: none;
          border-radius: 26px;
          border: 1px solid rgba(37, 99, 235, 0.1);
        }

        .reset-content {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 18px;
        }

        .reset-title-wrap {
          display: grid;
          gap: 8px;
          text-align: center;
        }

        .reset-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #2563eb;
          font-size: 0.72rem;
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .reset-kicker::before,
        .reset-kicker::after {
          content: "";
          width: 28px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, #2563eb, #38bdf8);
        }

        .reset-title {
          color: #04172d;
          font-size: clamp(1.9rem, 5vw, 2.5rem);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: -0.065em;
          text-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
        }

        .reset-description {
          color: #5b6f89;
          text-align: center;
          font-size: 0.92rem;
          line-height: 1.45;
          font-weight: 750;
        }

        .reset-form {
          display: grid;
          gap: 13px;
          padding: 16px;
          border-radius: 26px;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.68),
              rgba(245, 250, 255, 0.9)
            );
          border: 1px solid rgba(37, 99, 235, 0.14);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }

        .reset-input {
          width: 100%;
          min-height: 48px;
          border-radius: 16px;
          padding: 0 14px;
          color: #071d33;
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.96),
              rgba(245, 250, 255, 0.96)
            );
          border: 1px solid rgba(37, 99, 235, 0.24);
          outline: none;
          font-size: 0.95rem;
          font-weight: 750;
          transition:
            border-color 170ms ease,
            box-shadow 170ms ease;
        }

        .reset-input::placeholder {
          color: #5b6f89;
          opacity: 0.82;
        }

        .reset-input:focus {
          border-color: rgba(37, 99, 235, 0.58);
          box-shadow:
            0 0 0 4px rgba(37, 99, 235, 0.11),
            0 12px 24px rgba(37, 99, 235, 0.07);
        }

        .reset-button,
        .reset-login-button {
          width: 100%;
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 17px;
          color: #ffffff;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              color-mix(in srgb, #2563eb 72%, #38bdf8)
            );
          box-shadow:
            0 16px 28px rgba(37, 99, 235, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          font-size: 1rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            filter 170ms ease,
            opacity 170ms ease;
        }

        .reset-button:hover:not(:disabled),
        .reset-login-button:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
        }

        .reset-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .reset-message {
          border-radius: 18px;
          padding: 12px 14px;
          text-align: center;
          font-size: 0.88rem;
          font-weight: 750;
          line-height: 1.4;
        }

        .reset-message.is-success {
          color: #166534;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .reset-message.is-info {
          color: #1d4ed8;
          background: rgba(37, 99, 235, 0.09);
          border: 1px solid rgba(37, 99, 235, 0.22);
        }

        .reset-message.is-error {
          color: #991b1b;
          background: rgba(239, 68, 68, 0.09);
          border: 1px solid rgba(239, 68, 68, 0.24);
        }

        .reset-link-text {
          color: #5b6f89;
          text-align: center;
          font-size: 0.92rem;
          font-weight: 750;
        }

        .reset-link-text a {
          color: #2563eb;
          font-weight: 950;
        }

        .reset-link-text a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .reset-page {
            padding: 18px 14px;
          }

          .reset-page::after {
            width: 580px;
            height: 580px;
          }

          .reset-card {
            border-radius: 28px;
            padding: 24px 18px;
          }

          .reset-card::after {
            inset: 10px;
            border-radius: 22px;
          }

          .reset-form {
            padding: 14px;
            border-radius: 22px;
          }
        }
      `}</style>

      <main className="reset-page">
        <form onSubmit={actualizarContrasena} className="reset-card">
          <div className="reset-content">
            <div className="reset-title-wrap">
              <p className="reset-kicker">FCC Academy</p>

              <h1 className="reset-title">Restablecer contraseña</h1>

              <p className="reset-description">
                Escribe tu nueva contraseña para actualizar el acceso a tu cuenta.
              </p>
            </div>

            {!contrasenaActualizada && (
              <div className="reset-form">
                <input
                  type="password"
                  placeholder="Nueva contraseña"
                  value={nuevaContrasena}
                  onChange={(e) => setNuevaContrasena(e.target.value)}
                  className="reset-input"
                  required
                />

                <input
                  type="password"
                  placeholder="Confirmar nueva contraseña"
                  value={confirmarContrasena}
                  onChange={(e) => setConfirmarContrasena(e.target.value)}
                  className="reset-input"
                  required
                />

                <button
                  type="submit"
                  disabled={cargando}
                  className="reset-button"
                >
                  {cargando ? "Actualizando..." : "Actualizar contraseña"}
                </button>
              </div>
            )}

            {mensaje && (
              <div className={`reset-message is-${tipoMensaje}`}>
                {mensaje}
              </div>
            )}

            {contrasenaActualizada && (
              <Link href="/login" className="reset-login-button">
                Ir a iniciar sesión
              </Link>
            )}

            {!contrasenaActualizada && (
              <p className="reset-link-text">
                ¿Ya recordaste tu contraseña?{" "}
                <Link href="/login">Volver al login</Link>
              </p>
            )}
          </div>
        </form>
      </main>
    </>
  );
}