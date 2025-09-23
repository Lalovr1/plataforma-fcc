/**
 * Página de registro:
 * - Detecta rol dinámicamente según correo BUAP:
 *   @alumno.buap.mx → estudiante
 *   @correo.buap.mx → profesor
 * - Estudiantes deben seleccionar carrera y semestre.
 * - Registra usuario en Supabase con metadata inicial.
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
  const [mensaje, setMensaje] = useState("");

  // Detección automática del rol según correo
  const rolDetectado =
    correo.endsWith("@alumno.buap.mx")
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

      // Crear usuario con metadata
      const { data, error } = await supabase.auth.signUp({
        email: correo,
        password: contrasena,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            nombre: nombre.trim(),
            rol: rolDetectado,
            carrera_id: rolDetectado === "estudiante" ? carreraId : null,
            semestre_id: rolDetectado === "estudiante" ? semestreId : null,
            nivel: 0,
            puntos: 0,
            avatar_url: "/avatars/default/avatar.png",
          },
        },
      });

      if (error) {
        setMensaje(`❌ Error en registro: ${error.message}`);
        return;
      }

      if (data.user?.identities?.length === 0) {
        setMensaje("❌ Este correo ya está registrado.");
        return;
      }

      setMensaje("✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.");
    } catch (err) {
      console.error(err);
      setMensaje("❌ Ocurrió un error inesperado.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-950 text-white">
      <form
        onSubmit={handleRegister}
        className="bg-gray-900 p-6 rounded-xl shadow-md w-96 space-y-4"
      >
        <h2 className="text-2xl font-bold text-center">Registro</h2>

        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full p-2 rounded bg-gray-800"
          required
        />

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

        {/* Campos extras solo para estudiantes */}
        {rolDetectado === "estudiante" && (
          <>
            <select
              value={carreraId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setCarreraId(value ? Number(value) : null);
              }}
              className="w-full p-2 rounded bg-gray-800"
              required
            >
              <option value="">Selecciona tu carrera</option>
              <option value={1}>Licenciatura en Ciencias de la Computación</option>
              <option value={2}>Ingeniería en Ciencias de la Computación</option>
              <option value={3}>Ingeniería en Ciencia de Datos</option>
              <option value={4}>Ingeniería en Ciberseguridad</option>
              <option value={5}>Ingeniería en Tecnologías de la Información</option>
            </select>

            <select
              value={semestreId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setSemestreId(value ? Number(value) : null);
              }}
              className="w-full p-2 rounded bg-gray-800"
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

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold"
        >
          Registrarse
        </button>

        {mensaje && (
          <p
            className={`text-sm text-center ${
              mensaje.startsWith("✅") ? "text-green-400" : "text-red-400"
            }`}
          >
            {mensaje}
          </p>
        )}

        {/* 👇 Nuevo: enlace a login */}
        <p className="text-sm text-center text-gray-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
