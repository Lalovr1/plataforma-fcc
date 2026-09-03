import { crearSupabaseServidor } from "@/utils/supabaseServer";

export type RolUsuarioServidor = "estudiante" | "profesor";

export async function obtenerUsuarioConRolServidor() {
  const supabase = await crearSupabaseServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      rol: null as RolUsuarioServidor | null,
    };
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  const rol: RolUsuarioServidor | null =
    perfil?.rol === "estudiante" || perfil?.rol === "profesor"
      ? perfil.rol
      : null;

  return {
    user,
    rol,
  };
}