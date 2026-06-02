import type { CSSProperties } from "react";
import {
  capitalMedalMetaByState,
  type CapitalChallengeItem,
  type CapitalMedalSymbol,
  type CapitalStatus,
} from "../lib/capitals-challenge";

type Palette = {
  shellBorder: string;
  shellBackground: string;
  shellShadow: string;
  iconStroke: string;
  codeColor: string;
  motifColor: string;
  glowColor: string;
  ringColor: string;
};

const REGULAR_HEX = "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";

function getPalette(status: CapitalStatus): Palette {
  if (status === "completed") {
    return {
      shellBorder: "rgba(255,210,120,0.92)",
      shellBackground:
        "radial-gradient(circle at 50% 14%, rgba(255,243,204,0.96), rgba(247,187,69,0.96) 42%, rgba(178,104,18,0.98) 100%)",
      shellShadow: "0 18px 40px rgba(245,166,35,0.30)",
      iconStroke: "#5f3305",
      codeColor: "#5a2f00",
      motifColor: "rgba(90,47,0,0.86)",
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
      iconStroke: "#9b6a11",
      codeColor: "#9a6a12",
      motifColor: "rgba(154,106,18,0.84)",
      glowColor: "rgba(255,236,190,0.24)",
      ringColor: "rgba(154,106,18,0.18)",
    };
  }

  return {
    shellBorder: "rgba(255,255,255,0.12)",
    shellBackground:
      "linear-gradient(180deg, rgba(54,54,58,0.96), rgba(28,28,31,0.98) 54%, rgba(12,12,14,1) 100%)",
    shellShadow: "0 8px 24px rgba(0,0,0,0.18)",
    iconStroke: "rgba(255,255,255,0.46)",
    codeColor: "rgba(255,255,255,0.50)",
    motifColor: "rgba(255,255,255,0.34)",
    glowColor: "rgba(255,255,255,0.06)",
    ringColor: "rgba(255,255,255,0.09)",
  };
}

