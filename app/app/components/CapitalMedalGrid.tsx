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
  iconFill: string;
  codeColor: string;
  motifColor: string;
};

function getPalette(status: CapitalStatus): Palette {
  if (status === "completed") {
    return {
      shellBorder: "rgba(255,204,102,0.9)",
      shellBackground:
        "radial-gradient(circle at 30% 24%, rgba(255,226,152,0.95), rgba(245,166,35,0.96) 48%, rgba(162,84,12,0.98) 100%)",
      shellShadow: "0 18px 40px rgba(245,166,35,0.30)",
      iconStroke: "#5a2f00",
      iconFill: "rgba(90,47,0,0.10)",
      codeColor: "#5a2f00",
      motifColor: "rgba(90,47,0,0.86)",
    };
  }

  if (status === "next") {
    return {
      shellBorder: "rgba(255,236,190,0.92)",
      shellBackground:
        "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,246,223,0.98) 52%, rgba(243,222,170,0.98) 100%)",
      shellShadow: "0 16px 36px rgba(255,233,185,0.12)",
      iconStroke: "#9a6a12",
      iconFill: "rgba(154,106,18,0.08)",
      codeColor: "#9a6a12",
      motifColor: "rgba(154,106,18,0.82)",
    };
  }

  return {
    shellBorder: "rgba(255,255,255,0.12)",
    shellBackground:
      "linear-gradient(180deg, rgba(50,50,54,0.96), rgba(25,25,28,0.98) 52%, rgba(14,14,16,1) 100%)",
    shellShadow: "none",
    iconStroke: "rgba(255,255,255,0.42)",
    iconFill: "rgba(255,255,255,0.03)",
    codeColor: "rgba(255,255,255,0.50)",
    motifColor: "rgba(255,255,255,0.34)",
  };
}

