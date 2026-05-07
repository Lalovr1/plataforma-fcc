/**
 * Página de login:
 * - Permite iniciar sesión con correo BUAP y contraseña.
 * - Antes de iniciar sesión revisa si el correo existe y si está confirmado.
 * - Si el correo no está confirmado, permite reenviar confirmación.
 * - Si la contraseña falla, permite solicitar restablecimiento.
 * - Busca el rol en la tabla `usuarios` y redirige al dashboard correspondiente.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

type TipoMensaje = "error" | "success" | "info";

export default function LoginPage() {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<TipoMensaje>("error");
  const [cargando, setCargando] = useState(false);
  const [mostrarReenviarConfirmacion, setMostrarReenviarConfirmacion] = useState(false);
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
          "❌ No se pudo validar el estado de tu cuenta. Intenta nuevamente."
        );
        return;
      }

      if (estadoData === "no_registrado") {
        mostrarMensaje(
          "❌ Este correo no está registrado. Verifica que lo escribiste bien o regístrate para crear una cuenta."
        );
        return;
      }

      if (estadoData === "no_confirmado") {
        mostrarMensaje(
          "⚠️ Tu cuenta existe, pero todavía no has confirmado tu correo. Revisa tu bandeja de entrada o solicita un nuevo correo de confirmación.",
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
            "⚠️ Has intentado iniciar sesión demasiadas veces en poco tiempo. Espera unos minutos antes de volver a intentarlo.",
            "info"
          );
          return;
        }

        if (mensajeError.includes("invalid login credentials")) {
          mostrarMensaje(
            "❌ La contraseña es incorrecta. Intenta nuevamente o restablécela si no la recuerdas.",
            "error",
            { restablecer: true }
          );
          return;
        }

        mostrarMensaje(
          "❌ No se pudo iniciar sesión en este momento. Intenta nuevamente en unos minutos.",
          "error"
        );
        return;
      }

      if (!data.user) {
        mostrarMensaje("❌ No se encontró la información del usuario.");
        return;
      }

      localStorage.setItem("user_id", data.user.id);

      const { data: usuario, error: usuarioError } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", data.user.id)
        .single();

      if (usuarioError || !usuario) {
        console.error(usuarioError);
        mostrarMensaje(
          "❌ Tu cuenta existe, pero no se pudo determinar tu rol. Contacta al administrador de la plataforma."
        );
        return;
      }

      localStorage.setItem("rol_usuario", usuario.rol);

      if (usuario.rol === "estudiante") {
        window.location.href = "/dashboard/estudiante";
      } else if (usuario.rol === "profesor") {
        window.location.href = "/dashboard/profesor";
      } else {
        mostrarMensaje(
          "❌ Tu cuenta tiene un rol no válido. Contacta al administrador de la plataforma."
        );
      }
    } catch (err: any) {
      console.error(err);
      mostrarMensaje("❌ Error inesperado en login: " + err.message);
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
          "❌ No se pudo reenviar el correo de confirmación. Verifica el correo o intenta más tarde."
        );
        return;
      }

      mostrarMensaje(
        "✅ Te enviamos un nuevo correo de confirmación. Revisa tu bandeja de entrada y también la carpeta de spam.",
        "success"
      );
    } catch (err: any) {
      console.error(err);
      mostrarMensaje("❌ Error al reenviar confirmación: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const restablecerContrasena = async () => {
    limpiarMensajes();
    setCargando(true);

    const correoLimpio = correo.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(correoLimpio, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error(error);
        mostrarMensaje(
          "❌ No se pudo enviar el correo para restablecer tu contraseña. Intenta nuevamente."
        );
        return;
      }

      mostrarMensaje(
        "✅ Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja de entrada y también spam.",
        "success"
      );
    } catch (err: any) {
      console.error(err);
      mostrarMensaje("❌ Error al solicitar restablecimiento: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const colorMensaje =
    tipoMensaje === "success"
      ? "text-green-700 bg-green-50 border-green-200"
      : tipoMensaje === "info"
      ? "text-yellow-700 bg-yellow-50 border-yellow-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 text-gray-900 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-5 sm:p-6 rounded-xl shadow-md w-full max-w-sm space-y-4 border border-gray-200"
      >
        <h1 className="text-xl sm:text-2xl font-bold text-center">
          Iniciar Sesión
        </h1>

        <input
          type="email"
          placeholder="Correo BUAP"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <button
          type="submit"
          disabled={cargando}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed p-2 rounded font-bold text-white"
        >
          {cargando ? "Validando..." : "Ingresar"}
        </button>

        {mensaje && (
          <div className={`text-sm text-center border rounded-lg p-3 ${colorMensaje}`}>
            <p>{mensaje}</p>

            {mostrarReenviarConfirmacion && (
              <button
                type="button"
                onClick={reenviarConfirmacion}
                disabled={cargando}
                className="mt-3 text-blue-700 font-semibold hover:underline disabled:text-blue-400"
              >
                Reenviar correo de confirmación
              </button>
            )}

            {mostrarRestablecer && (
              <button
                type="button"
                onClick={restablecerContrasena}
                disabled={cargando}
                className="mt-3 text-blue-700 font-semibold hover:underline disabled:text-blue-400"
              >
                Restablecer contraseña
              </button>
            )}
          </div>
        )}

        <p className="text-sm text-center text-gray-600">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </form>
    </div>
  );
}