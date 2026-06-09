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
    strokeWidth: 2.55,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const bold = { ...common, strokeWidth: 3.05 };
  const thin = { ...common, strokeWidth: 1.75, opacity: 0.74 };
  const fillSoft = { fill: palette.iconStroke, opacity: 0.14 };
  const fillMedium = { fill: palette.iconStroke, opacity: 0.22 };
  const svgStyle: CSSProperties = { width: "100%", height: "100%", display: "block" };

  switch (symbol) {
    case "palacio-rio-branco":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M15 47V28h34v19Z" />
          <path {...bold} d="M13 48h38" />
          <path {...common} d="M17 47V29h30v18" />
          <path {...common} d="M20 29h24l-4-7H24l-4 7Z" />
          <path {...common} d="M24 47V35" />
          <path {...common} d="M32 47V35" />
          <path {...common} d="M40 47V35" />
          <path {...thin} d="M21 35h22" />
          <path {...thin} d="M32 22v-5" />
          <path {...thin} d="M32 17h7" />
        </svg>
      );
    case "farol-ponta-verde":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M27 48 30 19h4l3 29Z" />
          <path {...bold} d="M24 49h16" />
          <path {...common} d="M27 48 30 20h4l3 28" />
          <path {...common} d="M28 20h8l-2-6h-4l-2 6Z" />
          <path {...thin} d="M28 30h8" />
          <path {...thin} d="M27 39h10" />
          <path {...thin} d="M13 24h10" />
          <path {...thin} d="M41 24h10" />
          <path {...thin} d="M17 53c4-2 8-2 12 0 4-2 8-2 12 0" />
        </svg>
      );
    case "marco-zero":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <circle {...fillSoft} cx="32" cy="21" r="8" />
          <circle {...common} cx="32" cy="21" r="8" />
          <path {...bold} d="M32 29v18" />
          <path {...common} d="M22 47h20" />
          <path {...common} d="M18 53h28" />
          <path {...thin} d="M21 21h22" />
          <path {...thin} d="M32 13c3 4 3 12 0 16" />
        </svg>
      );
    case "teatro-amazonas":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M19 48V31h26v17Z" />
          <path {...bold} d="M16 49h32" />
          <path {...common} d="M20 48V31h24v17" />
          <path {...common} d="M23 31h18" />
          <path {...common} d="M25 31v-3c0-5 4-9 7-9s7 4 7 9v3" />
          <path {...thin} d="M28 48V38" />
          <path {...thin} d="M36 48V38" />
          <path {...thin} d="M27 25h10" />
          <path {...thin} d="M32 19v-4" />
        </svg>
      );
    case "elevador-lacerda":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M20 47V17h9v30ZM35 47V17h9v30Z" />
          <path {...bold} d="M17 49h30" />
          <path {...common} d="M21 47V17h8v30" />
          <path {...common} d="M35 47V17h8v30" />
          <path {...common} d="M21 22h22" />
          <path {...common} d="M21 32h22" />
          <path {...thin} d="M24 27h2" />
          <path {...thin} d="M38 27h2" />
          <path {...thin} d="M24 40h2" />
          <path {...thin} d="M38 40h2" />
        </svg>
      );
    case "ponte-ingleses":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...bold} d="M13 33h38" />
          <path {...common} d="M18 33v-8" />
          <path {...common} d="M28 33v-8" />
          <path {...common} d="M38 33v-8" />
          <path {...thin} d="M15 25h32" />
          <path {...common} d="M16 42c4-2 8-2 12 0 4-2 8-2 12 0 4-2 8-2 12 0" />
          <path {...thin} d="M16 49c4-2 8-2 12 0 4-2 8-2 12 0" />
        </svg>
      );
    case "congresso-nacional":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...bold} d="M14 48h36" />
          <path {...fillSoft} d="M26 47V24h5v23ZM34 47V24h5v23Z" />
          <path {...common} d="M26 47V24h5v23" />
          <path {...common} d="M34 47V24h5v23" />
          <path {...common} d="M24 24h17" />
          <path {...common} d="M15 38c4-6 9-9 15-9" />
          <path {...common} d="M49 38c-4-6-9-9-15-9" />
          <path {...thin} d="M17 38h12" />
          <path {...thin} d="M35 38h12" />
        </svg>
      );
    case "convento-penha":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M16 49c9-2 14-8 18-24 7 3 12 11 13 24Z" />
          <path {...common} d="M15 49c9-2 15-9 19-24 7 3 12 11 13 24" />
          <path {...bold} d="M23 49h27" />
          <path {...common} d="M28 34h12" />
          <path {...common} d="M30 34v-7h6v7" />
          <path {...thin} d="M33 27v-5" />
          <path {...thin} d="M31 24h4" />
        </svg>
      );
    case "tres-racas":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...bold} d="M20 49h24" />
          <path {...common} d="M32 49V21" />
          <circle {...fillMedium} cx="32" cy="18" r="3" />
          <circle {...common} cx="32" cy="18" r="3" />
          <circle {...common} cx="22" cy="29" r="3" />
          <circle {...common} cx="42" cy="29" r="3" />
          <path {...common} d="M22 32c-3 4-4 9-4 15" />
          <path {...common} d="M42 32c3 4 4 9 4 15" />
          <path {...common} d="M25 32 32 24l7 8" />
        </svg>
      );
    case "palacio-leoes":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M17 48V29h30v19Z" />
          <path {...bold} d="M14 49h36" />
          <path {...common} d="M18 48V29h28v19" />
          <path {...common} d="M20 29h24l-3-6H23l-3 6Z" />
          <path {...thin} d="M25 48V36" />
          <path {...thin} d="M32 48V36" />
          <path {...thin} d="M39 48V36" />
          <path {...thin} d="M24 24c3-3 6-4 9-4 4 0 7 1 10 4" />
        </svg>
      );
    case "arena-pantanal":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <ellipse {...fillSoft} cx="32" cy="38" rx="21" ry="12" />
          <ellipse {...bold} cx="32" cy="38" rx="21" ry="12" />
          <ellipse {...thin} cx="32" cy="38" rx="14" ry="7" />
          <path {...common} d="M16 38h32" />
          <path {...thin} d="M21 29v18" />
          <path {...thin} d="M32 26v24" />
          <path {...thin} d="M43 29v18" />
        </svg>
      );
    case "obelisco":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M32 15 39 48H25Z" />
          <path {...bold} d="M32 15 39 48H25Z" />
          <path {...thin} d="M32 23v18" />
          <path {...common} d="M22 49h20" />
          <path {...thin} d="M18 54h28" />
        </svg>
      );
    case "pampulha":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M16 45c6-12 13-17 20-17s10 7 12 17Z" />
          <path {...bold} d="M15 46c6-12 13-18 21-18s10 7 13 18" />
          <path {...common} d="M23 46V28" />
          <path {...common} d="M23 28h9" />
          <path {...thin} d="M25 24v-5" />
          <path {...thin} d="M22 21h6" />
          <path {...common} d="M20 50h28" />
        </svg>
      );
    case "ver-o-peso":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M18 48V33h28v15Z" />
          <path {...bold} d="M15 49h34" />
          <path {...common} d="M20 48V33h24v15" />
          <path {...common} d="M18 33h28" />
          <path {...common} d="M27 33v-7l5-5 5 5v7" />
          <path {...thin} d="M32 21v-5" />
          <path {...thin} d="M25 40h14" />
        </svg>
      );
    case "farol-cabo-branco":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M30 48V20h5l9 28Z" />
          <path {...bold} d="M28 49h18" />
          <path {...common} d="M31 48V20h5l8 28" />
          <path {...common} d="M24 30h19" />
          <path {...thin} d="M31 21 20 29" />
          <path {...thin} d="M16 23h9" />
          <path {...thin} d="M42 22h8" />
        </svg>
      );
    case "jardim-botanico":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M17 49V34c0-10 6-17 15-17s15 7 15 17v15Z" />
          <path {...bold} d="M15 50h34" />
          <path {...common} d="M18 49V34c0-10 6-17 14-17s14 7 14 17v15" />
          <path {...thin} d="M24 49V33" />
          <path {...thin} d="M32 49V18" />
          <path {...thin} d="M40 49V33" />
          <path {...common} d="M20 34h24" />
          <path {...thin} d="M24 26h16" />
        </svg>
      );
    case "ponte-nassau":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...bold} d="M14 35h36" />
          <path {...common} d="M18 47V35" />
          <path {...common} d="M46 47V35" />
          <path {...common} d="M18 35c3-5 7-8 14-8s11 3 14 8" />
          <path {...thin} d="M23 47c0-5 4-8 9-8s9 3 9 8" />
          <path {...common} d="M15 53c5-2 9-2 14 0 5-2 9-2 14 0" />
        </svg>
      );
    case "ponte-estaiada":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...bold} d="M32 18v30" />
          <path {...common} d="M18 48h28" />
          <path {...thin} d="M32 22 20 34" />
          <path {...thin} d="M32 27 18 42" />
          <path {...thin} d="M32 22 44 34" />
          <path {...thin} d="M32 27 46 42" />
          <path {...common} d="M16 53c5-2 9-2 14 0 5-2 9-2 14 0" />
        </svg>
      );
    case "cristo-redentor":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <circle {...fillMedium} cx="32" cy="17" r="4" />
          <circle {...common} cx="32" cy="17" r="4" />
          <path {...bold} d="M14 28h36" />
          <path {...bold} d="M32 21v25" />
          <path {...common} d="M25 46c3-5 11-5 14 0" />
          <path {...thin} d="M21 51c7-4 15-4 22 0" />
        </svg>
      );
    case "forte-reis-magos":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M32 17 39 28l12 3-8 9 1 12-12-5-12 5 1-12-8-9 12-3Z" />
          <path {...bold} d="M32 17 39 28l12 3-8 9 1 12-12-5-12 5 1-12-8-9 12-3Z" />
          <path {...thin} d="M27 35h10" />
          <path {...thin} d="M32 29v12" />
        </svg>
      );
    case "gasometro":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M18 48V29h18v19ZM38 48V17h8v31Z" />
          <path {...bold} d="M15 49h34" />
          <path {...common} d="M19 48V29h17v19" />
          <path {...common} d="M38 48V17h8v31" />
          <path {...thin} d="M19 35h17" />
          <path {...thin} d="M22 41h11" />
          <path {...thin} d="M42 17v-4" />
        </svg>
      );
    case "caixas-agua":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <rect {...fillSoft} x="15" y="24" width="9" height="20" rx="3" />
          <rect {...fillSoft} x="28" y="18" width="9" height="26" rx="3" />
          <rect {...fillSoft} x="41" y="24" width="9" height="20" rx="3" />
          <rect {...common} x="15" y="24" width="9" height="20" rx="3" />
          <rect {...common} x="28" y="18" width="9" height="26" rx="3" />
          <rect {...common} x="41" y="24" width="9" height="20" rx="3" />
          <path {...bold} d="M13 48h39" />
          <path {...thin} d="M19 44v4" />
          <path {...thin} d="M32 44v4" />
          <path {...thin} d="M45 44v4" />
        </svg>
      );
    case "portal-milenio":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M19 49V25h26v24H36V34h-8v15Z" />
          <path {...bold} d="M17 50h30" />
          <path {...common} d="M20 49V25h24v24" />
          <path {...common} d="M20 25c4-5 8-7 12-7s8 2 12 7" />
          <path {...common} d="M28 49V35h8v14" />
          <path {...thin} d="M24 30h16" />
        </svg>
      );
    case "ponte-hercilio-luz":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...bold} d="M13 45h38" />
          <path {...common} d="M21 45V21" />
          <path {...common} d="M43 45V21" />
          <path {...common} d="M21 23c4-5 8-8 11-8s7 3 11 8" />
          <path {...thin} d="M21 29h22" />
          <path {...thin} d="M25 29 22 45" />
          <path {...thin} d="M39 29 42 45" />
          <path {...thin} d="M29 29 32 45 35 29" />
          <path {...thin} d="M16 52c5-2 9-2 14 0 5-2 9-2 14 0" />
        </svg>
      );
    case "masp":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <rect {...fillSoft} x="18" y="21" width="28" height="12" rx="1" />
          <rect {...bold} x="18" y="21" width="28" height="12" rx="1" />
          <path {...bold} d="M21 48V33" />
          <path {...bold} d="M43 48V33" />
          <path {...common} d="M16 48h32" />
          <path {...thin} d="M22 40h20" />
          <path {...thin} d="M21 18h22" />
        </svg>
      );
    case "arcos-orla":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...bold} d="M14 49h36" />
          <path {...common} d="M16 49c0-9 5-15 12-15s12 6 12 15" />
          <path {...common} d="M25 49c0-5 3-8 7-8s7 3 7 8" />
          <path {...common} d="M38 49c0-6 3-10 8-10s8 4 8 10" />
          <path {...thin} d="M18 30h30" />
        </svg>
      );
    case "palacio-araguaia":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
          <path {...fillSoft} d="M17 48V30h30v18Z" />
          <path {...bold} d="M14 49h36" />
          <path {...common} d="M18 48V30h28v18" />
          <path {...common} d="M22 30h20l-5-7H27l-5 7Z" />
          <path {...thin} d="M25 48V37" />
          <path {...thin} d="M32 48V37" />
          <path {...thin} d="M39 48V37" />
          <path {...thin} d="M32 23v-6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={svgStyle}>
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
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 98,
          aspectRatio: "0.866 / 1",
          display: "grid",
          placeItems: "center",
          padding: "0.42rem 0.40rem 0.56rem",
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
            width: 38,
            height: 2.5,
            borderRadius: 999,
            background: item.status === "locked" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.36)",
            opacity: 0.72,
          }}
        />

        <div
          style={{
            width: "min(62px, 72%)",
            height: "min(56px, 62%)",
            borderRadius: 16,
            border: `1px solid ${palette.ringColor}`,
            background: item.status === "locked" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.10)",
            display: "grid",
            placeItems: "center",
            marginTop: 8,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ width: "min(54px, 88%)", height: "min(54px, 88%)", display: "grid", placeItems: "center" }}>
            <SymbolSvg symbol={meta.symbol} palette={palette} />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 10,
            transform: "translateX(-50%)",
            color: palette.codeColor,
            fontWeight: 950,
            fontSize: 10.5,
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
              right: 9,
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
