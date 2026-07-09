/**
 * Amigos del estudiante
 * - Lista de amigos.
 * - Solicitudes pendientes: aceptar / rechazar.
 * - Buscador de usuarios.
 * - Modal de perfil con avatar, nivel, puntos y logros.
 */

"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";
import toast from "react-hot-toast";
import GridLogros from "@/components/GridLogros";
import { Check, Search, UserPlus, X } from "lucide-react";

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

const defaultAvatar: AvatarConfig = {
  gender: "masculino",
  skin: "base/masculino/piel.png",
  skinColor: "#f1c27d",
  eyes: "Ojos1.png",
  mouth: "Boca1.png",
  nose: "Nariz1.png",
  glasses: "none",
  hair: "Cabello1.png",
  playera: "Playera1",
  sueter: "none",
  collar: "none",
  pulsera: "none",
  accessory: "none",
};

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

function AvatarAmigos({
  config,
  size,
}: {
  config: AvatarConfig | null;
  size: number;
}) {
  return (
    <div
      className="amigos-avatar-stage"
      style={{ "--amigos-avatar-size": `${size}px` } as CSSProperties}
    >
      <span className="amigos-avatar-orbit" />

      <div className="amigos-avatar-render">
        <RenderizadorAvatar config={config ?? defaultAvatar} size={size} />
      </div>
    </div>
  );
}

