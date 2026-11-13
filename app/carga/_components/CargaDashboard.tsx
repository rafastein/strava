"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import { formatNumber, formatPace, formatWeekdayShort } from "../../lib/format";
import { STATUS_META, type DayLoad } from "../../lib/training-load";

type ApiResponse = {
  days: DayLoad[];
  thresholdPaceSecPerKm: number;
  vdot: number | null;
  totalActivities: number;
  hrMax?: number;
  hrRest?: number;
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

const RATIO_MAX = 1.5;
const LIST_DAYS = 14;
const WINDOWS = [30, 60, 90] as const;

// Cores das séries: azul × âmbar se distinguem também por luminosidade.
const COLOR_CTL = "#6aa8ff";
const COLOR_ATL = "#f5a623";
const COLOR_TSB = "#c9cdd3";

const RATIO_ZONES: RatioZone[] = [
  {
    key: "recovery",
    label: "Recuperação",
    from: 0,
    to: 0.7,
    hint: "Carga recente bem abaixo da sua base. Bom para descansar, mas longo demais pode sinalizar perda de estímulo.",
  },
  {
    key: "performance",
    label: "Performance",
    from: 0.7,
    to: 0.8,
    hint: "Fadiga baixa. Janela boa para competir, testar pace ou chegar mais leve em treino-chave.",
  },
  {
    key: "optimal",
    label: "Ótimo",
    from: 0.8,
    to: 1.0,
    hint: "Carga bem encaixada. A fadiga recente acompanha a forma sem exagerar.",
  },
  {
    key: "maintaining",
    label: "Manutenção",
    from: 1.0,
    to: 1.3,
    hint: "Carga recente acima da base. Pode ser produtivo em bloco forte, mas exige atenção à recuperação.",
  },
  {
    key: "overreaching",
    label: "Sobrecarga",
    from: 1.3,
    to: RATIO_MAX,
    hint: "Fadiga muito acima da base. Zona para usar com cuidado e por pouco tempo.",
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
  const pct = Math.abs(day.ratio - 1) * 100;

  if (day.ratio < 0.7) {
    return `Sua fadiga recente está ${pct.toFixed(0)}% abaixo da sua forma. Ótimo para recuperar, mas não é a zona principal de construção.`;
  }

  if (day.ratio < 0.8) {
    return `Sua fadiga recente está ${pct.toFixed(0)}% abaixo da forma. É uma zona boa para render melhor em prova ou treino-chave.`;
  }

  if (day.ratio <= 1.0) {
    return `Sua fadiga recente está praticamente alinhada à sua forma. É a zona mais limpa para evoluir sem acumular peso demais.`;
  }

  if (day.ratio <= 1.3) {
    return `Sua fadiga recente está ${pct.toFixed(0)}% acima da forma. Isso indica bloco forte: produtivo, mas precisa ser absorvido.`;
  }

  return `Sua fadiga recente está ${pct.toFixed(0)}% acima da forma. É sinal de sobrecarga recente e pede cautela nos próximos treinos.`;
}

function getTsbInsight(tsb: number): string {
  if (tsb >= 10) return "TSB bem positivo: carga recente baixa em relação à base. Bom para prova, mas longo demais pode reduzir estímulo.";
  if (tsb >= 0) return "TSB positivo: a fadiga recente está menor que a sua base. Bom sinal para chegar mais leve.";
  if (tsb >= -10) return "TSB levemente negativo: normal em semanas de treino. Você está carregado, mas ainda controlado.";
  if (tsb >= -25) return "TSB negativo: fadiga acumulada. Funciona em bloco específico, mas a recuperação vira prioridade.";
  return "TSB muito negativo: sinal forte de peso acumulado. Vale olhar sono, pernas, FC e sensação antes de forçar.";
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
    const tick = { color: "#9ba1a9", font: { size: 12, family: "Inter, system-ui, sans-serif" } };

    let cancelled = false;

    import("chart.js/auto").then(({ default: Chart }) => {
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
  const maxLoad = Math.max(...recentDays.map((d) => d.trimp), 1);

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

        {data && today && meta ? (
          <>
            <div className="carga-grid">
              <div className="hoje-col">
                {/* ── Status ── */}
                <section className="ui-card ui-card--pad ui-stack" aria-label="Status de hoje">
                  <div className="carga-status">
                    <div>
                      <p className="ui-muted">Status de hoje</p>
                      <p className="carga-status__label" style={{ color: meta.color, marginTop: 4 }}>{meta.label}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p className="ui-muted" style={{ whiteSpace: "nowrap" }}>Ratio ATL/CTL</p>
                      <p className="carga-status__ratio" style={{ marginTop: 4 }}>{formatNumber(today.ratio, 2)}</p>
                    </div>
                  </div>

                  <p style={{ fontSize: 15, color: "var(--ui-text-2)", textWrap: "pretty" }}>{getRatioInsight(today)}</p>

                  <div
                    className="carga-gauge"
                    role="img"
                    aria-label={`Ratio ${formatNumber(today.ratio, 2)}, na faixa ${meta.label}`}
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
                    { color: COLOR_TSB, label: "Frescor", value: formatSigned(today.tsb), sub: "TSB" },
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
                      const rested = day.trimp <= 0;
                      return (
                        <div key={day.date} className="carga-day">
                          <span className="carga-day__date">
                            {formatWeekdayShort(day.date)} {formatDate(day.date)}
                          </span>
                          <span className="carga-day__load">
                            <span className="carga-day__track">
                              <span className="carga-day__fill" style={{ display: "block", width: `${rested ? 0 : Math.max((day.trimp / maxLoad) * 100, 3)}%` }} />
                            </span>
                            <span className="carga-day__value" style={rested ? { color: "var(--ui-muted)" } : undefined}>
                              {rested ? "descanso" : formatNumber(day.trimp)}
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
                    Primeiro olhe o <strong>status</strong> e o <strong>ratio ATL/CTL</strong>. Depois confira se o gráfico mostra a
                    fadiga subindo mais rápido que a forma. Se o TSB ficar muito negativo por muitos dias, o corpo está pagando a
                    conta. O ratio é um semáforo de tendência, não um diagnóstico fechado de overtraining.
                  </p>
                  <p><strong>Hoje:</strong> {meta.description}. {getTsbInsight(today.tsb)}</p>
                  <p><strong>Forma (CTL).</strong> Base aeróbica acumulada. Sobe devagar e mostra o quanto seu corpo vem sustentando treino nas últimas semanas.</p>
                  <p><strong>Fadiga (ATL).</strong> Peso dos treinos recentes. Sobe rápido depois de longões e treinos fortes; cai rápido quando você descansa.</p>
                  <p><strong>Frescor (TSB).</strong> Diferença entre forma e fadiga no estado calculado. Se o treino de hoje já entrou, leia como pós-carga registrada.</p>
                  <p><strong>Ratio ATL/CTL.</strong> Abaixo de 1, fadiga menor que a base. Acima de 1, fadiga recente maior que a base. Use como alerta, não como diagnóstico.</p>
                  <p><strong>Carga do dia.</strong> Esforço calculado do treino. Com FC, usa TRIMP; sem FC, usa estimativa por pace.</p>
                </div>
              </details>

              <details className="ui-card ui-details">
                <summary>Faixas do ratio<Chevron /></summary>
                <div className="ui-details__body">
                  {RATIO_ZONES.map((zone) => (
                    <p key={zone.key}>
                      <strong style={{ color: STATUS_META[zone.key].color }}>{zone.label}</strong>{" "}
                      {formatNumber(zone.from, 1)}–{formatNumber(zone.to, 1)}{zone.to === RATIO_MAX ? "+" : ""} · {zone.hint}
                    </p>
                  ))}
                </div>
              </details>

              <details className="ui-card ui-details">
                <summary>Regra prática do Jaja<Chevron /></summary>
                <div className="ui-details__body">
                  <p><strong>Para evoluir.</strong> CTL subindo aos poucos, ATL controlado e ratio entre 0,8 e 1,3.</p>
                  <p><strong>Para performar.</strong> TSB indo para perto de zero ou positivo, com ATL caindo antes da prova ou treino-chave.</p>
                  <p><strong>Para não quebrar.</strong> Evitar ratio acima de 1,3 por vários dias e TSB muito negativo sem recuperação planejada. É alerta de gestão de carga, não diagnóstico médico.</p>
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
                    <div><dt>Aquecimento do CTL</dt><dd>{data.warmupDays ?? "—"} dias</dd></div>
                    <div><dt>Janela calculada</dt><dd>{data.displayedDays ?? "—"} dias</dd></div>
                    <div><dt>Fuso dos dias</dt><dd>{data.timeZone?.split("/").pop()?.replace("_", " ") ?? "—"}</dd></div>
                    <div>
                      <dt>Método</dt>
                      <dd>
                        {data.loadMethod
                          ? `FC em ${formatNumber(data.loadMethod.withHeartRate)}, pace em ${formatNumber(data.loadMethod.fallbackPace)}`
                          : "TRIMP / pace"}
                      </dd>
                    </div>
                  </dl>
                  <p className="ui-muted">
                    O T-pace vem do VDOT e só é usado quando a corrida não tem FC confiável. O aquecimento é calculado antes
                    dos dias exibidos para o CTL não começar artificialmente baixo.
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