function SymbolSvg({ symbol, palette }: { symbol: CapitalMedalSymbol; palette: Palette }) {
  const common = {
    fill: "none",
    stroke: palette.iconStroke,
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (symbol) {
    case "rubber-tree": // AC · Palácio Rio Branco
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M14 46h36" />
          <path {...common} d="M18 46V29h28v17" />
          <path {...common} d="M21 29h22l-2-6H23l-2 6Z" />
          <path {...common} d="M24 46V35" />
          <path {...common} d="M32 46V35" />
          <path {...common} d="M40 46V35" />
          <path {...common} d="M27 35h10" />
          <path {...common} d="M20 24h24" />
        </svg>
      );
    case "palm": // AL · Farol da Ponta Verde
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M29 47h6" />
          <path {...common} d="M30 47V20h4v27" />
          <path {...common} d="M28 20h8l-2-5h-4l-2 5Z" />
          <path {...common} d="M27 28h10" />
          <path {...common} d="M26 35h12" />
          <path {...common} d="M23 47h18" />
        </svg>
      );
    case "equator": // AP · Marco Zero
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle {...common} cx="32" cy="20" r="5" />
          <path {...common} d="M32 25v16" />
          <path {...common} d="M24 41h16" />
          <path {...common} d="M20 47h24" />
          <path {...common} d="M23 33h18" />
        </svg>
      );
    case "victoria-regia": // AM · Teatro Amazonas
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M20 46h24" />
          <path {...common} d="M22 46V31h20v15" />
          <path {...common} d="M24 31h16" />
          <path {...common} d="M26 31v-4c0-3 3-6 6-6s6 3 6 6v4" />
          <path {...common} d="M28 46V36" />
          <path {...common} d="M36 46V36" />
          <path {...common} d="M31 19h2" />
        </svg>
      );
    case "berimbau": // BA · Elevador Lacerda
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M22 46V17" />
          <path {...common} d="M22 17h14" />
          <path {...common} d="M36 17v29" />
          <path {...common} d="M22 28h14" />
          <path {...common} d="M22 36h14" />
          <path {...common} d="M18 46h22" />
        </svg>
      );
    case "jangada": // CE · Ponte dos Ingleses
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M15 34h34" />
          <path {...common} d="M20 34 25 26l5 8 5-8 5 8" />
          <path {...common} d="M15 41c4-2 8-2 12 0 4-2 8-2 12 0 4-2 8-2 12 0" />
          <path {...common} d="M17 46h30" />
        </svg>
      );
    case "brasilia-sky": // DF · Congresso Nacional
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M16 45h32" />
          <path {...common} d="M26 45V28h4v17" />
          <path {...common} d="M34 45V28h4v17" />
          <path {...common} d="M24 28h16" />
          <path {...common} d="M18 36c3-5 7-7 10-7" />
          <path {...common} d="M46 36c-3-5-7-7-10-7" />
          <path {...common} d="M19 37h10" />
          <path {...common} d="M35 37h10" />
        </svg>
      );
    case "sea-cliff": // ES · Convento da Penha
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 46c10-2 15-9 19-21 5 2 8 9 9 21" />
          <path {...common} d="M28 31h8" />
          <path {...common} d="M30 31v-6h4v6" />
          <path {...common} d="M24 46h18" />
        </svg>
      );
    case "ipe": // GO · Monumento às Três Raças
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M22 46c0-8 4-13 10-20" />
          <path {...common} d="M42 46c0-8-4-13-10-20" />
          <path {...common} d="M32 46V24" />
          <path {...common} d="M25 46h14" />
        </svg>
      );
    case "tiles": // MA · Palácio dos Leões
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 46h28" />
          <path {...common} d="M20 46V28h24v18" />
          <path {...common} d="M24 28v-5h16v5" />
          <path {...common} d="M25 35h4" />
          <path {...common} d="M35 35h4" />
          <path {...common} d="M30 46V36h4v10" />
        </svg>
      );
    case "viola": // MT · Arena Pantanal
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 42c5-7 9-10 14-10s9 3 14 10" />
          <path {...common} d="M20 42h24" />
          <path {...common} d="M24 42v4" />
          <path {...common} d="M32 42v4" />
          <path {...common} d="M40 42v4" />
          <path {...common} d="M23 38h18" />
        </svg>
      );
    case "bird": // MS · Obelisco
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M32 18 38 45H26l6-27Z" />
          <path {...common} d="M23 47h18" />
          <path {...common} d="M28 34h8" />
        </svg>
      );
    case "mountains": // MG · Igreja da Pampulha
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M16 45c6-8 13-12 18-12 6 0 10 4 14 12" />
          <path {...common} d="M24 45V27" />
          <path {...common} d="M24 27h8" />
          <path {...common} d="M36 45V34" />
          <path {...common} d="M20 48h24" />
        </svg>
      );
    case "acai": // PA · Ver-o-Peso
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M19 46h26" />
          <path {...common} d="M22 46V31h20v15" />
          <path {...common} d="M22 31h20" />
          <path {...common} d="M27 31v-5l5-4 5 4v5" />
          <path {...common} d="M28 38h8" />
        </svg>
      );
    case "sunrise": // PB · Farol do Cabo Branco
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M28 47h8" />
          <path {...common} d="M30 47V19h4v28" />
          <path {...common} d="M28 19h8l-2-5h-4l-2 5Z" />
          <path {...common} d="M27 28h10" />
          <path {...common} d="M26 35h12" />
        </svg>
      );
    case "araucaria": // PR · Jardim Botânico
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 46h28" />
          <path {...common} d="M22 46V33c0-7 4-12 10-12s10 5 10 12v13" />
          <path {...common} d="M24 33h16" />
          <path {...common} d="M27 29c2-3 4-5 5-5 2 0 4 2 5 5" />
          <path {...common} d="M32 24v-4" />
          <path {...common} d="M26 39h12" />
        </svg>
      );
    case "umbrella": // PE · Ponte Maurício de Nassau
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M15 36h34" />
          <path {...common} d="M21 36V26" />
          <path {...common} d="M43 36V26" />
          <path {...common} d="M21 26c3-4 6-6 11-6s8 2 11 6" />
          <path {...common} d="M18 42c5-2 9-2 14 0 5-2 9-2 14 0" />
        </svg>
      );
    case "rivers": // PI · Ponte Estaiada
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M32 20v25" />
          <path {...common} d="M24 45h16" />
          <path {...common} d="M32 24 24 32" />
          <path {...common} d="M32 29 22 39" />
          <path {...common} d="M32 24 40 32" />
          <path {...common} d="M32 29 42 39" />
        </svg>
      );
    case "wave-boardwalk": // RJ · Cristo Redentor
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M32 21v20" />
          <path {...common} d="M20 29h24" />
          <path {...common} d="M28 21c1-4 2-6 4-6s3 2 4 6" />
          <path {...common} d="M24 45c5-3 11-3 16 0" />
        </svg>
      );
    case "sun-dunes": // RN · Forte dos Reis Magos
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M22 45 16 34l16-9 16 9-6 11" />
          <path {...common} d="M32 25v20" />
          <path {...common} d="M24 45h16" />
        </svg>
      );
    case "sunset": // RS · Usina do Gasômetro
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M20 46V25h16v21" />
          <path {...common} d="M36 46V18h8v28" />
          <path {...common} d="M20 31h16" />
          <path {...common} d="M16 46h32" />
        </svg>
      );
    case "boat": // RO · Três Caixas d'Água
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect {...common} x="18" y="23" width="6" height="18" rx="2" />
          <rect {...common} x="29" y="19" width="6" height="22" rx="2" />
          <rect {...common} x="40" y="23" width="6" height="18" rx="2" />
          <path {...common} d="M16 45h32" />
        </svg>
      );
    case "tepui": // RR · Portal do Milênio
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M20 46V24h24v22" />
          <path {...common} d="M20 24h24" />
          <path {...common} d="M27 46V32h10v14" />
        </svg>
      );
    case "bridge-sea": // SC · Ponte Hercílio Luz
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M16 42h32" />
          <path {...common} d="M22 42V22" />
          <path {...common} d="M42 42V22" />
          <path {...common} d="M22 23c2-3 5-5 10-5s8 2 10 5" />
          <path {...common} d="M22 28h20" />
          <path {...common} d="M25 28 23 42" />
          <path {...common} d="M39 28 41 42" />
        </svg>
      );
    case "skyline": // SP · MASP
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 46h28" />
          <path {...common} d="M22 46V29" />
          <path {...common} d="M42 46V29" />
          <path {...common} d="M22 29h20" />
          <path {...common} d="M28 29v-7h8v7" />
          <path {...common} d="M24 38h16" />
        </svg>
      );
    case "crab": // SE · Arcos da Orla
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 46h28" />
          <path {...common} d="M20 46c0-9 5-15 12-15s12 6 12 15" />
          <path {...common} d="M26 46c0-5 3-8 6-8s6 3 6 8" />
        </svg>
      );
    case "sunflower": // TO · Palácio Araguaia
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 46h28" />
          <path {...common} d="M21 46V28h22v18" />
          <path {...common} d="M26 28v-6h12v6" />
          <path {...common} d="M32 22v-4" />
          <path {...common} d="M29 37h6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle {...common} cx="32" cy="32" r="12" />
        </svg>
      );
  }
}

