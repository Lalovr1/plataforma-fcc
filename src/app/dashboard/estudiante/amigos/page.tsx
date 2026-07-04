/**
 * Amigos del estudiante
 * - Arriba: listado de amigos.
 * - Solicitudes pendientes: aceptar / rechazar.
 * - Buscador de usuarios.
 * - Al hacer click en un amigo: modal de perfil (avatar+marco grande, nombre, nivel, puntos, logros).
 */

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, { AvatarConfig } from "@/components/RenderizadorAvatar";
import toast from "react-hot-toast";
import GridLogros from "@/components/GridLogros";

type Usuario = {
  id: string;
  nombre: string;
  rol: "estudiante" | "profesor";
  nivel: number | null;
  puntos: number | null;
  avatar_config: AvatarConfig | null;
};

type Solicitud = {
  id: string;
  solicitante_id: string;
  destinatario_id: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  created_at: string;
  solicitante?: Usuario;
};

type LogroModal = {
  id: string;
  titulo: string;
  descripcion?: string;
  icono_url: string;
};

type AmigosCache = {
  timestamp: number;
  me: Usuario | null;
  friends: Usuario[];
  pending: Solicitud[];
  sentRequests: string[];
  results: Usuario[];
};

const CACHE_KEY_BASE = "fcc_academy_amigos_estudiante_v1";
const LOGROS_CACHE_KEY_BASE = "fcc_academy_amigo_logros_v1";

function parseAvatarConfig(value: any): AvatarConfig | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

function normalizarUsuario(value: any): Usuario | null {
  if (!value) return null;

  return {
    ...value,
    avatar_config: parseAvatarConfig(value.avatar_config),
  } as Usuario;
}

