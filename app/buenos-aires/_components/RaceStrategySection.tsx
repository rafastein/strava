type RaceStrategySectionProps = {
  targetPaceLabel: string;
};

export default function RaceStrategySection({ targetPaceLabel }: RaceStrategySectionProps) {
  const blocks = [
    {
      title: "Km 0–10",
      value: "Controle",
      text: `Largar sem brigar com o ritmo. A referência é estabilizar perto de ${targetPaceLabel}, deixando a sensação mandar mais que a ansiedade.`,
    },
    {
      title: "Km 10–30",
      value: "Cruzeiro",
      text: "Entrar no bloco mais econômico da prova: hidratação, gel no horário certo e menor variação possível de pace.",
    },
    {
      title: "Km 30–37",
      value: "Decisão",
      text: "Checar perna, respiração e frequência cardíaca. Se estiver controlado, manter; se pesar, proteger o sub-4 antes de buscar mais.",
    },
    {
      title: "Km 37–42",
      value: "Fechar",
      text: "Usar o que sobrou. Nada de heroísmo cedo: a prova começa de verdade depois do 35.",
    },
  ];

  return (
    <section className="ba-card content-card">
      <div className="content-card-head">
        <div>
          <p className="ba-label">Estratégia de prova</p>
          <h2 className="content-card-title">Buenos Aires por blocos</h2>
        </div>
        <span className="content-card-chip">Plano A/B/C</span>
      </div>

      <div className="content-grid content-grid-4">
        {blocks.map((block) => (
          <div key={block.title} className="ba-card-soft content-mini-card">
            <p className="ba-label">{block.title}</p>
            <p className="content-value">{block.value}</p>
            <p className="ba-muted content-caption">{block.text}</p>
          </div>
        ))}
      </div>

      <div className="content-grid content-grid-3" style={{ marginTop: ".9rem" }}>
        <div className="content-alert-card">
          <p style={{ color: "#34d399", fontWeight: 800 }}>Plano A</p>
          <p className="ba-muted content-caption">Sustentar {targetPaceLabel} com final progressivo se o corpo responder bem.</p>
        </div>
        <div className="content-alert-card">
          <p style={{ color: "#f5a623", fontWeight: 800 }}>Plano B</p>
          <p className="ba-muted content-caption">Oscilar para uma faixa segura e preservar o sub-4 sem quebrar depois do km 32.</p>
        </div>
        <div className="content-alert-card">
          <p style={{ color: "#fca5a5", fontWeight: 800 }}>Plano C</p>
          <p className="ba-muted content-caption">Reduzir, caminhar em postos se necessário e terminar inteiro para consolidar a maratona.</p>
        </div>
      </div>
    </section>
  );
}
