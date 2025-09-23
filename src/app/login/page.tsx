/**
 * Página de login:
 * - Permite iniciar sesión con correo BUAP y contraseña.
 * - Valida credenciales contra Supabase.
 * - Busca el rol en la tabla `usuarios` y redirige al dashboard correspondiente.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Link from "next/link"; // 👈 agregado

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

      // Buscar rol en tabla `usuarios`
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

      // Redirigir según rol
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
    <div className="flex justify-center items-center min-h-screen bg-gray-950 text-white">
      <form
        onSubmit={handleLogin}
        className="bg-gray-900 p-6 rounded-xl shadow-md w-96 space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Iniciar Sesión</h1>

        <input
          type="email"
          placeholder="Correo BUAP"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="w-full p-2 rounded bg-gray-800"
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          className="w-full p-2 rounded bg-gray-800"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold"
        >
          Ingresar
        </button>

        {mensaje && (
          <p className="text-sm text-center text-red-400">{mensaje}</p>
        )}

        {/* 👇 Nuevo: enlace a registro */}
        <p className="text-sm text-center text-gray-400">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-blue-400 hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
