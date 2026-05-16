type ReadinessSectionProps = {
  dotClassName: string;
  label: string;
  title: string;
  description: string;
  cycleDescription: string;
};

function readinessColor(label: string) {
  if (label === "Vermelho") return "#f87171";
  if (label === "Amarelo") return "#f5a623";
  return "#34d399";
}

export default function ReadinessSection({
  dotClassName,
  label,
  title,
  description,
  cycleDescription,
}: ReadinessSectionProps) {
  return (
    <section className="ba-card ba-readiness-section">
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <span
          className={dotClassName}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            marginTop: 6,
            flexShrink: 0,
          }}
        />
        <div>
          <p style={{ color: readinessColor(label), fontWeight: 800, fontSize: 18 }}>
            {title}
          </p>
          <p className="ba-muted" style={{ marginTop: 5, lineHeight: 1.55 }}>
            {description}
          </p>
        </div>
      </div>
      <div className="ba-card-soft" style={{ padding: ".95rem" }}>
        <p className="ba-label">Leitura do ciclo</p>
        <p
          style={{
            marginTop: 8,
            color: "rgba(255,255,255,.82)",
            lineHeight: 1.55,
          }}
        >
          {cycleDescription}
        </p>
      </div>
    </section>
  );
}
