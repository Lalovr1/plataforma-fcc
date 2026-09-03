"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Clock3,
  Medal,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/utils/supabaseClient";
import RenderizadorAvatar, {
  AvatarConfig,
} from "@/components/RenderizadorAvatar";
import GridLogros from "@/components/GridLogros";
import CargadorFCC from "@/components/CargadorFCC";
import EstadoErrorCargaFCC from "@/components/EstadoErrorCargaFCC";

interface Usuario {
  id: string;
  nombre: string;
  puntos: number;
  nivel: number | null;
  avatar_config: AvatarConfig | null;
}

interface LogroModal {
  id: string;
  titulo: string;
  descripcion?: string;
  icono_url: string;
}

const LIMITE_PREPARACION_VISUAL_PERFIL_MS = 30_000;
const DURACION_MINIMA_APERTURA_PERFIL_MS = 950;

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

function nombreCorto(nombre?: string) {
  if (!nombre) return "Sin asignar";
  return nombre.split(" ").slice(0, 2).join(" ");
}

function AvatarRanking({
  config,
  size,
  className = "",
  onReady,
}: {
  config: AvatarConfig | null;
  size: number;
  className?: string;
  onReady?: () => void;
}) {
  return (
    <div
      className={`ranking-avatar-stage ${className}`}
      style={{ "--ranking-avatar-size": `${size}px` } as CSSProperties}
    >
      <span className="ranking-avatar-orbit" />

      <div className="ranking-avatar-render">
        <RenderizadorAvatar
          config={config ?? defaultAvatar}
          size={size}
          onReady={onReady}
        />
      </div>
    </div>
  );
}

