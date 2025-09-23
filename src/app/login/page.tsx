/**
 * Página de login:
 * - Permite iniciar sesión con correo BUAP y contraseña.
 * - Valida credenciales contra Supabase.
 * - Busca el rol en la tabla `usuarios` y redirige al dashboard correspondiente.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";

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
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-xl shadow-md w-96"
      >
        <h1 className="text-2xl font-bold mb-4 text-center">Iniciar Sesión</h1>

        <label className="block mb-2">Correo BUAP</label>
        <input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <label className="block mb-2">Contraseña</label>
        <input
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Ingresar
        </button>

        {mensaje && (
          <p className="mt-4 text-center text-red-600 font-medium">{mensaje}</p>
        )}
      </form>
    </div>
  );
}