function SymbolSvg({ symbol, palette }: { symbol: CapitalMedalSymbol; palette: Palette }) {
  const common = {
    fill: "none",
    stroke: palette.iconStroke,
    strokeWidth: 2.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (symbol) {
    case "rubber-tree":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M32 45v-11" />
          <path {...common} d="M31 22c-6 0-11 4-11 10 0 5 4 8 12 8s12-3 12-8c0-6-5-10-11-10h-2Z" />
          <path {...common} d="M38 18c0 3-2 6-6 6 0-4 2-7 6-8 0 1 0 1 0 2Z" />
          <path {...common} d="M29 45h6" />
        </svg>
      );
    case "palm":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M32 46c0-7 1-15 4-23" />
          <path {...common} d="M32 46c0-7-1-15-4-23" />
          <path {...common} d="M32 18c2-4 6-7 12-8-2 6-6 9-12 9" />
          <path {...common} d="M32 18c-2-4-6-7-12-8 2 6 6 9 12 9" />
          <path {...common} d="M32 19c5-3 10-3 15 0-5 3-10 3-15 0Z" />
          <path {...common} d="M32 19c-5-3-10-3-15 0 5 3 10 3 15 0Z" />
          <path {...common} d="M27 49h10" />
        </svg>
      );
    case "equator":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle {...common} cx="32" cy="27" r="12" />
          <path {...common} d="M20 27h24" />
          <path {...common} d="M32 15c-3 4-4 8-4 12 0 4 1 8 4 12" />
          <path {...common} d="M32 15c3 4 4 8 4 12 0 4-1 8-4 12" />
          <path {...common} d="M32 39v8" />
          <path {...common} d="M28 47h8" />
        </svg>
      );
    case "victoria-regia":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M16 35c4-10 13-14 16-14 4 0 12 4 16 14-6 6-26 6-32 0Z" />
          <path {...common} d="M32 21v14" />
          <path {...common} d="M24 29h16" />
          <path {...common} d="M27 43c3-4 7-4 10 0" />
        </svg>
      );
    case "berimbau":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M24 47c1-14 5-24 12-31" />
          <path {...common} d="M36 16c5 9 6 20 4 31" />
          <path {...common} d="M30 17l4 30" />
          <circle {...common} cx="40" cy="34" r="5" />
          <path {...common} d="M22 35l8-4" />
        </svg>
      );
    case "jangada":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 40h28" />
          <path {...common} d="M26 40V20" />
          <path {...common} d="M26 21c9 2 14 8 14 15-6-1-11-6-14-15Z" />
          <path {...common} d="M18 40c4 4 8 4 12 0 4 4 8 4 12 0 4 4 8 4 12 0" />
        </svg>
      );
    case "brasilia-sky":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 38c4-6 9-10 14-10s10 4 14 10" />
          <path {...common} d="M22 42h20" />
          <path {...common} d="M32 20l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
          <path {...common} d="M18 46h28" />
        </svg>
      );
    case "sea-cliff":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 42c6-7 13-12 20-15 1 7 1 11 0 15" />
          <path {...common} d="M18 46c3-3 6-3 9 0 3-3 6-3 9 0 3-3 6-3 9 0" />
          <path {...common} d="M40 22c3 3 5 7 6 12" />
        </svg>
      );
    case "araucaria":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M32 47V24" />
          <path {...common} d="M21 28c4-4 8-6 11-6s7 2 11 6" />
          <path {...common} d="M19 33c5-4 9-6 13-6s8 2 13 6" />
          <path {...common} d="M17 38c6-4 11-6 15-6s9 2 15 6" />
          <path {...common} d="M28 47h8" />
        </svg>
      );
    case "ipe":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M32 46V33" />
          <path {...common} d="M28 46h8" />
          <circle {...common} cx="32" cy="20" r="4" />
          <circle {...common} cx="24" cy="24" r="4" />
          <circle {...common} cx="40" cy="24" r="4" />
          <circle {...common} cx="28" cy="29" r="4" />
          <circle {...common} cx="36" cy="29" r="4" />
        </svg>
      );
    case "tiles":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect {...common} x="18" y="18" width="12" height="12" rx="2" />
          <rect {...common} x="34" y="18" width="12" height="12" rx="2" />
          <rect {...common} x="18" y="34" width="12" height="12" rx="2" />
          <rect {...common} x="34" y="34" width="12" height="12" rx="2" />
          <path {...common} d="M18 24c4-4 8-4 12 0" />
          <path {...common} d="M34 40c4-4 8-4 12 0" />
        </svg>
      );
    case "viola":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M36 20c2-2 6-2 8 0 2 2 2 6 0 8l-7 7" />
          <path {...common} d="M24 30c-4 0-7 3-7 7s3 7 7 7c2 0 4-1 5-2l8-8c1-1 2-3 2-5 0-4-3-7-7-7-2 0-4 1-5 2l-1 1" />
          <path {...common} d="M39 17l8 8" />
        </svg>
      );
    case "bird":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 39c5-10 12-15 21-15 5 0 8 2 8 5 0 4-4 8-8 8-4 0-6-1-9-4" />
          <path {...common} d="M26 39c4 0 7 2 10 6" />
          <path {...common} d="M44 27l5-3" />
          <circle cx="39" cy="28" r="1.6" fill={palette.iconStroke} />
        </svg>
      );
    case "mountains":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M16 42 27 26l7 10 4-6 10 12" />
          <path {...common} d="M22 42h24" />
          <path {...common} d="M26 28l2 3 3-5" />
        </svg>
      );
    case "acai":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M21 37c0 7 5 12 11 12s11-5 11-12H21Z" />
          <circle {...common} cx="26" cy="28" r="3.5" />
          <circle {...common} cx="33" cy="25" r="3.5" />
          <circle {...common} cx="39" cy="29" r="3.5" />
        </svg>
      );
    case "sunrise":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M22 39a10 10 0 0 1 20 0" />
          <path {...common} d="M18 43h28" />
          <path {...common} d="M32 21v6" />
          <path {...common} d="M24 25l3 3" />
          <path {...common} d="M40 25l-3 3" />
        </svg>
      );
    case "umbrella":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 33c4-8 10-12 14-12 4 0 10 4 14 12H18Z" />
          <path {...common} d="M32 33v11c0 3 2 4 4 4" />
          <path {...common} d="M24 33c0 2 1 4 4 4s4-2 4-4" />
          <path {...common} d="M32 33c0 2 1 4 4 4s4-2 4-4" />
        </svg>
      );
    case "rivers":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M21 22c5 5 8 11 10 18" />
          <path {...common} d="M43 22c-5 5-8 11-10 18" />
          <path {...common} d="M22 42c3-2 6-2 9 0 3-2 6-2 9 0" />
        </svg>
      );
    case "wave-boardwalk":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M16 38c3-4 6-4 9 0s6 4 9 0 6-4 9 0 6 4 9 0" />
          <path {...common} d="M18 27c4 0 6-2 8-4 2 2 4 4 8 4 4 0 6-2 8-4 2 2 4 4 8 4" />
        </svg>
      );
    case "sun-dunes":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle {...common} cx="21" cy="22" r="5" />
          <path {...common} d="M16 43c6-7 13-9 20-7 5 1 9 0 13-3" />
          <path {...common} d="M21 46c6-4 12-5 18-3" />
        </svg>
      );
    case "sunset":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M22 36a10 10 0 0 1 20 0" />
          <path {...common} d="M18 40h28" />
          <path {...common} d="M20 45c4-2 8-2 12 0 4-2 8-2 12 0" />
        </svg>
      );
    case "boat":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M22 37h20l-3 7H25l-3-7Z" />
          <path {...common} d="M29 37V24" />
          <path {...common} d="M29 24c6 1 10 4 12 8H29" />
          <path {...common} d="M18 47c4 2 8 2 12 0 4 2 8 2 12 0 4 2 8 2 12 0" />
        </svg>
      );
    case "tepui":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M18 42c5-9 11-14 16-14s11 5 16 14H18Z" />
          <path {...common} d="M24 29h16" />
        </svg>
      );
    case "bridge-sea":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M16 42h32" />
          <path {...common} d="M22 42V28h20v14" />
          <path {...common} d="M22 28c2-5 5-8 10-8s8 3 10 8" />
          <path {...common} d="M18 47c3-2 6-2 9 0 3-2 6-2 9 0 3-2 6-2 9 0" />
        </svg>
      );
    case "skyline":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect {...common} x="18" y="28" width="8" height="16" rx="1" />
          <rect {...common} x="28" y="22" width="8" height="22" rx="1" />
          <rect {...common} x="38" y="26" width="8" height="18" rx="1" />
          <path {...common} d="M16 44h32" />
        </svg>
      );
    case "crab":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path {...common} d="M24 35c0-5 4-9 8-9s8 4 8 9c0 4-3 7-8 7s-8-3-8-7Z" />
          <path {...common} d="M24 31l-6-4" />
          <path {...common} d="M40 31l6-4" />
          <path {...common} d="M22 37l-5 4" />
          <path {...common} d="M42 37l5 4" />
          <path {...common} d="M27 42l-3 5" />
          <path {...common} d="M37 42l3 5" />
        </svg>
      );
    case "sunflower":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle {...common} cx="32" cy="28" r="5" />
          <circle {...common} cx="32" cy="17" r="3" />
          <circle {...common} cx="41" cy="20" r="3" />
          <circle {...common} cx="45" cy="28" r="3" />
          <circle {...common} cx="41" cy="36" r="3" />
          <circle {...common} cx="32" cy="39" r="3" />
          <circle {...common} cx="23" cy="36" r="3" />
          <circle {...common} cx="19" cy="28" r="3" />
          <circle {...common} cx="23" cy="20" r="3" />
          <path {...common} d="M32 33v13" />
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

