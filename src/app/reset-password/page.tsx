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

  const colorMensaje =
    tipoMensaje === "success"
      ? "text-green-700 bg-green-50 border-green-200"
      : tipoMensaje === "info"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 text-gray-900 px-4">
      <form
        onSubmit={actualizarContrasena}
        className="bg-white p-5 sm:p-6 rounded-xl shadow-md w-full max-w-sm space-y-4 border border-gray-200"
      >
        <h1 className="text-xl sm:text-2xl font-bold text-center">
          Restablecer contraseña
        </h1>

        <p className="text-sm text-center text-gray-600">
          Escribe tu nueva contraseña para actualizar el acceso a tu cuenta.
        </p>

        {!contrasenaActualizada && (
          <>
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={nuevaContrasena}
              onChange={(e) => setNuevaContrasena(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />

            <input
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={confirmarContrasena}
              onChange={(e) => setConfirmarContrasena(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed p-2 rounded font-bold text-white"
            >
              {cargando ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </>
        )}

        {mensaje && (
          <div className={`text-sm text-center border rounded-lg p-3 ${colorMensaje}`}>
            {mensaje}
          </div>
        )}

        {contrasenaActualizada && (
          <Link
            href="/login"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold text-white"
          >
            Ir a iniciar sesión
          </Link>
        )}

        {!contrasenaActualizada && (
          <p className="text-sm text-center text-gray-600">
            ¿Ya recordaste tu contraseña?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Volver al login
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}