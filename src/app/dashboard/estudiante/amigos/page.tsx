/**
 * Amigos del estudiante
 * - Arriba: listado de amigos.
 * - Solicitudes pendientes: aceptar / rechazar.
 * - Buscador de usuarios.
 * - Al hacer click en un amigo: modal de perfil (avatar+marco grande, nombre, nivel, puntos, logros).
 */

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import toast from "react-hot-toast";

type Usuario = {
  id: string;
  nombre: string;
  rol: "estudiante" | "profesor";
  nivel: number | null;
  puntos: number | null;
  avatar_config: AvatarConfig | null;
  frame_url: string | null;
};

type Solicitud = {
  id: string;
  solicitante_id: string;
  destinatario_id: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  created_at: string;
  solicitante?: Usuario;
};

export default function AmigosPage() {
  const [me, setMe] = useState<Usuario | null>(null);
  const [friends, setFriends] = useState<Usuario[]>([]);
  const [pending, setPending] = useState<Solicitud[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmigo, setSelectedAmigo] = useState<Usuario | null>(null);
  const [logros, setLogros] = useState<{ id: string; titulo: string; icono_url: string }[]>([]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: meRow } = await supabase
        .from("usuarios")
        .select("id,nombre,rol,nivel,puntos,avatar_config,frame_url")
        .eq("id", user.id)
        .maybeSingle();

      if (meRow) setMe(meRow as Usuario);

      await refreshAll(user.id);
      setLoading(false);
    };
    init();
  }, []);

  const refreshAll = async (myId: string) => {
    await Promise.all([
      loadFriends(myId),
      loadPending(myId),
      loadSentRequests(myId),
      loadDefaultResults(myId),
    ]);
  };

  const loadFriends = async (myId: string) => {
    const { data: rows1 } = await supabase
      .from("amistades")
      .select(
        `id,usuario_id,amigo_id,
         amigo:amigo_id (id,nombre,rol,nivel,puntos,avatar_config,frame_url)`
      )
      .eq("usuario_id", myId);

    const { data: rows2 } = await supabase
      .from("amistades")
      .select(
        `id,usuario_id,amigo_id,
         amigo:usuario_id (id,nombre,rol,nivel,puntos,avatar_config,frame_url)`
      )
      .eq("amigo_id", myId);

    const amigos: Usuario[] = [
      ...(rows1?.map((r: any) => r.amigo) ?? []),
      ...(rows2?.map((r: any) => r.amigo) ?? []),
    ];
    setFriends(amigos);
  };

  const loadPending = async (myId: string) => {
    const { data } = await supabase
      .from("solicitudes_amistad")
      .select(
        `id,solicitante_id,destinatario_id,estado,created_at,
         solicitante:solicitante_id (id,nombre,rol,nivel,puntos,avatar_config,frame_url)`
      )
      .eq("destinatario_id", myId)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true });

    setPending((data as any[]) ?? []);
  };

  const loadSentRequests = async (myId: string) => {
    const { data } = await supabase
      .from("solicitudes_amistad")
      .select("id,destinatario_id,estado")
      .eq("solicitante_id", myId)
      .eq("estado", "pendiente");

    const ids = new Set((data ?? []).map((r) => r.destinatario_id));
    setSentRequests(ids);
  };

  const loadDefaultResults = async (myId: string) => {
    const { data } = await supabase
      .from("usuarios")
      .select("id,nombre,rol,nivel,puntos,avatar_config,frame_url")
      .eq("rol", "estudiante")
      .neq("id", myId)
      .order("puntos", { ascending: false })
      .limit(24);

    setResults((data as any[]) ?? []);
  };

  const doSearch = async () => {
    if (!me) return;
    const term = search.trim();
    if (!term) {
      await loadDefaultResults(me.id);
      return;
    }

    const { data } = await supabase
      .from("usuarios")
      .select("id,nombre,rol,nivel,puntos,avatar_config,frame_url")
      .eq("rol", "estudiante")
      .neq("id", me.id)
      .ilike("nombre", `%${term}%`)
      .order("puntos", { ascending: false })
      .limit(50);

    setResults((data as any[]) ?? []);
  };

  const sendRequest = async (toUser: Usuario) => {
    if (!me) return;

    const { error } = await supabase.from("solicitudes_amistad").insert([
      { solicitante_id: me.id, destinatario_id: toUser.id, estado: "pendiente" },
    ]);

    if (error) {
      toast.error("No se pudo enviar la solicitud.");
    } else {
      toast.success("Solicitud enviada.");
      setSentRequests((prev) => new Set([...Array.from(prev), toUser.id]));
    }
  };

  const acceptRequest = async (req: Solicitud) => {
    if (!me) return;

    const { error } = await supabase
      .from("solicitudes_amistad")
      .update({ estado: "aceptada" })
      .eq("id", req.id);

    if (error) {
      toast.error("No se pudo aceptar.");
      return;
    }

    await supabase.from("amistades").insert([
      { usuario_id: req.solicitante_id, amigo_id: req.destinatario_id },
    ]);

    toast.success("Ahora son amigos 🎉");
    await refreshAll(me.id);
  };

  const rejectRequest = async (req: Solicitud) => {
    if (!me) return;

    const { error } = await supabase
      .from("solicitudes_amistad")
      .update({ estado: "rechazada" })
      .eq("id", req.id);

    if (error) {
      toast.error("No se pudo rechazar.");
    } else {
      toast("Solicitud rechazada.");
      await refreshAll(me.id);
    }
  };

  const openAmigo = async (u: Usuario) => {
    setSelectedAmigo(u);
    setLogros([]);

    const { data } = await supabase
      .from("logros_usuarios")
      .select("id, logro:logros (id, titulo, icono_url)")
      .eq("usuario_id", u.id);

    setLogros(
      (data ?? []).map((r: any) => ({
        id: r.logro.id,
        titulo: r.logro.titulo,
        icono_url: r.logro.icono_url,
      }))
    );
  };

  const defaultAvatar: AvatarConfig = {
    skin: "Piel1.png",
    eyes: "Ojos1.png",
    hair: "none",
    mouth: "Boca1.png",
    nose: "Nariz1.png",
    glasses: "none",
    clothes: "none",
    accessory: "none",
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-heading)" }}>
          Amigos
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Amigos */}
          <section className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--color-heading)" }}>
              Tu lista
            </h2>
            {friends.length === 0 ? (
              <p style={{ color: "var(--color-muted)" }}>
                Aún no has agregado amigos. Busca estudiantes abajo y envía una solicitud.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {friends.map((u) => (
                  <button
                    key={u.id}
                    className="p-4 rounded-lg flex items-center gap-4 shadow text-left w-full hover:opacity-90"
                    style={{
                      backgroundColor: "var(--color-card)",
                      color: "var(--color-text)",
                    }}
                    onClick={() => openAmigo(u)}
                  >
                    <RenderizadorAvatar
                      config={u.avatar_config ?? defaultAvatar}
                      frameUrl={u.frame_url}
                      size={100}
                    />
                    <div>
                      <div className="text-xl font-semibold" style={{ color: "var(--color-heading)" }}>
                        {u.nombre}
                      </div>
                      <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                        Nivel {u.nivel ?? 0} • {u.puntos ?? 0} pts
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Solicitudes */}
          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--color-heading)" }}>
              Solicitudes recibidas
            </h2>
            {pending.length === 0 ? (
              <p style={{ color: "var(--color-muted)" }}>No tienes solicitudes pendientes.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-lg flex items-center justify-between shadow"
                    style={{
                      backgroundColor: "var(--color-card)",
                      color: "var(--color-text)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RenderizadorAvatar
                        config={req.solicitante?.avatar_config ?? defaultAvatar}
                        frameUrl={req.solicitante?.frame_url ?? null}
                        size={50}
                      />
                      <div>
                        <div className="font-medium" style={{ color: "var(--color-heading)" }}>
                          {req.solicitante?.nombre}
                        </div>
                        <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                          Nivel {req.solicitante?.nivel ?? 0} • {req.solicitante?.puntos ?? 0} pts
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white"
                        onClick={() => acceptRequest(req)}
                      >
                        Aceptar
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg"
                        style={{
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-card)",
                          color: "var(--color-text)",
                        }}
                        onClick={() => rejectRequest(req)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Buscador */}
        <section className="mt-6">
          <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--color-heading)" }}>
            Buscar estudiantes
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
            className="flex gap-2"
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ingresa un nombre"
              className="flex-1 p-2 rounded"
              style={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition"
            >
              Buscar
            </button>
          </form>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((u) => {
              const isFriend = friends.some((f) => f.id === u.id);
              const hasPending =
                sentRequests.has(u.id) ||
                pending.some(
                  (p) => p.solicitante_id === u.id || p.destinatario_id === u.id
                );

              return (
                <div
                  key={u.id}
                  className="p-4 rounded-lg flex items-center justify-between shadow"
                  style={{
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-text)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <RenderizadorAvatar
                      config={u.avatar_config ?? defaultAvatar}
                      frameUrl={u.frame_url}
                      size={100}
                    />
                    <div>
                      <div className="text-xl font-medium" style={{ color: "var(--color-heading)" }}>
                        {u.nombre}
                      </div>
                      <div className="text-sm" style={{ color: "var(--color-muted)" }}>
                        Nivel {u.nivel ?? 0} • {u.puntos ?? 0} pts
                      </div>
                    </div>
                  </div>

                  {isFriend ? (
                    <span className="px-3 py-1 rounded bg-green-600 text-white text-sm">
                      Amigos
                    </span>
                  ) : hasPending ? (
                    <span className="px-3 py-1 rounded bg-yellow-500 text-white text-sm">
                      Esperando respuesta
                    </span>
                  ) : (
                    <button
                      className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                      onClick={() => sendRequest(u)}
                    >
                      Enviar solicitud
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      
      {selectedAmigo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="p-6 rounded-2xl w-[720px] shadow-lg relative"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text)" }}
          >
            <button
              className="absolute top-3 right-3 hover:opacity-80"
              onClick={() => setSelectedAmigo(null)}
              aria-label="Cerrar"
              style={{ color: "var(--color-muted)" }}
            >
              ✕
            </button>

            <div className="flex items-center gap-4">
              <RenderizadorAvatar
                config={selectedAmigo.avatar_config ?? defaultAvatar}
                frameUrl={selectedAmigo.frame_url}
                size={250}
              />
              <div>
                <h3 className="text-4xl font-bold" style={{ color: "var(--color-heading)" }}>
                  {selectedAmigo.nombre}
                </h3>
                <div className="text-lg" style={{ color: "var(--color-muted)" }}>
                  Nivel {selectedAmigo.nivel ?? 0} • {selectedAmigo.puntos ?? 0} pts
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-xl font-semibold mb-3" style={{ color: "var(--color-heading)" }}>
                Logros desbloqueados
              </h4>
              {logros.length === 0 ? (
                <p style={{ color: "var(--color-muted)" }}>Este usuario aún no tiene logros.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {logros.map((l) => (
                    <div
                      key={l.id}
                      className="flex flex-col items-center p-3 rounded-lg"
                      style={{ backgroundColor: "var(--color-bg)" }}
                    >
                      <img src={l.icono_url} alt={l.titulo} className="w-16 h-16 object-contain" />
                      <span className="mt-2 text-sm text-center">{l.titulo}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </LayoutGeneral>
  );
}