export default function AmigosPage() {
  const [me, setMe] = useState<Usuario | null>(null);
  const [friends, setFriends] = useState<Usuario[]>([]);
  const [pending, setPending] = useState<Solicitud[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmigo, setSelectedAmigo] = useState<Usuario | null>(null);
  const [logros, setLogros] = useState<LogroModal[]>([]);
  const [loadingLogros, setLoadingLogros] = useState(false);

  const logrosRevisadosRef = useRef(false);

  const getCacheKey = (usuarioId: string) => `${CACHE_KEY_BASE}_${usuarioId}`;
  const getLogrosCacheKey = (usuarioId: string) => `${LOGROS_CACHE_KEY_BASE}_${usuarioId}`;

  const guardarCache = (
    usuarioId: string,
    data: {
      me: Usuario | null;
      friends: Usuario[];
      pending: Solicitud[];
      sentRequests: Set<string> | string[];
      results: Usuario[];
    }
  ) => {
    try {
      sessionStorage.setItem(
        getCacheKey(usuarioId),
        JSON.stringify({
          timestamp: Date.now(),
          me: data.me,
          friends: data.friends,
          pending: data.pending,
          sentRequests: Array.isArray(data.sentRequests)
            ? data.sentRequests
            : Array.from(data.sentRequests),
          results: data.results,
        })
      );
    } catch {}
  };

  const leerCache = (usuarioId: string): AmigosCache | null => {
    try {
      const raw = sessionStorage.getItem(getCacheKey(usuarioId));
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.friends)) return null;
      if (!Array.isArray(parsed?.pending)) return null;
      if (!Array.isArray(parsed?.sentRequests)) return null;
      if (!Array.isArray(parsed?.results)) return null;

      return {
        timestamp: Number(parsed.timestamp) || Date.now(),
        me: parsed.me ?? null,
        friends: parsed.friends,
        pending: parsed.pending,
        sentRequests: parsed.sentRequests,
        results: parsed.results,
      };
    } catch {
      return null;
    }
  };

  const aplicarCache = (cache: AmigosCache) => {
    setMe(cache.me);
    setFriends(cache.friends);
    setPending(cache.pending);
    setSentRequests(new Set(cache.sentRequests));
    setResults(cache.results);
  };

  const guardarLogrosCache = (usuarioId: string, data: LogroModal[]) => {
    try {
      sessionStorage.setItem(
        getLogrosCacheKey(usuarioId),
        JSON.stringify({
          timestamp: Date.now(),
          logros: data,
        })
      );
    } catch {}
  };

  const leerLogrosCache = (usuarioId: string): LogroModal[] | null => {
    try {
      const raw = sessionStorage.getItem(getLogrosCacheKey(usuarioId));
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.logros)) return null;

      return parsed.logros;
    } catch {
      return null;
    }
  };

  useLayoutEffect(() => {
    const usuarioLocal = localStorage.getItem("user_id");
    if (!usuarioLocal) return;

    const cache = leerCache(usuarioLocal);
    if (!cache) return;

    aplicarCache(cache);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const cache = leerCache(user.id);
        if (cache) {
          aplicarCache(cache);
          setLoading(false);
        }

        const { data: meRow } = await supabase
          .from("usuarios")
          .select("id,nombre,rol,nivel,puntos,avatar_config")
          .eq("id", user.id)
          .maybeSingle();

        const meData = normalizarUsuario(meRow);

        if (meData) {
          setMe(meData);
        }

        await refreshAll(user.id, meData);
      } catch (e) {
        console.error("Error inicializando amigos:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const fetchFriends = async (myId: string): Promise<Usuario[]> => {
    const { data, error } = await supabase
      .from("amistades")
      .select(`
        id, usuario_id, amigo_id,
        usuario:usuario_id (id,nombre,rol,nivel,puntos,avatar_config),
        amigo:amigo_id (id,nombre,rol,nivel,puntos,avatar_config)
      `)
      .or(`usuario_id.eq.${myId},amigo_id.eq.${myId}`);

    if (error) {
      console.error("Error cargando amigos:", error);
      return [];
    }

    const amigos = ((data as any[]) ?? [])
      .map((r) => (r.usuario_id === myId ? r.amigo : r.usuario))
      .map((u) => normalizarUsuario(u))
      .filter(Boolean) as Usuario[];

    if (!logrosRevisadosRef.current) {
      logrosRevisadosRef.current = true;

      setTimeout(async () => {
        try {
          const { data: amistadesUsuario } = await supabase
            .from("amistades")
            .select("id")
            .eq("usuario_id", myId);

          const { data: amistadesAmigo } = await supabase
            .from("amistades")
            .select("id")
            .eq("amigo_id", myId);

          const totalAmigos =
            (amistadesUsuario?.length ?? 0) + (amistadesAmigo?.length ?? 0);

          const { verificarLogros } = await import("@/utils/verificarLogros");
          await verificarLogros(myId, "amistades", totalAmigos);
        } catch (e) {
          console.error("Error verificando logros iniciales:", e);
        }
      }, 1500);
    }

    return amigos;
  };

  const fetchPending = async (myId: string): Promise<Solicitud[]> => {
    const { data } = await supabase
      .from("solicitudes_amistad")
      .select(
        `id,solicitante_id,destinatario_id,estado,created_at,
         solicitante:solicitante_id (id,nombre,rol,nivel,puntos,avatar_config)`
      )
      .eq("destinatario_id", myId)
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true });

    return ((data as any[]) ?? []).map((req) => ({
      ...req,
      solicitante: normalizarUsuario(req.solicitante) ?? undefined,
    }));
  };

  const fetchSentRequests = async (myId: string): Promise<Set<string>> => {
    const { data } = await supabase
      .from("solicitudes_amistad")
      .select("id,destinatario_id,estado")
      .eq("solicitante_id", myId)
      .eq("estado", "pendiente");

    return new Set((data ?? []).map((r) => r.destinatario_id));
  };

  const fetchDefaultResults = async (myId: string): Promise<Usuario[]> => {
    const { data } = await supabase
      .from("usuarios")
      .select("id,nombre,rol,nivel,puntos,avatar_config")
      .eq("rol", "estudiante")
      .neq("id", myId)
      .order("puntos", { ascending: false })
      .limit(24);

    return ((data as any[]) ?? [])
      .map((u) => normalizarUsuario(u))
      .filter(Boolean) as Usuario[];
  };

  const refreshAll = async (myId: string, meOverride?: Usuario | null) => {
    const [friendsData, pendingData, sentData, resultsData] = await Promise.all([
      fetchFriends(myId),
      fetchPending(myId),
      fetchSentRequests(myId),
      fetchDefaultResults(myId),
    ]);

    const meData = meOverride ?? me;

    setFriends(friendsData);
    setPending(pendingData);
    setSentRequests(sentData);
    setResults(resultsData);

    guardarCache(myId, {
      me: meData,
      friends: friendsData,
      pending: pendingData,
      sentRequests: sentData,
      results: resultsData,
    });
  };

  const doSearch = async () => {
    if (!me) return;

    const term = search.trim();

    if (!term) {
      const defaultResults = await fetchDefaultResults(me.id);
      setResults(defaultResults);

      guardarCache(me.id, {
        me,
        friends,
        pending,
        sentRequests,
        results: defaultResults,
      });

      return;
    }

    const { data } = await supabase
      .from("usuarios")
      .select("id,nombre,rol,nivel,puntos,avatar_config")
      .eq("rol", "estudiante")
      .neq("id", me.id)
      .ilike("nombre", `%${term}%`)
      .order("puntos", { ascending: false })
      .limit(50);

    const parsed = ((data as any[]) ?? [])
      .map((u) => normalizarUsuario(u))
      .filter(Boolean) as Usuario[];

    setResults(parsed);
  };

  const sendRequest = async (toUser: Usuario) => {
    if (!me) return;

    const { error } = await supabase.from("solicitudes_amistad").insert([
      { solicitante_id: me.id, destinatario_id: toUser.id, estado: "pendiente" },
    ]);

    if (error) {
      toast.error("No se pudo enviar la solicitud.");
      return;
    }

    toast.success("Solicitud enviada.");

    setSentRequests((prev) => {
      const next = new Set([...Array.from(prev), toUser.id]);

      guardarCache(me.id, {
        me,
        friends,
        pending,
        sentRequests: next,
        results,
      });

      return next;
    });
  };

  const acceptRequest = async (req: Solicitud) => {
    if (!me) return;

    const { error: updateError } = await supabase
      .from("solicitudes_amistad")
      .update({ estado: "aceptada" })
      .eq("id", req.id);

    if (updateError) {
      toast.error("No se pudo aceptar.");
      return;
    }

    const { error: insertError } = await supabase
      .from("amistades")
      .insert([{ usuario_id: req.solicitante_id, amigo_id: req.destinatario_id }]);

    if (insertError) {
      console.error("Error insertando amistad:", insertError);
      toast.error("Error al crear la amistad.");
      return;
    }

    try {
      const { verificarLogros } = await import("@/utils/verificarLogros");

      const { count: countAceptante } = await supabase
        .from("amistades")
        .select("*", { count: "exact" })
        .or(`usuario_id.eq.${me.id},amigo_id.eq.${me.id}`);

      await verificarLogros(me.id, "amistades", countAceptante ?? 0);
    } catch (err) {
      console.error("Error verificando logros de amistad:", err);
    }

    toast.success("Ahora son amigos 🎉");
    await refreshAll(me.id, me);
  };

  const rejectRequest = async (req: Solicitud) => {
    if (!me) return;

    const { error } = await supabase
      .from("solicitudes_amistad")
      .update({ estado: "rechazada" })
      .eq("id", req.id);

    if (error) {
      toast.error("No se pudo rechazar.");
      return;
    }

    toast("Solicitud rechazada.");
    await refreshAll(me.id, me);
  };

  const openAmigo = async (u: Usuario) => {
    setSelectedAmigo(u);

    const cache = leerLogrosCache(u.id);

    if (cache) {
      setLogros(cache);
      setLoadingLogros(false);
    } else {
      setLogros([]);
      setLoadingLogros(true);
    }

    const { data: relaciones, error: errorRelaciones } = await supabase
      .from("logros_usuarios")
      .select("logro_id")
      .eq("usuario_id", u.id);

    if (errorRelaciones) {
      console.error("Error obteniendo relaciones:", errorRelaciones);
      setLoadingLogros(false);
      return;
    }

    if (!relaciones || relaciones.length === 0) {
      setLogros([]);
      guardarLogrosCache(u.id, []);
      setLoadingLogros(false);
      return;
    }

    const logroIds = relaciones.map((r: any) => r.logro_id);

    const { data: logrosData, error: errorLogros } = await supabase
      .from("logros")
      .select("id, nombre, descripcion, icono_url")
      .in("id", logroIds);

    if (errorLogros) {
      console.error("Error obteniendo logros:", errorLogros);
      setLoadingLogros(false);
      return;
    }

    const parsed = (logrosData ?? []).map((l: any) => ({
      id: l.id,
      titulo: l.nombre,
      descripcion: l.descripcion,
      icono_url: l.icono_url,
    }));

    setLogros(parsed);
    guardarLogrosCache(u.id, parsed);
    setLoadingLogros(false);
  };

  const defaultAvatar: AvatarConfig = {
    bodyType: "male",
    skin: "PielBase.png",
    skinColor: "#f1c27d",
    hair: "none",
    eyes: "none",
    mouth: "none",
    nose: "none",
    glasses: "none",
    clothes: "none",
    accessory: "none",
  };

  if (loading) {
    return (
      <LayoutGeneral rol="estudiante">
        <div className="space-y-6">
          <h1
            className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
            style={{ color: "var(--color-heading)" }}
          >
            Amigos
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 min-w-0">
            <section className="lg:col-span-2 min-w-0">
              <div
                className="h-7 rounded w-32 mb-3 animate-pulse"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map((item) => (
                  <div
                    key={item}
                    className="p-4 rounded-lg shadow animate-pulse flex items-center gap-4"
                    style={{ backgroundColor: "var(--color-card)" }}
                  >
                    <div
                      className="h-20 w-20 rounded-full"
                      style={{ backgroundColor: "var(--color-border)" }}
                    />
                    <div className="space-y-3 flex-1">
                      <div
                        className="h-5 rounded w-2/3"
                        style={{ backgroundColor: "var(--color-border)" }}
                      />
                      <div
                        className="h-4 rounded w-1/2"
                        style={{ backgroundColor: "var(--color-border)" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div
                className="h-7 rounded w-48 mb-3 animate-pulse"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <div
                className="h-24 rounded-lg shadow animate-pulse"
                style={{ backgroundColor: "var(--color-card)" }}
              />
            </section>
          </div>

          <section className="mt-6">
            <div
              className="h-7 rounded w-44 mb-3 animate-pulse"
              style={{ backgroundColor: "var(--color-border)" }}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <div
                className="h-10 rounded flex-1 animate-pulse"
                style={{ backgroundColor: "var(--color-card)" }}
              />
              <div
                className="h-10 rounded-lg w-full sm:w-24 animate-pulse"
                style={{ backgroundColor: "var(--color-card)" }}
              />
            </div>
          </section>
        </div>
      </LayoutGeneral>
    );
  }

  return (
    <LayoutGeneral rol="estudiante">
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold pl-14 lg:pl-0 min-h-11 flex items-center"
          style={{ color: "var(--color-heading)" }}
        >
          Amigos
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 min-w-0">
          <section className="lg:col-span-2 min-w-0">
            <h2
              className="text-xl font-semibold mb-3"
              style={{ color: "var(--color-heading)" }}
            >
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
                    className="p-4 rounded-lg flex flex-col sm:flex-row items-center gap-3 sm:gap-4 shadow text-center sm:text-left w-full hover:opacity-90 min-w-0"
                    style={{
                      backgroundColor: "var(--color-card)",
                      color: "var(--color-text)",
                    }}
                    onClick={() => openAmigo(u)}
                  >
                    <RenderizadorAvatar
                      config={u.avatar_config ?? defaultAvatar}
                      size={100}
                    />

                    <div>
                      <div
                        className="text-lg sm:text-xl font-semibold break-words"
                        style={{ color: "var(--color-heading)" }}
                      >
                        {u.nombre}
                      </div>

                      <div
                        className="text-sm"
                        style={{ color: "var(--color-muted)" }}
                      >
                        Nivel {u.nivel ?? 0} • {u.puntos ?? 0} pts
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2
              className="text-xl font-semibold mb-3"
              style={{ color: "var(--color-heading)" }}
            >
              Solicitudes recibidas
            </h2>

            {pending.length === 0 ? (
              <p style={{ color: "var(--color-muted)" }}>
                No tienes solicitudes pendientes.
              </p>
            ) : (
              <div className="space-y-3">
                {pending.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow min-w-0"
                    style={{
                      backgroundColor: "var(--color-card)",
                      color: "var(--color-text)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RenderizadorAvatar
                        config={req.solicitante?.avatar_config ?? defaultAvatar}
                        size={50}
                      />

                      <div>
                        <div
                          className="font-medium"
                          style={{ color: "var(--color-heading)" }}
                        >
                          {req.solicitante?.nombre}
                        </div>

                        <div
                          className="text-sm"
                          style={{ color: "var(--color-muted)" }}
                        >
                          Nivel {req.solicitante?.nivel ?? 0} •{" "}
                          {req.solicitante?.puntos ?? 0} pts
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

        <section className="mt-6">
          <h2
            className="text-xl font-semibold mb-3"
            style={{ color: "var(--color-heading)" }}
          >
            Buscar estudiantes
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch();
            }}
            className="flex flex-col sm:flex-row gap-2"
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
                  className="p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow min-w-0"
                  style={{
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-text)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <RenderizadorAvatar
                      config={u.avatar_config ?? defaultAvatar}
                      size={100}
                    />

                    <div>
                      <div
                        className="text-lg sm:text-xl font-medium break-words"
                        style={{ color: "var(--color-heading)" }}
                      >
                        {u.nombre}
                      </div>

                      <div
                        className="text-sm"
                        style={{ color: "var(--color-muted)" }}
                      >
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

      {selectedAmigo &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setSelectedAmigo(null)}
          >
            <div
              className="p-4 sm:p-6 rounded-2xl w-[92vw] max-w-[720px] max-h-[90dvh] overflow-y-auto shadow-lg relative"
              style={{
                backgroundColor: "var(--color-card)",
                color: "var(--color-text)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 hover:opacity-80"
                onClick={() => setSelectedAmigo(null)}
                aria-label="Cerrar"
                style={{ color: "var(--color-muted)" }}
              >
                ✕
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left min-w-0">
                <div className="scale-[0.75] sm:scale-100 -my-8 sm:my-0">
                  <RenderizadorAvatar
                    config={selectedAmigo.avatar_config ?? defaultAvatar}
                    size={250}
                  />
                </div>

                <div>
                  <h3
                    className="text-2xl sm:text-4xl font-bold break-words"
                    style={{ color: "var(--color-heading)" }}
                  >
                    {selectedAmigo.nombre}
                  </h3>

                  <div
                    className="text-lg"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Nivel {selectedAmigo.nivel ?? 0} • {selectedAmigo.puntos ?? 0} pts
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4
                  className="text-xl font-semibold mb-3"
                  style={{ color: "var(--color-heading)" }}
                >
                  Logros desbloqueados
                </h4>

                {loadingLogros ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-24 rounded-lg animate-pulse"
                        style={{ backgroundColor: "var(--color-bg)" }}
                      />
                    ))}
                  </div>
                ) : logros.length === 0 ? (
                  <p style={{ color: "var(--color-muted)" }}>
                    Este usuario aún no tiene logros.
                  </p>
                ) : (
                  <GridLogros
                    logros={logros.map((l) => ({
                      ...l,
                      descripcion: l.descripcion ?? "",
                      desbloqueado: true,
                    }))}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </LayoutGeneral>
  );
}