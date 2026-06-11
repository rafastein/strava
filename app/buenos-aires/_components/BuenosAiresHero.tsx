import Link from "next/link";
import RaceCountdown from "../../components/RaceCountdown";

type BuenosAiresHeroProps = {
  targetPaceLabel: string;
  targetPredictionLabel: string;
  cyclePhaseName: string;
  targetDateIso: string;
};

export default function BuenosAiresHero({
  targetPaceLabel,
  targetPredictionLabel,
  cyclePhaseName,
  targetDateIso,
}: BuenosAiresHeroProps) {
  const cyclePhaseCompactName =
    cyclePhaseName.length > 12 ? "Desenv." : cyclePhaseName;

  return (
    <section className="ba-hero" style={{ marginBottom: "2.2rem" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "2rem",
          borderRadius: 28,
          background:
            "linear-gradient(135deg, rgba(245,166,35,.18), rgba(255,255,255,.03) 42%, rgba(255,255,255,.015))",
          border: "1px solid rgba(245,166,35,.18)",
        }}
      >
        <div className="ba-race-glow" />
        <div style={{ position: "relative" }}>
          <p className="ba-eyebrow">Road to Buenos Aires · 20/09</p>
          <h1 className="ba-title" style={{ marginTop: ".85rem" }}>
            Maratona de
            <br />
            Buenos Aires
          </h1>
          <p
            style={{
              maxWidth: 600,
              marginTop: ".9rem",
              fontSize: 15,
              lineHeight: 1.65,
            }}
            className="ba-muted"
          >
            Central do ciclo: volume, longão, aderência semanal, VDOT,
            projeções e sinais de prontidão para a prova-alvo.
          </p>
          <div
            className="ba-action-row"
            style={{
              display: "flex",
              gap: ".7rem",
              flexWrap: "wrap",
              marginTop: "1.4rem",
            }}
          >
            <Link href="/" className="ba-pill ba-pill-orange">
              Dashboard →
            </Link>
            <Link href="/longoes" className="ba-pill ba-pill-dark">
              Ver longões
            </Link>
            <span className="ba-pill ba-pill-dark">Meta {targetPaceLabel}</span>
          </div>
        </div>
      </div>

      <div className="ba-card" style={{ padding: "1.2rem" }}>
        <div className="ba-card-head" style={{ marginBottom: "1rem" }}>
          <div>
            <p className="ba-eyebrow">Contagem regressiva</p>
            <p className="ba-muted" style={{ fontSize: 13, marginTop: 4 }}>
              Buenos Aires · prova-alvo
            </p>
          </div>
          <span
            style={{
              border: "1px solid rgba(245,166,35,.25)",
              color: "#f5a623",
              background: "rgba(245,166,35,.09)",
              padding: ".35rem .65rem",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            42K
          </span>
        </div>
        <div style={{ margin: ".75rem 0 1.1rem" }}>
          <RaceCountdown
            targetDate={targetDateIso}
            raceName="Buenos Aires"
          />
        </div>
        <div className="ba-grid-3" style={{ marginTop: "1rem" }}>
          <div className="ba-card-soft" style={{ padding: ".95rem" }}>
            <p className="ba-label">Pace-alvo</p>
            <p className="ba-value" style={{ fontSize: 32, marginTop: 8 }}>
              {targetPaceLabel.replace("/km", "")}
            </p>
            <p className="ba-muted" style={{ fontSize: 12 }}>
              /km
            </p>
          </div>
          <div className="ba-card-soft" style={{ padding: ".95rem" }}>
            <p className="ba-label">Projetado</p>
            <p className="ba-value" style={{ fontSize: 32, marginTop: 8 }}>
              {targetPredictionLabel}
            </p>
            <p className="ba-muted" style={{ fontSize: 12 }}>
              tempo-alvo
            </p>
          </div>
          <div
            className="ba-card-soft ba-cycle-phase-mini-card"
            title={`Fase: ${cyclePhaseName}`}
            aria-label={`Fase do ciclo: ${cyclePhaseName}`}
          >
            <p className="ba-label">Fase</p>
            <p className="ba-value ba-cycle-phase-mini-value">
              {cyclePhaseCompactName}
            </p>
            <p className="ba-muted ba-cycle-phase-mini-caption">do ciclo</p>
          </div>
        </div>
      </div>
    </section>
  );
}
