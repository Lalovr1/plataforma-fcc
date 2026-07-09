/**
 * Página de registro:
 * - Detecta rol dinámicamente según correo BUAP:
 *   @alumno.buap.mx o @alm.buap.mx → estudiante
 *   @correo.buap.mx → profesor
 * - Estudiantes deben seleccionar carrera y semestre.
 * - Crea el usuario en Supabase Auth y luego lo inserta en la tabla `usuarios`.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

export default function RegisterPage() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [carreraId, setCarreraId] = useState<number | null>(null);
  const [semestreId, setSemestreId] = useState<number | null>(null);
  const [matricula, setMatricula] = useState("");
  const [mensaje, setMensaje] = useState("");

  const rolDetectado =
    correo.endsWith("@alumno.buap.mx") || correo.endsWith("@alm.buap.mx")
      ? "estudiante"
      : correo.endsWith("@correo.buap.mx")
      ? "profesor"
      : null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje("");

    try {
      if (!rolDetectado) {
        setMensaje("❌ Solo se permiten correos institucionales BUAP.");
        return;
      }

      if (!nombre.trim()) {
        setMensaje("❌ El nombre es obligatorio.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: correo,
        password: contrasena,
      });

      if (error) {
        setMensaje(`❌ Error en registro: ${error.message}`);
        return;
      }

      if (data.user?.identities?.length === 0) {
        setMensaje("❌ Este correo ya está registrado.");
        return;
      }

      if (data.user) {
        const { error: insertError } = await supabase.from("usuarios").insert({
          id: data.user.id,
          email: data.user.email,
          nombre: nombre.trim(),
          rol: rolDetectado,
          carrera_id: rolDetectado === "estudiante" ? carreraId : null,
          semestre_id: rolDetectado === "estudiante" ? semestreId : null,
          matricula: rolDetectado === "estudiante" ? matricula.trim() : null,
          nivel: rolDetectado === "estudiante" ? 0 : null,
          puntos: rolDetectado === "estudiante" ? 0 : null,
          avatar_config: null,
        });

        if (insertError) {
          setMensaje(`❌ Error guardando en usuarios: ${insertError.message}`);
          return;
        }

        if (rolDetectado === "estudiante") {
          await fetch("/api/insertRecompensas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id }),
          });
        }
      }

      setMensaje("✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.");
    } catch (err) {
      console.error(err);
      setMensaje("❌ Ocurrió un error inesperado.");
    }
  };

  return (
    <>
      <style>{`
        .register-page,
        .register-page * {
          box-sizing: border-box;
        }

        .register-page {
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

        .register-page::before {
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

        .register-page::after {
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

        .register-card {
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

        .register-card::before {
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

        .register-card::after {
          content: "";
          position: absolute;
          inset: 14px;
          pointer-events: none;
          border-radius: 26px;
          border: 1px solid rgba(37, 99, 235, 0.1);
        }

        .register-content {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 18px;
        }

        .register-title-wrap {
          display: grid;
          gap: 8px;
          text-align: center;
        }

        .register-kicker {
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

        .register-kicker::before,
        .register-kicker::after {
          content: "";
          width: 28px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, #2563eb, #38bdf8);
        }

        .register-title {
          color: #04172d;
          font-size: clamp(2rem, 5vw, 2.7rem);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: -0.065em;
          text-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
        }

        .register-form {
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

        .register-input,
        .register-select {
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

        .register-input::placeholder {
          color: #5b6f89;
          opacity: 0.82;
        }

        .register-select {
          cursor: pointer;
        }

        .register-input:focus,
        .register-select:focus {
          border-color: rgba(37, 99, 235, 0.58);
          box-shadow:
            0 0 0 4px rgba(37, 99, 235, 0.11),
            0 12px 24px rgba(37, 99, 235, 0.07);
        }

        .register-button {
          width: 100%;
          min-height: 50px;
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
            filter 170ms ease;
        }

        .register-button:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
        }

        .register-message {
          border-radius: 18px;
          padding: 12px 14px;
          text-align: center;
          font-size: 0.88rem;
          font-weight: 750;
          line-height: 1.4;
        }

        .register-message.is-success {
          color: #166534;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .register-message.is-error {
          color: #991b1b;
          background: rgba(239, 68, 68, 0.09);
          border: 1px solid rgba(239, 68, 68, 0.24);
        }

        .register-login {
          color: #5b6f89;
          text-align: center;
          font-size: 0.92rem;
          font-weight: 750;
        }

        .register-login a {
          color: #2563eb;
          font-weight: 950;
        }

        .register-login a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .register-page {
            padding: 18px 14px;
          }

          .register-page::after {
            width: 580px;
            height: 580px;
          }

          .register-card {
            border-radius: 28px;
            padding: 24px 18px;
          }

          .register-card::after {
            inset: 10px;
            border-radius: 22px;
          }

          .register-form {
            padding: 14px;
            border-radius: 22px;
          }
        }

        @media (max-height: 760px) {
          .register-page {
            padding-top: 14px;
            padding-bottom: 14px;
          }

          .register-card {
            width: min(100%, 410px);
            border-radius: 30px;
            padding: 22px 18px;
          }

          .register-card::after {
            inset: 11px;
            border-radius: 23px;
          }

          .register-content {
            gap: 13px;
          }

          .register-title-wrap {
            gap: 5px;
          }

          .register-kicker {
            font-size: 0.64rem;
            letter-spacing: 0.19em;
          }

          .register-title {
            font-size: clamp(1.75rem, 4.2vw, 2.25rem);
          }

          .register-form {
            gap: 10px;
            padding: 13px;
            border-radius: 22px;
          }

          .register-input,
          .register-select {
            min-height: 42px;
            border-radius: 14px;
            padding: 0 12px;
            font-size: 0.88rem;
          }

          .register-button {
            min-height: 44px;
            border-radius: 15px;
            font-size: 0.94rem;
          }

          .register-message {
            border-radius: 15px;
            padding: 9px 11px;
            font-size: 0.8rem;
          }

          .register-login {
            font-size: 0.84rem;
          }
        }

        @media (max-height: 660px) {
          .register-page {
            padding: 10px 12px;
          }

          .register-card {
            width: min(100%, 390px);
            border-radius: 26px;
            padding: 16px 14px;
          }

          .register-card::after {
            inset: 9px;
            border-radius: 20px;
          }

          .register-content {
            gap: 9px;
          }

          .register-title-wrap {
            gap: 3px;
          }

          .register-kicker {
            gap: 7px;
            font-size: 0.56rem;
            letter-spacing: 0.17em;
          }

          .register-kicker::before,
          .register-kicker::after {
            width: 20px;
          }

          .register-title {
            font-size: clamp(1.45rem, 3.7vw, 1.85rem);
          }

          .register-form {
            gap: 7px;
            padding: 9px;
            border-radius: 18px;
          }

          .register-input,
          .register-select {
            min-height: 36px;
            border-radius: 12px;
            padding: 0 10px;
            font-size: 0.8rem;
          }

          .register-button {
            min-height: 38px;
            border-radius: 13px;
            font-size: 0.86rem;
          }

          .register-message {
            border-radius: 13px;
            padding: 7px 9px;
            font-size: 0.74rem;
            line-height: 1.3;
          }

          .register-login {
            font-size: 0.76rem;
          }
        }

        @media (max-height: 560px) {
          .register-page {
            padding: 8px 10px;
          }

          .register-card {
            width: min(100%, 370px);
            border-radius: 22px;
            padding: 12px;
          }

          .register-card::after {
            inset: 7px;
            border-radius: 17px;
          }

          .register-content {
            gap: 7px;
          }

          .register-kicker {
            font-size: 0.5rem;
            letter-spacing: 0.15em;
          }

          .register-kicker::before,
          .register-kicker::after {
            width: 16px;
          }

          .register-title {
            font-size: clamp(1.25rem, 3.3vw, 1.55rem);
          }

          .register-form {
            gap: 6px;
            padding: 7px;
            border-radius: 16px;
          }

          .register-input,
          .register-select {
            min-height: 32px;
            border-radius: 10px;
            font-size: 0.74rem;
          }

          .register-button {
            min-height: 34px;
            border-radius: 11px;
            font-size: 0.8rem;
          }

          .register-message {
            padding: 6px 8px;
            font-size: 0.68rem;
          }

          .register-login {
            font-size: 0.7rem;
          }
        }
      `}</style>

      <main className="register-page">
        <form onSubmit={handleRegister} className="register-card">
          <div className="register-content">
            <div className="register-title-wrap">
              <p className="register-kicker">FCC Academy</p>

              <h2 className="register-title">Registro</h2>
            </div>

            <div className="register-form">
              <input
                type="text"
                placeholder="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="register-input"
                required
              />

              <input
                type="email"
                placeholder="Correo BUAP"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="register-input"
                required
              />

              <input
                type="password"
                placeholder="Contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="register-input"
                required
              />

              {rolDetectado === "estudiante" && (
                <>
                  <input
                    type="text"
                    placeholder="Matrícula"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    className="register-input"
                    required
                  />

                  <select
                    value={carreraId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCarreraId(value ? Number(value) : null);
                    }}
                    className="register-select"
                    required
                  >
                    <option value="">Selecciona tu carrera</option>
                    <option value={1}>
                      Licenciatura en Ciencias de la Computación
                    </option>
                    <option value={2}>
                      Ingeniería en Ciencias de la Computación
                    </option>
                    <option value={3}>Ingeniería en Ciencia de Datos</option>
                    <option value={4}>Ingeniería en Ciberseguridad</option>
                    <option value={5}>
                      Ingeniería en Tecnologías de la Información
                    </option>
                  </select>

                  <select
                    value={semestreId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSemestreId(value ? Number(value) : null);
                    }}
                    className="register-select"
                    required
                  >
                    <option value="">Selecciona tu semestre</option>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Semestre {i + 1}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <button type="submit" className="register-button">
                Registrarse
              </button>
            </div>

            {mensaje && (
              <p
                className={`register-message ${
                  mensaje.startsWith("✅") ? "is-success" : "is-error"
                }`}
              >
                {mensaje}
              </p>
            )}

            <p className="register-login">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login">Inicia sesión aquí</Link>
            </p>
          </div>
        </form>
      </main>
    </>
  );
}
