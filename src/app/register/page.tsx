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
    <div className="flex justify-center items-center min-h-screen bg-gray-100 text-gray-900">
      <form
        onSubmit={handleRegister}
        className="bg-white p-6 rounded-xl shadow-md w-96 space-y-4 border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-center">Registro</h2>

        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

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

        {/* Campos extras solo para estudiantes */}
        {rolDetectado === "estudiante" && (
          <>
            <input
              type="text"
              placeholder="Matrícula"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={carreraId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setCarreraId(value ? Number(value) : null);
              }}
              className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-bold text-white"
        >
          Registrarse
        </button>

        {mensaje && (
          <p
            className={`text-sm text-center ${
              mensaje.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {mensaje}
          </p>
        )}

        <p className="text-sm text-center text-gray-600">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
