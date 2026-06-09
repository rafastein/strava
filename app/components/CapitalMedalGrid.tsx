import type { CSSProperties } from "react";
import {
  capitalMedalMetaByState,
  type CapitalChallengeItem,
  type CapitalStatus,
} from "../lib/capitals-challenge";

type Palette = {
  shellBorder: string;
  shellBackground: string;
  shellShadow: string;
  codeColor: string;
  motifColor: string;
  glowColor: string;
  ringColor: string;
};

const REGULAR_HEX = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

// Mapeia code → arquivo de imagem em /public/capitais/
const PHOTO_BY_CODE: Record<string, string> = {
  BSB: "/capitais/bsb.jpg",
  RIO: "/capitais/rio.jpg",
  SPO: "/capitais/spo.jpg",
  GYN: "/capitais/gyn.jpg",
  BHZ: "/capitais/bhz.jpg",
  CWB: "/capitais/cwb.jpg",
  CGR: "/capitais/cgr.jpg",
  CGB: "/capitais/cgb.jpg",
  AJU: "/capitais/aju.jpg",
  FOR: "/capitais/for.jpg",
  JPA: "/capitais/jpa.jpg",
  MCZ: "/capitais/mcz.jpg",
  NAT: "/capitais/nat.jpg",
  REC: "/capitais/rec.jpg",
  SSA: "/capitais/ssa.jpg",
  SLZ: "/capitais/slz.jpg",
  THE: "/capitais/the.jpg",
  BEL: "/capitais/bel.jpg",
  BVB: "/capitais/bvb.jpg",
  MCP: "/capitais/mcp.jpg",
  MAO: "/capitais/mao.jpg",
  PMW: "/capitais/pmw.jpg",
  PVH: "/capitais/pvh.jpg",
  RBR: "/capitais/rbr.jpg",
  VIX: "/capitais/vix.jpg",
  FLN: "/capitais/fln.jpg",
  POA: "/capitais/poa.jpg",
};

function getPalette(status: CapitalStatus): Palette {
  if (status === "completed") {
    return {
      shellBorder: "rgba(255,210,120,0.92)",
      shellBackground:
        "radial-gradient(circle at 50% 14%, rgba(255,243,204,0.96), rgba(247,187,69,0.96) 42%, rgba(178,104,18,0.98) 100%)",
      shellShadow: "0 18px 40px rgba(245,166,35,0.30)",
      codeColor: "#f5a623",
      motifColor: "#f5a623",
      glowColor: "rgba(255,213,118,0.44)",
      ringColor: "rgba(98,55,7,0.22)",
    };
  }

  if (status === "next") {
    return {
      shellBorder: "rgba(255,239,194,0.92)",
      shellBackground:
        "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,248,229,0.98) 50%, rgba(239,220,178,0.98) 100%)",
      shellShadow: "0 16px 34px rgba(255,233,185,0.16)",
      codeColor: "#4db8ff",
      motifColor: "#4db8ff",
      glowColor: "rgba(255,236,190,0.24)",
      ringColor: "rgba(154,106,18,0.18)",
    };
  }

  return {
    shellBorder: "rgba(255,255,255,0.12)",
    shellBackground:
      "linear-gradient(180deg, rgba(54,54,58,0.96), rgba(28,28,31,0.98) 54%, rgba(12,12,14,1) 100%)",
    shellShadow: "0 8px 24px rgba(0,0,0,0.18)",
    codeColor: "rgba(255,255,255,0.50)",
    motifColor: "rgba(255,255,255,0.34)",
    glowColor: "rgba(255,255,255,0.06)",
    ringColor: "rgba(255,255,255,0.09)",
  };
}

