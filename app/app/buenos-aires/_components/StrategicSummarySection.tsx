type StrategicSummarySectionProps = {
  cyclePhaseName: string;
  readinessLabel: string;
  targetPaceLabel: string;
  weekText: string;
};

export default function StrategicSummarySection({
  cyclePhaseName,
  readinessLabel,
  targetPaceLabel,
  weekText,
}: StrategicSummarySectionProps) {
  return (
    <section className="ba-card" style={{ padding: "1.2rem" }}>
      <p className="ba-label">Resumo estratégico</p>
      <div className="ba-summary-grid">
        <div className="ba-card-soft" style={{ padding: ".95rem" }}>
          <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>Momento</p>
          <p className="ba-muted" style={{ marginTop: 7, lineHeight: 1.45, fontSize: 13 }}>
            Ciclo em {cyclePhaseName}, com semáforo {readinessLabel.toLowerCase()} e alvo de {targetPaceLabel}.
          </p>
        </div>
        <div className="ba-card-soft" style={{ padding: ".95rem" }}>
          <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>Semana</p>
          <p className="ba-muted" style={{ marginTop: 7, lineHeight: 1.45, fontSize: 13 }}>
            {weekText}
          </p>
        </div>
        <div className="ba-card-soft" style={{ padding: ".95rem" }}>
          <p style={{ color: "#fff", fontWeight: 650, fontSize: 14 }}>Próximo foco</p>
          <p className="ba-muted" style={{ marginTop: 7, lineHeight: 1.45, fontSize: 13 }}>
            Aumentar consistência, longões e especificidade antes dos blocos mais fortes.
          </p>
        </div>
      </div>
    </section>
  );
}
