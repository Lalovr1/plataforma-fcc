/**
 * Página de login:
 * - Permite iniciar sesión con correo BUAP y contraseña.
 * - Antes de iniciar sesión revisa si el correo existe y si está confirmado.
 * - Si el correo no está confirmado, permite reenviar confirmación.
 * - Si la contraseña falla, permite solicitar restablecimiento.
 * - Busca el rol en la tabla `usuarios` y redirige al dashboard correspondiente.
 * - Carga el tema del usuario antes de redirigir para evitar parpadeo claro/oscuro.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";
import { Lock, LogIn, Mail } from "lucide-react";

type TipoMensaje = "error" | "success" | "info";

const temasValidos = [
  "claro",
  "blanco",
  "oscuro",
  "gris",
  "esmeralda",
  "morado",
  "indigo",
  "rojo",
  "rosa",
] as const;

type Tema = (typeof temasValidos)[number];

function esTemaValido(valor: any): valor is Tema {
  return temasValidos.includes(valor);
}

function aplicarTemaAntesDeEntrar(tema: Tema) {
  localStorage.setItem("preferencias_usuario", JSON.stringify({ tema }));

  const clasesTema = temasValidos.map((t) => `theme-${t}`);

  document.documentElement.classList.remove(...clasesTema);
  document.documentElement.classList.add(`theme-${tema}`);

  if (document.body) {
    document.body.classList.remove(...clasesTema);
    document.body.classList.add(`theme-${tema}`);
  }
}

export default function LoginPage() {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<TipoMensaje>("error");
  const [cargando, setCargando] = useState(false);
  const [mostrarReenviarConfirmacion, setMostrarReenviarConfirmacion] =
    useState(false);
  const [mostrarRestablecer, setMostrarRestablecer] = useState(false);

  const limpiarMensajes = () => {
    setMensaje("");
    setMostrarReenviarConfirmacion(false);
    setMostrarRestablecer(false);
  };

  const mostrarMensaje = (
    texto: string,
    tipo: TipoMensaje = "error",
    opciones?: {
      reenviarConfirmacion?: boolean;
      restablecer?: boolean;
    }
  ) => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    setMostrarReenviarConfirmacion(Boolean(opciones?.reenviarConfirmacion));
    setMostrarRestablecer(Boolean(opciones?.restablecer));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    limpiarMensajes();
    setCargando(true);

    const correoLimpio = correo.trim().toLowerCase();

    try {
      const { data: estadoData, error: estadoError } = await supabase.rpc(
        "estado_login_usuario",
        {
          correo_input: correoLimpio,
        }
      );

      if (estadoError) {
        console.error(estadoError);
        mostrarMensaje(
          "No se pudo validar el estado de tu cuenta. Intenta nuevamente."
        );
        return;
      }

      if (estadoData === "no_registrado") {
        mostrarMensaje(
          "Este correo no está registrado. Verifica que lo escribiste bien o regístrate para crear una cuenta."
        );
        return;
      }

      if (estadoData === "no_confirmado") {
        mostrarMensaje(
          "Tu cuenta existe, pero todavía no has confirmado tu correo. Revisa tu bandeja de entrada o solicita un nuevo correo de confirmación.",
          "info",
          { reenviarConfirmacion: true }
        );
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: correoLimpio,
        password: contrasena,
      });

      if (error) {
        const mensajeError = error.message?.toLowerCase() || "";

        if (mensajeError.includes("rate limit")) {
          mostrarMensaje(
            "Has intentado iniciar sesión demasiadas veces en poco tiempo. Espera unos minutos antes de volver a intentarlo.",
            "info"
          );
          return;
        }

        if (mensajeError.includes("invalid login credentials")) {
          mostrarMensaje(
            "La contraseña es incorrecta. Intenta nuevamente o restablécela si no la recuerdas.",
            "error",
            { restablecer: true }
          );
          return;
        }

        mostrarMensaje(
          "No se pudo iniciar sesión en este momento. Intenta nuevamente en unos minutos."
        );
        return;
      }

      if (!data.user) {
        mostrarMensaje("No se encontró la información del usuario.");
        return;
      }

      localStorage.setItem("user_id", data.user.id);

      const [{ data: usuario, error: usuarioError }, { data: preferencias }] =
        await Promise.all([
          supabase
            .from("usuarios")
            .select("rol")
            .eq("id", data.user.id)
            .single(),
          supabase
            .from("configuraciones_usuario")
            .select("tema")
            .eq("usuario_id", data.user.id)
            .maybeSingle(),
        ]);

      if (usuarioError || !usuario) {
        console.error(usuarioError);
        mostrarMensaje(
          "Tu cuenta existe, pero no se pudo determinar tu rol. Contacta al administrador de la plataforma."
        );
        return;
      }

      const temaUsuario = esTemaValido(preferencias?.tema)
        ? preferencias.tema
        : "claro";

      aplicarTemaAntesDeEntrar(temaUsuario);

      localStorage.setItem("rol_usuario", usuario.rol);

      if (usuario.rol === "estudiante") {
        window.location.href = "/dashboard/estudiante";
      } else if (usuario.rol === "profesor") {
        window.location.href = "/dashboard/profesor";
      } else {
        mostrarMensaje(
          "Tu cuenta tiene un rol no válido. Contacta al administrador de la plataforma."
        );
      }
    } catch (err: any) {
      console.error(err);
      mostrarMensaje("Error inesperado en login: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const reenviarConfirmacion = async () => {
    limpiarMensajes();
    setCargando(true);

    const correoLimpio = correo.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: correoLimpio,
      });

      if (error) {
        console.error(error);
        mostrarMensaje(
          "No se pudo reenviar el correo de confirmación. Verifica el correo o intenta más tarde."
        );
        return;
      }

      mostrarMensaje(
        "Te enviamos un nuevo correo de confirmación. Revisa tu bandeja de entrada y también la carpeta de spam.",
        "success"
      );
    } catch (err: any) {
      console.error(err);
      mostrarMensaje("Error al reenviar confirmación: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const restablecerContrasena = async () => {
    limpiarMensajes();
    setCargando(true);

    const correoLimpio = correo.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        correoLimpio,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        console.error(error);
        mostrarMensaje(
          "No se pudo enviar el correo para restablecer tu contraseña. Intenta nuevamente."
        );
        return;
      }

      mostrarMensaje(
        "Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja de entrada y también spam.",
        "success"
      );
    } catch (err: any) {
      console.error(err);
      mostrarMensaje("Error al solicitar restablecimiento: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page {
          --login-bg: #f7fbff;
          --login-bg-soft: #edf4ff;
          --login-bg-cyan: #e8f8ff;

          --login-text: #071d33;
          --login-heading: #04172d;
          --login-muted: #5b6f89;

          --login-accent: #2563eb;
          --login-accent-strong: #0f48cf;
          --login-cyan: #38bdf8;

          --login-border: rgba(37, 99, 235, 0.2);
          --login-surface: rgba(255, 255, 255, 0.9);
          --login-surface-soft: rgba(245, 250, 255, 0.94);
          --login-surface-strong: rgba(255, 255, 255, 0.96);

          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: clamp(12px, 3dvh, 28px) 18px;
          color: var(--login-text);
          overflow: hidden;
          position: relative;
          background:
            radial-gradient(
              circle at 18% 18%,
              color-mix(in srgb, var(--login-cyan) 10%, transparent),
              transparent 28%
            ),
            radial-gradient(
              circle at 80% 82%,
              color-mix(in srgb, var(--login-accent) 8%, transparent),
              transparent 30%
            ),
            linear-gradient(
              135deg,
              var(--login-bg-soft),
              var(--login-bg) 48%,
              var(--login-bg-cyan)
            );
        }

        .login-page::before {
          content: "";
          position: absolute;
          inset: -100px;
          pointer-events: none;
          background:
            linear-gradient(
              color-mix(in srgb, var(--login-border) 42%, transparent) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              color-mix(in srgb, var(--login-border) 42%, transparent) 1px,
              transparent 1px
            );
          background-size: 48px 48px;
          opacity: 0.14;
          mask-image: radial-gradient(circle at center, black 20%, transparent 74%);
        }

        .login-page::after {
          content: "";
          position: absolute;
          width: clamp(620px, 78vw, 980px);
          height: clamp(620px, 78vw, 980px);
          border-radius: 999px;
          pointer-events: none;
          background:
            radial-gradient(
              circle,
              color-mix(in srgb, var(--login-accent) 5%, transparent),
              transparent 62%
            );
          border: 1px solid color-mix(in srgb, var(--login-accent) 14%, transparent);
          box-shadow:
            0 0 0 22px color-mix(in srgb, var(--login-accent) 2%, transparent),
            0 0 120px color-mix(in srgb, var(--login-cyan) 10%, transparent);
          opacity: 0.95;
        }

        .login-card {
          position: relative;
          width: min(100%, 470px);
          max-height: calc(100dvh - clamp(24px, 6dvh, 56px));
          overflow: hidden;
          border-radius: clamp(24px, 4dvh, 34px);
          padding: clamp(18px, 4dvh, 38px);
          background:
            linear-gradient(
              135deg,
              var(--login-surface),
              var(--login-surface-soft)
            );
          border: 1px solid color-mix(
            in srgb,
            var(--login-accent) 16%,
            var(--login-border)
          );
          box-shadow:
            0 28px 70px color-mix(in srgb, var(--login-accent) 10%, transparent),
            0 18px 40px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--login-surface-strong) 72%,
              transparent
            );
          backdrop-filter: blur(14px);
        }

        .login-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              115deg,
              transparent 0 18%,
              color-mix(in srgb, var(--login-accent) 8%, transparent) 18% 18.4%,
              transparent 18.4% 100%
            ),
            linear-gradient(
              155deg,
              transparent 0 72%,
              color-mix(in srgb, var(--login-cyan) 9%, transparent) 72% 72.4%,
              transparent 72.4% 100%
            );
          opacity: 0.95;
        }

        .login-card::after {
          content: "";
          position: absolute;
          inset: clamp(10px, 1.8dvh, 14px);
          pointer-events: none;
          border-radius: clamp(22px, 3.1dvh, 26px);
          border: 1px solid color-mix(
            in srgb,
            var(--login-accent) 10%,
            transparent
          );
        }

        .login-content {
          position: relative;
          z-index: 2;
          display: grid;
          gap: clamp(10px, 2.2dvh, 20px);
        }

        .login-logo-wrap {
          position: relative;
          display: grid;
          place-items: center;
          padding: clamp(2px, 1.8dvh, 16px) 0 clamp(0px, 1.1dvh, 10px);
        }

        .login-logo-wrap::before {
          content: "";
          position: absolute;
          width: min(300px, 62vw, 40dvh);
          aspect-ratio: 300 / 218;
          border-radius: clamp(22px, 3.4dvh, 30px);
          background:
            radial-gradient(
              circle at 50% 50%,
              color-mix(in srgb, var(--login-cyan) 12%, transparent),
              transparent 62%
            ),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              color-mix(in srgb, var(--login-accent) 16%, transparent) 48deg,
              transparent 92deg,
              color-mix(in srgb, var(--login-cyan) 14%, transparent) 170deg,
              transparent 250deg,
              color-mix(in srgb, var(--login-accent) 14%, transparent) 314deg,
              transparent 360deg
            );
          opacity: 0.9;
        }

        .login-logo-wrap::after {
          content: "";
          position: absolute;
          width: min(264px, 55vw, 35dvh);
          aspect-ratio: 264 / 188;
          border-radius: clamp(20px, 2.9dvh, 24px);
          border: 1px solid color-mix(
            in srgb,
            var(--login-accent) 14%,
            transparent
          );
          box-shadow:
            0 0 0 10px color-mix(in srgb, var(--login-accent) 2%, transparent),
            0 18px 36px color-mix(in srgb, var(--login-accent) 7%, transparent);
        }

        .login-logo {
          position: relative;
          z-index: 2;
          width: min(230px, 72vw, 31dvh);
          transform: translateY(clamp(-20px, -2.4dvh, -8px));
          height: auto;
          object-fit: contain;
          filter: drop-shadow(
            0 14px 24px color-mix(in srgb, var(--login-accent) 10%, transparent)
          );
        }

        .login-title-wrap {
          display: grid;
          gap: clamp(5px, 1dvh, 8px);
          text-align: center;
          padding-top: 2px;
        }

        .login-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--login-accent);
          font-size: clamp(0.62rem, 1.35dvh, 0.72rem);
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .login-kicker::before,
        .login-kicker::after {
          content: "";
          width: clamp(18px, 4.5dvh, 28px);
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            var(--login-accent),
            var(--login-cyan)
          );
        }

        .login-title {
          color: var(--login-heading);
          font-size: clamp(1.85rem, 5dvh, 2.85rem);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: -0.065em;
          text-shadow: 0 10px 24px color-mix(
            in srgb,
            var(--login-accent) 8%,
            transparent
          );
        }

        .login-form {
          display: grid;
          gap: clamp(10px, 1.8dvh, 14px);
          margin-top: 2px;
          padding: clamp(12px, 2dvh, 18px);
          border-radius: clamp(20px, 3dvh, 26px);
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.68),
              rgba(245, 250, 255, 0.9)
            );
          border: 1px solid color-mix(
            in srgb,
            var(--login-accent) 12%,
            var(--login-border)
          );
          box-shadow: inset 0 1px 0 color-mix(
            in srgb,
            var(--login-surface-strong) 68%,
            transparent
          );
        }

        .login-field {
          position: relative;
        }

        .login-field-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--login-accent);
          pointer-events: none;
        }

        .login-input {
          width: 100%;
          min-height: clamp(43px, 6.3dvh, 50px);
          border-radius: 16px;
          padding: 0 14px 0 44px;
          color: var(--login-text);
          background:
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.96),
              rgba(245, 250, 255, 0.96)
            );
          border: 1px solid color-mix(
            in srgb,
            var(--login-accent) 22%,
            var(--login-border)
          );
          outline: none;
          font-size: clamp(0.88rem, 1.9dvh, 0.95rem);
          font-weight: 750;
          transition:
            border-color 170ms ease,
            box-shadow 170ms ease,
            transform 170ms ease;
        }

        .login-input::placeholder {
          color: var(--login-muted);
          opacity: 0.8;
        }

        .login-input:focus {
          border-color: color-mix(
            in srgb,
            var(--login-accent) 56%,
            var(--login-border)
          );
          box-shadow:
            0 0 0 4px color-mix(
              in srgb,
              var(--login-accent) 11%,
              transparent
            ),
            0 12px 24px color-mix(
              in srgb,
              var(--login-accent) 7%,
              transparent
            );
        }

        .login-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          min-height: clamp(44px, 6.6dvh, 52px);
          border-radius: 17px;
          color: #ffffff;
          background:
            linear-gradient(
              135deg,
              var(--login-accent),
              color-mix(in srgb, var(--login-accent) 72%, #38bdf8)
            );
          box-shadow:
            0 16px 28px color-mix(
              in srgb,
              var(--login-accent) 20%,
              transparent
            ),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          font-size: clamp(0.92rem, 2dvh, 1rem);
          font-weight: 950;
          transition:
            transform 170ms ease,
            filter 170ms ease,
            opacity 170ms ease;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.05);
        }

        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .login-message {
          border-radius: 18px;
          padding: clamp(10px, 1.7dvh, 12px) 14px;
          text-align: center;
          font-size: clamp(0.8rem, 1.75dvh, 0.88rem);
          font-weight: 750;
          line-height: 1.35;
        }

        .login-message.is-success {
          color: #166534;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid color-mix(in srgb, #22c55e 30%, transparent);
        }

        .login-message.is-info {
          color: #92400e;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
        }

        .login-message.is-error {
          color: #991b1b;
          background: rgba(239, 68, 68, 0.09);
          border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
        }

        .login-message-action {
          margin-top: 10px;
          color: var(--login-accent);
          font-weight: 950;
        }

        .login-message-action:hover {
          text-decoration: underline;
        }

        .login-register {
          color: var(--login-muted);
          text-align: center;
          font-size: clamp(0.82rem, 1.8dvh, 0.92rem);
          font-weight: 750;
          padding-top: 2px;
        }

        .login-register a {
          color: var(--login-accent);
          font-weight: 950;
        }

        .login-register a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .login-page {
            padding: 18px 14px;
          }

          .login-page::after {
            width: 560px;
            height: 560px;
          }

          .login-card {
            width: min(100%, 420px);
            border-radius: 28px;
            padding: 24px 18px;
          }

          .login-card::after {
            inset: 10px;
            border-radius: 22px;
          }

          .login-content {
            gap: 18px;
          }

          .login-logo-wrap::before {
            width: min(78vw, 260px, 40dvh);
            aspect-ratio: 260 / 170;
            border-radius: 26px;
          }

          .login-logo-wrap::after {
            width: min(68vw, 226px, 35dvh);
            aspect-ratio: 226 / 144;
            border-radius: 22px;
          }

          .login-logo {
            width: min(210px, 70vw, 31dvh);
          }

          .login-form {
            padding: 14px;
            border-radius: 22px;
          }
        }

        @media (max-height: 760px) {
          .login-card {
            padding: 18px;
          }

          .login-content {
            gap: 12px;
          }

          .login-logo-wrap {
            padding-top: 2px;
            padding-bottom: 0;
          }

          .login-title-wrap {
            gap: 5px;
          }

          .login-form {
            padding: 12px;
            gap: 10px;
          }
        }

        @media (max-height: 660px) {
          .login-page {
            padding-top: 10px;
            padding-bottom: 10px;
          }

          .login-card {
            padding: 14px;
          }

          .login-content {
            gap: 9px;
          }

          .login-logo {
            width: min(185px, 64vw, 27dvh);
            transform: translateY(-8px);
          }

          .login-logo-wrap::before {
            width: min(235px, 58vw, 34dvh);
          }

          .login-logo-wrap::after {
            width: min(205px, 50vw, 30dvh);
          }

          .login-title {
            font-size: clamp(1.7rem, 4.3dvh, 2.25rem);
          }

          .login-kicker {
            font-size: 0.62rem;
          }

          .login-input {
            min-height: 42px;
          }

          .login-button {
            min-height: 43px;
          }

          .login-register {
            font-size: 0.8rem;
          }
        }
      `}</style>

      <main className="login-page">
        <section className="login-card">
          <div className="login-content">
            <div className="login-logo-wrap">
              <img src="/logo.png" alt="FCC Academy" className="login-logo" />
            </div>

            <div className="login-title-wrap">
              <p className="login-kicker">FCC Academy</p>

              <h1 className="login-title">Iniciar sesión</h1>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div className="login-field">
                <Mail
                  className="login-field-icon"
                  size={18}
                  strokeWidth={2.4}
                />

                <input
                  type="email"
                  placeholder="Correo BUAP"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <Lock
                  className="login-field-icon"
                  size={18}
                  strokeWidth={2.4}
                />

                <input
                  type="password"
                  placeholder="Contraseña"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  className="login-input"
                  required
                />
              </div>

              <button type="submit" disabled={cargando} className="login-button">
                <LogIn size={18} strokeWidth={2.4} />
                <span>{cargando ? "Validando..." : "Ingresar"}</span>
              </button>
            </form>

            {mensaje && (
              <div className={`login-message is-${tipoMensaje}`}>
                <p>{mensaje}</p>

                {mostrarReenviarConfirmacion && (
                  <button
                    type="button"
                    onClick={reenviarConfirmacion}
                    disabled={cargando}
                    className="login-message-action"
                  >
                    Reenviar correo de confirmación
                  </button>
                )}

                {mostrarRestablecer && (
                  <button
                    type="button"
                    onClick={restablecerContrasena}
                    disabled={cargando}
                    className="login-message-action"
                  >
                    Restablecer contraseña
                  </button>
                )}
              </div>
            )}

            <p className="login-register">
              ¿No tienes cuenta? <Link href="/register">Regístrate aquí</Link>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
