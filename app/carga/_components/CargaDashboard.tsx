"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import { formatNumber, formatPace, formatWeekdayShort } from "../../lib/format";
import { STATUS_META, describeTsb, type DayLoad } from "../../lib/training-load";
import { applyChartTheme } from "../../lib/chart-theme";

type ApiResponse = {
  days: DayLoad[];
  thresholdPaceSecPerKm: number;
  vdot: number | null;
  totalActivities: number;
  hrMax?: number;
  hrRest?: number;
  lthr?: number;
  displayedDays?: number;
  warmupDays?: number;
  fetchDays?: number;
  timeZone?: string;
  loadMethod?: {
    withHeartRate: number;
    fallbackPace: number;
  };
};

type RatioZone = {
  key: DayLoad["status"];
  label: string;
  from: number;
  to: number;
  hint: string;
};

const RATIO_MAX = 2;
const LIST_DAYS = 14;
const WINDOWS = [30, 60, 90] as const;

// Cores das séries: azul × âmbar se distinguem também por luminosidade.
const COLOR_CTL = "#6aa8ff";
const COLOR_ATL = "#f5a623";
const COLOR_TSB = "#c9cdd3";

// Faixas de Gabbett (2016) para o ratio de carga aguda/crônica.
const RATIO_ZONES: RatioZone[] = [
  {
    key: "low",
    label: "Carga baixa",
    from: 0,
    to: 0.8,
    hint: "Carga recente abaixo da base. Esperado em descanso e polimento; por muitas semanas, a forma começa a cair.",
  },
  {
    key: "productive",
    label: "Produtiva",
    from: 0.8,
    to: 1.3,
    hint: "Carga recente acompanhando a base, com folga para subir. É a faixa associada a evoluir com menos risco.",
  },
  {
    key: "caution",
    label: "Atenção",
    from: 1.3,
    to: 1.5,
    hint: "Carga recente bem acima da base. Aceitável em bloco curto e planejado, com recuperação em seguida.",
  },
  {
    key: "spike",
    label: "Pico",
    from: 1.5,
    to: RATIO_MAX,
    hint: "Salto de carga. É a faixa que os estudos de Gabbett associam a mais lesões; vale aliviar os próximos dias.",
  },
];

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)}`;
}

function ratioToPercent(value: number): number {
  return Math.min(Math.max(value / RATIO_MAX, 0), 1) * 100;
}

function getRatioInsight(day: DayLoad): string {
  const pct = Math.round(Math.abs(day.ratio - 1) * 100);
  const relation = day.ratio >= 1 ? `${pct}% acima` : `${pct}% abaixo`;

  if (day.status === "low") {
    return `A carga dos últimos dias está ${relation} da sua base. Bom para recuperar ou polir; por muito tempo, a forma começa a cair.`;
  }
  if (day.status === "productive") {
    return `A carga dos últimos dias está ${pct <= 5 ? "alinhada à" : `${relation} da`} sua base. Faixa para evoluir sem salto de carga.`;
  }
  if (day.status === "caution") {
    return `A carga dos últimos dias está ${relation} da sua base. Bloco forte: funciona se vier recuperação logo depois.`;
  }
  return `A carga dos últimos dias está ${relation} da sua base. É um salto de carga: alivie e observe sono, pernas e FC.`;
}

function Chevron() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function CargaPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(60);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    fetch("/api/strava/training-load")
      .then((r) => {
        if (!r.ok) throw new Error("Resposta inválida da API de carga");
        return r.json();
      })
      .then((d: ApiResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Não foi possível carregar a carga de treino. Tente de novo em instantes.");
        setLoading(false);
      });
  }, []);

  // Renderiza chart.js quando dados chegam ou janela muda
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const visible = data.days.slice(-windowDays);
    const labels = visible.map((d) => formatDate(d.date));
    const tick = { color: "#9ba1a9", font: { size: 12 } };

    let cancelled = false;

    import("chart.js/auto").then(({ default: Chart }) => {
      applyChartTheme(Chart);
      if (cancelled || !canvasRef.current) return;

      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }

      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Forma (CTL)", data: visible.map((d) => d.ctl), borderColor: COLOR_CTL, borderWidth: 2.5, pointRadius: 0, tension: 0.4, fill: false },
            { label: "Fadiga (ATL)", data: visible.map((d) => d.atl), borderColor: COLOR_ATL, borderWidth: 2.5, pointRadius: 0, tension: 0.4, fill: false },
            { label: "Frescor (TSB)", data: visible.map((d) => d.tsb), borderColor: COLOR_TSB, borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, tension: 0.4, fill: false, yAxisID: "y2" },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#1f2226",
              borderColor: "#343941",
              borderWidth: 1,
              titleColor: "#9ba1a9",
              bodyColor: "#f2f3f5",
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(Number(ctx.raw), 1)}`,
              },
            },
          },
          scales: {
            x: { ticks: { ...tick, maxTicksLimit: 5, maxRotation: 0 }, grid: { display: false } },
            y: { position: "left", ticks: { ...tick, maxTicksLimit: 5 }, grid: { color: "#262a2f" } },
            // Frescor fica num eixo próprio à direita, sem grade, para não achatar forma e fadiga.
            y2: { position: "right", ticks: { ...tick, maxTicksLimit: 5 }, grid: { drawOnChartArea: false } },
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
        chartRef.current = null;
      }
    };
  }, [data, windowDays]);

  const today = data?.days[data.days.length - 1] ?? null;
  const meta = today ? STATUS_META[today.status] : null;
  const recentDays = data ? data.days.slice(-LIST_DAYS).reverse() : [];
  const maxLoad = Math.max(...recentDays.map((d) => d.load), 1);
  const tsbReading = today ? describeTsb(today.tsb) : null;

  return (
    <div className="ui-page">
      <Navbar />

      <main className="ui-container">
        <header className="ui-header">
          <div>
            <h1 className="ui-title">Carga</h1>
            <p className="ui-muted">Forma, fadiga e frescor{today ? ` · ${formatWeekdayShort(today.date)}, ${formatDate(today.date)}` : ""}</p>
          </div>
        </header>

        {loading ? (
          <p className="ui-card ui-card--pad ui-muted" role="status">Calculando forma, fadiga e frescor…</p>
        ) : null}

        {error ? (
          <p className="ui-card ui-card--pad" role="alert" style={{ color: "#ff8a7a" }}>{error}</p>
        ) : null}

        {data && today && meta && tsbReading ? (
          <>
            <div className="carga-grid">
              <div className="hoje-col">
                {/* ── Status ── */}
                <section className="ui-card ui-card--pad ui-stack" aria-label="Status de hoje">
                  <div className="carga-status">
                    <div>
                      <p className="ui-muted">Carga recente</p>
                      <p className="carga-status__label" style={{ color: meta.color, marginTop: 4 }}>{meta.label}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p className="ui-muted" style={{ whiteSpace: "nowrap" }}>Aguda/crônica</p>
                      <p className="carga-status__ratio" style={{ marginTop: 4 }}>{formatNumber(today.ratio, 2)}</p>
                    </div>
                  </div>

                  <p style={{ fontSize: 15, color: "var(--ui-text-2)", textWrap: "pretty" }}>{getRatioInsight(today)}</p>

                  <div
                    className="carga-gauge"
                    role="img"
                    aria-label={`Ratio de carga ${formatNumber(today.ratio, 2)}, na faixa ${meta.label}`}
                  >
                    <div className="carga-gauge__marker-track">
                      <span className="carga-gauge__marker" style={{ left: `${ratioToPercent(today.ratio)}%` }} />
                    </div>
                    <div className="carga-gauge__zones">
                      {RATIO_ZONES.map((zone) => (
                        <div key={zone.key} className="carga-gauge__zone" style={{ flexGrow: Math.round((zone.to - zone.from) * 10) }}>
                          <span
                            className="carga-gauge__bar"
                            style={zone.key === today.status ? { background: STATUS_META[zone.key].color } : undefined}
                          />
                          <span>{formatNumber(zone.from, zone.from === 0 ? 0 : 1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── Três números ── */}
                <div className="ui-stat-grid">
                  {[
                    { color: COLOR_CTL, label: "Forma", value: formatNumber(today.ctl, 1), sub: "CTL · 42 dias" },
                    { color: COLOR_ATL, label: "Fadiga", value: formatNumber(today.atl, 1), sub: "ATL · 7 dias" },
                    { color: COLOR_TSB, label: "Frescor", value: formatSigned(today.tsb), sub: tsbReading.label },
                  ].map((tile) => (
                    <div key={tile.label} className="ui-stat" style={{ padding: "14px 12px" }}>
                      <span className="carga-tile__head">
                        <span className="carga-dot" style={{ background: tile.color }} />
                        {tile.label}
                      </span>
                      <span className="carga-tile__value">{tile.value}</span>
                      <span className="ui-stat__label">{tile.sub}</span>
                    </div>
                  ))}
                </div>

                {/* ── Evolução ── */}
                <section className="ui-card ui-card--pad ui-stack" aria-label="Evolução da carga">
                  <div className="ui-section__head" style={{ padding: 0, alignItems: "center" }}>
                    <h2 className="ui-h2">Evolução</h2>
                    <div className="ui-seg" role="group" aria-label="Período do gráfico">
                      {WINDOWS.map((w) => (
                        <button key={w} type="button" className="ui-seg__item" aria-pressed={windowDays === w} onClick={() => setWindowDays(w)}>
                          {w}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="carga-chart">
                    <canvas
                      ref={canvasRef}
                      role="img"
                      aria-label={`Forma, fadiga e frescor nos últimos ${windowDays} dias. Hoje: forma ${formatNumber(today.ctl, 1)}, fadiga ${formatNumber(today.atl, 1)}, frescor ${formatSigned(today.tsb)}.`}
                    />
                  </div>
                  <div className="carga-legend">
                    {[
                      { color: COLOR_CTL, label: "Forma (CTL)" },
                      { color: COLOR_ATL, label: "Fadiga (ATL)" },
                      { color: COLOR_TSB, label: "Frescor (TSB), eixo direito" },
                    ].map((item) => (
                      <span key={item.label} className="carga-legend__item">
                        <span className="carga-legend__line" style={{ background: item.color }} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              <div className="hoje-col">
                {/* ── Últimos dias ── */}
                <section className="ui-section" style={{ paddingTop: 0 }} aria-label={`Últimos ${LIST_DAYS} dias`}>
                  <div className="ui-section__head">
                    <h2 className="ui-h2">Últimos {LIST_DAYS} dias</h2>
                    <span className="ui-muted">carga do dia · ratio</span>
                  </div>
                  <div className="ui-card">
                    {recentDays.map((day) => {
                      const dayMeta = STATUS_META[day.status];
                      const rested = day.load <= 0;
                      return (
                        <div key={day.date} className="carga-day">
                          <span className="carga-day__date">
                            {formatWeekdayShort(day.date)} {formatDate(day.date)}
                          </span>
                          <span className="carga-day__load">
                            <span className="carga-day__track">
                              <span className="carga-day__fill" style={{ display: "block", width: `${rested ? 0 : Math.max((day.load / maxLoad) * 100, 3)}%` }} />
                            </span>
                            <span className="carga-day__value" style={rested ? { color: "var(--ui-muted)" } : undefined}>
                              {rested ? "descanso" : formatNumber(day.load)}
                            </span>
                          </span>
                          <span className="carga-day__status">
                            <span className="ui-num" style={{ fontSize: 15 }}>{formatNumber(day.ratio, 2)}</span>
                            <span style={{ fontSize: 12, color: dayMeta.color }}>{dayMeta.label}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>

            {/* ── Explicações, recolhidas ── */}
            <div className="hoje-col" style={{ marginTop: 12 }}>
              <details className="ui-card ui-details">
                <summary>Como ler estes números<Chevron /></summary>
                <div className="ui-details__body">
                  <p>
                    <strong>Hoje:</strong> {meta.description}. Frescor em <strong>{tsbReading.label.toLowerCase()}</strong>: {tsbReading.text}
                  </p>
                  <p><strong>Carga do dia.</strong> Pontos na escala do TSS: 1 hora no seu limiar vale 100. Com FC, é o TRIMP de Banister convertido pela sua FC de limiar (hrTSS); sem FC, é o rTSS pelo pace.</p>
                  <p><strong>Forma (CTL).</strong> Média da carga diária com peso de 42 dias. Sobe devagar e mostra quanto treino seu corpo vem sustentando.</p>
                  <p><strong>Fadiga (ATL).</strong> A mesma média com peso de 7 dias. Sobe rápido depois de longões e treinos fortes e cai rápido no descanso.</p>
                  <p><strong>Frescor (TSB).</strong> Forma menos fadiga ao fim do dia anterior, ou seja, como você acordou hoje. O treino de hoje só entra no frescor de amanhã.</p>
                  <p><strong>Aguda/crônica.</strong> Fadiga dividida pela forma. Mostra se a carga recente saltou em relação à sua base. Os estudos discordam sobre o quanto isso prevê lesão: use como alerta de tendência, nunca como diagnóstico.</p>
                </div>
              </details>

              <details className="ui-card ui-details">
                <summary>Faixas da carga aguda/crônica<Chevron /></summary>
                <div className="ui-details__body">
                  {RATIO_ZONES.map((zone) => (
                    <p key={zone.key}>
                      <strong style={{ color: STATUS_META[zone.key].color }}>{zone.label}</strong>{" "}
                      {zone.to === RATIO_MAX ? `${formatNumber(zone.from, 1)} ou mais` : `${formatNumber(zone.from, 1)}–${formatNumber(zone.to, 1)}`} · {zone.hint}
                    </p>
                  ))}
                </div>
              </details>

              <details className="ui-card ui-details">
                <summary>Faixas do frescor<Chevron /></summary>
                <div className="ui-details__body">
                  <p><strong>+25 ou mais · Muito descansado.</strong> Bom na véspera de prova; por muitos dias, a forma cai.</p>
                  <p><strong>+5 a +25 · Pronto para prova.</strong> Janela típica de prova ou teste depois do polimento.</p>
                  <p><strong>−10 a +5 · Transição.</strong> De passagem, subindo para prova ou voltando de descanso. Muito tempo aqui é treino sem progressão.</p>
                  <p><strong>−30 a −10 · Em bloco de treino.</strong> Normal em semanas de construção; cansado demais para render em prova.</p>
                  <p><strong>Abaixo de −30 · Fadiga alta.</strong> Hora de olhar sono, pernas e FC de repouso antes de forçar.</p>
                  <p className="ui-muted">Para evoluir: forma subindo aos poucos e carga aguda/crônica entre 0,8 e 1,3. Para a prova: frescor subindo para +5 a +25 com a fadiga caindo nos dias anteriores.</p>
                </div>
              </details>

              <details className="ui-card ui-details">
                <summary>Detalhes do cálculo<Chevron /></summary>
                <div className="ui-details__body">
                  <dl className="ui-dl">
                    <div><dt>T-pace (limiar)</dt><dd>{formatPace(data.thresholdPaceSecPerKm)}</dd></div>
                    <div><dt>VDOT dinâmico</dt><dd>{data.vdot ? formatNumber(data.vdot, 1) : "—"}</dd></div>
                    <div><dt>Atividades analisadas</dt><dd>{formatNumber(data.totalActivities)}</dd></div>
                    <div><dt>FC máx / repouso</dt><dd>{data.hrMax ?? "—"}/{data.hrRest ?? "—"} bpm</dd></div>
                    <div><dt>FC de limiar</dt><dd>{data.lthr ?? "—"} bpm</dd></div>
                    <div><dt>Aquecimento do CTL</dt><dd>{data.warmupDays ?? "—"} dias</dd></div>
                    <div><dt>Janela calculada</dt><dd>{data.displayedDays ?? "—"} dias</dd></div>
                    <div><dt>Fuso dos dias</dt><dd>{data.timeZone?.split("/").pop()?.replace("_", " ") ?? "—"}</dd></div>
                    <div>
                      <dt>Método</dt>
                      <dd>
                        {data.loadMethod
                          ? `hrTSS em ${formatNumber(data.loadMethod.withHeartRate)}, rTSS em ${formatNumber(data.loadMethod.fallbackPace)}`
                          : "hrTSS / rTSS"}
                      </dd>
                    </div>
                  </dl>
                  <p className="ui-muted">
                    Com FC, a carga é o TRIMP de Banister dividido pelo TRIMP de 1 hora na FC de limiar (× 100). Sem FC, é o
                    rTSS com o T-pace do VDOT (88%, como na tabela de Daniels). Constantes de 42 e 7 dias; o aquecimento é
                    calculado antes dos dias exibidos para a forma não começar artificialmente baixa.
                  </p>
                </div>
              </details>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
