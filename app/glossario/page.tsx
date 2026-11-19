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
      "Comparação entre o que estava previsto no COROS e o que foi executado no Strava. Pode ser medida por volume, longão e tipo de estímulo.",
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
  Planejamento: "Comparação entre o plano do COROS e a execução real.",
  "Tipos de treino": "Estímulos que aparecem no plano e no histórico.",
};

export const metadata = { title: "Glossário · Rafael Cabral" };

function slug(group: string) {
  return group.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "-");
}

export default function GlossarioPage() {
  const groups = Array.from(new Set(TERMS.map((term) => term.group)));

  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container" style={{ maxWidth: 760 }}>
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Glossário</h1>
            <p className="ui-muted">{TERMS.length} termos usados nas páginas de treino, provas e carga</p>
          </div>
        </header>

        <nav className="glossario-chips" aria-label="Categorias">
          {groups.map((group) => (
            <a key={group} href={`#${slug(group)}`} className="ui-chip glossario-chip">{group}</a>
          ))}
        </nav>

        <div className="hoje-col" style={{ marginTop: 12 }}>
          {groups.map((group) => {
            const terms = TERMS.filter((term) => term.group === group);
            return (
              <section key={group} id={slug(group)} className="ui-section glossario-section" aria-label={group}>
                <div className="ui-section__head">
                  <h2 className="ui-h2">{group}</h2>
                  <span className="ui-muted">{GROUP_DESCRIPTIONS[group]}</span>
                </div>
                <dl className="ui-card ui-list">
                  {terms.map((term) => (
                    <div key={term.term} className="glossario-term">
                      <dt>
                        <span className="ui-row__title">{term.term}</span>
                        <span className="ui-muted"> · {term.short}</span>
                      </dt>
                      <dd>{term.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>

        <p style={{ marginTop: 24 }}>
          <Link href="/carga" className="ui-btn ui-btn--ghost">Forma, fadiga e frescor estão explicados em Carga</Link>
        </p>
      </main>
      <footer className="ui-footer">Strava · Rafael Cabral · glossário</footer>
    </div>
  );
}
