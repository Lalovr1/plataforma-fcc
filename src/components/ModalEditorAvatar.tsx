/**
 * Modal de edición del avatar del usuario.
 * Permite personalizar cabello, ojos, boca, nariz, ropa, playeras y accesorios,
 * mostrando una vista previa en tiempo real.
 */

"use client";

import { useState, useEffect } from "react";
import RenderizadorAvatar, { AvatarConfig } from "./RenderizadorAvatar";
import { supabase } from "@/utils/supabaseClient";

interface Props {
  open: boolean;
  onClose: () => void;
  initialConfig: AvatarConfig;
  onSave: (newConfig: AvatarConfig) => void;
  forzado?: boolean;
}

export default function ModalEditorAvatar({
  open,
  onClose,
  initialConfig,
  onSave,
  forzado = false,
}: Props) {
  const rolUsuario = typeof window !== "undefined" ? localStorage.getItem("rol_usuario") || "estudiante" : "estudiante";
  const [config, setConfig] = useState<AvatarConfig>({
    ...initialConfig,
    sueterColor: initialConfig.sueterColor ?? "#ffffff",
  });
  const [currentTab, setCurrentTab] = useState("gender");
  const [desbloqueados, setDesbloqueados] = useState<string[]>([]);
  const [cargandoDesbloqueos, setCargandoDesbloqueos] = useState(true);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let intentos = 0;

    async function cargarDesbloqueados() {
      // Si es profesor, desbloquear todo y salir
      if (rolUsuario === "profesor") {
        console.log("🎓 Modo profesor — todos los elementos desbloqueados");
        setDesbloqueados(["ALL_ITEMS_UNLOCKED"]);
        setCargandoDesbloqueos(false);
        return;
      }

      try {
        const { data: user } = await supabase.auth.getUser();
        let userId = user?.user?.id || localStorage.getItem("user_id");

        while (!userId && intentos < 5) {
          await new Promise((r) => setTimeout(r, 300));
          userId = localStorage.getItem("user_id");
          intentos++;
        }

        if (!userId) {
          console.warn("⚠️ No se encontró user_id, modo sin restricciones");
          setDesbloqueados([]);
          setCargandoDesbloqueos(false);
          return;
        }

        const { data, error } = await supabase
          .from("recompensas_usuario")
          .select("nombre")
          .eq("user_id", userId);

        if (error) console.error("❌ Error al cargar recompensas:", error);

        setDesbloqueados(data?.map((d) => d.nombre) || []);
      } catch (err) {
        console.error("⚠️ Error inesperado al cargar desbloqueados:", err);
      } finally {
        setCargandoDesbloqueos(false);
      }
    }

    if (open) cargarDesbloqueados();
  }, [open, rolUsuario]);

  useEffect(() => {
    if (open) {
      setConfig({
        ...initialConfig,
        sueterColor: initialConfig.sueterColor ?? "#ffffff",
      });
    }
  }, [open]);

  useEffect(() => {
    setConfig((prev) => ({ ...prev }));
  }, [config.skinColor]);

  useEffect(() => {
    if (rolUsuario === "profesor") {
      setDesbloqueados(["ALL_ITEMS_UNLOCKED"]);
      setCargandoDesbloqueos(false);
    }
  }, [rolUsuario]);

  if (!open) return null;
  if (cargandoDesbloqueos) return null;

    const SKIN_TONES =["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5a3825"]

  const TABS = [
    {
      key: "gender",
      label: "Cuerpo",
      items: ["masculino", "femenino"],
    },
    {
      key: "hair",
      label: "Cabello",
      items: [
        "none",
        "Cabello1.png",
        "Cabello2.png",
        "Cabello3.png",
        "Cabello4.png",
        "Cabello5.png",
        "Cabello6.png",
        "Cabello7.png",
        "Cabello8.png",
        "Cabello9.png",
        "Cabello10.png",
        "Cabello11.png",
        "Cabello12.png",
        "Cabello13.png",
        "Cabello14.png",
      ],
    },
    {
      key: "eyes",
      label: "Ojos",
      get items() {
        return ["Ojos1.png", "Ojos2.png", "Ojos3.png", "Ojos4.png", "Ojos5.png", "Ojos6.png", "Ojos7.png"];
      },
    },
    {
      key: "nose",
      label: "Nariz",
      items: [
        "Nariz1.png",
        "Nariz2.png",
        "Nariz3.png",
        "Nariz4.png",
      ],
    },
    {
      key: "mouth",
      label: "Boca",
      items: [
        "Boca1.png",
        "Boca2.png",
        "Boca3.png",
        "Boca4.png",
        "Boca5.png",
        "Boca6.png",
      ],
    },
    {
      key: "ropa",
      label: "Ropa",
      subsections:
        rolUsuario === "profesor"
          ? [
              {
                key: "capas_profesor",
                label: "Capas de profesor",
                items: ["none", "Capa1", "Capa2", "Capa3"],
                renderItem: (file: string, config: AvatarConfig) => {
                  if (file === "none") return null;
                  const basePath = `/elementos_avatar/ropa_profesor/${config.gender}/previews/${file}.png`;
                  return (
                    <div className="relative w-full aspect-square flex items-center justify-center rounded bg-[var(--color-card)] overflow-hidden">
                      <img
                        src={basePath}
                        className="absolute inset-0 w-full h-full object-contain"
                        alt={file}
                      />
                    </div>
                  );
                },
              },
            ]
          : [
              {
                key: "playera",
                label: "Playeras personalizables",
                items: ["none", "Playera1", "Playera2", "Playera3", "Playera4"],
              },
              {
                key: "sueter_color",
                label: "Suéteres personalizables",
                get items() {
                  const baseNames = ["Sueter1", "Sueter2", "Sueter3"];
                  return ["none", ...baseNames];
                },
              },
              {
                key: "sueter_simple",
                label: "Prendas especiales",
                get items() {
                  return ["none", "ChaquetaNegra", "ArmaduraNegra", "PlayeraNeon", "SudaderaBuap", "SudaderaBuap2"];
                },
              },
            ],
      renderItem: (file: string, config: AvatarConfig) => {
        if (file === "none") return null;

        // Ropa de profesor
        if (rolUsuario === "profesor") {
          const basePath = `/elementos_avatar/ropa_profesor/${config.gender}/previews/${file}.png`;
          return (
            <div className="relative w-full aspect-square flex items-center justify-center rounded bg-[var(--color-card)] overflow-hidden">
              <img
                src={basePath}
                className="absolute inset-0 w-full h-full object-contain"
                alt={file}
              />
            </div>
          );
        }

        // Ropa de estudiante
        const hasDoubleLayer = file.includes("Sueter");
        const basePath = `/elementos_avatar/ropa/${config.gender}/sueteres/previews/${file}`;
        return (
          <div className="relative w-full aspect-square flex items-center justify-center rounded bg-[var(--color-card)] overflow-hidden">
            {hasDoubleLayer ? (
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${basePath}_Relleno.png)`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundSize: "contain",
                  }}
                />
                <div
                  className="absolute inset-0 will-change-transform"
                  style={{
                    backgroundColor: config.sueterColor ?? "#ffffff",
                    opacity: 0.6,
                    maskImage: `url(${basePath}_Relleno.png)`,
                    WebkitMaskImage: `url(${basePath}_Relleno.png)`,
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    pointerEvents: "none",
                  }}
                />
                <img
                  src={`${basePath}_Contorno.png`}
                  className="absolute inset-0 w-full h-full object-contain"
                  alt="contorno"
                />
              </>
            ) : (
              <img
                src={`${basePath}.png`}
                className="absolute inset-0 w-full h-full object-contain"
                alt="sueter"
              />
            )}
          </div>
        );
      },
    },
    {
      key: "accessory",
      label: "Accesorios",
      subsections: [
        { key: "glasses", label: "Lentes", items: ["none", "Lentes1.png", "Lentes2.png","Lentes3.png"] },
        { key: "collar", label: "Collar", items: ["none"] },
        { key: "pulsera", label: "Pulsera", items: ["none"] },
      ],
    },
  ];

  const handleSave = () => {
    if (!["masculino", "femenino"].includes(config.gender)) {
      alert("Debes seleccionar un tipo de cuerpo antes de guardar.");
      return;
    }

    // Si el usuario es profesor, omitir validaciones de desbloqueo
    if (rolUsuario === "profesor") {
      onSave(config);
      return;
    }

    const campos = ["hair", "eyes", "mouth", "nose", "playera", "sueter", "glasses", "collar", "pulsera"];
    const bloqueadosUsados = campos
      .map((key) => {
        const valor = (config as any)[key];
        if (
          valor &&
          valor !== "none" &&
          !desbloqueados.some((n) => coincideNombre(n, valor))
        ) {
          return key;
        }
        return null;
      })
      .filter(Boolean) as string[];

    if (bloqueadosUsados.length > 0) {
      const nombresAmigables: Record<string, string> = {
        hair: "Cabello",
        eyes: "Ojos",
        mouth: "Boca",
        nose: "Nariz",
        playera: "Playera",
        sueter: "Suéter",
        glasses: "Lentes",
        collar: "Collar",
        pulsera: "Pulsera",
  };

  const lista = bloqueadosUsados
    .map((key) => nombresAmigables[key] || key)
    .join(", ");

  setMensaje(`⚠️ Los siguientes elementos no están desbloqueados: ${lista}.`);
  setTimeout(() => setMensaje(""), 5000);
  return;
}

    onSave(config);
  };

  const getCurrentValue = (tabKey: string) => {
    const val = (config as any)[tabKey];
    return val ?? "none";
  };

  function coincideNombre(a: string, b: string) {
    return a.toLowerCase().replace(".png", "") === b.toLowerCase().replace(".png", "");
  }
  
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-all duration-500 ease-out"
      style={{
        zIndex: 10020, 
        backdropFilter: "blur(1px)",
        animation: "fadeZoomIn 0.4s ease-out",
      }}
    >
      <div
        className="p-6 rounded-xl w-full max-w-5xl max-h-[85vh] shadow-lg flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--color-card)",
          color: "var(--color-text)",
          animation: "fadeZoomIn 0.3s ease-out",
        }}
      >
        <h2
          className="text-2xl font-bold mb-4 text-center"
          style={{ color: "var(--color-heading)" }}
        >
          Editor de Avatar
        </h2>

        <div className="flex gap-6 flex-1 overflow-hidden">
          <div className="relative flex flex-col items-center justify-start flex-shrink-0 w-[420px]">
            {/* 🔹 Avatar principal */}
            <RenderizadorAvatar config={config} size={380} />

            {/* 🔹 Selector de color dinámico debajo del avatar */}
            {currentTab === "gender" && (
              <div className="mt-5 flex justify-center gap-3 flex-wrap">
                {SKIN_TONES.map((tone) => (
                  <div
                    key={tone}
                    onClick={() => setConfig({ ...config, skinColor: tone })}
                    className={`w-9 h-9 rounded-full cursor-pointer border-2 transition-transform duration-150 ${
                      config.skinColor === tone
                        ? "ring-4 ring-[var(--color-btn)] border-[var(--color-btn)] scale-110"
                        : "border-[var(--color-border)] hover:scale-105"
                    }`}
                    style={{ backgroundColor: tone, opacity: 0.95 }}
                  />
                ))}
              </div>
            )}

            {currentTab === "ropa" && rolUsuario !== "profesor" && (
              <div className="mt-5 flex justify-center gap-3 flex-wrap">
                {["#ffffff", "#d1d5db", "#374151", "#3b82f6", "#60a5fa", "#8b5cf6"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setConfig({ ...config, sueterColor: color })}
                    className={`w-9 h-9 rounded-full border transition-all duration-200 hover:scale-110 ${
                      config.sueterColor === color
                        ? "ring-4 ring-[var(--color-btn)] border-[var(--color-btn)]"
                        : "border-[var(--color-border)]"
                    }`}
                    style={{ backgroundColor: color, opacity: 0.6 }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-center gap-2 mb-4 flex-nowrap">
              {TABS.map((tab) => {
                const isActive = currentTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setCurrentTab(tab.key)}
                    className={`px-3 py-1 rounded-md text-xs transition-all duration-150 select-none
                      ${isActive ? "font-semibold" : "font-medium opacity-80 hover:opacity-100"}`}
                    style={{
                      backgroundColor: isActive
                        ? "var(--color-btn)"
                        : "var(--color-card)",
                      color: isActive
                        ? "var(--color-text-btn)"
                        : "var(--color-muted)",
                      whiteSpace: "nowrap", // 🔹 mantiene todo en una línea
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              className="h-[400px] overflow-y-auto pr-2"
              style={{ overflowX: "hidden", overflowY: "visible" }}
            >
              {(() => {
                const currentTabData = TABS.find((t) => t.key === currentTab);
                if (!currentTabData) return null;

                if ((currentTabData as any).subsections) {
                  const tabWithSubs = currentTabData as any;
                  return tabWithSubs.subsections.map((sub: any) => (
                    <div key={sub.key} className="mb-6 col-span-3">
                      <h3 className="text-center text-sm font-semibold mb-2">{sub.label}</h3>
                      <div className="grid grid-cols-3 gap-3 px-1 overflow-visible">
                        {(
                          typeof sub.items === "function" ? sub.items() : sub.items
                        )
                          // 🔹 Mostrar "none" en Playera y en todos los accesorios
                          .filter((file: string) => {
                            if (file === "none") {
                              // Mostrar en Playera y en Accesorios
                              return currentTab === "accessory" || sub.label === "Playera";
                            }
                            return true;
                          })

                          .map((file: string) => {
                          let currentValue: string = "none";
                            if (currentTab === "ropa") {
                              if (sub.key === "playera" || sub.label === "Playera" || sub.key.toLowerCase().includes("playera")) {
                                currentValue = config.playera;
                              } else if (sub.key === "sueter_color" || sub.label.toLowerCase().includes("suéter")) {
                                currentValue = config.sueter;
                              } else if (sub.key === "sueter_simple" || sub.label.toLowerCase().includes("prendas")) {
                                currentValue = config.sueter;
                              }
                            } else {
                              currentValue = (config as any)[sub.key];
                            }
                            const isSelected =
                              currentValue === file ||
                              (sub.key === "capas_profesor" && config.sueter === file);
                            const desbloqueado =
                              rolUsuario === "profesor" ||
                              desbloqueados.includes("ALL_ITEMS_UNLOCKED") ||
                              desbloqueados.some((n) => coincideNombre(n, file)) ||
                              file === "none";
                          return (
                            <div
                              key={file}
                              className={`cursor-pointer rounded-lg border transition-all duration-150 flex items-center justify-center ${
                                isSelected
                                  ? "ring-4 ring-[var(--color-btn)] border-[var(--color-btn)] scale-[1.03]"
                                  : "border-[var(--color-border)] hover:ring-2 hover:ring-[var(--color-btn)]"
                              }`}
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                filter: desbloqueado ? "none" : "grayscale(100%) brightness(0.6)",
                                opacity: desbloqueado ? 1 : 0.7,
                                position: "relative",
                              }}
                              onClick={() => {
                                const newConfig = { ...config };

                                if (currentTab === "ropa") {
                                  const isPlayera = sub.key === "playera" || sub.label === "Playera";
                                  const isSueterColor = sub.key === "sueter_color" || sub.label.toLowerCase().includes("suéter");
                                  const isSueterSimple = sub.key === "sueter_simple" || sub.label.toLowerCase().includes("prendas");
                                  const isProfesor = sub.key === "capas_profesor" || sub.label.toLowerCase().includes("profesor");

                                  newConfig.playera = "none";
                                  newConfig.sueter = "none";

                                  if (isPlayera) {
                                    newConfig.playera = file === "none" ? "none" : file;
                                  } else if (isSueterColor || isSueterSimple) {
                                    newConfig.sueter = file === "none" ? "none" : file;
                                  } else if (isProfesor) {
                                    newConfig.sueter = file === "none" ? "none" : file;
                                  }
                                } else {
                                  (newConfig as any)[sub.key] = file;
                                }

                                setConfig(newConfig);
                              }}
                            >
                              <div
                                className="w-full aspect-square flex items-center justify-center rounded bg-[var(--color-card)]"
                              >
                                {file === "none" ? (
                                  <span className="text-sm" style={{ color: "var(--color-muted)" }}>Ninguno</span>
                                ) : currentTab === "ropa" ? (
                                  sub.key === "playera" ? (
                                    <div className="relative w-full aspect-square flex items-center justify-center rounded bg-[var(--color-card)] overflow-hidden">
                                      {file !== "none" ? (
                                        <>
                                          <div
                                            className="absolute inset-0"
                                            style={{
                                              backgroundImage: `url(/elementos_avatar/ropa/${config.gender}/playeras/previews/${file}_Relleno.png)`,
                                              backgroundRepeat: "no-repeat",
                                              backgroundPosition: "center",
                                              backgroundSize: "contain",
                                            }}
                                          />
                                          <div
                                            className="absolute inset-0 will-change-transform"
                                            style={{
                                              backgroundColor: config.sueterColor ?? "#ffffff",
                                              opacity: 0.6,
                                              maskImage: `url(/elementos_avatar/ropa/${config.gender}/playeras/previews/${file}_Relleno.png)`,
                                              WebkitMaskImage: `url(/elementos_avatar/ropa/${config.gender}/playeras/previews/${file}_Relleno.png)`,
                                              maskSize: "contain",
                                              maskRepeat: "no-repeat",
                                              maskPosition: "center",
                                              WebkitMaskSize: "contain",
                                              WebkitMaskRepeat: "no-repeat",
                                              WebkitMaskPosition: "center",
                                              pointerEvents: "none",
                                            }}
                                          />
                                          <img
                                            src={`/elementos_avatar/ropa/${config.gender}/playeras/previews/${file}_Contorno.png`}
                                            className="absolute inset-0 w-full h-full object-contain"
                                            alt={file}
                                          />
                                        </>
                                      ) : (
                                        <span className="text-sm" style={{ color: "var(--color-muted)" }}>Ninguno</span>
                                      )}
                                    </div>
                                  ) : (
                                    (TABS.find((t) => t.key === "ropa") as any)?.renderItem?.(file, config) ?? null
                                  )
                                ) : (
                                  <img
                                    src={
                                      currentTab === "accessory"
                                        ? sub.key === "glasses"
                                          ? `/elementos_avatar/cara/lentes/previews/${file}`
                                          : `/elementos_avatar/accesorios/${file}`
                                        : currentTab === "hair"
                                        ? `/elementos_avatar/cabello/${config.gender}/previews/${file}`
                                        : currentTab === "eyes"
                                        ? `/elementos_avatar/cara/ojos/${config.gender}/previews/${file}`
                                        : currentTab === "mouth"
                                        ? `/elementos_avatar/cara/bocas/previews/${file}`
                                        : currentTab === "nose"
                                        ? `/elementos_avatar/cara/narices/previews/${file}`
                                        : ""
                                    }
                                    className="max-w-full max-h-full object-contain"
                                    alt={file}
                                  />
                                )}
                              </div>
                            {!desbloqueado && (
                              <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.25)] rounded-lg group overflow-visible">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6 text-white opacity-90" fill="currentColor">
                                  <path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z" />
                                </svg>
                                <div
                                className="absolute z-[50] bottom-[-2.6rem] left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md text-[11px] bg-[var(--color-card)] text-[var(--color-text)] border border-[var(--color-border)] shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 text-center"
                                  style={{
                                    maxWidth: "180px",
                                    whiteSpace: "pre-line",
                                    wordBreak: "keep-all",
                                    lineHeight: "1.1rem",
                                  }}
                                >
                                  Desbloquea cofres<br />para obtener este elemento
                                </div>
                              </div>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                }

                const items = typeof (currentTabData as any).items === "function"
                  ? (currentTabData as any).items()
                  : (currentTabData as any).items;

                return (
                  <div
                    className={`${
                      currentTab === "gender"
                        ? "flex justify-between items-stretch gap-3 h-full"
                        : "grid grid-cols-3 gap-3 pt-2 pb-2 px-2"
                    }`}
                  >
                    {items?.map((file: string) => {
                      const currentValue = (config as any)[currentTab];
                      const isSelected = currentValue === file;
                      const desbloqueado =
                        rolUsuario === "profesor" ||
                        desbloqueados.includes("ALL_ITEMS_UNLOCKED") ||
                        currentTab === "gender" ||
                        desbloqueados.some((n) => coincideNombre(n, file)) ||
                        file === "none";
                      return (
                        <div
                          key={file}
                          className={`cursor-pointer rounded-lg border transition-all duration-150 flex items-center justify-center text-xl font-semibold select-none ${
                            isSelected
                              ? "ring-4 ring-[var(--color-btn)] border-[var(--color-btn)] scale-[1.03]"
                              : "border-[var(--color-border)] hover:ring-2 hover:ring-[var(--color-btn)]"
                          }`}
                          style={
                            currentTab === "gender"
                              ? {
                                  height: "220px",
                                  flex: "1 1 48%",
                                  maxWidth: "48%",
                                  margin: "1%",
                                }
                              : {
                                width: "100%",
                                aspectRatio: "1 / 1",
                                filter: desbloqueado ? "none" : "grayscale(100%) brightness(0.6)",
                                opacity: desbloqueado ? 1 : 0.7,
                                position: "relative",
                              }
                          }
                          onClick={() => {
                            if (currentTab === "gender") {
                              setConfig((prev) => {
                                const nuevoGenero = file as "masculino" | "femenino";
                                const nuevoConfig = { ...prev, gender: nuevoGenero, skin: "piel.png" };

                                nuevoConfig.hair = prev.hair ?? "none";
                                nuevoConfig.sueter = prev.sueter ?? "none";

                                return nuevoConfig;
                              });
                            } else {
                              setConfig({ ...config, [currentTab]: file });
                            }
                          }}
                        >
                          {currentTab === "gender" ? (
                            <span
                              className="text-lg font-semibold select-none"
                              style={{ color: "var(--color-text)" }}
                            >
                              {file === "masculino" ? "Masculino" : "Femenino"}
                            </span>
                          ) : (
                            <div
                              className={`${
                                currentTab === "accessory" ? "w-20 h-20" : "w-full aspect-square"
                              } flex items-center justify-center rounded bg-[var(--color-card)]`}
                            >
                              {file === "none" ? (
                                <span className="text-sm" style={{ color: "var(--color-muted)" }}>Ninguno</span>
                              ) : (
                                <img
                                  src={
                                    currentTab === "hair"
                                      ? `/elementos_avatar/cabello/${config.gender}/previews/${file}`
                                      : currentTab === "eyes"
                                      ? (["Ojos5.png","Ojos6.png","Ojos7.png"].includes(file)
                                          ? `/elementos_avatar/cara/ojos/previews/${file}`
                                          : `/elementos_avatar/cara/ojos/${config.gender}/previews/${file}`)
                                      : currentTab === "mouth"
                                      ? `/elementos_avatar/cara/bocas/previews/${file}`
                                      : currentTab === "nose"
                                      ? `/elementos_avatar/cara/narices/previews/${file}`
                                      : ""
                                  }
                                  className="max-w-full max-h-full object-contain"
                                  alt={file}
                                />
                              )}
                            </div>
                          )}
                          {!desbloqueado && (
                            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.25)] rounded-lg group overflow-visible">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6 text-white opacity-90" fill="currentColor">
                                <path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z" />
                              </svg>
                              <div
                                className="absolute z-[50] bottom-[-2.8rem] left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md text-[11px] font-normal bg-[var(--color-card)] text-[var(--color-text)] border border-[var(--color-border)] shadow-md opacity-0 group-hover:opacity-100 group-hover:translate-y-[-4px] transition-all duration-300 text-center"
                                style={{
                                  maxWidth: "180px",
                                  whiteSpace: "pre-line",
                                  wordBreak: "keep-all",
                                  lineHeight: "1.1rem",
                                }}
                              >
                                Desbloquea cofres<br />para obtener este elemento
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* 🔹 Pie del modal */}
        <div className="mt-6 flex justify-end items-center gap-4">
          {!forzado && (
            <button
              className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white"
              onClick={onClose}
            >
              Cancelar
            </button>
          )}

          <button
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            onClick={handleSave}
          >
            {forzado ? "Crear avatar" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* 🔹 Animación global */}
      <style jsx global>{`
        @keyframes fadeZoomIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>

      {mensaje && (
        <div className="absolute bottom-6 right-6 bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {mensaje}
        </div>
      )}
    </div>
  );
}
