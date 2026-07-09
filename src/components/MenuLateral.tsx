"use client";

/**
 * Menú lateral principal.
 * Navegación por rol, estado activo, responsive mobile y logout.
 */

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Trophy,
  Users,
  Settings,
  LogOut,
  Home,
  PlusCircle,
  GraduationCap,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

interface Props {
  rol: string;
}

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const estudianteLinks: NavItem[] = [
  {
    href: "/dashboard/estudiante",
    label: "Inicio",
    icon: Home,
  },
  {
    href: "/dashboard/estudiante/cursos",
    label: "Cursos",
    icon: BookOpen,
  },
  {
    href: "/dashboard/estudiante/ranking",
    label: "Ranking",
    icon: Trophy,
  },
  {
    href: "/dashboard/estudiante/amigos",
    label: "Amigos",
    icon: Users,
  },
  {
    href: "/dashboard/estudiante/profesores",
    label: "Profesores",
    icon: GraduationCap,
  },
];

const profesorLinks: NavItem[] = [
  {
    href: "/dashboard/profesor",
    label: "Inicio",
    icon: Home,
  },
  {
    href: "/dashboard/profesor/cursos",
    label: "Cursos",
    icon: BookOpen,
  },
  {
    href: "/dashboard/profesor/ranking",
    label: "Ranking",
    icon: Trophy,
  },
  {
    href: "/dashboard/profesor/agregar-curso",
    label: "Agregar curso",
    icon: PlusCircle,
  },
];