function MedalShell({ item }: { item: CapitalChallengeItem }) {
  const meta = capitalMedalMetaByState[item.state];
  const palette = getPalette(item.status);
  const statusLabel =
    item.status === "completed" ? "Concluída" : item.status === "next" ? "Próxima" : "Pendente";
  const photoSrc = PHOTO_BY_CODE[meta.code];
  const isLocked = item.status === "locked";

  return (
    <article
      title={`${item.city} · ${meta.motif}`}
      style={{
        display: "grid",
        justifyItems: "center",
        alignItems: "start",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 98,
          aspectRatio: "1 / 0.866",
          clipPath: REGULAR_HEX,
          backgroundImage: photoSrc ? `url(${photoSrc})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
          backgroundColor: photoSrc ? "#1a1a1a" : undefined,
          background: photoSrc ? undefined : palette.shellBackground,
          filter: isLocked ? "grayscale(100%) brightness(0.55)" : "none",
          boxShadow: palette.shellShadow,
          isolation: "isolate",
          overflow: "hidden",
        }}
      >

        {/* Overlay por status */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: isLocked
              ? "rgba(0,0,0,0.48)"
              : item.status === "completed"
              ? "linear-gradient(180deg, rgba(180,110,0,0.22) 0%, rgba(0,0,0,0.28) 100%)"
              : "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.26) 100%)",
            zIndex: 1,
          }}
        />

        {/* Borda interna hex dourada */}
        <div
          style={{
            position: "absolute",
            inset: 4,
            clipPath: REGULAR_HEX,
            border: `1.5px solid ${
              item.status === "completed"
                ? "rgba(255,210,100,0.6)"
                : item.status === "next"
                ? "rgba(255,255,255,0.4)"
                : "rgba(255,255,255,0.10)"
            }`,
            zIndex: 2,
          }}
        />

        {/* Brilho topo */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "8%",
            transform: "translateX(-50%)",
            width: 38,
            height: 2.5,
            borderRadius: 999,
            background: isLocked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.32)",
            opacity: 0.72,
            zIndex: 3,
          }}
        />

        {/* Indicador status (ponto laranja/branco) */}
        {!isLocked && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 9,
              top: 11,
              width: 7,
              height: 7,
              borderRadius: 999,
              background: item.status === "completed" ? "#fff4c8" : "#f5a623",
              boxShadow:
                item.status === "completed"
                  ? "0 0 10px rgba(255,255,255,0.55)"
                  : "0 0 8px rgba(245,166,35,0.6)",
              zIndex: 4,
            }}
          />
        )}


      </div>

      {/* Nome e status abaixo */}
      <div style={{ textAlign: "center", minHeight: 26, maxWidth: 106 }}>
        <div
          style={{
            color: "#fff",
            fontSize: 11,
            fontWeight: 850,
            lineHeight: 1.12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.city}
        </div>
        <div
          style={{
            marginTop: 5,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 16,
            padding: "0 0.42rem",
            borderRadius: 999,
            border: `1px solid ${palette.ringColor}`,
            color: isLocked ? "rgba(255,255,255,0.32)" : palette.motifColor,
            fontSize: 7.5,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {statusLabel}
        </div>
      </div>
    </article>
  );
}

export default function CapitalMedalGrid({ items }: { items: CapitalChallengeItem[] }) {
  const completed = items.filter((item) => item.status === "completed").length;
  const next = items.filter((item) => item.status === "next").length;
  const remaining = items.length - completed;

  const orderedItems = [...items].sort((a, b) => {
    const statusOrder: Record<CapitalStatus, number> = { completed: 0, next: 1, locked: 2 };
    return (
      statusOrder[a.status] - statusOrder[b.status] ||
      a.region.localeCompare(b.region, "pt-BR", { sensitivity: "base" }) ||
      a.city.localeCompare(b.city, "pt-BR", { sensitivity: "base" })
    );
  });

  return (
    <section
      className="ba-card"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "clamp(1rem, 2vw, 1.3rem)",
        border: "1px solid rgba(245,166,35,0.18)",
        background:
          "radial-gradient(circle at 18% 0%, rgba(245,166,35,0.14), transparent 30%), radial-gradient(circle at 85% 8%, rgba(255,255,255,0.08), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018))",
        boxShadow: "0 22px 70px rgba(0,0,0,0.28)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          opacity: 0.16,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p className="ba-eyebrow">Coleção oficial do desafio</p>
            <h2
              style={{
                color: "#fff",
                fontSize: "clamp(1.85rem, 3.5vw, 2.65rem)",
                lineHeight: 0.98,
                letterSpacing: "-0.05em",
                fontWeight: 950,
                marginTop: "0.35rem",
              }}
            >
              Capitais conquistadas
            </h2>
            <p className="ba-muted" style={{ marginTop: ".48rem", maxWidth: 740, lineHeight: 1.55, fontSize: 13 }}>
              As concluídas entram douradas, as próximas ficam iluminadas e as pendentes seguem bloqueadas.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(76px, 1fr))",
              gap: 8,
              minWidth: "min(270px, 100%)",
            }}
          >
            <SummaryBox label="Concluídas" value={String(completed)} tone="completed" />
            <SummaryBox label="Próximas" value={String(next)} tone="next" />
            <SummaryBox label="Restantes" value={String(remaining)} tone="locked" />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(78px, 1fr))",
            gap: "12px 8px",
            marginTop: "1.1rem",
          }}
        >
          {orderedItems.map((item) => (
            <MedalShell key={item.state} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SummaryBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: CapitalStatus;
}) {
  const palette = getPalette(tone);
  const style: CSSProperties = {
    minWidth: 0,
    borderRadius: 14,
    border: `1px solid ${
      tone === "completed"
        ? "rgba(245,166,35,0.36)"
        : tone === "next"
        ? "rgba(255,255,255,0.22)"
        : "rgba(255,255,255,0.10)"
    }`,
    background: tone === "locked" ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0.18)",
    padding: "0.72rem 0.78rem",
    boxShadow: tone === "completed" ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
  };

  return (
    <div style={style}>
      <p className="ba-label" style={{ fontSize: 9, whiteSpace: "nowrap" }}>
        {label}
      </p>
      <p
        style={{
          marginTop: 5,
          color: tone === "locked" ? "#fff" : palette.codeColor,
          fontSize: 27,
          fontWeight: 950,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        {value}
      </p>
    </div>
  );
}