/**
 * Modal de edición del avatar del usuario.
 * Permite personalizar cabello, ojos, boca, nariz, ropa, playeras y accesorios,
 * mostrando una vista previa en tiempo real.
 */

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const rolUsuario =
    typeof window !== "undefined"
      ? localStorage.getItem("rol_usuario") || "estudiante"
      : "estudiante";

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

  const SKIN_TONES = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5a3825"];

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
        return [
          "Ojos1.png",
          "Ojos2.png",
          "Ojos3.png",
          "Ojos4.png",
          "Ojos5.png",
          "Ojos6.png",
          "Ojos7.png",
        ];
      },
    },
    {
      key: "nose",
      label: "Nariz",
      items: ["Nariz1.png", "Nariz2.png", "Nariz3.png", "Nariz4.png"],
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
                    <div className="avatar-editor-option-inner">
                      <img
                        src={basePath}
                        className="absolute inset-0 h-full w-full object-contain"
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
                  return [
                    "none",
                    "Uniforme_Gris",
                    "ChaquetaNegra",
                    "ArmaduraNegra",
                    "PlayeraNeon",
                    "SudaderaBuap",
                    "SudaderaBuap2",
                    "Sudadera_Negro_Naranja",
                    "Uniforme_Naranja_Azul",
                    "Playera_Seleccion",
                    "Uniforme_Negro_Rojo",
                    "Uniforme_Azul",
                    "Uniforme_Cafe",
                  ];
                },
              },
            ],
      renderItem: (file: string, config: AvatarConfig) => {
        if (file === "none") return null;

        // Ropa de profesor
        if (rolUsuario === "profesor") {
          const basePath = `/elementos_avatar/ropa_profesor/${config.gender}/previews/${file}.png`;
          return (
            <div className="avatar-editor-option-inner">
              <img
                src={basePath}
                className="absolute inset-0 h-full w-full object-contain"
                alt={file}
              />
            </div>
          );
        }

        // Ropa de estudiante
        const hasDoubleLayer = file.includes("Sueter");
        const basePath = `/elementos_avatar/ropa/${config.gender}/sueteres/previews/${file}`;

        return (
          <div className="avatar-editor-option-inner">
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
                  className="absolute inset-0 h-full w-full object-contain"
                  alt="contorno"
                />
              </>
            ) : (
              <img
                src={`${basePath}.png`}
                className="absolute inset-0 h-full w-full object-contain"
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
        {
          key: "glasses",
          label: "Lentes",
          items: ["none", "Lentes1.png", "Lentes2.png", "Lentes3.png"],
        },
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

    const campos = [
      "hair",
      "eyes",
      "mouth",
      "nose",
      "playera",
      "sueter",
      "glasses",
      "collar",
      "pulsera",
    ];

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

  function coincideNombre(a: string, b: string) {
    return (
      a.toLowerCase().replace(".png", "") ===
      b.toLowerCase().replace(".png", "")
    );
  }

  const mostrarPaletaColor =
    currentTab === "gender" || (currentTab === "ropa" && rolUsuario !== "profesor");

  return createPortal(
    <div
      className="avatar-editor-overlay fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      style={{
        zIndex: 10020,
      }}
      onClick={forzado ? undefined : onClose}
    >
      <div
        className="avatar-editor-modal relative flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden rounded-[28px] p-3 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!forzado && (
          <button
            type="button"
            onClick={onClose}
            className="avatar-editor-close absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none"
            title="Cerrar"
          >
            ×
          </button>
        )}

        <div className="mb-3 sm:mb-5 px-8 text-center">
          <p className="avatar-editor-eyebrow">Personalización</p>
          <h2 className="avatar-editor-title">Editor de Avatar</h2>
        </div>

        <div className="avatar-editor-body flex flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:gap-6">
          <div className="avatar-editor-preview-shell flex w-full flex-shrink-0 flex-col items-center lg:w-[420px]">
            <div className="avatar-editor-avatar-stage relative flex items-center justify-center">
              <span className="avatar-editor-avatar-orbit" />

              <div className="avatar-editor-avatar-render relative z-[2]">
                <RenderizadorAvatar config={config} size={300} />
              </div>
            </div>

            <div className="avatar-editor-color-slot">
              {currentTab === "gender" && (
                <div className="avatar-editor-color-row flex flex-wrap justify-center gap-3">
                  {SKIN_TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setConfig({ ...config, skinColor: tone })}
                      className={`avatar-editor-color-dot ${
                        config.skinColor === tone ? "is-selected" : ""
                      }`}
                      style={{ backgroundColor: tone }}
                      title="Color de piel"
                    />
                  ))}
                </div>
              )}

              {currentTab === "ropa" && rolUsuario !== "profesor" && (
                <div className="avatar-editor-color-row flex flex-wrap justify-center gap-3">
                  {[
                    "#ffffff",
                    "#d1d5db",
                    "#374151",
                    "#3b82f6",
                    "#60a5fa",
                    "#8b5cf6",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setConfig({ ...config, sueterColor: color })}
                      className={`avatar-editor-color-dot ${
                        config.sueterColor === color ? "is-selected" : ""
                      }`}
                      style={{ backgroundColor: color }}
                      title="Color de prenda"
                    />
                  ))}
                </div>
              )}

              {!mostrarPaletaColor && (
                <div className="avatar-editor-color-row flex flex-wrap justify-center gap-3">
                  <span
                    className="avatar-editor-color-dot avatar-editor-color-none is-selected"
                    aria-label="Sin color configurable"
                    title="Sin color configurable"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="avatar-editor-controls flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="avatar-editor-tabs mb-4 flex justify-start gap-2 overflow-x-auto pb-2 lg:justify-center">
              {TABS.map((tab) => {
                const isActive = currentTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCurrentTab(tab.key)}
                    className={`avatar-editor-tab ${isActive ? "is-active" : ""}`}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              className={`avatar-editor-options-scroll h-[320px] overflow-y-auto pr-2 sm:h-[400px] ${
                currentTab === "gender" ? "is-gender-tab" : ""
              }`}
              style={{
                overflowX: "hidden",
                overflowY: currentTab === "gender" ? "hidden" : "auto",
              }}
            >
              {(() => {
                const currentTabData = TABS.find((t) => t.key === currentTab);
                if (!currentTabData) return null;

                if ((currentTabData as any).subsections) {
                  const tabWithSubs = currentTabData as any;

                  return tabWithSubs.subsections.map((sub: any) => (
                    <div key={sub.key} className="mb-6 col-span-3">
                      <h3 className="avatar-editor-section-title mb-3 text-center text-sm font-semibold">
                        {sub.label}
                      </h3>

                      <div className="grid grid-cols-3 gap-3 overflow-visible px-1">
                        {(
                          typeof sub.items === "function"
                            ? sub.items()
                            : sub.items
                        )
                          .filter((file: string) => {
                            if (file === "none") {
                              return (
                                currentTab === "accessory" ||
                                sub.label === "Playera"
                              );
                            }

                            return true;
                          })
                          .map((file: string) => {
                            let currentValue: string = "none";

                            if (currentTab === "ropa") {
                              if (
                                sub.key === "playera" ||
                                sub.label === "Playera" ||
                                sub.key.toLowerCase().includes("playera")
                              ) {
                                currentValue = config.playera;
                              } else if (
                                sub.key === "sueter_color" ||
                                sub.label.toLowerCase().includes("suéter")
                              ) {
                                currentValue = config.sueter;
                              } else if (
                                sub.key === "sueter_simple" ||
                                sub.label.toLowerCase().includes("prendas")
                              ) {
                                currentValue = config.sueter;
                              }
                            } else {
                              currentValue = (config as any)[sub.key];
                            }

                            const isSelected =
                              currentValue === file ||
                              (sub.key === "capas_profesor" &&
                                config.sueter === file);

                            const desbloqueado =
                              rolUsuario === "profesor" ||
                              desbloqueados.includes("ALL_ITEMS_UNLOCKED") ||
                              desbloqueados.some((n) =>
                                coincideNombre(n, file)
                              ) ||
                              file === "none";

                            return (
                              <div
                                key={file}
                                className={`avatar-editor-option group ${
                                  isSelected ? "is-selected" : ""
                                } ${!desbloqueado ? "is-locked" : ""}`}
                                style={{
                                  width: "100%",
                                  aspectRatio: "1 / 1",
                                  filter: desbloqueado
                                    ? "none"
                                    : "grayscale(100%) brightness(0.6)",
                                  opacity: desbloqueado ? 1 : 0.7,
                                  position: "relative",
                                }}
                                onClick={() => {
                                  const newConfig = { ...config };

                                  if (currentTab === "ropa") {
                                    const isPlayera =
                                      sub.key === "playera" ||
                                      sub.label === "Playera";
                                    const isSueterColor =
                                      sub.key === "sueter_color" ||
                                      sub.label
                                        .toLowerCase()
                                        .includes("suéter");
                                    const isSueterSimple =
                                      sub.key === "sueter_simple" ||
                                      sub.label
                                        .toLowerCase()
                                        .includes("prendas");
                                    const isProfesor =
                                      sub.key === "capas_profesor" ||
                                      sub.label
                                        .toLowerCase()
                                        .includes("profesor");

                                    newConfig.playera = "none";
                                    newConfig.sueter = "none";

                                    if (isPlayera) {
                                      newConfig.playera =
                                        file === "none" ? "none" : file;
                                    } else if (isSueterColor || isSueterSimple) {
                                      newConfig.sueter =
                                        file === "none" ? "none" : file;
                                    } else if (isProfesor) {
                                      newConfig.sueter =
                                        file === "none" ? "none" : file;
                                    }
                                  } else {
                                    (newConfig as any)[sub.key] = file;
                                  }

                                  setConfig(newConfig);
                                }}
                              >
                                <div className="avatar-editor-option-inner">
                                  {file === "none" ? (
                                    <span className="avatar-editor-none-text">
                                      Ninguno
                                    </span>
                                  ) : currentTab === "ropa" ? (
                                    sub.key === "playera" ? (
                                      <div className="avatar-editor-option-inner">
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
                                                backgroundColor:
                                                  config.sueterColor ??
                                                  "#ffffff",
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
                                              className="absolute inset-0 h-full w-full object-contain"
                                              alt={file}
                                            />
                                          </>
                                        ) : (
                                          <span className="avatar-editor-none-text">
                                            Ninguno
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      (TABS.find(
                                        (t) => t.key === "ropa"
                                      ) as any)?.renderItem?.(file, config) ??
                                      null
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
                                      className="max-h-full max-w-full object-contain"
                                      alt={file}
                                    />
                                  )}
                                </div>

                                {!desbloqueado && (
                                  <div className="avatar-editor-lock-layer absolute inset-0 flex items-center justify-center rounded-[18px]">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      className="h-6 w-6 text-white opacity-90"
                                      fill="currentColor"
                                    >
                                      <path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z" />
                                    </svg>

                                    <div className="avatar-editor-tooltip absolute left-1/2 top-1/2 z-[120] px-3 py-1.5 text-center text-[11px]">
                                      Desbloquea cofres
                                      <br />
                                      para obtener este elemento
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

                const items =
                  typeof (currentTabData as any).items === "function"
                    ? (currentTabData as any).items()
                    : (currentTabData as any).items;

                return (
                  <div
                    className={
                      currentTab === "gender"
                        ? "avatar-editor-gender-grid flex h-full items-stretch justify-between gap-3"
                        : "grid grid-cols-3 gap-3 px-2 pb-2 pt-2"
                    }
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
                          className={`avatar-editor-option group ${
                            isSelected ? "is-selected" : ""
                          } ${!desbloqueado ? "is-locked" : ""} ${
                            currentTab === "gender"
                              ? "avatar-editor-gender-option"
                              : ""
                          }`}
                          style={
                            currentTab === "gender"
                              ? {
                                  height: "220px",
                                  flex: "1 1 48%",
                                  maxWidth: "48%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }
                              : {
                                  width: "100%",
                                  aspectRatio: "1 / 1",
                                  filter: desbloqueado
                                    ? "none"
                                    : "grayscale(100%) brightness(0.6)",
                                  opacity: desbloqueado ? 1 : 0.7,
                                  position: "relative",
                                }
                          }
                          onClick={() => {
                            if (currentTab === "gender") {
                              setConfig((prev) => {
                                const nuevoGenero = file as
                                  | "masculino"
                                  | "femenino";

                                const nuevoConfig = {
                                  ...prev,
                                  gender: nuevoGenero,
                                  skin: "piel.png",
                                };

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
                            <span className="avatar-editor-gender-label">
                              {file === "masculino" ? "Masculino" : "Femenino"}
                            </span>
                          ) : (
                            <div
                              className={`avatar-editor-option-inner ${
                                currentTab === "accessory"
                                  ? "mx-auto h-20 w-20"
                                  : "h-full w-full"
                              }`}
                            >
                              {file === "none" ? (
                                <span className="avatar-editor-none-text">
                                  Ninguno
                                </span>
                              ) : (
                                <img
                                  src={
                                    currentTab === "hair"
                                      ? `/elementos_avatar/cabello/${config.gender}/previews/${file}`
                                      : currentTab === "eyes"
                                        ? [
                                            "Ojos5.png",
                                            "Ojos6.png",
                                            "Ojos7.png",
                                          ].includes(file)
                                          ? `/elementos_avatar/cara/ojos/previews/${file}`
                                          : `/elementos_avatar/cara/ojos/${config.gender}/previews/${file}`
                                        : currentTab === "mouth"
                                          ? `/elementos_avatar/cara/bocas/previews/${file}`
                                          : currentTab === "nose"
                                            ? `/elementos_avatar/cara/narices/previews/${file}`
                                            : ""
                                  }
                                  className="max-h-full max-w-full object-contain"
                                  alt={file}
                                />
                              )}
                            </div>
                          )}

                          {!desbloqueado && (
                            <div className="avatar-editor-lock-layer absolute inset-0 flex items-center justify-center rounded-[18px]">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="h-6 w-6 text-white opacity-90"
                                fill="currentColor"
                              >
                                <path d="M12 2a4 4 0 00-4 4v3H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm-2 7V6a2 2 0 114 0v3h-4z" />
                              </svg>

                              <div className="avatar-editor-tooltip absolute left-1/2 top-1/2 z-[120] px-3 py-1.5 text-center text-[11px] font-normal">
                                Desbloquea cofres
                                <br />
                                para obtener este elemento
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

        {/* Pie del modal */}
        <div className="avatar-editor-footer mt-4 flex flex-col-reverse items-stretch justify-end gap-3 sm:mt-6 sm:flex-row sm:items-center sm:gap-4">
          {!forzado && (
            <button
              type="button"
              className="avatar-editor-secondary-button px-4 py-2"
              onClick={onClose}
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            className="fcc-premium-button px-5 py-2"
            onClick={handleSave}
          >
            {forzado ? "Crear avatar" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes avatar-editor-fade-zoom-in {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(10px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes avatar-editor-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .avatar-editor-overlay {
          background:
            radial-gradient(
              circle at 18% 16%,
              color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent),
              transparent 34%
            ),
            radial-gradient(
              circle at 84% 78%,
              color-mix(in srgb, var(--fcc-premium-cyan) 14%, transparent),
              transparent 36%
            ),
            rgba(2, 8, 23, 0.58);
          backdrop-filter: blur(7px);
          animation: avatar-editor-fade-zoom-in 0.28s ease-out;
        }

        .avatar-editor-modal {
          height: auto;
          max-height: calc(100dvh - 2rem);
          color: var(--fcc-premium-text);
          background:
            radial-gradient(
              circle at 88% 90%,
              color-mix(in srgb, var(--fcc-premium-accent) 9%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface-strong),
              var(--fcc-premium-surface-soft)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow:
            0 30px 90px rgba(2, 8, 23, 0.28),
            var(--fcc-premium-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.72);
          animation: avatar-editor-fade-zoom-in 0.24s ease-out;
        }

        .theme-oscuro .avatar-editor-modal {
          box-shadow:
            0 34px 96px rgba(0, 0, 0, 0.72),
            var(--fcc-premium-shadow),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .avatar-editor-close {
          color: var(--fcc-premium-text);
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 92%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 92%, transparent)
            );
          border: 1px solid var(--fcc-premium-border);
          box-shadow: var(--fcc-premium-shadow-soft);
        }

        .avatar-editor-close:hover {
          transform: translateY(-1px);
          border-color: var(--fcc-premium-border-strong);
          color: var(--fcc-premium-accent);
        }

        .avatar-editor-eyebrow {
          margin-bottom: 0.2rem;
          color: var(--fcc-premium-accent);
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .avatar-editor-title {
          color: var(--fcc-premium-text);
          font-size: clamp(1.35rem, 3vw, 1.9rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .avatar-editor-preview-shell {
          --fcc-user-avatar-core: color-mix(in srgb, var(--fcc-premium-cyan) 18%, transparent);
          --fcc-user-avatar-a: color-mix(in srgb, var(--fcc-premium-accent) 34%, transparent);
          --fcc-user-avatar-b: color-mix(in srgb, var(--fcc-premium-cyan) 28%, transparent);
          --fcc-user-avatar-c: color-mix(in srgb, var(--fcc-premium-accent) 26%, transparent);
          --fcc-user-avatar-border: color-mix(in srgb, var(--fcc-premium-accent) 28%, transparent);
          --fcc-user-avatar-shadow-a: color-mix(in srgb, var(--fcc-premium-accent) 4%, transparent);
          --fcc-user-avatar-shadow-b: color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          --fcc-user-orbit-a: color-mix(in srgb, var(--fcc-premium-accent) 20%, transparent);
          --fcc-user-orbit-b: color-mix(in srgb, var(--fcc-premium-cyan) 22%, transparent);

          justify-content: flex-start;
          padding-top: 0;
          overflow: visible;
        }

        .avatar-editor-avatar-stage {
          --avatar-editor-stage-size: clamp(300px, 30vw, 420px);
          --avatar-editor-render-scale: 1.28;
          --avatar-editor-avatar-circle-size: 82%;
          --avatar-editor-avatar-ring-size: 70%;
          --avatar-editor-avatar-orbit-size: 66%;

          position: relative;
          flex: 0 0 auto;
          width: var(--avatar-editor-stage-size);
          height: var(--avatar-editor-stage-size);
          max-width: 100%;
          display: grid;
          place-items: end center;
          overflow: visible;
          isolation: isolate;
        }

        .avatar-editor-avatar-stage::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-circle-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          background:
            radial-gradient(circle, var(--fcc-user-avatar-core), transparent 62%),
            conic-gradient(
              from 210deg,
              transparent 0deg,
              var(--fcc-user-avatar-a) 42deg,
              transparent 84deg,
              var(--fcc-user-avatar-b) 145deg,
              transparent 210deg,
              var(--fcc-user-avatar-c) 285deg,
              transparent 360deg
            );
          filter: blur(0.2px);
          opacity: 0.95;
          z-index: -3;
        }

        .avatar-editor-avatar-stage::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-ring-size);
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          transform: translate(-50%, -50%);
          border: 1px solid var(--fcc-user-avatar-border);
          box-shadow:
            0 0 0 14px var(--fcc-user-avatar-shadow-a),
            0 0 42px var(--fcc-user-avatar-shadow-b);
          z-index: -2;
        }

        .avatar-editor-avatar-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--avatar-editor-avatar-orbit-size);
          aspect-ratio: 1 / 1;
          z-index: -1;
          border-radius: 999px;
          transform: translate(-50%, -50%) rotate(-18deg);
          background:
            linear-gradient(
              90deg,
              transparent 0 12%,
              var(--fcc-user-orbit-a) 12% 18%,
              transparent 18% 100%
            ),
            linear-gradient(
              180deg,
              transparent 0 60%,
              var(--fcc-user-orbit-b) 60% 64%,
              transparent 64% 100%
            );
          opacity: 0.95;
        }

        .avatar-editor-avatar-render {
          position: absolute !important;
          left: 50%;
          bottom: 0;
          z-index: 2;
          display: grid;
          place-items: center;
          transform: translateX(-50%) scale(var(--avatar-editor-render-scale)) !important;
          transform-origin: center bottom;
        }

        .avatar-editor-avatar-render > * {
          max-width: none !important;
          max-height: none !important;
        }

        .avatar-editor-color-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 58px;
          margin-top: 8px;
        }

        .avatar-editor-color-row {
          position: relative;
          z-index: 3;
          display: flex;
          width: 100%;
          justify-content: center;
        }

        .avatar-editor-color-dot {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 999px;
          border: 2px solid var(--fcc-premium-border);
          box-shadow: none;
          opacity: 0.96;
        }

        .avatar-editor-color-dot:hover {
          transform: translateY(-1px) scale(1.04);
        }

        .avatar-editor-color-dot.is-selected {
          transform: scale(1.08);
          border: 4px solid var(--fcc-premium-accent);
          box-shadow: none;
        }

        .avatar-editor-color-none {
          position: relative;
          cursor: default;
          pointer-events: none;
          opacity: 0.72;
          background:
            linear-gradient(
              135deg,
              transparent calc(50% - 1px),
              var(--fcc-premium-muted) calc(50% - 1px) calc(50% + 1px),
              transparent calc(50% + 1px)
            ),
            color-mix(in srgb, var(--fcc-premium-surface-strong) 94%, white);
          border-style: solid;
        }

        .avatar-editor-color-none.is-selected {
          opacity: 1;
          border-style: solid;
          border-color: var(--fcc-premium-accent);
        }

        .avatar-editor-color-none:hover {
          transform: none;
        }

        .avatar-editor-tabs {
          scrollbar-width: thin;
        }

        .avatar-editor-tab {
          min-height: 34px;
          border-radius: 999px;
          padding: 0 0.85rem;
          color: var(--fcc-premium-muted);
          background: transparent;
          border: 1px solid transparent;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .avatar-editor-tab:hover {
          color: var(--fcc-premium-text);
          background: color-mix(in srgb, var(--fcc-premium-accent) 8%, transparent);
          border-color: var(--fcc-premium-border);
        }

        .avatar-editor-tab.is-active {
          color: white;
          background: var(--fcc-premium-button);
          border-color: color-mix(in srgb, var(--fcc-premium-accent) 32%, transparent);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .theme-oscuro .avatar-editor-tab.is-active {
          color: #050505;
        }

        .avatar-editor-options-scroll {
          padding-bottom: 0.35rem;
        }

        .avatar-editor-section-title {
          color: var(--fcc-premium-text);
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .avatar-editor-option {
          cursor: pointer;
          overflow: visible;
          border-radius: 18px;
          border: 1px solid var(--fcc-premium-border);
          background:
            radial-gradient(
              circle at 72% 18%,
              color-mix(in srgb, var(--fcc-premium-cyan) 8%, transparent),
              transparent 34%
            ),
            linear-gradient(
              135deg,
              var(--fcc-premium-surface),
              var(--fcc-premium-surface-soft)
            );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
          transition:
            transform var(--fcc-transition),
            box-shadow var(--fcc-transition),
            border-color var(--fcc-transition),
            filter var(--fcc-transition),
            opacity var(--fcc-transition);
        }

        .theme-oscuro .avatar-editor-option {
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .avatar-editor-option:hover {
          transform: translateY(-2px);
          border-color: var(--fcc-premium-border-strong);
        }

        .avatar-editor-option.is-selected {
          transform: translateY(-1px);
          border-width: 2px;
          border-color: var(--fcc-premium-accent);
          box-shadow:
            inset 0 0 0 3px color-mix(in srgb, var(--fcc-premium-accent) 20%, transparent),
            inset 0 0 0 1px color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
        }

        .avatar-editor-option-inner {
          position: relative;
          display: flex;
          width: 100%;
          height: 100%;
          aspect-ratio: 1 / 1;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 88%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 94%, transparent)
            );
        }

        .avatar-editor-none-text {
          color: var(--fcc-premium-muted);
          font-size: 0.88rem;
          font-weight: 700;
        }

        .avatar-editor-options-scroll.is-gender-tab {
          overflow-y: hidden !important;
          padding: 0.35rem;
        }

        .avatar-editor-gender-grid {
          min-height: 100%;
          height: 100%;
          align-items: stretch;
          overflow: visible;
          padding: 0.25rem;
          box-sizing: border-box;
        }

        .avatar-editor-gender-option {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center;
          height: 100% !important;
          min-height: 220px;
          box-sizing: border-box;
        }

        .avatar-editor-gender-label {
          display: block;
          width: 100%;
          color: var(--fcc-premium-text);
          font-size: 1rem;
          font-weight: 900;
          text-align: center;
        }

        .avatar-editor-option.is-locked {
          z-index: 1;
        }

        .avatar-editor-option.is-locked:hover {
          z-index: 80;
        }

        .avatar-editor-lock-layer {
          z-index: 30;
          background: rgba(0, 0, 0, 0.28);
          overflow: visible;
          pointer-events: none;
        }

        .avatar-editor-tooltip {
          width: max-content;
          max-width: 124px;
          white-space: normal;
          word-break: normal;
          line-height: 1.08rem;
          color: var(--fcc-premium-text);
          background: var(--fcc-premium-surface-strong);
          border: 1px solid var(--fcc-premium-border);
          border-radius: 10px;
          box-shadow: none;
          opacity: 0;
          transform: translate(-50%, -50%);
          transition: opacity var(--fcc-transition);
        }

        .group:hover .avatar-editor-tooltip {
          opacity: 1;
          transform: translate(-50%, -50%);
        }

        .avatar-editor-secondary-button {
          min-height: 40px;
          border-radius: 12px;
          color: var(--fcc-premium-text);
          background:
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--fcc-premium-surface-strong) 94%, transparent),
              color-mix(in srgb, var(--fcc-premium-surface-soft) 94%, transparent)
            );
          border: 1px solid var(--fcc-premium-border);
          font-weight: 850;
          box-shadow: var(--fcc-premium-shadow-soft);
        }

        .avatar-editor-secondary-button:hover {
          transform: translateY(-1px);
          color: var(--fcc-premium-accent);
          border-color: var(--fcc-premium-border-strong);
        }

        .avatar-editor-toast {
          animation: avatar-editor-fade-in 0.3s ease-out;
        }

        @media (min-width: 641px) and (max-width: 1023px) {
          .avatar-editor-modal {
            height: calc(100dvh - 1.5rem) !important;
            max-height: calc(100dvh - 1.5rem) !important;
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            gap: 0.75rem !important;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            flex: 0 0 auto;
            margin: 0 auto;
            overflow: visible;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(58vw, 260px);
            --avatar-editor-render-scale: 0.82;
          }

          .avatar-editor-color-slot {
            min-height: 44px;
            margin-top: 0.15rem;
          }

          .avatar-editor-color-dot {
            width: 2rem;
            height: 2rem;
          }

          .avatar-editor-controls {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-tabs {
            flex: 0 0 auto;
            margin-bottom: 0.5rem !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            height: auto !important;
            flex: 1 1 auto;
            padding: 0.25rem 0.35rem 0.55rem;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            padding: 0.35rem;
            overflow-y: hidden !important;
          }

          .avatar-editor-options-scroll > .flex {
            padding: 0.25rem;
          }

          .avatar-editor-option.is-selected {
            transform: none;
            box-shadow:
              inset 0 0 0 3px color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent),
              inset 0 0 0 1px color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 128px !important;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
            flex-direction: row !important;
            align-items: stretch !important;
            margin-top: 0.75rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 42px;
            flex: 1 1 0;
            white-space: nowrap;
          }

          .avatar-editor-footer .fcc-premium-button {
            flex-grow: 1.18;
          }
        }

        @media (min-width: 641px) and (max-width: 1023px) and (max-height: 780px) {
          .avatar-editor-modal > .mb-3 {
            margin-bottom: 0.35rem !important;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(46vw, 220px);
            --avatar-editor-render-scale: 0.7;
          }

          .avatar-editor-color-slot {
            min-height: 36px;
          }

          .avatar-editor-color-dot {
            width: 1.72rem;
            height: 1.72rem;
          }

          .avatar-editor-tab {
            min-height: 30px;
            font-size: 0.68rem;
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 96px !important;
          }

          .avatar-editor-footer {
            margin-top: 0.5rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 38px;
          }
        }

        @media (max-width: 640px) {
          .avatar-editor-overlay {
            align-items: center;
            padding: 0.5rem;
          }

          .avatar-editor-modal {
            width: calc(100vw - 1rem) !important;
            height: calc(100dvh - 1rem) !important;
            max-height: calc(100dvh - 1rem) !important;
            border-radius: 24px;
            padding: 0.75rem !important;
            overflow: hidden;
          }

          .avatar-editor-close {
            right: 0.75rem;
            top: 0.75rem;
            height: 2.5rem;
            width: 2.5rem;
          }

          .avatar-editor-modal > .mb-3 {
            margin-bottom: 0.35rem !important;
            padding-left: 3rem !important;
            padding-right: 3rem !important;
          }

          .avatar-editor-eyebrow {
            margin-bottom: 0.08rem;
            font-size: 0.64rem;
            letter-spacing: 0.18em;
          }

          .avatar-editor-title {
            font-size: clamp(1.18rem, 5.7vw, 1.42rem);
          }

          .avatar-editor-body {
            min-height: 0;
            flex: 1 1 auto;
            gap: 0.45rem !important;
            overflow: hidden !important;
          }

          .avatar-editor-preview-shell {
            flex: 0 0 auto;
            margin: 0 auto;
            overflow: visible;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(72vw, 222px);
            --avatar-editor-render-scale: 0.72;
          }

          .avatar-editor-color-slot {
            flex: 0 0 auto;
            min-height: 38px;
            margin-top: 0.1rem;
          }

          .avatar-editor-color-row {
            gap: 0.62rem !important;
          }

          .avatar-editor-color-dot {
            width: 1.85rem;
            height: 1.85rem;
            flex: 0 0 auto;
          }

          .avatar-editor-color-dot.is-selected {
            border-width: 3px;
          }

          .avatar-editor-controls {
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden !important;
          }

          .avatar-editor-tabs {
            position: relative;
            z-index: 5;
            flex: 0 0 auto;
            margin-bottom: 0.35rem !important;
            padding-bottom: 0.35rem;
            gap: 0.42rem !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch;
          }

          .avatar-editor-tab {
            min-height: 30px;
            flex: 0 0 auto;
            padding: 0 0.68rem;
            font-size: 0.68rem;
          }

          .avatar-editor-options-scroll {
            min-height: 0;
            height: auto !important;
            flex: 1 1 auto;
            padding: 0.25rem 0.3rem 0.55rem;
            overflow-y: auto !important;
          }

          .avatar-editor-options-scroll.is-gender-tab {
            padding: 0.35rem;
            overflow-y: hidden !important;
          }

          .avatar-editor-options-scroll .grid {
            gap: 0.55rem !important;
          }

          .avatar-editor-options-scroll > .flex {
            min-height: 0 !important;
            height: auto !important;
            align-items: stretch !important;
            gap: 0.55rem !important;
            padding: 0.25rem;
          }

          .avatar-editor-options-scroll > .avatar-editor-gender-grid {
            min-height: 100% !important;
            height: 100% !important;
          }

          .avatar-editor-section-title {
            margin-bottom: 0.5rem !important;
            font-size: 0.78rem;
          }

          .avatar-editor-option {
            border-radius: 16px;
          }

          .avatar-editor-option-inner {
            border-radius: 14px;
          }

          .avatar-editor-option.is-selected {
            transform: none;
            box-shadow:
              inset 0 0 0 3px color-mix(in srgb, var(--fcc-premium-accent) 24%, transparent),
              inset 0 0 0 1px color-mix(in srgb, var(--fcc-premium-accent) 18%, transparent);
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 120px !important;
            flex: 1 1 calc(50% - 0.3rem) !important;
            max-width: none !important;
            margin: 0 !important;
          }

          .avatar-editor-gender-label {
            font-size: 0.9rem;
          }

          .avatar-editor-footer {
            flex: 0 0 auto;
            flex-direction: row !important;
            align-items: stretch !important;
            margin-top: 0.55rem !important;
            gap: 0.55rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 40px;
            flex: 1 1 0;
            border-radius: 14px;
            padding: 0.45rem 0.6rem !important;
            font-size: clamp(0.76rem, 3.4vw, 0.9rem);
            white-space: nowrap;
          }

          .avatar-editor-footer .fcc-premium-button {
            flex-grow: 1.18;
          }
        }

        @media (max-width: 640px) and (max-height: 760px) {
          .avatar-editor-modal {
            padding: 0.62rem !important;
          }

          .avatar-editor-modal > .mb-3 {
            margin-bottom: 0.2rem !important;
          }

          .avatar-editor-eyebrow {
            font-size: 0.58rem;
          }

          .avatar-editor-title {
            font-size: clamp(1.06rem, 5.2vw, 1.24rem);
          }

          .avatar-editor-body {
            gap: 0.34rem !important;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(58vw, 190px);
            --avatar-editor-render-scale: 0.63;
          }

          .avatar-editor-color-slot {
            min-height: 32px;
          }

          .avatar-editor-color-row {
            gap: 0.5rem !important;
          }

          .avatar-editor-color-dot {
            width: 1.55rem;
            height: 1.55rem;
          }

          .avatar-editor-tab {
            min-height: 28px;
            padding: 0 0.62rem;
            font-size: 0.64rem;
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 96px !important;
          }

          .avatar-editor-footer {
            margin-top: 0.42rem !important;
            gap: 0.45rem !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 36px;
            border-radius: 12px;
          }
        }

        @media (max-width: 380px) {
          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(70vw, 188px);
            --avatar-editor-render-scale: 0.62;
          }

          .avatar-editor-tab {
            padding: 0 0.58rem;
          }
        }

        @media (max-width: 640px) and (max-height: 640px) {
          .avatar-editor-close {
            height: 2.25rem;
            width: 2.25rem;
          }

          .avatar-editor-modal > .mb-3 {
            padding-left: 2.7rem !important;
            padding-right: 2.7rem !important;
          }

          .avatar-editor-eyebrow {
            display: none;
          }

          .avatar-editor-avatar-stage {
            --avatar-editor-stage-size: min(46vw, 160px);
            --avatar-editor-render-scale: 0.53;
          }

          .avatar-editor-color-slot {
            min-height: 28px;
          }

          .avatar-editor-color-dot {
            width: 1.38rem;
            height: 1.38rem;
          }

          .avatar-editor-gender-option {
            height: 100% !important;
            min-height: 76px !important;
          }

          .avatar-editor-footer .fcc-premium-button,
          .avatar-editor-footer .avatar-editor-secondary-button {
            min-height: 34px;
            font-size: 0.72rem;
          }
        }
      `}</style>

      {mensaje && (
        <div className="avatar-editor-toast fixed bottom-4 left-4 right-4 z-[10030] rounded-2xl border px-4 py-3 text-sm shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md">
          {mensaje}
        </div>
      )}

      <style jsx global>{`
        .avatar-editor-toast {
          color: var(--fcc-premium-text);
          background: var(--fcc-premium-surface-strong);
          border-color: var(--fcc-premium-border);
          box-shadow: var(--fcc-premium-shadow);
        }
      `}</style>
    </div>,
    document.body
  );
}