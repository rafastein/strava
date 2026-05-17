import Link from "next/link";
import Navbar from "../components/Navbar";

const TERMS = [
  {
    term: "Z1",
    group: "Zonas",
    short: "Muito leve",
    definition:
      "Zona usada em regenerativos, aquecimentos e desaquecimentos. A sensação deve ser confortável, sustentável e sem pressão de ritmo.",
  },
  {
    term: "Z2",
    group: "Zonas",
    short: "Leve/moderada",
    definition:
      "Base da resistência aeróbica. É a zona que aparece em rodagens e longões controlados, ajudando a construir volume com segurança.",
  },
  {
    term: "Z3",
    group: "Zonas",
    short: "Moderada",
    definition:
      "Zona sustentada, usada em blocos de ritmo, progressivos e trechos próximos ao pace de prova. Exige controle para não virar intensidade demais.",
  },
  {
    term: "Z4",
    group: "Zonas",
    short: "Forte",
    definition:
      "Zona próxima do limiar. Costuma aparecer em intervalados, tiros mais longos e treinos que trabalham tolerância ao esforço.",
  },
  {
    term: "Z5",
    group: "Zonas",
    short: "Muito forte",
    definition:
      "Acima do limiar, usada com parcimônia em estímulos curtos de velocidade. É útil, mas cobra mais recuperação.",
  },
  {
    term: "Limiar",
    group: "Fisiologia",
    short: "Referência de esforço",
    definition:
      "Intensidade próxima do ponto em que a fadiga começa a acumular rapidamente. Ajuda a calibrar treinos sustentados e projeções de prova.",
  },
  {
    term: "VO2max estimado",
    group: "Fisiologia",
    short: "Capacidade aeróbica",
    definition:
      "Estimativa da capacidade de usar oxigênio durante o esforço. No dashboard, funciona melhor como tendência do que como número absoluto.",
  },
  {
    term: "VDOT",
    group: "Projeções",
    short: "Modelo Daniels",
    definition:
      "Indicador inspirado no método de Jack Daniels para estimar desempenho e paces de treino a partir de resultados recentes.",
  },
  {
    term: "Pace de maratona",
    group: "Prova",
    short: "Ritmo-alvo",
    definition:
      "Ritmo planejado para sustentar os 42 km. No ciclo de Buenos Aires, serve como referência para blocos específicos e simulações.",
  },
  {
    term: "Eficiência",
    group: "Métricas",
    short: "Ritmo x custo",
    definition:
      "Relação entre ritmo, frequência cardíaca e contexto do treino. Ajuda a perceber quando o corpo entrega mais velocidade com menos desgaste.",
  },
  {
    term: "Aderência",
    group: "Planejamento",
    short: "Planejado x feito",
    definition:
      "Comparação entre o que estava previsto no SisRUN e o que foi executado no Strava. Pode ser medida por volume, longão e tipo de estímulo.",
  },
  {
    term: "Longão",
    group: "Tipos de treino",
    short: "Resistência específica",
    definition:
      "Treino longo da semana. Para a maratona, é um dos principais blocos de construção de resistência física, mental e nutricional.",
  },
  {
    term: "Regenerativo",
    group: "Tipos de treino",
    short: "Recuperação ativa",
    definition:
      "Treino leve para circular, soltar a musculatura e manter rotina sem gerar carga excessiva. Não deve virar treino moderado.",
  },
  {
    term: "Fartlek",
    group: "Tipos de treino",
    short: "Variação de ritmo",
    definition:
      "Treino com alternância entre trechos mais fortes e leves. Trabalha mudança de velocidade sem a rigidez de um intervalado clássico.",
  },
  {
    term: "Intervalado",
    group: "Tipos de treino",
    short: "Repetições",
    definition:
      "Treino estruturado em blocos ou tiros, geralmente com pausas. Desenvolve velocidade, economia de corrida e tolerância ao esforço.",
  },
];

const GROUP_DESCRIPTIONS: Record<string, string> = {
  Zonas: "Como interpretar a intensidade dos treinos.",
  Fisiologia: "Indicadores que ajudam a entender capacidade e tolerância ao esforço.",
  Projeções: "Modelos usados para estimar paces e cenários de prova.",
  Prova: "Conceitos ligados à execução da competição.",
  Métricas: "Números usados para ler evolução e custo do treino.",
  Planejamento: "Comparação entre o plano do SisRUN e a execução real.",
  "Tipos de treino": "Estímulos que aparecem na planilha e no histórico.",
};

export default function GlossarioPage() {
  const groups = Array.from(new Set(TERMS.map((term) => term.group)));
  const highlighted = TERMS.filter((term) => ["Aderência", "Eficiência", "VDOT", "Longão"].includes(term.term));

  return (
    <main className="min-h-screen" style={{ background: "#0d0d0d", fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div className="ba-page glossary-page">
        <section className="glossary-hero ba-card">
          <div>
            <p className="ba-eyebrow">Guia rápido</p>
            <h1 className="ba-title glossary-title">Glossário do dashboard</h1>
            <p className="ba-muted glossary-lead">
              Uma leitura simples dos conceitos usados nas páginas de treino, maratona, longões, SisRUN e projeções.
            </p>
          </div>

          <div className="glossary-hero-panel">
            <p className="ba-label">Resumo</p>
            <strong>{TERMS.length} termos</strong>
            <span>{groups.length} categorias para consultar durante o ciclo.</span>
          </div>
        </section>

        <section className="glossary-quick-grid">
          {highlighted.map((term) => (
            <div key={term.term} className="ba-card-soft glossary-feature-card">
              <p className="ba-label">{term.group}</p>
              <h2>{term.term}</h2>
              <span>{term.short}</span>
            </div>
          ))}
        </section>

        <section className="ba-card glossary-index-card">
          <div className="content-card-head">
            <div>
              <p className="ba-label">Categorias</p>
              <h2 className="content-card-title">Navegação rápida</h2>
            </div>
            <Link href="/" className="content-card-chip content-chip-link">
              Voltar ao dashboard
            </Link>
          </div>

          <div className="glossary-index-pills">
            {groups.map((group) => (
              <a key={group} href={`#${group.toLowerCase().replaceAll(" ", "-")}`}>
                {group}
              </a>
            ))}
          </div>
        </section>

        <div className="glossary-sections">
          {groups.map((group) => {
            const terms = TERMS.filter((term) => term.group === group);

            return (
              <section key={group} id={group.toLowerCase().replaceAll(" ", "-")} className="ba-card glossary-section-card">
                <div className="glossary-section-head">
                  <div>
                    <p className="ba-label">Categoria</p>
                    <h2>{group}</h2>
                    <p className="ba-muted">{GROUP_DESCRIPTIONS[group]}</p>
                  </div>
                  <span>{terms.length} termos</span>
                </div>

                <div className="glossary-term-grid">
                  {terms.map((term) => (
                    <article key={term.term} className="glossary-term-card">
                      <div>
                        <p className="glossary-term-group">{term.short}</p>
                        <h3>{term.term}</h3>
                      </div>
                      <p>{term.definition}</p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <footer className="site-footer">STRAVA · RAFAEL CABRAL · GLOSSÁRIO</footer>
    </main>
  );
}