export default function CapitalMedalGrid({ items }: { items: CapitalChallengeItem[] }) {
  const completed = items.filter((item) => item.status === "completed").length;
  const remaining = items.length - completed;

  return (
    <section
      className="ba-card"
      style={{
        padding: "1.25rem",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.018))",
      }}
    >
      <p className="ba-eyebrow">Projeto 27 capitais</p>
      <h2
        style={{
          color: "#fff",
          fontSize: "clamp(1.95rem, 4vw, 2.8rem)",
          lineHeight: 1.02,
          letterSpacing: "-0.04em",
          fontWeight: 900,
          marginTop: "0.35rem",
        }}
      >
        Capitais conquistadas
      </h2>
      <p className="ba-muted" style={{ marginTop: ".5rem", maxWidth: 760, lineHeight: 1.65 }}>
        Cada capital concluída adiciona um novo módulo simbólico ao desafio.
        A linguagem visual desta coleção usa referências culturais e locais para
        transformar cada medalha em um pedaço do Brasil.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: "1.1rem",
        }}
      >
        <SummaryBox label="Capitais concluídas" value={String(completed)} tone="completed" />
        <SummaryBox label="Para fechar o Brasil" value={String(remaining)} tone="next" />
        <SummaryBox label="Meta final" value="27" tone="locked" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
          gap: 16,
          marginTop: "1.4rem",
        }}
      >
        {items.map((item) => {
          const meta = capitalMedalMetaByState[item.state];
          const palette = getPalette(item.status);

          return (
            <article
              key={item.state}
              title={`${item.city} · ${meta.motif}`}
              style={{
                display: "grid",
                justifyItems: "center",
                alignItems: "start",
                gap: 8,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 112,
                  aspectRatio: "1 / 1.06",
                  display: "grid",
                  placeItems: "center",
                  padding: "0.82rem 0.72rem 0.9rem",
                  clipPath: "polygon(50% 0%, 90% 18%, 90% 82%, 50% 100%, 10% 82%, 10% 18%)",
                  border: `1px solid ${palette.shellBorder}`,
                  background: palette.shellBackground,
                  boxShadow: palette.shellShadow,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 6,
                    clipPath: "polygon(50% 0%, 90% 18%, 90% 82%, 50% 100%, 10% 82%, 10% 18%)",
                    border: `1px solid ${palette.shellBorder}`,
                    opacity: 0.55,
                  }}
                />

                <div
                  style={{
                    width: "100%",
                    height: 48,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <SymbolSvg symbol={meta.symbol} palette={palette} />
                </div>

                <div style={{ textAlign: "center", marginTop: 2 }}>
                  <div
                    style={{
                      color: palette.codeColor,
                      fontWeight: 900,
                      fontSize: 17,
                      lineHeight: 1,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {meta.code}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "center", minHeight: 28 }}>
                <div
                  style={{
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    lineHeight: 1.15,
                  }}
                >
                  {item.city}
                </div>
                <div
                  style={{
                    color: palette.motifColor,
                    fontSize: 11,
                    lineHeight: 1.2,
                    marginTop: 3,
                  }}
                >
                  {meta.motif}
                </div>
              </div>
            </article>
          );
        })}
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
    borderRadius: 16,
    border: `1px solid ${tone === "completed" ? "rgba(245,166,35,0.30)" : tone === "next" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)"}`,
    background: tone === "locked" ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.18)",
    padding: "0.95rem 1rem",
  };

  return (
    <div style={style}>
      <p className="ba-label">{label}</p>
      <p
        style={{
          marginTop: 6,
          color: tone === "locked" ? "#fff" : palette.codeColor,
          fontSize: 32,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        {value}
      </p>
    </div>
  );
}