export default function WidgetRanking() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [miUsuario, setMiUsuario] = useState<Usuario | null>(null);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [reintento, setReintento] = useState(0);

  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [receivedRequests, setReceivedRequests] = useState<Set<string>>(
    new Set()
  );

  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [preparandoPerfilId, setPreparandoPerfilId] = useState<string | null>(
    null
  );
  const [logros, setLogros] = useState<LogroModal[]>([]);
  const [loadingLogros, setLoadingLogros] = useState(false);
  const [errorLogrosPerfil, setErrorLogrosPerfil] = useState(false);
  const [enviandoSolicitudId, setEnviandoSolicitudId] = useState<string | null>(
    null
  );
  const [perfilVisualListo, setPerfilVisualListo] = useState(false);
  const [avatarPerfilListo, setAvatarPerfilListo] = useState(false);
  const [logrosPerfilListos, setLogrosPerfilListos] = useState(false);
  const inicioPreparacionPerfilRef = useRef(0);

  useEffect(() => {
    if (
      !selectedUsuario ||
      !preparandoPerfilId ||
      selectedUsuario.id !== preparandoPerfilId ||
      perfilVisualListo ||
      !avatarPerfilListo ||
      !logrosPerfilListos
    ) {
      return;
    }

    let cancelado = false;
    let frame1: number | null = null;
    let frame2: number | null = null;
    const idPreparado = preparandoPerfilId;
    const transcurrido =
      performance.now() - inicioPreparacionPerfilRef.current;
    const espera = Math.max(
      0,
      DURACION_MINIMA_APERTURA_PERFIL_MS - transcurrido
    );

    const timer = window.setTimeout(() => {
      frame1 = window.requestAnimationFrame(() => {
        frame2 = window.requestAnimationFrame(() => {
          if (cancelado) return;

          setPerfilVisualListo(true);
          setPreparandoPerfilId((actual) =>
            actual === idPreparado ? null : actual
          );
        });
      });
    }, espera);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      if (frame1 !== null) window.cancelAnimationFrame(frame1);
      if (frame2 !== null) window.cancelAnimationFrame(frame2);
    };
  }, [
    selectedUsuario,
    preparandoPerfilId,
    perfilVisualListo,
    avatarPerfilListo,
    logrosPerfilListos,
  ]);

  useEffect(() => {
    if (
      !selectedUsuario ||
      !preparandoPerfilId ||
      selectedUsuario.id !== preparandoPerfilId ||
      perfilVisualListo
    ) {
      return;
    }

    const idPreparado = preparandoPerfilId;
    const transcurrido =
      performance.now() - inicioPreparacionPerfilRef.current;
    const restante = Math.max(
      0,
      LIMITE_PREPARACION_VISUAL_PERFIL_MS - transcurrido
    );

    const limite = window.setTimeout(() => {
      setPerfilVisualListo(true);
      setPreparandoPerfilId((actual) =>
        actual === idPreparado ? null : actual
      );
    }, restante);

    return () => window.clearTimeout(limite);
  }, [selectedUsuario, preparandoPerfilId, perfilVisualListo]);

  const fetchEstadoSocial = async (myId: string) => {
    const [
      { data: amistades, error: amistadesError },
      { data: solicitudes, error: solicitudesError },
    ] = await Promise.all([
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

    if (amistadesError || solicitudesError) {
      throw amistadesError ?? solicitudesError;
    }

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

  useEffect(() => {
    const fetchRanking = async () => {
      setCargandoInicial(true);
      setErrorCarga(false);

      try {
        const [rankingResult, authResult] = await Promise.all([
          supabase
            .from("usuarios")
            .select("id, nombre, nivel, puntos, avatar_config")
            .eq("rol", "estudiante")
            .order("puntos", { ascending: false })
            .limit(5),
          supabase.auth.getUser(),
        ]);

        if (rankingResult.error) throw rankingResult.error;
        if (authResult.error) throw authResult.error;

        const parsed = ((rankingResult.data as any[]) ?? [])
          .map((value) => normalizarUsuario(value))
          .filter(Boolean) as Usuario[];

        setUsuarios(parsed);

        const authUser = authResult.data.user;
        if (!authUser) {
          setMiUsuario(null);
          return;
        }

        const { data: currentData, error: currentError } = await supabase
          .from("usuarios")
          .select("id, nombre, nivel, puntos, avatar_config, rol")
          .eq("id", authUser.id)
          .single();

        if (currentError) throw currentError;

        if (currentData?.rol === "estudiante") {
          const current = normalizarUsuario(currentData);
          setMiUsuario(current);
          await fetchEstadoSocial(authUser.id);
        } else {
          setMiUsuario(null);
          setFriendIds(new Set());
          setSentRequests(new Set());
          setReceivedRequests(new Set());
        }
      } catch (error) {
        console.error("Error cargando widget ranking:", error);
        setErrorCarga(true);
      } finally {
        setCargandoInicial(false);
      }
    };

    void fetchRanking();
  }, [reintento]);

  const getEstadoUsuario = (usuarioId: string) => {
    if (!miUsuario) return "none";
    if (miUsuario.id === usuarioId) return "self";
    if (friendIds.has(usuarioId)) return "friend";
    if (sentRequests.has(usuarioId)) return "sent";
    if (receivedRequests.has(usuarioId)) return "received";

    return "none";
  };

  const renderSocialBadge = (usuarioId: string) => {
    const estado = getEstadoUsuario(usuarioId);

    if (estado === "self") {
      return <span className="ranking-social-badge is-self">Tú</span>;
    }

    if (estado === "friend") {
      return (
        <span className="ranking-social-badge is-friend">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          Amigos
        </span>
      );
    }

    if (estado === "sent") {
      return (
        <span className="ranking-social-badge is-pending">
          <Clock3 size={14} strokeWidth={2.5} />
          Solicitud enviada
        </span>
      );
    }

    if (estado === "received") {
      return (
        <span className="ranking-social-badge is-pending">
          <Clock3 size={14} strokeWidth={2.5} />
          Te envió solicitud
        </span>
      );
    }

    return null;
  };

  const abrirPerfil = async (usuario: Usuario) => {
    if (preparandoPerfilId) return;

    const inicio = performance.now();
    const modalYaAbierto =
      selectedUsuario?.id === usuario.id && perfilVisualListo;

    inicioPreparacionPerfilRef.current = inicio;
    setPreparandoPerfilId(usuario.id);
    setLogros([]);
    setLoadingLogros(true);
    setErrorLogrosPerfil(false);

    if (!modalYaAbierto) {
      setPerfilVisualListo(false);
      setAvatarPerfilListo(false);
      setLogrosPerfilListos(false);
      setSelectedUsuario(usuario);
    }

    const estadoSocialPromise = miUsuario?.id
      ? fetchEstadoSocial(miUsuario.id).catch((error) => {
          console.error("Error actualizando estado social:", error);
        })
      : Promise.resolve();

    let parsed: LogroModal[] = [];

    try {
      const { data: relaciones, error: errorRelaciones } = await supabase
        .from("logros_usuarios")
        .select("logro_id")
        .eq("usuario_id", usuario.id);

      if (errorRelaciones) throw errorRelaciones;

      if (relaciones && relaciones.length > 0) {
        const logroIds = relaciones.map((r: any) => r.logro_id);
        const { data: logrosData, error: errorLogros } = await supabase
          .from("logros")
          .select("id, nombre, descripcion, icono_url")
          .in("id", logroIds);

        if (errorLogros) throw errorLogros;

        parsed = (logrosData ?? []).map((l: any) => ({
          id: l.id,
          titulo: l.nombre,
          descripcion: l.descripcion,
          icono_url: l.icono_url,
        }));
      }

      await estadoSocialPromise;
      setLogros(parsed);
      setErrorLogrosPerfil(false);

      if (parsed.length === 0) {
        setLogrosPerfilListos(true);
      }
    } catch (error) {
      console.error("Error preparando perfil del ranking:", error);
      await estadoSocialPromise;
      setLogros([]);
      setErrorLogrosPerfil(true);
      setLogrosPerfilListos(true);
    }

    setLoadingLogros(false);

    if (modalYaAbierto) {
      setPreparandoPerfilId(null);
    }
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

  const cerrarPerfil = () => {
    setSelectedUsuario(null);
    setPreparandoPerfilId(null);
    setPerfilVisualListo(false);
    setAvatarPerfilListo(false);
    setLogrosPerfilListos(false);
    setLoadingLogros(false);
    setErrorLogrosPerfil(false);
    setLogros([]);
  };

  if (cargandoInicial) {
    return (
      <CargadorFCC
        compacto
        mensaje="Actualizando ranking"
        detalle="Consultando posiciones y avatares vigentes…"
      />
    );
  }

  if (errorCarga) {
    return (
      <EstadoErrorCargaFCC
        compacto
        titulo="No se pudo confirmar el ranking"
        detalle="No se mostraron posiciones anteriores. Reintenta cuando la conexión esté estable."
        onRetry={() => setReintento((valor) => valor + 1)}
      />
    );
  }

  return (
    <>
      <style>{`
        .widget-ranking {
          container-type: size;
          container-name: fcc-ranking-slot;
        }

        .fcc-widget-ranking-card,
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

        .fcc-widget-ranking-card {
          --fcc-widget-gap: 8px;
          --fcc-widget-row-py: 7px;
          --fcc-widget-row-px: 12px;
          --fcc-widget-avatar-stage-top: 64px;
          --fcc-widget-avatar-stage-small: 52px;
          --fcc-widget-avatar-scale-top: 0.74;
          --fcc-widget-avatar-scale-small: 0.68;
          --fcc-widget-name: 1.03rem;
          --fcc-widget-name-small: 0.92rem;
          --fcc-widget-points: 0.92rem;
          --fcc-widget-points-small: 0.82rem;
          --fcc-widget-place-font: 0.72rem;
          --fcc-widget-medal: 30px;

          position: relative;
          overflow: hidden;
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          border-radius: 28px;
          padding: 14px;
          background:
            radial-gradient(
              circle at 10% 12%,
              color-mix(in srgb, var(--ranking-cyan) 8%, transparent),
              transparent 28%
            ),
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

        .fcc-widget-ranking-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              130deg,
              transparent 0 64%,
              color-mix(in srgb, var(--ranking-cyan) 4%, transparent) 64% 68%,
              transparent 68% 100%
            ),
            radial-gradient(
              circle at 88% 12%,
              color-mix(in srgb, var(--ranking-accent) 5%, transparent),
              transparent 24%
            );
          opacity: 0.95;
        }

        .fcc-widget-ranking-header {
          position: relative;
          z-index: 2;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .fcc-widget-ranking-header::before,
        .fcc-widget-ranking-header::after {
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

        .fcc-widget-ranking-header::after {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--ranking-accent) 55%, transparent),
            transparent
          );
        }

        .fcc-widget-ranking-title-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: var(--ranking-accent);
          background: color-mix(in srgb, var(--ranking-accent) 9%, transparent);
          border: 1px solid color-mix(in srgb, var(--ranking-accent) 18%, transparent);
          flex: 0 0 auto;
        }

        .fcc-widget-ranking-title {
          margin: 0;
          color: var(--ranking-heading);
          font-size: clamp(1.08rem, 1.4vw, 1.3rem);
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .fcc-widget-ranking-list {
          position: relative;
          z-index: 1;
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-rows: repeat(5, minmax(0, 1fr));
          gap: var(--fcc-widget-gap);
        }

        .fcc-widget-ranking-row {
          position: relative;
          width: 100%;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          border-radius: 22px;
          padding: var(--fcc-widget-row-py) var(--fcc-widget-row-px);
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

        .fcc-widget-ranking-row::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              128deg,
              transparent 0 62%,
              color-mix(in srgb, var(--ranking-cyan) 5%, transparent) 62% 65%,
              transparent 65% 72%,
              color-mix(in srgb, var(--ranking-accent) 4%, transparent) 72% 74%,
              transparent 74% 100%
            );
          opacity: 0.95;
        }

        .fcc-widget-ranking-row:hover {
          transform: translateY(-1px);
          border-color: var(--fcc-premium-border-strong);
          box-shadow: var(--fcc-premium-shadow-hover);
        }

        .fcc-widget-ranking-row.is-first {
          border-color: color-mix(in srgb, #facc15 48%, var(--ranking-border));
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, #facc15 13%, var(--fcc-premium-surface)),
              var(--fcc-premium-surface-soft)
            );
        }

        .fcc-widget-ranking-row.is-second {
          border-color: color-mix(in srgb, #94a3b8 44%, var(--ranking-border));
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, #94a3b8 12%, var(--fcc-premium-surface)),
              var(--fcc-premium-surface-soft)
            );
        }

        .fcc-widget-ranking-row.is-third {
          border-color: color-mix(in srgb, #fb923c 42%, var(--ranking-border));
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, #fb923c 12%, var(--fcc-premium-surface)),
              var(--fcc-premium-surface-soft)
            );
        }

        .fcc-widget-ranking-main {
          position: relative;
          z-index: 2;
          min-width: 0;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
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
          transition: transform 210ms ease;
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
          transition: transform 210ms ease;
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
          transition: transform 240ms ease;
        }

        .ranking-avatar-render {
          position: relative;
          z-index: 2;
        }

        .fcc-dashboard-ranking-avatar {
          width: var(--fcc-widget-avatar-stage-top);
          height: var(--fcc-widget-avatar-stage-top);
        }

        .fcc-widget-ranking-row.is-small .fcc-dashboard-ranking-avatar {
          width: var(--fcc-widget-avatar-stage-small);
          height: var(--fcc-widget-avatar-stage-small);
        }

        .fcc-dashboard-ranking-avatar .ranking-avatar-render {
          transform: scale(var(--fcc-widget-avatar-scale-top));
          transform-origin: center;
        }

        .fcc-widget-ranking-row.is-small
          .fcc-dashboard-ranking-avatar .ranking-avatar-render {
          transform: scale(var(--fcc-widget-avatar-scale-small));
        }

        .fcc-widget-ranking-row:hover .ranking-avatar-stage::before {
          transform: rotate(5deg) scale(1.02);
        }

        .fcc-widget-ranking-row:hover .ranking-avatar-stage::after {
          transform: scale(1.025);
        }

        .fcc-widget-ranking-row:hover .ranking-avatar-orbit {
          transform: rotate(-6deg) scale(1.02);
        }

        .fcc-widget-ranking-copy {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .fcc-widget-ranking-name {
          min-width: 0;
          color: var(--ranking-heading);
          font-size: var(--fcc-widget-name);
          font-weight: 950;
          line-height: 1.05;
          letter-spacing: -0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fcc-widget-ranking-row.is-small .fcc-widget-ranking-name {
          font-size: var(--fcc-widget-name-small);
        }

        .fcc-widget-ranking-points {
          color: var(--ranking-accent);
          font-size: var(--fcc-widget-points);
          font-weight: 950;
          line-height: 1;
        }

        .fcc-widget-ranking-row.is-small .fcc-widget-ranking-points {
          font-size: var(--fcc-widget-points-small);
        }

        .fcc-widget-ranking-place {
          position: relative;
          z-index: 2;
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-width: 74px;
          max-width: 90px;
        }

        .fcc-widget-ranking-place-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 10px;
          border-radius: 16px;
          color: var(--ranking-accent);
          background: color-mix(in srgb, var(--ranking-accent) 9%, transparent);
          border: 1px solid color-mix(in srgb, var(--ranking-accent) 18%, transparent);
          font-size: var(--fcc-widget-place-font);
          font-weight: 950;
          line-height: 1;
          white-space: nowrap;
        }

        .fcc-widget-ranking-medal {
          width: var(--fcc-widget-medal);
          height: var(--fcc-widget-medal);
          display: grid;
          place-items: center;
          border-radius: 999px;
          color: var(--ranking-accent);
          background: color-mix(in srgb, var(--ranking-accent) 9%, transparent);
          border: 1px solid color-mix(in srgb, var(--ranking-accent) 18%, transparent);
        }

        .fcc-widget-ranking-row.is-first .fcc-widget-ranking-place-label,
        .fcc-widget-ranking-row.is-first .fcc-widget-ranking-medal {
          color: #a16207;
          background: color-mix(in srgb, #facc15 22%, transparent);
          border-color: color-mix(in srgb, #facc15 38%, transparent);
        }

        .fcc-widget-ranking-row.is-second .fcc-widget-ranking-place-label,
        .fcc-widget-ranking-row.is-second .fcc-widget-ranking-medal {
          color: #64748b;
          background: color-mix(in srgb, #94a3b8 20%, transparent);
          border-color: color-mix(in srgb, #94a3b8 34%, transparent);
        }

        .fcc-widget-ranking-row.is-third .fcc-widget-ranking-place-label,
        .fcc-widget-ranking-row.is-third .fcc-widget-ranking-medal {
          color: #c2410c;
          background: color-mix(in srgb, #fb923c 20%, transparent);
          border-color: color-mix(in srgb, #fb923c 34%, transparent);
        }

        @container fcc-ranking-slot (min-height: 610px) {
          .fcc-widget-ranking-card {
            --fcc-widget-gap: 9px;
            --fcc-widget-row-py: 8px;
            --fcc-widget-avatar-stage-top: 72px;
            --fcc-widget-avatar-stage-small: 58px;
            --fcc-widget-avatar-scale-top: 0.84;
            --fcc-widget-avatar-scale-small: 0.76;
            --fcc-widget-name: 1.08rem;
            --fcc-widget-name-small: 0.96rem;
            --fcc-widget-points: 0.96rem;
            --fcc-widget-points-small: 0.85rem;
            --fcc-widget-place-font: 0.74rem;
            --fcc-widget-medal: 32px;
            padding: 15px;
          }
        }

        @container fcc-ranking-slot (max-height: 515px) {
          .fcc-widget-ranking-card {
            --fcc-widget-gap: 5px;
            --fcc-widget-row-py: 4px;
            --fcc-widget-row-px: 10px;
            --fcc-widget-avatar-stage-top: 50px;
            --fcc-widget-avatar-stage-small: 42px;
            --fcc-widget-avatar-scale-top: 0.56;
            --fcc-widget-avatar-scale-small: 0.54;
            --fcc-widget-name: 0.92rem;
            --fcc-widget-name-small: 0.84rem;
            --fcc-widget-points: 0.82rem;
            --fcc-widget-points-small: 0.76rem;
            --fcc-widget-place-font: 0.64rem;
            --fcc-widget-medal: 24px;
            padding: 10px;
          }

          .fcc-widget-ranking-header {
            gap: 8px;
            margin-bottom: 7px;
          }

          .fcc-widget-ranking-title-icon {
            width: 26px;
            height: 26px;
            border-radius: 9px;
          }

          .fcc-widget-ranking-title {
            font-size: 1rem;
          }

          .fcc-widget-ranking-place {
            gap: 3px;
            min-width: 64px;
          }

          .fcc-widget-ranking-place-label {
            min-height: 22px;
            padding-inline: 8px;
          }
        }

        @container fcc-ranking-slot (max-height: 430px) {
          .fcc-widget-ranking-card {
            --fcc-widget-gap: 3px;
            --fcc-widget-row-py: 2px;
            --fcc-widget-row-px: 8px;
            --fcc-widget-avatar-stage-top: 40px;
            --fcc-widget-avatar-stage-small: 36px;
            --fcc-widget-avatar-scale-top: 0.46;
            --fcc-widget-avatar-scale-small: 0.46;
            --fcc-widget-name: 0.82rem;
            --fcc-widget-name-small: 0.76rem;
            --fcc-widget-points: 0.72rem;
            --fcc-widget-points-small: 0.68rem;
            --fcc-widget-place-font: 0.58rem;
            --fcc-widget-medal: 20px;
            padding: 7px;
          }

          .fcc-widget-ranking-header {
            gap: 6px;
            margin-bottom: 5px;
          }

          .fcc-widget-ranking-header::before,
          .fcc-widget-ranking-header::after {
            width: 26px;
          }

          .fcc-widget-ranking-title-icon {
            width: 22px;
            height: 22px;
            border-radius: 8px;
          }

          .fcc-widget-ranking-title-icon svg {
            width: 13px;
            height: 13px;
          }

          .fcc-widget-ranking-title {
            font-size: 0.9rem;
          }

          .fcc-widget-ranking-row {
            gap: 5px;
            border-radius: 16px;
          }

          .fcc-widget-ranking-main {
            gap: 5px;
          }

          .fcc-widget-ranking-place {
            gap: 2px;
            min-width: 56px;
            max-width: 60px;
          }

          .fcc-widget-ranking-place-label {
            min-height: 19px;
            padding-inline: 6px;
            border-radius: 12px;
          }
        }

        @container fcc-ranking-slot (max-width: 390px) {
          .fcc-widget-ranking-card {
            --fcc-widget-row-px: 9px;
            --fcc-widget-avatar-stage-top: 54px;
            --fcc-widget-avatar-stage-small: 46px;
            --fcc-widget-name: 0.94rem;
            --fcc-widget-name-small: 0.86rem;
            --fcc-widget-place-font: 0.64rem;
          }

          .fcc-widget-ranking-row {
            gap: 7px;
          }

          .fcc-widget-ranking-main {
            gap: 7px;
          }

          .fcc-widget-ranking-place {
            min-width: 62px;
            max-width: 68px;
          }

          .fcc-widget-ranking-place-label {
            padding-inline: 7px;
          }
        }

        .ranking-social-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
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

        .ranking-profile-overlay.is-visible {
          animation: ranking-profile-ready 180ms ease-out both;
        }

        @keyframes ranking-profile-ready {
          from {
            opacity: 0;
            transform: scale(0.992);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
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

        @media (max-width: 720px) {
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

        @media (prefers-reduced-motion: reduce) {
          .fcc-widget-ranking-row,
          .ranking-avatar-stage::before,
          .ranking-avatar-stage::after,
          .ranking-avatar-orbit,
          .ranking-profile-close {
            transition: none !important;
          }

          .fcc-widget-ranking-row:hover {
            transform: none !important;
          }
        }
      `}</style>

      <section className="fcc-widget-ranking-card">
        <div className="fcc-widget-ranking-header">
          <span className="fcc-widget-ranking-title-icon" aria-hidden="true">
            <Trophy size={16} strokeWidth={2.2} />
          </span>
          <h2 className="fcc-widget-ranking-title">Top 5 global</h2>
        </div>

        <div className="fcc-widget-ranking-list">
          {[0, 1, 2, 3, 4].map((index) => {
            const user = usuarios[index];
            const rank = index + 1;
            const isSmall = rank >= 4;
            const rankClass =
              rank === 1
                ? "is-first"
                : rank === 2
                  ? "is-second"
                  : rank === 3
                    ? "is-third"
                    : "";
            const avatarSize = isSmall ? 96 : 112;

            return (
              <button
                key={user?.id ?? `ranking-slot-${rank}`}
                type="button"
                className={`fcc-widget-ranking-row ${rankClass} ${isSmall ? "is-small" : ""}`}
                onClick={() => {
                  if (!user) return;
                  void abrirPerfil(user);
                }}
                disabled={!user}
              >
                <div className="fcc-widget-ranking-main">
                  <AvatarRanking
                    config={user?.avatar_config ?? null}
                    size={avatarSize}
                    className="fcc-dashboard-ranking-avatar"
                  />

                  <div className="fcc-widget-ranking-copy">
                    <span className="fcc-widget-ranking-name">
                      {user ? nombreCorto(user.nombre) : "Sin asignar"}
                    </span>
                    <span className="fcc-widget-ranking-points">
                      {user ? `${user.puntos} pts` : "— pts"}
                    </span>
                  </div>
                </div>

                <div className="fcc-widget-ranking-place" aria-hidden="true">
                  <span className="fcc-widget-ranking-place-label">
                    {rank}° Lugar
                  </span>
                  <span className="fcc-widget-ranking-medal">
                    <Medal size={16} strokeWidth={2.1} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {preparandoPerfilId && (
        <CargadorFCC
          flotante={!selectedUsuario || !perfilVisualListo}
          sobreModal={Boolean(selectedUsuario && perfilVisualListo)}
          mensaje="Preparando perfil"
          detalle=""
        />
      )}

      {selectedUsuario &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`ranking-profile-overlay ${
              perfilVisualListo ? "is-visible" : ""
            }`}
            aria-hidden={!perfilVisualListo}
            style={{
              opacity: perfilVisualListo ? 1 : 0,
              pointerEvents: perfilVisualListo ? "auto" : "none",
            }}
            onClick={cerrarPerfil}
          >
            <div
              className="ranking-profile-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="ranking-profile-close"
                onClick={cerrarPerfil}
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.4} />
              </button>

              <div className="ranking-profile-header">
                <AvatarRanking
                  config={selectedUsuario.avatar_config}
                  size={300}
                  onReady={() => setAvatarPerfilListo(true)}
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

                    {miUsuario &&
                      getEstadoUsuario(selectedUsuario.id) === "none" && (
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
                ) : errorLogrosPerfil ? (
                  <EstadoErrorCargaFCC
                    compacto
                    titulo="No se pudieron confirmar los logros"
                    detalle="No se mostró una lista vacía como si fuera el estado real."
                    onRetry={() => {
                      if (selectedUsuario) void abrirPerfil(selectedUsuario);
                    }}
                  />
                ) : logros.length === 0 ? (
                  <div className="ranking-logros-empty">
                    Este usuario aún no tiene logros.
                  </div>
                ) : (
                  <GridLogros
                    logros={logros.map((logro) => ({
                      ...logro,
                      descripcion: logro.descripcion ?? "",
                      desbloqueado: true,
                    }))}
                    onReady={() => setLogrosPerfilListos(true)}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