function MedalShell({ item }: { item: CapitalChallengeItem }) {
  const meta = capitalMedalMetaByState[item.state];
  const palette = getPalette(item.status);
  const statusLabel = item.status === "completed" ? "Concluída" : item.status === "next" ? "Próxima" : "Pendente";

  return (
    <article
      title={`${item.city} · ${meta.motif}`}
      style={{
        display: "grid",
        justifyItems: "center",
        alignItems: "start",
        gap: 5,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 92,
          aspectRatio: "0.866 / 1",
          display: "grid",
          placeItems: "center",
          padding: "0.54rem 0.50rem 0.62rem",
          clipPath: REGULAR_HEX,
          border: `1px solid ${palette.shellBorder}`,
          background: palette.shellBackground,
          boxShadow: palette.shellShadow,
          isolation: "isolate",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -10,
            background: `radial-gradient(circle at 50% 16%, ${palette.glowColor}, transparent 60%)`,
            opacity: item.status === "locked" ? 0.5 : 1,
            zIndex: -1,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 4,
            clipPath: REGULAR_HEX,
            border: `1px solid ${palette.ringColor}`,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 9,
            clipPath: REGULAR_HEX,
            border: `1px solid ${palette.ringColor}`,
            opacity: 0.68,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "10%",
            transform: "translateX(-50%)",
            width: 34,
            height: 2.5,
            borderRadius: 999,
            background: item.status === "locked" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.36)",
            opacity: 0.72,
          }}
        />

        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            border: `1px solid ${palette.ringColor}`,
            background: item.status === "locked" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.10)",
            display: "grid",
            placeItems: "center",
            marginTop: 1,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ width: 40, height: 40, display: "grid", placeItems: "center" }}>
            <SymbolSvg symbol={meta.symbol} palette={palette} />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 13,
            transform: "translateX(-50%)",
            color: palette.codeColor,
            fontWeight: 950,
            fontSize: 13,
            lineHeight: 1,
            letterSpacing: "0.08em",
            textShadow: item.status === "completed" ? "0 1px 0 rgba(255,255,255,0.3)" : "none",
          }}
        >
          {meta.code}
        </div>

        {item.status !== "locked" && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 8,
              top: 13,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: item.status === "completed" ? "#fff4c8" : "#f5a623",
              boxShadow: item.status === "completed" ? "0 0 12px rgba(255,255,255,0.55)" : "0 0 10px rgba(245,166,35,0.46)",
            }}
          />
        )}
      </div>

      <div style={{ textAlign: "center", minHeight: 26, maxWidth: 100 }}>
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
            color: item.status === "locked" ? "rgba(255,255,255,0.32)" : palette.motifColor,
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
            gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))",
            gap: "10px 8px",
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
    border: `1px solid ${tone === "completed" ? "rgba(245,166,35,0.36)" : tone === "next" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)"}`,
    background: tone === "locked" ? "rgba(0,0,0,0.24)" : "rgba(0,0,0,0.18)",
    padding: "0.72rem 0.78rem",
    boxShadow: tone === "completed" ? "inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
  };

  return (
    <div style={style}>
      <p className="ba-label" style={{ fontSize: 9, whiteSpace: "nowrap" }}>{label}</p>
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