export default function AmigosPage() {
  const [me, setMe] = useState<Usuario | null>(null);
  const [friends, setFriends] = useState<Usuario[]>([]);
  const [pending, setPending] = useState<Solicitud[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);

  const [selectedAmigo, setSelectedAmigo] = useState<Usuario | null>(null);
  const [logros, setLogros] = useState<LogroModal[]>([]);
  const [loadingLogros, setLoadingLogros] = useState(false);

  const [procesandoSolicitudId, setProcesandoSolicitudId] = useState<
    string | null
  >(null);
  const [enviandoSolicitudId, setEnviandoSolicitudId] = useState<string | null>(
    null
  );

  const logrosRevisadosRef = useRef(false);

  const getCacheKey = (usuarioId: string) => `${CACHE_KEY_BASE}_${usuarioId}`;
  const getLogrosCacheKey = (usuarioId: string) =>
    `${LOGROS_CACHE_KEY_BASE}_${usuarioId}`;

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
      .select(
        `
        id, usuario_id, amigo_id,
        usuario:usuario_id (id,nombre,rol,nivel,puntos,avatar_config),
        amigo:amigo_id (id,nombre,rol,nivel,puntos,avatar_config)
      `
      )
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
          const { count } = await supabase
            .from("amistades")
            .select("*", { count: "exact", head: true })
            .or(`usuario_id.eq.${myId},amigo_id.eq.${myId}`);

          const { verificarLogros } = await import("@/utils/verificarLogros");
          await verificarLogros(myId, "amistades", count ?? 0);
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

    setBuscando(true);

    try {
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
    } finally {
      setBuscando(false);
    }
  };

  const getEstadoUsuario = (usuarioId: string) => {
    if (me?.id === usuarioId) return "self";
    if (friends.some((f) => f.id === usuarioId)) return "friend";
    if (sentRequests.has(usuarioId)) return "sent";
    if (
      pending.some(
        (p) => p.solicitante_id === usuarioId || p.destinatario_id === usuarioId
      )
    ) {
      return "received";
    }

    return "none";
  };

  const sendRequest = async (toUser: Usuario) => {
    if (!me) return;
    if (toUser.id === me.id) return;

    setEnviandoSolicitudId(toUser.id);

    try {
      const estadoActual = getEstadoUsuario(toUser.id);

      if (estadoActual === "friend") {
        toast("Ya son amigos.");
        return;
      }

      if (estadoActual === "sent") {
        toast("Ya habías enviado una solicitud.");
        return;
      }

      if (estadoActual === "received") {
        toast("Ese usuario ya te envió una solicitud.");
        return;
      }

      const { data: amistadExistente } = await supabase
        .from("amistades")
        .select("id")
        .or(
          `and(usuario_id.eq.${me.id},amigo_id.eq.${toUser.id}),and(usuario_id.eq.${toUser.id},amigo_id.eq.${me.id})`
        )
        .limit(1);

      if (amistadExistente && amistadExistente.length > 0) {
        toast("Ya son amigos.");
        await refreshAll(me.id, me);
        return;
      }

      const { data: solicitudExistente } = await supabase
        .from("solicitudes_amistad")
        .select("solicitante_id,destinatario_id")
        .eq("estado", "pendiente")
        .or(
          `and(solicitante_id.eq.${me.id},destinatario_id.eq.${toUser.id}),and(solicitante_id.eq.${toUser.id},destinatario_id.eq.${me.id})`
        )
        .limit(1);

      const solicitud = solicitudExistente?.[0] as any;

      if (solicitud) {
        if (solicitud.solicitante_id === me.id) {
          setSentRequests((prev) => new Set([...Array.from(prev), toUser.id]));
          toast("Ya habías enviado una solicitud.");
        } else {
          toast("Ese usuario ya te envió una solicitud.");
          await refreshAll(me.id, me);
        }

        return;
      }

      const { error } = await supabase.from("solicitudes_amistad").insert([
        {
          solicitante_id: me.id,
          destinatario_id: toUser.id,
          estado: "pendiente",
        },
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
    } finally {
      setEnviandoSolicitudId(null);
    }
  };

  const acceptRequest = async (req: Solicitud) => {
    if (!me) return;

    setProcesandoSolicitudId(req.id);

    try {
      const { error: updateError } = await supabase
        .from("solicitudes_amistad")
        .update({ estado: "aceptada" })
        .eq("id", req.id);

      if (updateError) {
        toast.error("No se pudo aceptar.");
        return;
      }

      const { data: amistadExistente } = await supabase
        .from("amistades")
        .select("id")
        .or(
          `and(usuario_id.eq.${req.solicitante_id},amigo_id.eq.${req.destinatario_id}),and(usuario_id.eq.${req.destinatario_id},amigo_id.eq.${req.solicitante_id})`
        )
        .limit(1);

      if (!amistadExistente || amistadExistente.length === 0) {
        const { error: insertError } = await supabase.from("amistades").insert([
          {
            usuario_id: req.solicitante_id,
            amigo_id: req.destinatario_id,
          },
        ]);

        if (insertError) {
          console.error("Error insertando amistad:", insertError);
          toast.error("Error al crear la amistad.");
          return;
        }
      }

      try {
        const { verificarLogros } = await import("@/utils/verificarLogros");

        const { count } = await supabase
          .from("amistades")
          .select("*", { count: "exact", head: true })
          .or(`usuario_id.eq.${me.id},amigo_id.eq.${me.id}`);

        await verificarLogros(me.id, "amistades", count ?? 0);
      } catch (err) {
        console.error("Error verificando logros de amistad:", err);
      }

      toast.success("Ahora son amigos 🎉");
      await refreshAll(me.id, me);
    } finally {
      setProcesandoSolicitudId(null);
    }
  };

  const rejectRequest = async (req: Solicitud) => {
    if (!me) return;

    setProcesandoSolicitudId(req.id);

    try {
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
    } finally {
      setProcesandoSolicitudId(null);
    }
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

  const renderEstadoBadge = (usuarioId: string) => {
    const estado = getEstadoUsuario(usuarioId);

    if (estado === "friend") {
      return <span className="amigos-status-badge is-friend">Amigos</span>;
    }

    if (estado === "sent") {
      return (
        <span className="amigos-status-badge is-pending">
          Solicitud enviada
        </span>
      );
    }

    if (estado === "received") {
      return (
        <span className="amigos-status-badge is-pending">
          Te envió solicitud
        </span>
      );
    }

    return null;
  };

  return (
    <LayoutGeneral rol="estudiante">
      <style>{`
        .amigos-page,
        .amigos-profile-overlay {
          --amigos-text: var(--fcc-premium-text, var(--color-text));
          --amigos-heading: var(--fcc-premium-heading, var(--color-heading));
          --amigos-muted: var(--fcc-premium-muted, var(--color-muted));
          --amigos-accent: var(--fcc-premium-accent);
          --amigos-cyan: var(--fcc-premium-cyan);
          --amigos-border: var(--fcc-premium-border, var(--color-border));

          --amigos-avatar-core: color-mix(in srgb, var(--amigos-cyan) 18%, transparent);
          --amigos-avatar-a: color-mix(in srgb, var(--amigos-accent) 34%, transparent);
          --amigos-avatar-b: color-mix(in srgb, var(--amigos-cyan) 28%, transparent);
          --amigos-avatar-c: color-mix(in srgb, var(--amigos-accent) 26%, transparent);
          --amigos-avatar-border: color-mix(in srgb, var(--amigos-accent) 28%, transparent);
          --amigos-avatar-shadow-a: color-mix(in srgb, var(--amigos-accent) 4%, transparent);
          --amigos-avatar-shadow-b: color-mix(in srgb, var(--amigos-accent) 18%, transparent);
          --amigos-orbit-a: color-mix(in srgb, var(--amigos-accent) 20%, transparent);
          --amigos-orbit-b: color-mix(in srgb, var(--amigos-cyan) 22%, transparent);

          color: var(--amigos-text);
        }

        .amigos-page {
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .amigos-hero,
        .amigos-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--amigos-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .amigos-hero {
          border-radius: 22px;
          padding: 16px 22px;
        }

        .amigos-hero-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }

        .amigos-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--amigos-accent);
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .amigos-kicker::before,
        .amigos-kicker::after {
          content: "";
          width: 32px;
          height: 2px;
          border-radius: 999px;
          background: var(--amigos-accent);
        }

        .amigos-description {
          max-width: 620px;
          margin: 0 auto;
          color: var(--amigos-muted);
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 700;
        }

        .amigos-main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          min-width: 0;
        }

        @media (min-width: 1024px) {
          .amigos-main-grid {
            grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
          }
        }

        .amigos-panel {
          padding: clamp(14px, 2.4vw, 20px);
        }

        .amigos-section-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 16px;
          color: var(--amigos-heading);
          text-align: center;
          font-size: clamp(1.1rem, 1.7vw, 1.35rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .amigos-section-title::before,
        .amigos-section-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--amigos-accent) 55%, transparent)
          );
        }

        .amigos-section-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--amigos-accent) 55%, transparent),
            transparent
          );
        }

        .amigos-card-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        @media (min-width: 640px) {
          .amigos-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .amigos-search-results-grid {
          grid-template-columns: 1fr;
        }

        @media (min-width: 640px) {
          .amigos-search-results-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1180px) {
          .amigos-search-results-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .amigos-user-card,
        .amigos-request-card {
          position: relative;
          overflow: hidden;
          min-width: 0;
          border-radius: 24px;
          padding: 16px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--amigos-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--amigos-text);
        }

        .amigos-user-card {
          width: 100%;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          text-align: left;
          cursor: pointer;
          transition:
            transform 170ms ease,
            box-shadow 170ms ease,
            border-color 170ms ease;
        }

        .amigos-user-card:hover {
          transform: translateY(-1px);
          border-color: var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow-hover);
        }

        .amigos-user-main {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          text-align: left;
        }

        .amigos-user-info {
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .amigos-user-name {
          color: var(--amigos-heading);
          font-size: clamp(1rem, 1.45vw, 1.22rem);
          font-weight: 950;
          line-height: 1.12;
          letter-spacing: -0.035em;
          word-break: break-word;
        }

        .amigos-user-meta {
          color: var(--amigos-muted);
          font-size: 0.86rem;
          font-weight: 800;
        }

        .amigos-search-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }

        .amigos-search-input {
          min-height: 46px;
          width: 100%;
          border-radius: 16px;
          padding: 0 16px;
          color: var(--amigos-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--amigos-accent) 18%,
            var(--amigos-border)
          );
          outline: none;
          font-size: 0.94rem;
          font-weight: 750;
        }

        .amigos-search-input::placeholder {
          color: var(--amigos-muted);
          opacity: 0.78;
        }

        .amigos-search-input:focus {
          border-color: color-mix(
            in srgb,
            var(--amigos-accent) 58%,
            var(--amigos-border)
          );
          box-shadow: 0 0 0 4px color-mix(
            in srgb,
            var(--amigos-accent) 13%,
            transparent
          );
        }

        .amigos-primary-button,
        .amigos-success-button,
        .amigos-muted-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          border-radius: 14px;
          padding: 0 15px;
          font-size: 0.88rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            filter 170ms ease,
            opacity 170ms ease;
        }

        .amigos-primary-button {
          color: #ffffff;
          background: linear-gradient(
            135deg,
            var(--amigos-accent),
            color-mix(in srgb, var(--amigos-accent) 72%, #38bdf8)
          );
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--amigos-accent) 24%, transparent);
        }

        .theme-oscuro .amigos-primary-button {
          color: #050505;
        }

        .amigos-success-button {
          color: #ffffff;
          background: linear-gradient(135deg, #16a34a, #22c55e);
        }

        .amigos-muted-button {
          color: var(--amigos-text);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--amigos-border);
        }

        .amigos-primary-button:hover:not(:disabled),
        .amigos-success-button:hover:not(:disabled),
        .amigos-muted-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.04);
        }

        .amigos-primary-button:disabled,
        .amigos-success-button:disabled,
        .amigos-muted-button:disabled {
          opacity: 0.58;
          cursor: not-allowed;
          transform: none;
        }

        .amigos-result-card {
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          min-height: 118px;
          padding: 14px;
        }

        .amigos-result-card .amigos-user-main {
          pointer-events: none;
        }

        .amigos-result-card:focus-visible {
          outline: none;
          box-shadow:
            var(--fcc-premium-shadow-hover),
            0 0 0 4px color-mix(
              in srgb,
              var(--amigos-accent) 18%,
              transparent
            );
        }

        .amigos-result-actions,
        .amigos-request-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .amigos-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 28px;
          border-radius: 999px;
          padding: 0 11px;
          font-size: 0.74rem;
          font-weight: 950;
          line-height: 1;
        }

        .amigos-status-badge.is-friend {
          color: #ffffff;
          background: linear-gradient(135deg, #16a34a, #22c55e);
        }

        .amigos-status-badge.is-pending {
          color: #ffffff;
          background: linear-gradient(135deg, #d97706, #f59e0b);
        }

        .amigos-empty {
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-radius: 24px;
          padding: 24px 18px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px dashed color-mix(
            in srgb,
            var(--amigos-accent) 34%,
            transparent
          );
        }

        .amigos-empty-text {
          max-width: 460px;
          color: var(--amigos-muted);
          font-size: 0.94rem;
          line-height: 1.5;
          font-weight: 750;
        }

        .amigos-avatar-stage {
          position: relative;
          flex: 0 0 auto;
          width: var(--amigos-avatar-size);
          height: var(--amigos-avatar-size);
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .amigos-avatar-stage::before {
          content: "";
          position: absolute;
          width: 82%;
          height: 82%;
          border-radius: 999px;
          background:
            radial-gradient(circle, var(--amigos-avatar-core), transparent 62%),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--amigos-avatar-a) 42deg,
              transparent 84deg,
              var(--amigos-avatar-b) 145deg,
              transparent 210deg,
              var(--amigos-avatar-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -3;
        }

        .amigos-avatar-stage::after {
          content: "";
          position: absolute;
          width: 70%;
          height: 70%;
          border-radius: 999px;
          border: 1px solid var(--amigos-avatar-border);
          box-shadow:
            0 0 0 14px var(--amigos-avatar-shadow-a),
            0 0 42px var(--amigos-avatar-shadow-b);
          z-index: -2;
        }

        .amigos-avatar-orbit {
          position: absolute;
          inset: 17%;
          z-index: -1;
          border-radius: 999px;
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--amigos-orbit-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--amigos-orbit-b) 60% 64%,
              transparent 64% 100%
            );
          transform: rotate(-18deg);
          opacity: 0.95;
        }

        .amigos-avatar-render {
          position: relative;
          z-index: 2;
        }

        .amigos-profile-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(15, 23, 42, 0.62);
          backdrop-filter: blur(8px);
        }

        .amigos-profile-modal {
          position: relative;
          width: min(94vw, 760px);
          max-height: 90dvh;
          overflow-y: auto;
          border-radius: 30px;
          padding: clamp(18px, 3vw, 28px);
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--amigos-border);
          box-shadow:
            var(--fcc-premium-shadow-hover),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--amigos-text);
        }

        .amigos-profile-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--amigos-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--amigos-border);
          transition:
            transform 170ms ease,
            color 170ms ease,
            border-color 170ms ease;
        }

        .amigos-profile-close:hover {
          transform: translateY(-1px);
          color: #ef4444;
          border-color: color-mix(in srgb, #ef4444 34%, var(--amigos-border));
        }

        .amigos-profile-header {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: clamp(16px, 3vw, 26px);
          padding-right: 34px;
        }

        .amigos-profile-name {
          color: var(--amigos-heading);
          font-size: clamp(1.75rem, 4vw, 3rem);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: -0.055em;
          word-break: break-word;
        }

        .amigos-profile-meta {
          margin-top: 10px;
          color: var(--amigos-muted);
          font-size: clamp(1rem, 1.7vw, 1.15rem);
          font-weight: 800;
        }

        .amigos-logros-section {
          margin-top: 24px;
        }

        .amigos-logros-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 14px;
          color: var(--amigos-heading);
          text-align: center;
          font-size: clamp(1.1rem, 1.8vw, 1.4rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .amigos-logros-title::before,
        .amigos-logros-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--amigos-accent) 55%, transparent)
          );
        }

        .amigos-logros-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--amigos-accent) 55%, transparent),
            transparent
          );
        }

        .amigos-logros-empty {
          min-height: 120px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          padding: 18px;
          text-align: center;
          color: var(--amigos-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 68%,
            transparent
          );
          border: 1px dashed color-mix(
            in srgb,
            var(--amigos-accent) 26%,
            transparent
          );
          font-weight: 750;
        }

        .amigos-skeleton-panel {
          padding: clamp(14px, 2.4vw, 20px);
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--amigos-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .amigos-skeleton-line {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--amigos-accent) 16%,
            var(--fcc-premium-surface-strong)
          );
        }

        @media (min-width: 640px) {
          .amigos-search-form {
            flex-direction: row;
          }

          .amigos-search-button {
            min-width: 128px;
          }
        }

        @media (max-width: 640px) {
          .amigos-hero {
            padding: 14px 16px;
          }

          .amigos-kicker {
            font-size: 0.7rem;
            letter-spacing: 0.18em;
          }

          .amigos-description {
            font-size: 0.86rem;
          }

          .amigos-user-card,
          .amigos-user-main {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
          }

          .amigos-result-actions,
          .amigos-request-actions {
            justify-content: center;
          }

          .amigos-profile-header {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
            padding-right: 0;
            padding-top: 18px;
          }
        }
      `}</style>

      <div className="amigos-page">
        <section className="amigos-hero">
          <div className="amigos-hero-inner">
            <p className="amigos-kicker">Amigos</p>

            <p className="amigos-description">
              Conecta con otros estudiantes de FCC Academy.
            </p>
          </div>
        </section>

        {loading ? (
          <section className="amigos-skeleton-panel animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="amigos-user-card">
                  <div className="amigos-skeleton-line h-20 w-20 rounded-full" />

                  <div className="space-y-3 w-full">
                    <div className="amigos-skeleton-line h-5 w-2/3" />
                    <div className="amigos-skeleton-line h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <div className="amigos-main-grid">
              <section className="amigos-panel">
                <h2 className="amigos-section-title">Tu lista</h2>

                {friends.length === 0 ? (
                  <div className="amigos-empty">
                    <p className="amigos-empty-text">
                      Aún no has agregado amigos.
                    </p>
                  </div>
                ) : (
                  <div className="amigos-card-grid">
                    {friends.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="amigos-user-card"
                        onClick={() => openAmigo(u)}
                      >
                        <AvatarAmigos config={u.avatar_config} size={96} />

                        <span className="amigos-user-info">
                          <span className="amigos-user-name">{u.nombre}</span>

                          <span className="amigos-user-meta">
                            Nivel {u.nivel ?? 0} • {u.puntos ?? 0} pts
                          </span>

                          {renderEstadoBadge(u.id)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="amigos-panel">
                <h2 className="amigos-section-title">
                  Solicitudes recibidas
                </h2>

                {pending.length === 0 ? (
                  <div className="amigos-empty">
                    <p className="amigos-empty-text">
                      No tienes solicitudes pendientes.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-12">
                    {pending.map((req) => (
                      <article key={req.id} className="amigos-request-card">
                        <button
                          type="button"
                          className="amigos-user-main w-full"
                          onClick={() =>
                            req.solicitante && openAmigo(req.solicitante)
                          }
                        >
                          <AvatarAmigos
                            config={req.solicitante?.avatar_config ?? null}
                            size={74}
                          />

                          <span className="amigos-user-info">
                            <span className="amigos-user-name">
                              {req.solicitante?.nombre ?? "Usuario"}
                            </span>

                            <span className="amigos-user-meta">
                              Nivel {req.solicitante?.nivel ?? 0} •{" "}
                              {req.solicitante?.puntos ?? 0} pts
                            </span>
                          </span>
                        </button>

                        <div className="amigos-request-actions mt-4">
                          <button
                            type="button"
                            className="amigos-success-button"
                            onClick={() => acceptRequest(req)}
                            disabled={procesandoSolicitudId === req.id}
                          >
                            <Check size={16} strokeWidth={2.5} />
                            <span>
                              {procesandoSolicitudId === req.id
                                ? "Guardando..."
                                : "Aceptar"}
                            </span>
                          </button>

                          <button
                            type="button"
                            className="amigos-muted-button"
                            onClick={() => rejectRequest(req)}
                            disabled={procesandoSolicitudId === req.id}
                          >
                            <X size={16} strokeWidth={2.5} />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="amigos-panel">
              <h2 className="amigos-section-title">Buscar estudiantes</h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  doSearch();
                }}
                className="amigos-search-form"
              >
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ingresa un nombre"
                  className="amigos-search-input"
                />

                <button
                  type="submit"
                  className="amigos-primary-button amigos-search-button"
                  disabled={buscando}
                >
                  <Search size={17} strokeWidth={2.4} />
                  <span>{buscando ? "Buscando..." : "Buscar"}</span>
                </button>
              </form>

              {results.length === 0 ? (
                <div className="amigos-empty">
                  <p className="amigos-empty-text">
                    No hay estudiantes para mostrar.
                  </p>
                </div>
              ) : (
                <div className="amigos-card-grid amigos-search-results-grid">
                  {results.map((u) => {
                    const estado = getEstadoUsuario(u.id);

                    return (
                      <article
                        key={u.id}
                        className="amigos-user-card amigos-result-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => openAmigo(u)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openAmigo(u);
                          }
                        }}
                      >
                        <div className="amigos-user-main">
                          <AvatarAmigos config={u.avatar_config} size={92} />

                          <span className="amigos-user-info">
                            <span className="amigos-user-name">{u.nombre}</span>

                            <span className="amigos-user-meta">
                              Nivel {u.nivel ?? 0} • {u.puntos ?? 0} pts
                            </span>
                          </span>
                        </div>

                        <div className="amigos-result-actions">
                          {estado === "friend" ||
                          estado === "sent" ||
                          estado === "received" ? (
                            renderEstadoBadge(u.id)
                          ) : (
                            <button
                              type="button"
                              className="amigos-primary-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendRequest(u);
                              }}
                              disabled={enviandoSolicitudId === u.id}
                            >
                              <UserPlus size={17} strokeWidth={2.4} />
                              <span>
                                {enviandoSolicitudId === u.id
                                  ? "Enviando..."
                                  : "Enviar solicitud"}
                              </span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedAmigo &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="amigos-profile-overlay"
            onClick={() => setSelectedAmigo(null)}
          >
            <div
              className="amigos-profile-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="amigos-profile-close"
                onClick={() => setSelectedAmigo(null)}
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.4} />
              </button>

              <div className="amigos-profile-header">
                <AvatarAmigos
                  config={selectedAmigo.avatar_config}
                  size={230}
                />

                <div>
                  <h3 className="amigos-profile-name">
                    {selectedAmigo.nombre}
                  </h3>

                  <p className="amigos-profile-meta">
                    Nivel {selectedAmigo.nivel ?? 0} •{" "}
                    {selectedAmigo.puntos ?? 0} pts
                  </p>

                  <div className="mt-4">
                    {renderEstadoBadge(selectedAmigo.id)}
                  </div>
                </div>
              </div>

              <div className="amigos-logros-section">
                <h4 className="amigos-logros-title">Logros desbloqueados</h4>

                {loadingLogros ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-24 rounded-xl"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--amigos-accent) 12%, transparent)",
                        }}
                      />
                    ))}
                  </div>
                ) : logros.length === 0 ? (
                  <div className="amigos-logros-empty">
                    Este usuario aún no tiene logros.
                  </div>
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