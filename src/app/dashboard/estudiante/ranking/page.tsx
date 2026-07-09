/**
 * Ranking global de estudiantes con soporte de temas e interacción social.
 */

"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabaseClient";
import LayoutGeneral from "@/components/LayoutGeneral";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";
import GridLogros from "@/components/GridLogros";
import toast from "react-hot-toast";
import { CheckCircle2, Clock3, UserPlus, X } from "lucide-react";

interface Usuario {
  id: string;
  nombre: string;
  puntos: number;
  nivel: number | null;
  avatar_config: AvatarConfig | null;
}

interface RankingCache {
  timestamp: number;
  usuarios: Usuario[];
  miUsuario: Usuario | null;
  miPosicion: number | null;
}

interface LogroModal {
  id: string;
  titulo: string;
  descripcion?: string;
  icono_url: string;
}

const CACHE_KEY_BASE = "fcc_academy_ranking_estudiante_v1";
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
    id: value.id,
    nombre: value.nombre,
    puntos: Number(value.puntos ?? 0),
    nivel: value.nivel ?? 0,
    avatar_config: parseAvatarConfig(value.avatar_config),
  };
}

function AvatarRanking({
  config,
  size,
  className = "",
}: {
  config: AvatarConfig | null;
  size: number;
  className?: string;
}) {
  return (
    <div
      className={`ranking-avatar-stage ${className}`}
      style={{ "--ranking-avatar-size": `${size}px` } as CSSProperties}
    >
      <span className="ranking-avatar-orbit" />

      <div className="ranking-avatar-render">
        <RenderizadorAvatar config={config ?? defaultAvatar} size={size} />
      </div>
    </div>
  );
}

