/**
 * Página de login:
 * - Permite iniciar sesión con correo BUAP y contraseña.
 * - Valida credenciales contra Supabase.
 * - Busca el rol en la tabla `usuarios` y redirige al dashboard correspondiente.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link";

export default function LoginPage() {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });

      if (error) {
        setMensaje("❌ Credenciales inválidas o correo no confirmado.");
        return;
      }

      if (!data.user) {
        setMensaje("❌ No se encontró usuario.");
        return;
      }

      console.log("✅ Sesión iniciada:", data.session);

      const { data: usuario, error: usuarioError } = await supabase
        .from("usuarios")
        .select("rol")
        .eq("id", data.user.id)
        .single();

      if (usuarioError || !usuario) {
        console.error(usuarioError);
        setMensaje("❌ No se pudo determinar el rol del usuario.");
        return;
      }

      if (usuario.rol === "estudiante") {
        window.location.href = "/dashboard/estudiante";
      } else if (usuario.rol === "profesor") {
        window.location.href = "/dashboard/profesor";
      } else {
        setMensaje("❌ Rol no válido.");
      }
    } catch (err: any) {
      console.error(err);
      setMensaje("❌ Error en login: " + err.message);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 text-gray-900">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-xl shadow-md w-96 space-y-4 border border-gray-200"
      >
        <h1 className="text-2xl font-bold text-center">Iniciar Sesión</h1>

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
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold text-white"
        >
          Ingresar
        </button>

        {mensaje && (
          <p className="text-sm text-center text-red-600">{mensaje}</p>
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