export default function MenuLateral({ rol }: Props) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [tutorialActivo, setTutorialActivo] = useState(false);

  useEffect(() => {
    const handler = (e: any) => setTutorialActivo(!!e.detail?.activo);
    window.addEventListener("tutorial:estado", handler);

    setTutorialActivo(!!(window as any).__tutorialActivo);

    return () => {
      window.removeEventListener("tutorial:estado", handler);
    };
  }, []);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  const linksPrincipales = rol === "profesor" ? profesorLinks : estudianteLinks;

  function estaActivo(href: string) {
    if (pathname === href) return true;
    if (href === "/dashboard/estudiante") return pathname === href;
    if (href === "/dashboard/profesor") return pathname === href;

    return pathname?.startsWith(`${href}/`);
  }

  const asideStyle: CSSProperties = {
    pointerEvents: tutorialActivo ? "none" : "auto",
  };

  async function cerrarSesion() {
    const { supabase } = await import("@/utils/supabaseClient");

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error al cerrar sesión en Supabase:", err);
    }

    window.dispatchEvent(new Event("logout"));

    localStorage.clear();
    window.location.href = "/login";
  }

  function NavLinkItem({ item }: { item: NavItem }) {
    const Icono = item.icon;
    const activo = estaActivo(item.href);

    return (
      <Link
        href={item.href}
        className={`fcc-nav-item ${activo ? "is-active" : ""}`}
      >
        <span className="fcc-nav-active-glow" />

        <span className="fcc-nav-icon">
          <Icono size={19} strokeWidth={1.95} />
        </span>

        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <style>{`
        .menu-lateral-fcc {
          color: var(--fcc-sidebar-text, #f3f8ff);
          background: var(
            --fcc-sidebar-bg,
            radial-gradient(circle at 42% -8%, rgba(52, 139, 255, 0.24), transparent 32%),
            radial-gradient(circle at 0% 78%, rgba(35, 212, 255, 0.13), transparent 38%),
            linear-gradient(180deg, #061d39 0%, #06172f 44%, #041021 100%)
          );
          border-right: 1px solid var(--fcc-sidebar-border, rgba(125, 181, 255, 0.22));
          box-shadow: var(
            --fcc-sidebar-shadow,
            14px 0 38px rgba(8, 24, 50, 0.16),
            inset -1px 0 0 rgba(255, 255, 255, 0.035)
          );
        }

        .menu-lateral-fcc::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(var(--fcc-sidebar-grid-a, rgba(88, 166, 255, 0.05)) 1px, transparent 1px),
            linear-gradient(90deg, var(--fcc-sidebar-grid-b, rgba(88, 166, 255, 0.04)) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(to bottom, black 0%, transparent 76%);
          opacity: var(--fcc-sidebar-grid-opacity, 0.42);
        }

        .menu-lateral-fcc::after {
          content: "";
          position: absolute;
          inset: auto 0 0 0;
          height: 36%;
          pointer-events: none;
          background:
            linear-gradient(
              135deg,
              transparent 0 48%,
              var(--fcc-sidebar-bottom-a, rgba(35, 212, 255, 0.18)) 48.5% 49%,
              transparent 49.5%
            ),
            radial-gradient(
              circle at 18% 84%,
              var(--fcc-sidebar-bottom-b, rgba(47, 123, 255, 0.2)),
              transparent 28%
            );
          opacity: var(--fcc-sidebar-bottom-opacity, 0.78);
        }

        .fcc-logo-panel {
          position: relative;
          display: grid;
          place-items: center;
          width: 100%;
          min-height: 184px;
          padding: 22px 20px 24px;
          border-bottom: 1px solid var(--fcc-sidebar-logo-border, rgba(125, 181, 255, 0.18));
        }

        .fcc-logo-panel::before {
          content: "";
          position: absolute;
          width: 144px;
          height: 144px;
          border-radius: 999px;
          background:
            radial-gradient(
              circle,
              var(--fcc-sidebar-logo-glow, rgba(35, 212, 255, 0.14)),
              transparent 62%
            );
          filter: blur(4px);
        }

        .fcc-logo-panel::after {
          content: "";
          position: absolute;
          inset: auto 22px 0 22px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--fcc-sidebar-logo-line-a, rgba(35, 212, 255, 0.46)),
            var(--fcc-sidebar-logo-line-b, rgba(47, 123, 255, 0.20)),
            transparent
          );
        }

        .fcc-logo-inner {
          position: relative;
          display: grid;
          place-items: center;
          width: 150px;
          max-width: 78%;
        }

        .fcc-logo-mark {
          width: 100%;
          max-width: 150px;
          aspect-ratio: 1 / 1;
          background-image: var(
            --fcc-sidebar-logo-image,
            url("/logos/logo-azul.png")
          );
          background-repeat: no-repeat;
          background-position: center;
          background-size: contain;
          filter: drop-shadow(
            0 0 18px var(--fcc-sidebar-logo-shadow, rgba(35, 212, 255, 0.24))
          );
        }

        .fcc-nav {
          padding: 22px 14px 12px;
        }

        .fcc-nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          padding: 10px 14px;
          border-radius: 16px;
          color: var(--fcc-sidebar-muted, rgba(226, 238, 255, 0.82));
          font-size: 15px;
          font-weight: 760;
          letter-spacing: -0.01em;
          overflow: hidden;
          border: 1px solid transparent;
          transition:
            color 180ms ease,
            background 180ms ease,
            border-color 180ms ease,
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .fcc-nav-item:hover {
          color: var(--fcc-sidebar-hover-text, #ffffff);
          background: var(--fcc-sidebar-hover-bg, rgba(255, 255, 255, 0.075));
          border-color: var(--fcc-sidebar-hover-border, rgba(255, 255, 255, 0.14));
        }

        .fcc-nav-item.is-active {
          color: var(--fcc-sidebar-active-text, #ffffff);
          background:
            linear-gradient(
              90deg,
              var(--fcc-sidebar-active-a, rgba(47, 123, 255, 0.42)),
              var(--fcc-sidebar-active-b, rgba(47, 123, 255, 0.18))
            ),
            var(--fcc-sidebar-active-base, rgba(255, 255, 255, 0.05));
          border-color: var(--fcc-sidebar-active-border, rgba(96, 165, 250, 0.38));
          box-shadow:
            0 12px 30px var(--fcc-sidebar-active-shadow, rgba(21, 88, 214, 0.22)),
            inset 0 0 0 1px var(--fcc-sidebar-active-inset, rgba(255, 255, 255, 0.045));
        }

        .fcc-nav-active-glow {
          position: absolute;
          left: 0;
          top: 11px;
          bottom: 11px;
          width: 3px;
          border-radius: 999px;
          background: transparent;
          box-shadow: none;
        }

        .fcc-nav-item.is-active .fcc-nav-active-glow {
          background: var(--fcc-sidebar-active-glow, #35d8ff);
          box-shadow: 0 0 16px var(--fcc-sidebar-active-glow-shadow, rgba(35, 212, 255, 0.92));
        }

        .fcc-nav-icon {
          position: relative;
          display: grid;
          place-items: center;
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          color: currentColor;
          opacity: 0.96;
        }

        .fcc-nav-icon svg {
          filter: drop-shadow(0 0 8px transparent);
          transition: filter 180ms ease;
        }

        .fcc-nav-item.is-active .fcc-nav-icon svg {
          filter: drop-shadow(
            0 0 8px var(--fcc-sidebar-icon-shadow, rgba(35, 212, 255, 0.55))
          );
        }

        .fcc-logout-button {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 48px;
          padding: 10px 14px;
          border-radius: 16px;
          color: var(--fcc-sidebar-logout-text, #ff7373);
          font-weight: 760;
          border: 1px solid transparent;
          transition:
            background 180ms ease,
            border-color 180ms ease,
            color 180ms ease;
        }

        .fcc-logout-button:hover {
          background: var(--fcc-sidebar-logout-bg-hover, rgba(239, 68, 68, 0.11));
          border-color: var(--fcc-sidebar-logout-border-hover, rgba(239, 68, 68, 0.22));
          color: var(--fcc-sidebar-logout-text-hover, #ff8a8a);
        }

        .fcc-mobile-menu-button {
          background: var(
            --fcc-mobile-menu-bg,
            linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,248,255,0.92))
          );
          color: var(--fcc-mobile-menu-text, #0f2746);
          border: 1px solid var(--fcc-mobile-menu-border, rgba(15, 39, 70, 0.08));
          box-shadow: var(--fcc-mobile-menu-shadow, 0 18px 38px rgba(15, 39, 70, 0.12));
        }

        .fcc-mobile-close {
          color: var(--fcc-sidebar-close-text, #ffffff);
          background: var(--fcc-sidebar-close-bg, rgba(255, 255, 255, 0.08));
          border: 1px solid var(--fcc-sidebar-close-border, rgba(255, 255, 255, 0.12));
        }

        @media (max-height: 760px) {
          .fcc-logo-panel {
            min-height: 164px;
            padding-top: 18px;
            padding-bottom: 18px;
          }

          .fcc-logo-inner {
            width: 136px;
          }

          .fcc-logo-mark {
            max-width: 124px;
          }

          .fcc-nav {
            padding-top: 16px;
          }

          .fcc-nav-item {
            min-height: 44px;
          }
        }
      `}</style>

      <button
        type="button"
        onClick={() => setMenuAbierto(true)}
        className="fcc-mobile-menu-button lg:hidden fixed top-3 left-3 z-40 w-11 h-11 flex items-center justify-center rounded-2xl"
        aria-label="Abrir menú"
      >
        <Menu size={24} />
      </button>

      {menuAbierto && (
        <button
          type="button"
          onClick={() => setMenuAbierto(false)}
          className="lg:hidden fixed inset-0 bg-black/45 z-40 backdrop-blur-[2px]"
          aria-label="Cerrar menú"
        />
      )}

      <aside
        className={`menu-lateral menu-lateral-fcc fixed top-0 left-0 h-full w-64 flex flex-col justify-between z-50 transition-transform duration-300 overflow-y-auto ${
          menuAbierto ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={asideStyle}
      >
        <div className="relative z-10">
          <div className="fcc-logo-panel">
            <div className="fcc-logo-inner">
              <div
                className="fcc-logo-mark"
                role="img"
                aria-label="FCC Academy"
              />
            </div>

            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              className="fcc-mobile-close lg:hidden absolute right-4 top-4 rounded-xl p-2 hover:opacity-80"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="fcc-nav space-y-2">
            {linksPrincipales.map((item) => (
              <NavLinkItem key={item.href} item={item} />
            ))}

            <NavLinkItem
              item={{
                href: "/dashboard/configuracion",
                label: "Configuración",
                icon: Settings,
              }}
            />
          </nav>
        </div>

        <div className="relative z-10 p-4">
          <button
            type="button"
            onClick={cerrarSesion}
            className="fcc-logout-button"
          >
            <LogOut size={19} strokeWidth={1.95} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}