export default function EstudianteRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [miUsuario, setMiUsuario] = useState<Usuario | null>(null);
  const [miPosicion, setMiPosicion] = useState<number | null>(null);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cacheCargado, setCacheCargado] = useState(false);
  const [vistaRanking, setVistaRanking] = useState<"global" | "amigos">(
    "global"
  );

  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [receivedRequests, setReceivedRequests] = useState<Set<string>>(
    new Set()
  );

  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [logros, setLogros] = useState<LogroModal[]>([]);
  const [loadingLogros, setLoadingLogros] = useState(false);
  const [enviandoSolicitudId, setEnviandoSolicitudId] = useState<string | null>(
    null
  );

  const getCacheKey = (usuarioId: string) => `${CACHE_KEY_BASE}_${usuarioId}`;
  const getLogrosCacheKey = (usuarioId: string) =>
    `${LOGROS_CACHE_KEY_BASE}_${usuarioId}`;

  const guardarCache = (
    usuarioId: string,
    rankingUsuarios: Usuario[],
    usuarioActual: Usuario | null,
    posicionActual: number | null
  ) => {
    try {
      sessionStorage.setItem(
        getCacheKey(usuarioId),
        JSON.stringify({
          timestamp: Date.now(),
          usuarios: rankingUsuarios,
          miUsuario: usuarioActual,
          miPosicion: posicionActual,
        })
      );
    } catch {}
  };

  const leerCache = (usuarioId: string): RankingCache | null => {
    try {
      const raw = sessionStorage.getItem(getCacheKey(usuarioId));
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.usuarios)) return null;

      return {
        timestamp: Number(parsed.timestamp) || Date.now(),
        usuarios: parsed.usuarios,
        miUsuario: parsed.miUsuario ?? null,
        miPosicion: parsed.miPosicion ?? null,
      };
    } catch {
      return null;
    }
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

  const fetchEstadoSocial = async (myId: string) => {
    const [{ data: amistades }, { data: solicitudes }] = await Promise.all([
      supabase
        .from("amistades")
        .select("usuario_id, amigo_id")
        .or(`usuario_id.eq.${myId},amigo_id.eq.${myId}`),

      supabase
        .from("solicitudes_amistad")
        .select("solicitante_id, destinatario_id, estado")
        .eq("estado", "pendiente")
        .or(`solicitante_id.eq.${myId},destinatario_id.eq.${myId}`),
    ]);

    const amigos = new Set<string>();

    (amistades ?? []).forEach((row: any) => {
      const otroId = row.usuario_id === myId ? row.amigo_id : row.usuario_id;
      if (otroId) amigos.add(otroId);
    });

    const enviadas = new Set<string>();
    const recibidas = new Set<string>();

    (solicitudes ?? []).forEach((row: any) => {
      if (row.solicitante_id === myId) {
        enviadas.add(row.destinatario_id);
      }

      if (row.destinatario_id === myId) {
        recibidas.add(row.solicitante_id);
      }
    });

    setFriendIds(amigos);
    setSentRequests(enviadas);
    setReceivedRequests(recibidas);
  };

  useLayoutEffect(() => {
    try {
      const usuarioLocal = localStorage.getItem("user_id");
      if (!usuarioLocal) return;

      const cache = leerCache(usuarioLocal);
      if (!cache) return;

      setUsuarios(cache.usuarios);
      setMiUsuario(cache.miUsuario);
      setMiPosicion(cache.miPosicion);
      setCacheCargado(true);
      setCargandoInicial(false);
    } catch {}
  }, []);

  const fetchRanking = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: ranking } = await supabase
      .from("usuarios")
      .select("id, nombre, nivel, puntos, avatar_config")
      .eq("rol", "estudiante")
      .order("puntos", { ascending: false });

    let miUsuarioData: Usuario | null = null;
    let miPos: number | null = null;

    if (user) {
      const { data: misDatos } = await supabase
        .from("usuarios")
        .select("id, nombre, nivel, puntos, avatar_config")
        .eq("id", user.id)
        .single();

      miUsuarioData = normalizarUsuario(misDatos);

      const { data: todos } = await supabase
        .from("usuarios")
        .select("id")
        .eq("rol", "estudiante")
        .order("puntos", { ascending: false });

      const index = todos?.findIndex((u) => u.id === user.id) ?? -1;
      miPos = index >= 0 ? index + 1 : null;

      await fetchEstadoSocial(user.id);
    }

    const rankingUsuarios = ((ranking as any[]) ?? [])
      .map((u) => normalizarUsuario(u))
      .filter(Boolean) as Usuario[];

    setUsuarios(rankingUsuarios);
    setMiUsuario(miUsuarioData);
    setMiPosicion(miPos);

    if (user) {
      guardarCache(user.id, rankingUsuarios, miUsuarioData, miPos);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const usuarioLocal = localStorage.getItem("user_id");

        if (usuarioLocal) {
          const cache = leerCache(usuarioLocal);

          if (cache && !cacheCargado) {
            setUsuarios(cache.usuarios);
            setMiUsuario(cache.miUsuario);
            setMiPosicion(cache.miPosicion);
            setCargandoInicial(false);
          }
        }

        await fetchRanking();
      } catch (e) {
        console.error("Error cargando ranking:", e);
      } finally {
        setCargandoInicial(false);
      }
    };

    init();
  }, []);

  const getEstadoUsuario = (usuarioId: string) => {
    if (miUsuario?.id === usuarioId) return "self";
    if (friendIds.has(usuarioId)) return "friend";
    if (sentRequests.has(usuarioId)) return "sent";
    if (receivedRequests.has(usuarioId)) return "received";

    return "none";
  };

  const renderPosicion = (index: number) => {
    if (index === 0) return "1°";
    if (index === 1) return "2°";
    if (index === 2) return "3°";

    return `#${index + 1}`;
  };

  const getRankingClass = (index: number) => {
    if (index === 0) return "ranking-row is-first";
    if (index === 1) return "ranking-row is-second";
    if (index === 2) return "ranking-row is-third";

    return "ranking-row";
  };

  const usuariosAMostrar =
    vistaRanking === "amigos"
      ? usuarios.filter(
          (user) => user.id === miUsuario?.id || friendIds.has(user.id)
        )
      : usuarios.slice(0, 20);

  const tituloRanking =
    vistaRanking === "amigos" ? "Top de amigos" : "Top estudiantes";

  const mensajeRankingVacio =
    vistaRanking === "amigos"
      ? "Todavía no tienes amigos dentro del ranking."
      : "Todavía no hay estudiantes en el ranking.";

  const miIndiceEnVista = miUsuario
    ? usuariosAMostrar.findIndex((user) => user.id === miUsuario.id)
    : -1;

  const miPosicionVista =
    vistaRanking === "amigos"
      ? miIndiceEnVista >= 0
        ? miIndiceEnVista + 1
        : null
      : miPosicion;

  const tituloMiPosicion =
    vistaRanking === "amigos"
      ? "Tu posición entre amigos"
      : "Tu posición global";

  const renderSocialBadge = (usuarioId: string) => {
    const estado = getEstadoUsuario(usuarioId);

    if (estado === "self") {
      return <span className="ranking-social-badge is-self">Tú</span>;
    }

    if (estado === "friend") {
      return <span className="ranking-social-badge is-friend">Amigos</span>;
    }

    if (estado === "sent") {
      return (
        <span className="ranking-social-badge is-pending">
          Solicitud enviada
        </span>
      );
    }

    if (estado === "received") {
      return (
        <span className="ranking-social-badge is-pending">
          Te envió solicitud
        </span>
      );
    }

    return null;
  };

  const abrirPerfil = async (usuario: Usuario) => {
    setSelectedUsuario(usuario);

    if (miUsuario?.id) {
      void fetchEstadoSocial(miUsuario.id);
    }

    const cache = leerLogrosCache(usuario.id);

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
      .eq("usuario_id", usuario.id);

    if (errorRelaciones) {
      console.error("Error obteniendo relaciones:", errorRelaciones);
      setLoadingLogros(false);
      return;
    }

    if (!relaciones || relaciones.length === 0) {
      setLogros([]);
      guardarLogrosCache(usuario.id, []);
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
    guardarLogrosCache(usuario.id, parsed);
    setLoadingLogros(false);
  };

  const enviarSolicitud = async (toUser: Usuario) => {
    if (!miUsuario) return;
    if (toUser.id === miUsuario.id) return;

    setEnviandoSolicitudId(toUser.id);

    try {
      const { data: amistadExistente } = await supabase
        .from("amistades")
        .select("id")
        .or(
          `and(usuario_id.eq.${miUsuario.id},amigo_id.eq.${toUser.id}),and(usuario_id.eq.${toUser.id},amigo_id.eq.${miUsuario.id})`
        )
        .limit(1);

      if (amistadExistente && amistadExistente.length > 0) {
        setFriendIds((prev) => new Set([...Array.from(prev), toUser.id]));
        toast("Ya son amigos.");
        return;
      }

      const { data: solicitudExistente } = await supabase
        .from("solicitudes_amistad")
        .select("solicitante_id, destinatario_id")
        .eq("estado", "pendiente")
        .or(
          `and(solicitante_id.eq.${miUsuario.id},destinatario_id.eq.${toUser.id}),and(solicitante_id.eq.${toUser.id},destinatario_id.eq.${miUsuario.id})`
        )
        .limit(1);

      const solicitud = solicitudExistente?.[0] as any;

      if (solicitud) {
        if (solicitud.solicitante_id === miUsuario.id) {
          setSentRequests((prev) => new Set([...Array.from(prev), toUser.id]));
          toast("Ya habías enviado una solicitud.");
        } else {
          setReceivedRequests(
            (prev) => new Set([...Array.from(prev), toUser.id])
          );
          toast("Ese usuario ya te envió una solicitud. Revísala en Amigos.");
        }

        return;
      }

      const { error } = await supabase.from("solicitudes_amistad").insert([
        {
          solicitante_id: miUsuario.id,
          destinatario_id: toUser.id,
          estado: "pendiente",
        },
      ]);

      if (error) {
        toast.error("No se pudo enviar la solicitud.");
        return;
      }

      setSentRequests((prev) => new Set([...Array.from(prev), toUser.id]));
      toast.success("Solicitud enviada.");
    } finally {
      setEnviandoSolicitudId(null);
    }
  };

  return (
    <LayoutGeneral rol="estudiante">
      <style>{`
        .ranking-page,
          .ranking-profile-overlay {
            --ranking-text: var(--fcc-premium-text, var(--color-text));
            --ranking-heading: var(--fcc-premium-heading, var(--color-heading));
            --ranking-muted: var(--fcc-premium-muted, var(--color-muted));
            --ranking-accent: var(--fcc-premium-accent);
            --ranking-cyan: var(--fcc-premium-cyan);
            --ranking-border: var(--fcc-premium-border, var(--color-border));

            --ranking-avatar-core: color-mix(in srgb, var(--ranking-cyan) 18%, transparent);
            --ranking-avatar-a: color-mix(in srgb, var(--ranking-accent) 34%, transparent);
            --ranking-avatar-b: color-mix(in srgb, var(--ranking-cyan) 28%, transparent);
            --ranking-avatar-c: color-mix(in srgb, var(--ranking-accent) 26%, transparent);
            --ranking-avatar-border: color-mix(in srgb, var(--ranking-accent) 28%, transparent);
            --ranking-avatar-shadow-a: color-mix(in srgb, var(--ranking-accent) 4%, transparent);
            --ranking-avatar-shadow-b: color-mix(in srgb, var(--ranking-accent) 18%, transparent);
            --ranking-orbit-a: color-mix(in srgb, var(--ranking-accent) 20%, transparent);
            --ranking-orbit-b: color-mix(in srgb, var(--ranking-cyan) 22%, transparent);

            color: var(--ranking-text);
          }

          .ranking-page {
            display: grid;
            gap: 16px;
            min-width: 0;
          }

        .ranking-hero,
        .ranking-mi-posicion,
        .ranking-panel {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--ranking-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .ranking-hero {
          border-radius: 22px;
          padding: 16px 22px;
        }

        .ranking-hero-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }

        .ranking-kicker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--ranking-accent);
          font-size: 0.75rem;
          font-weight: 950;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .ranking-kicker::before,
        .ranking-kicker::after {
          content: "";
          width: 32px;
          height: 2px;
          border-radius: 999px;
          background: var(--ranking-accent);
        }

        .ranking-description {
          max-width: 620px;
          margin: 0 auto;
          color: var(--ranking-muted);
          font-size: 0.9rem;
          line-height: 1.4;
          font-weight: 700;
        }

        .ranking-mi-posicion {
          padding: clamp(18px, 2.8vw, 28px);
        }

        .ranking-section-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 18px;
          color: var(--ranking-heading);
          text-align: center;
          font-size: clamp(1.1rem, 1.7vw, 1.35rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .ranking-section-title::before,
        .ranking-section-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--ranking-accent) 55%, transparent)
          );
        }

        .ranking-section-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--ranking-accent) 55%, transparent),
            transparent
          );
        }

        .ranking-user-card {
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 18px;
          border-radius: 28px;
          padding: 20px;
          background:
            linear-gradient(
              135deg,
              color-mix(
                in srgb,
                var(--fcc-premium-surface-strong) 74%,
                transparent
              ),
              color-mix(
                in srgb,
                var(--fcc-premium-surface-soft) 92%,
                transparent
              )
            );
          border: 1px solid color-mix(
            in srgb,
            var(--ranking-accent) 24%,
            var(--ranking-border)
          );
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .ranking-position-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 86px;
          min-height: 70px;
          border-radius: 22px;
          color: var(--ranking-accent);
          background: color-mix(in srgb, var(--ranking-accent) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--ranking-accent) 20%, transparent);
          font-size: clamp(1.75rem, 3.3vw, 2.75rem);
          font-weight: 950;
          letter-spacing: -0.05em;
        }

        .ranking-user-name {
          min-width: 0;
          color: var(--ranking-heading);
          font-size: clamp(1.15rem, 2vw, 1.55rem);
          font-weight: 950;
          line-height: 1.12;
          letter-spacing: -0.04em;
          word-break: break-word;
        }

        .ranking-points {
          justify-self: end;
          color: var(--ranking-accent);
          font-size: clamp(1rem, 1.5vw, 1.2rem);
          font-weight: 950;
          white-space: nowrap;
        }

        .ranking-panel {
          padding: clamp(14px, 2.4vw, 20px);
        }
        
        .ranking-tabs {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .ranking-tab {
          min-height: 38px;
          border-radius: 999px;
          padding: 0 16px;
          color: var(--ranking-accent);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 78%,
            transparent
          );
          border: 1px solid color-mix(
            in srgb,
            var(--ranking-accent) 18%,
            var(--ranking-border)
          );
          font-size: 0.86rem;
          font-weight: 950;
          transition:
            transform 160ms ease,
            background 160ms ease,
            border-color 160ms ease;
        }

        .ranking-tab:hover {
          transform: translateY(-1px);
          border-color: color-mix(
            in srgb,
            var(--ranking-accent) 34%,
            var(--ranking-border)
          );
        }

        .ranking-tab.is-active {
          color: #ffffff;
          background: linear-gradient(
            135deg,
            var(--ranking-accent),
            color-mix(in srgb, var(--ranking-accent) 72%, #38bdf8)
          );
          border-color: transparent;
          box-shadow: 0 14px 26px
            color-mix(in srgb, var(--ranking-accent) 20%, transparent);
        }

        .theme-oscuro .ranking-tab.is-active {
          color: #050505;
        }

        .ranking-list {
          display: grid;
          gap: 12px;
        }

        .ranking-row {
          position: relative;
          width: 100%;
          overflow: hidden;
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          min-width: 0;
          border-radius: 24px;
          padding: 14px 16px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--ranking-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--ranking-text);
          text-align: left;
          cursor: pointer;
          transition:
            transform 170ms ease,
            box-shadow 170ms ease,
            border-color 170ms ease;
        }

        .ranking-row:hover {
          transform: translateY(-1px);
          border-color: var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow-hover);
        }

        .ranking-row.is-first {
          border-color: color-mix(in srgb, #facc15 48%, var(--ranking-border));
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, #facc15 13%, var(--fcc-premium-surface)),
              var(--fcc-premium-surface-soft)
            );
        }

        .ranking-row.is-second {
          border-color: color-mix(in srgb, #94a3b8 44%, var(--ranking-border));
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, #94a3b8 12%, var(--fcc-premium-surface)),
              var(--fcc-premium-surface-soft)
            );
        }

        .ranking-row.is-third {
          border-color: color-mix(in srgb, #fb923c 42%, var(--ranking-border));
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, #fb923c 12%, var(--fcc-premium-surface)),
              var(--fcc-premium-surface-soft)
            );
        }

        .ranking-medal {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 54px;
          min-height: 44px;
          border-radius: 16px;
          color: var(--ranking-accent);
          background: color-mix(in srgb, var(--ranking-accent) 9%, transparent);
          border: 1px solid color-mix(in srgb, var(--ranking-accent) 18%, transparent);
          font-size: 1rem;
          font-weight: 950;
          line-height: 1;
        }

        .ranking-row.is-first .ranking-medal {
          color: #a16207;
          background: color-mix(in srgb, #facc15 22%, transparent);
          border-color: color-mix(in srgb, #facc15 38%, transparent);
        }

        .ranking-row.is-second .ranking-medal {
          color: #64748b;
          background: color-mix(in srgb, #94a3b8 20%, transparent);
          border-color: color-mix(in srgb, #94a3b8 34%, transparent);
        }

        .ranking-row.is-third .ranking-medal {
          color: #c2410c;
          background: color-mix(in srgb, #fb923c 20%, transparent);
          border-color: color-mix(in srgb, #fb923c 34%, transparent);
        }

        .ranking-avatar-stage {
          position: relative;
          flex: 0 0 auto;
          width: var(--ranking-avatar-size);
          height: var(--ranking-avatar-size);
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .ranking-avatar-stage::before {
          content: "";
          position: absolute;
          width: 82%;
          height: 82%;
          border-radius: 999px;
          background:
            radial-gradient(circle, var(--ranking-avatar-core), transparent 62%),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--ranking-avatar-a) 42deg,
              transparent 84deg,
              var(--ranking-avatar-b) 145deg,
              transparent 210deg,
              var(--ranking-avatar-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -3;
        }

        .ranking-avatar-stage::after {
          content: "";
          position: absolute;
          width: 70%;
          height: 70%;
          border-radius: 999px;
          border: 1px solid var(--ranking-avatar-border);
          box-shadow:
            0 0 0 14px var(--ranking-avatar-shadow-a),
            0 0 42px var(--ranking-avatar-shadow-b);
          z-index: -2;
        }

        .ranking-avatar-orbit {
          position: absolute;
          inset: 17%;
          z-index: -1;
          border-radius: 999px;
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--ranking-orbit-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--ranking-orbit-b) 60% 64%,
              transparent 64% 100%
            );
          transform: rotate(-18deg);
          opacity: 0.95;
        }

        .ranking-avatar-render {
          position: relative;
          z-index: 2;
        }

        .ranking-name-block {
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .ranking-name {
          min-width: 0;
          color: var(--ranking-heading);
          font-weight: 950;
          line-height: 1.12;
          letter-spacing: -0.03em;
          word-break: break-word;
        }

        .ranking-row.is-first .ranking-name,
        .ranking-row.is-second .ranking-name,
        .ranking-row.is-third .ranking-name {
          font-size: clamp(1.08rem, 1.8vw, 1.35rem);
        }

        .ranking-row:not(.is-first):not(.is-second):not(.is-third) .ranking-name {
          font-size: clamp(0.95rem, 1.3vw, 1.1rem);
        }

        .ranking-social-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 25px;
          border-radius: 999px;
          padding: 0 10px;
          font-size: 0.72rem;
          font-weight: 950;
          line-height: 1;
        }

        .ranking-social-badge.is-self {
          color: var(--ranking-accent);
          background: color-mix(in srgb, var(--ranking-accent) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--ranking-accent) 18%, transparent);
        }

        .ranking-social-badge.is-friend {
          color: #ffffff;
          background: linear-gradient(135deg, #16a34a, #22c55e);
        }

        .ranking-social-badge.is-pending {
          color: #ffffff;
          background: linear-gradient(135deg, #d97706, #f59e0b);
        }

        .ranking-empty {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-radius: 24px;
          padding: 28px 18px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px dashed color-mix(
            in srgb,
            var(--ranking-accent) 34%,
            transparent
          );
        }

        .ranking-empty-text {
          max-width: 460px;
          color: var(--ranking-muted);
          font-size: 0.96rem;
          line-height: 1.5;
          font-weight: 750;
        }

        .ranking-skeleton-panel {
          padding: clamp(14px, 2.4vw, 20px);
          border-radius: 28px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--ranking-border);
          box-shadow:
            var(--fcc-premium-shadow-soft),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
        }

        .ranking-skeleton-list {
          display: grid;
          gap: 12px;
        }

        .ranking-skeleton-row {
          border-radius: 24px;
          padding: 18px;
          background:
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--ranking-border);
        }

        .ranking-skeleton-line {
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--ranking-accent) 16%,
            var(--fcc-premium-surface-strong)
          );
        }

        .ranking-profile-overlay {
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

        .ranking-profile-modal {
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
          border: 1px solid var(--ranking-border);
          box-shadow:
            var(--fcc-premium-shadow-hover),
            inset 0 1px 0 color-mix(
              in srgb,
              var(--fcc-premium-surface-strong) 68%,
              transparent
            );
          color: var(--ranking-text);
        }

        .ranking-profile-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--ranking-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 76%,
            transparent
          );
          border: 1px solid var(--ranking-border);
          transition:
            transform 170ms ease,
            color 170ms ease,
            border-color 170ms ease;
        }

        .ranking-profile-close:hover {
          transform: translateY(-1px);
          color: #ef4444;
          border-color: color-mix(in srgb, #ef4444 34%, var(--ranking-border));
        }

        .ranking-profile-header {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: clamp(16px, 3vw, 26px);
          padding-right: 34px;
        }

        .ranking-profile-name {
          color: var(--ranking-heading);
          font-size: clamp(1.75rem, 4vw, 3rem);
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: -0.055em;
          word-break: break-word;
        }

        .ranking-profile-meta {
          margin-top: 10px;
          color: var(--ranking-muted);
          font-size: clamp(1rem, 1.7vw, 1.15rem);
          font-weight: 800;
        }

        .ranking-profile-social {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }

        .ranking-profile-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          border-radius: 14px;
          padding: 0 15px;
          color: #ffffff;
          background: linear-gradient(
            135deg,
            var(--ranking-accent),
            color-mix(in srgb, var(--ranking-accent) 72%, #38bdf8)
          );
          box-shadow: 0 14px 28px
            color-mix(in srgb, var(--ranking-accent) 24%, transparent);
          font-size: 0.88rem;
          font-weight: 950;
          transition:
            transform 170ms ease,
            filter 170ms ease;
        }

        .theme-oscuro .ranking-profile-action {
          color: #050505;
        }

        .ranking-profile-action:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: saturate(1.04);
        }

        .ranking-profile-action:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .ranking-profile-note {
          color: var(--ranking-muted);
          font-size: 0.85rem;
          font-weight: 750;
        }

        .ranking-logros-section {
          margin-top: 24px;
        }

        .ranking-logros-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 14px;
          color: var(--ranking-heading);
          text-align: center;
          font-size: clamp(1.1rem, 1.8vw, 1.4rem);
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .ranking-logros-title::before,
        .ranking-logros-title::after {
          content: "";
          width: 42px;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            color-mix(in srgb, var(--ranking-accent) 55%, transparent)
          );
        }

        .ranking-logros-title::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--ranking-accent) 55%, transparent),
            transparent
          );
        }

        .ranking-logros-empty {
          min-height: 120px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          padding: 18px;
          text-align: center;
          color: var(--ranking-muted);
          background: color-mix(
            in srgb,
            var(--fcc-premium-surface-strong) 68%,
            transparent
          );
          border: 1px dashed color-mix(
            in srgb,
            var(--ranking-accent) 26%,
            transparent
          );
          font-weight: 750;
        }

        @media (max-width: 640px) {
          .ranking-hero {
            padding: 14px 16px;
          }

          .ranking-kicker {
            font-size: 0.7rem;
            letter-spacing: 0.18em;
          }

          .ranking-description {
            font-size: 0.86rem;
          }

          .ranking-user-card,
          .ranking-row {
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 10px;
            padding: 14px;
          }

          .ranking-user-card {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
          }

          .ranking-points {
            justify-self: center;
          }

          .ranking-position-pill {
            min-width: 92px;
            min-height: 70px;
          }

          .ranking-row .ranking-points {
            grid-column: 1 / -1;
            justify-self: center;
          }

          .ranking-profile-header {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
            padding-right: 0;
            padding-top: 18px;
          }

          .ranking-profile-social {
            justify-content: center;
          }
        }
      `}</style>

      <div className="ranking-page">
        <section className="ranking-hero">
          <div className="ranking-hero-inner">
            <p className="ranking-kicker">Ranking global</p>

            <p className="ranking-description">
              Consulta las posiciones por puntos acumulados en FCC Academy.
            </p>
          </div>
        </section>

        {cargandoInicial ? (
          <>
            <section className="ranking-skeleton-panel animate-pulse">
              <div className="ranking-skeleton-line h-5 w-40 mb-4 mx-auto" />

              <div className="ranking-skeleton-row">
                <div className="flex items-center gap-4">
                  <div className="ranking-skeleton-line h-10 w-14" />
                  <div className="ranking-skeleton-line h-20 w-20 rounded-full" />
                  <div className="ranking-skeleton-line h-5 w-44" />
                </div>
              </div>
            </section>

            <section className="ranking-skeleton-panel animate-pulse">
              <div className="ranking-skeleton-list">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="ranking-skeleton-row">
                    <div className="flex items-center gap-4">
                      <div className="ranking-skeleton-line h-10 w-14" />
                      <div className="ranking-skeleton-line h-16 w-16 rounded-full" />
                      <div className="ranking-skeleton-line h-5 w-44" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {miUsuario && miPosicionVista && (
              <section className="ranking-mi-posicion">
                <h2 className="ranking-section-title">{tituloMiPosicion}</h2>

                <div className="ranking-user-card">
                  <span className="ranking-position-pill">#{miPosicionVista}</span>

                  <AvatarRanking
                    config={miUsuario.avatar_config}
                    size={112}
                  />

                  <span className="ranking-user-name">{miUsuario.nombre}</span>

                  <span className="ranking-points">
                    {miUsuario.puntos} pts
                  </span>
                </div>
              </section>
            )}

            <section className="ranking-panel">
              <h2 className="ranking-section-title">{tituloRanking}</h2>

              <div className="ranking-tabs">
                <button
                  type="button"
                  className={`ranking-tab ${
                    vistaRanking === "global" ? "is-active" : ""
                  }`}
                  onClick={() => setVistaRanking("global")}
                >
                  Global
                </button>

                <button
                  type="button"
                  className={`ranking-tab ${
                    vistaRanking === "amigos" ? "is-active" : ""
                  }`}
                  onClick={() => setVistaRanking("amigos")}
                >
                  Mis amigos
                </button>
              </div>

              {usuariosAMostrar.length === 0 ? (
                <div className="ranking-empty">
                  <p className="ranking-empty-text">{mensajeRankingVacio}</p>
                </div>
              ) : (
                <div className="ranking-list">
                  {usuariosAMostrar.map((user, index) => (
                    <button
                      key={user.id}
                      type="button"
                      className={getRankingClass(index)}
                      onClick={() => abrirPerfil(user)}
                    >
                      <span className="ranking-medal">
                        {renderPosicion(index)}
                      </span>

                      <AvatarRanking
                        config={user.avatar_config}
                        size={index < 3 ? 92 : 76}
                      />

                      <span className="ranking-name-block">
                        <span className="ranking-name">{user.nombre}</span>
                        {renderSocialBadge(user.id)}
                      </span>

                      <span className="ranking-points">
                        {user.puntos} pts
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {selectedUsuario &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="ranking-profile-overlay"
            onClick={() => setSelectedUsuario(null)}
          >
            <div
              className="ranking-profile-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="ranking-profile-close"
                onClick={() => setSelectedUsuario(null)}
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.4} />
              </button>

              <div className="ranking-profile-header">
                <AvatarRanking
                  config={selectedUsuario.avatar_config}
                  size={230}
                />

                <div>
                  <h3 className="ranking-profile-name">
                    {selectedUsuario.nombre}
                  </h3>

                  <p className="ranking-profile-meta">
                    Nivel {selectedUsuario.nivel ?? 0} •{" "}
                    {selectedUsuario.puntos ?? 0} pts
                  </p>

                  <div className="ranking-profile-social">
                    {renderSocialBadge(selectedUsuario.id)}

                      {getEstadoUsuario(selectedUsuario.id) === "none" && (
                        <button
                          type="button"
                          className="ranking-profile-action"
                          onClick={() => enviarSolicitud(selectedUsuario)}
                          disabled={enviandoSolicitudId === selectedUsuario.id}
                        >
                          <UserPlus size={17} strokeWidth={2.4} />
                          <span>
                            {enviandoSolicitudId === selectedUsuario.id
                              ? "Enviando..."
                              : "Enviar solicitud"}
                          </span>
                        </button>
                      )}
                    </div>
                </div>
              </div>

              <div className="ranking-logros-section">
                <h4 className="ranking-logros-title">Logros desbloqueados</h4>

                {loadingLogros ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-24 rounded-xl"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--ranking-accent) 12%, transparent)",
                        }}
                      />
                    ))}
                  </div>
                ) : logros.length === 0 ? (
                  <div className="ranking-logros-empty">
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