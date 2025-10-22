"use client";
import { useEffect, useState } from "react";
import { aplicarXP } from "@/lib/aplicarXP";

interface Props {
  logro: {
    nombre: string;
    descripcion: string;
    xp_recompensa: number;
    icono_url?: string | null;
  };
  onClose: () => void;
}

export default function ModalLogroDesbloqueado({ logro, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div
      data-logro-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.97)",
        transition: "all 0.6s ease-in-out",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-card)",
          color: "var(--color-text)",
          padding: "30px 40px",
          borderRadius: "22px",
          boxShadow: "0 0 50px rgba(255,255,255,0.9), 0 0 40px var(--color-accent)",
          textAlign: "center",
          maxWidth: "420px",
          animation: "aparecer 0.6s ease-out",
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <img
            src={logro.icono_url || "/icons/trophy_default.png"}
            alt={logro.nombre}
            onError={(e) => (e.currentTarget.src = "/icons/trophy_default.png")}
            style={{
              width: "120px",
              height: "120px",
              objectFit: "contain",
              margin: "0 auto 10px",
              display: "block",
              filter: "drop-shadow(0 0 10px var(--color-accent))",
            }}
          />
        {!logro.nombre && <div style={{ fontSize: "52px" }}>🏆</div>}
        </div>

        <h2 style={{ fontSize: "22px", marginBottom: "8px" }}>{logro.nombre}</h2>
        <p style={{ fontSize: "15px", opacity: 0.9 }}>{logro.descripcion}</p>
        <p
          style={{
            fontSize: "15px",
            marginTop: "10px",
            color: "var(--color-accent)",
            fontWeight: 600,
          }}
        >
          +{logro.xp_recompensa} XP
        </p>

        <button
          onClick={async () => {
            const userId = localStorage.getItem("user_id");
            if (userId) {
              await aplicarXP(userId, logro.xp_recompensa);
            }

            window.dispatchEvent(new Event("logroCerrado"));

            setVisible(false);
            setTimeout(onClose, 500);
          }}
          style={{
            marginTop: "18px",
            backgroundColor: "#2ecc71",
            color: "white",
            border: "none",
            padding: "10px 28px",
            borderRadius: "10px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow:
              "0 0 20px rgba(255,255,255,0.8), 0 0 25px var(--color-accent)",
            transition: "all 0.3s ease",
          }}
        >
          Continuar
        </button>
      </div>

      <style jsx global>{`
        @keyframes aparecer {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
