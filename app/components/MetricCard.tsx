type MetricCardProps = {
  label: string;
  value: string;
  caption?: string;
  accent?: boolean;
  className?: string;
};

export default function MetricCard({
  label,
  value,
  caption,
  accent = false,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`ba-card ${className}`.trim()}
      style={{
        padding: "1rem 1.25rem",
        borderColor: accent ? "rgba(245,166,35,0.25)" : undefined,
      }}
    >
      <p className="ba-label" style={{ marginBottom: 6 }}>
        {label}
      </p>
      <p
        className="ba-value"
        style={{
          fontSize: 28,
          color: accent ? "#f5a623" : "#fff",
        }}
      >
        {value}
      </p>
      {caption && (
        <p className="ba-muted" style={{ fontSize: 12, marginTop: 4 }}>
          {caption}
        </p>
      )}
    </div>
  );
}
