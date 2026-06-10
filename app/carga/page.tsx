"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { STATUS_META, type DayLoad } from "../lib/training-load";

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
  color: string;
  hint: string;
};

const RATIO_MAX = 1.5;

const RATIO_ZONES: RatioZone[] = [
  {
    key: "recovery",
    label: "Recuperação",
    from: 0,
    to: 0.7,
    color: "#a78bfa",
    hint: "Carga recente bem abaixo da sua base. Bom para descansar, mas longo demais pode sinalizar perda de estímulo.",
  },
  {
    key: "performance",
    label: "Performance",
    from: 0.7,
    to: 0.8,
    color: "#60a5fa",
    hint: "Fadiga baixa. Janela boa para competir, testar pace ou chegar mais leve em treino-chave.",
  },
  {
    key: "optimal",
    label: "Ótimo",
    from: 0.8,
    to: 1.0,
    color: "#10b981",
    hint: "Carga bem encaixada. A fadiga recente acompanha a forma sem exagerar.",
  },
  {
    key: "maintaining",
    label: "Manutenção",
    from: 1.0,
    to: 1.3,
    color: "#f5a623",
    hint: "Carga recente acima da base. Pode ser produtivo em bloco forte, mas exige atenção à recuperação.",
  },
  {
    key: "overreaching",
    label: "Sobrecarga",
    from: 1.3,
    to: RATIO_MAX,
    color: "#ef4444",
    hint: "Fadiga muito acima da base. Zona para usar com cuidado e por pouco tempo.",
  },
];

function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

// Últimos N dias da série
function lastN(days: DayLoad[], n: number): DayLoad[] {
  return days.slice(-n);
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

function HelpCard({
  title,
  children,
  color = "rgba(255,255,255,0.5)",
}: {
  title: string;
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "0.85rem 0.95rem",
        borderRadius: 16,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.065)",
      }}
    >
      <p className="ba-label" style={{ color }}>{title}</p>
      <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.58)" }}>
        {children}
      </p>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 14px ${color}66`,
        flexShrink: 0,
      }}
    />
  );
}

export default function CargaPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<30 | 60 | 90>(60);
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
        setError("Erro ao carregar dados");
        setLoading(false);
      });
  }, []);

  // Renderiza chart.js quando dados chegam ou janela muda
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const visible = lastN(data.days, windowDays);
    const labels = visible.map((d) => formatDate(d.date));
    const ctlData = visible.map((d) => d.ctl);
    const atlData = visible.map((d) => d.atl);
    const tsbData = visible.map((d) => d.tsb);

    let cancelled = false;

    // Carrega chart.js dinamicamente
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
            {
              label: "CTL — Forma",
              data: ctlData,
              borderColor: "#10b981",
              backgroundColor: "rgba(16,185,129,0.08)",
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.4,
              fill: false,
            },
            {
              label: "ATL — Fadiga",
              data: atlData,
              borderColor: "#f5a623",
              backgroundColor: "rgba(245,166,35,0.08)",
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.4,
              fill: false,
            },
            {
              label: "TSB — Frescor",
              data: tsbData,
              borderColor: "#60a5fa",
              backgroundColor: "rgba(96,165,250,0.06)",
              borderWidth: 1.5,
              borderDash: [4, 3],
              pointRadius: 0,
              tension: 0.4,
              fill: false,
              yAxisID: "y2",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(13,13,13,0.92)",
              borderColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              titleColor: "rgba(255,255,255,0.55)",
              bodyColor: "#f0ede8",
              padding: 10,
              callbacks: {
                label: (ctx) => {
                  const v = Number(ctx.raw).toFixed(1);
                  return ` ${ctx.dataset.label}: ${v}`;
                },
                afterBody: () => ["", "CTL/ATL usam o eixo esquerdo.", "TSB usa o eixo direito."],
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: "rgba(255,255,255,0.3)",
                font: { size: 10, family: "DM Mono" },
                maxTicksLimit: 10,
                maxRotation: 0,
              },
              grid: { color: "rgba(255,255,255,0.04)" },
            },
            y: {
              position: "left",
              title: {
                display: true,
                text: "Carga — CTL / ATL",
                color: "rgba(255,255,255,0.32)",
                font: { size: 10, family: "DM Mono" },
              },
              ticks: {
                color: "rgba(255,255,255,0.3)",
                font: { size: 10, family: "DM Mono" },
              },
              grid: { color: "rgba(255,255,255,0.06)" },
            },
            y2: {
              position: "right",
              title: {
                display: true,
                text: "Frescor — TSB",
                color: "rgba(96,165,250,0.55)",
                font: { size: 10, family: "DM Mono" },
              },
              ticks: {
                color: "rgba(96,165,250,0.5)",
                font: { size: 10, family: "DM Mono" },
              },
              grid: { drawOnChartArea: false },
            },
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

  const today = data ? data.days[data.days.length - 1] : null;
  const meta = today ? STATUS_META[today.status] : null;

  return (
    <div className="page">
      <Navbar />

      <div className="ba-page">
        {/* Header */}
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Buenos Aires · 20 set 2026</p>
            <h1 className="ba-title">CARGA</h1>
            <p className="ba-muted" style={{ marginTop: 8, maxWidth: 760, lineHeight: 1.55 }}>
              Esta página mostra se o ciclo está construindo forma, acumulando fadiga ou pedindo recuperação.
              A leitura principal é sempre: forma de longo prazo, fadiga recente e frescor para render — com 30 dias de aquecimento antes da janela visível.
            </p>
          </div>
        </div>

        {loading && (
          <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
            Calculando ATL / CTL / TSB…
          </p>
        )}

        {error && (
          <p style={{ color: "var(--danger)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
            {error}
          </p>
        )}

        {data && today && meta && (
          <>
            {/* Guia rápido */}
            <div className="ba-card-soft" style={{ padding: "1.15rem 1.3rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <p className="ba-label">Como ler em 30 segundos</p>
                  <p style={{ marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 13, lineHeight: 1.55 }}>
                    Primeiro olhe o <strong>Status</strong> e o <strong>Ratio ATL/CTL</strong>. Depois confira se o gráfico mostra a
                    fadiga subindo mais rápido que a forma. Se o TSB ficar muito negativo por muitos dias, o corpo está pagando a conta.
                    O ratio é um semáforo de tendência, não um diagnóstico fechado de overtraining.
                  </p>
                </div>
                <div
                  style={{
                    alignSelf: "center",
                    padding: "0.7rem 0.9rem",
                    borderRadius: 14,
                    background: `${meta.color}14`,
                    border: `1px solid ${meta.color}33`,
                    minWidth: 220,
                  }}
                >
                  <p className="ba-label" style={{ color: meta.color }}>Leitura de hoje</p>
                  <p style={{ marginTop: 5, color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 1.45 }}>
                    {getRatioInsight(today)}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                <HelpCard title="CTL / Forma" color="#10b981">
                  Base aeróbica acumulada. Sobe devagar e mostra o quanto seu corpo vem sustentando treino nas últimas semanas.
                </HelpCard>
                <HelpCard title="ATL / Fadiga" color="#f5a623">
                  Peso dos treinos recentes. Sobe rápido depois de longões e treinos fortes; cai rápido quando você descansa.
                </HelpCard>
                <HelpCard title="TSB / Frescor" color="#60a5fa">
                  Diferença entre forma e fadiga no estado calculado. Se o treino de hoje já entrou, leia como pós-carga registrada.
                </HelpCard>
                <HelpCard title="Ratio ATL/CTL" color={meta.color}>
                  É o termômetro da página. Abaixo de 1, fadiga menor que a base. Acima de 1, fadiga recente maior que a base. Use como alerta, não como diagnóstico.
                </HelpCard>
              </div>
            </div>

            {/* Status atual — cards */}
            <div className="ba-grid-4" style={{ marginBottom: "1.5rem" }}>
              <div className="ba-card-soft" style={{ padding: "1.1rem 1.3rem" }}>
                <p className="ba-label">Status</p>
                <p className="ba-value" style={{ fontSize: "1.6rem", color: meta.color }}>
                  {meta.label}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, lineHeight: 1.4 }}>
                  {meta.description}
                </p>
              </div>

              <div className="ba-card-soft" style={{ padding: "1.1rem 1.3rem" }}>
                <p className="ba-label">CTL — Forma</p>
                <p className="ba-value ba-value--success" style={{ fontSize: "2rem" }}>
                  {today.ctl.toFixed(1)}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, lineHeight: 1.4 }}>
                  Média exponencial de ~42 dias. Número maior = base mais forte.
                </p>
              </div>

              <div className="ba-card-soft" style={{ padding: "1.1rem 1.3rem" }}>
                <p className="ba-label">ATL — Fadiga</p>
                <p className="ba-value ba-value--accent" style={{ fontSize: "2rem" }}>
                  {today.atl.toFixed(1)}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, lineHeight: 1.4 }}>
                  Média exponencial de ~7 dias. Número maior = mais carga recente.
                </p>
              </div>

              <div className="ba-card-soft" style={{ padding: "1.1rem 1.3rem" }}>
                <p className="ba-label">TSB — Frescor</p>
                <p
                  className="ba-value"
                  style={{
                    fontSize: "2rem",
                    color: today.tsb >= 0 ? "#60a5fa" : "#ef4444",
                  }}
                >
                  {formatSigned(today.tsb)}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, lineHeight: 1.4 }}>
                  CTL − ATL no estado calculado. Com treino já sincronizado, é leitura pós-carga do dia.
                </p>
              </div>
            </div>

            {/* Interpretação do dia */}
            <div className="ba-card-soft" style={{ padding: "1rem 1.3rem", marginBottom: "1.5rem" }}>
              <p className="ba-label" style={{ marginBottom: 10 }}>O que esses números estão dizendo</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Dot color={meta.color} />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
                    <strong style={{ color: "rgba(255,255,255,0.78)" }}>Status:</strong> {meta.description}.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Dot color="#60a5fa" />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
                    <strong style={{ color: "rgba(255,255,255,0.78)" }}>TSB:</strong> {getTsbInsight(today.tsb)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Dot color="#f5a623" />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
                    <strong style={{ color: "rgba(255,255,255,0.78)" }}>Carga:</strong> esforço calculado do dia. Com FC, usa TRIMP; sem FC, usa estimativa por pace. Dia sem corrida aparece como “—” na tabela.
                  </p>
                </div>
              </div>
            </div>

            {/* Ratio bar */}
            <div
              className="ba-card-soft"
              style={{ padding: "1rem 1.3rem", marginBottom: "1.5rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12 }}>
                <div>
                  <p className="ba-label">Ratio ATL / CTL</p>
                  <p style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.52)", lineHeight: 1.45 }}>
                    Compara a carga recente com sua base. A faixa verde é a zona mais equilibrada; vermelho indica sobrecarga recente e pede leitura junto com sono, dor, FC e sensação.
                  </p>
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: meta.color, whiteSpace: "nowrap" }}>
                  {today.ratio.toFixed(2)}
                </p>
              </div>
              <div style={{ position: "relative", height: 10, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                {/* Zonas coloridas em escala 0.0 → 1.5 */}
                {RATIO_ZONES.map((zone) => (
                  <div
                    key={zone.key}
                    title={`${zone.label}: ${zone.from.toFixed(1)}–${zone.to.toFixed(1)}`}
                    style={{
                      position: "absolute",
                      left: `${ratioToPercent(zone.from)}%`,
                      width: `${ratioToPercent(zone.to) - ratioToPercent(zone.from)}%`,
                      height: "100%",
                      background: `${zone.color}42`,
                    }}
                  />
                ))}
                {/* Marcador */}
                <div
                  style={{
                    position: "absolute",
                    left: `${ratioToPercent(today.ratio)}%`,
                    top: 0,
                    width: 3,
                    height: "100%",
                    background: meta.color,
                    borderRadius: 2,
                    transform: "translateX(-50%)",
                    boxShadow: `0 0 12px ${meta.color}`,
                  }}
                />
              </div>
              <div style={{ position: "relative", height: 16, marginTop: 5, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                {([0, 0.7, 0.8, 1.0, 1.3, 1.5] as const).map((tick) => (
                  <span
                    key={tick}
                    style={{
                      position: "absolute",
                      left: `${ratioToPercent(tick)}%`,
                      transform: tick === 0 ? "translateX(0)" : tick === 1.5 ? "translateX(-100%)" : "translateX(-50%)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tick === 1.5 ? "1.5+" : tick.toFixed(1)}
                  </span>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8, marginTop: 12 }}>
                {RATIO_ZONES.map((zone) => (
                  <div key={zone.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: "rgba(255,255,255,0.48)", lineHeight: 1.35 }}>
                    <Dot color={zone.color} />
                    <span>
                      <strong style={{ color: zone.color }}>{zone.label}</strong>
                      <br />
                      {zone.from.toFixed(1)}–{zone.to.toFixed(1)} · {zone.hint}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico */}
            <div className="ba-card" style={{ padding: "1.4rem 1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                  <p className="ba-label">Evolução da carga</p>
                  <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.52)", lineHeight: 1.45, maxWidth: 760 }}>
                    Verde deve subir devagar ao longo do ciclo. Laranja sobe rápido depois de semanas fortes. Azul mostra se você está mais fresco ou mais carregado no estado calculado após a carga registrada.
                  </p>
                </div>

                {/* Seletor de janela */}
                <div style={{ display: "flex", gap: 4, alignSelf: "flex-start" }}>
                  {([30, 60, 90] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindowDays(w)}
                      style={{
                        background: windowDays === w ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${windowDays === w ? "rgba(245,166,35,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: windowDays === w ? "var(--accent)" : "rgba(255,255,255,0.4)",
                        borderRadius: 6,
                        padding: "3px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {w}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Legenda manual */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 16 }}>
                {[
                  { color: "#10b981", label: "CTL — Forma", text: "base de 42 dias; tendência lenta" },
                  { color: "#f5a623", label: "ATL — Fadiga", text: "últimos 7 dias; reage rápido" },
                  { color: "#60a5fa", label: "TSB — Frescor", text: "CTL − ATL; usa o eixo direito" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
                    <span style={{ display: "inline-block", width: 18, height: 3, borderRadius: 2, background: item.color, marginTop: 6 }} />
                    <span>
                      <strong style={{ color: "rgba(255,255,255,0.68)" }}>{item.label}</strong>
                      <br />
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ position: "relative", height: 280 }}>
                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label={`Gráfico de carga de treino — CTL, ATL e TSB nos últimos ${windowDays} dias`}
                >
                  CTL {today.ctl.toFixed(1)}, ATL {today.atl.toFixed(1)}, TSB {today.tsb.toFixed(1)}
                </canvas>
              </div>
            </div>

            {/* Tabela últimos 14 dias */}
            <div className="ba-card-soft" style={{ padding: "1.2rem 1.4rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <p className="ba-label">Últimos 14 dias</p>
                  <p style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.45 }}>
                    Use a tabela para entender por que o status mudou: uma carga alta aumenta ATL primeiro; o CTL acompanha mais devagar.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
                <HelpCard title="Carga" color="#f5a623">Esforço calculado do treino do dia.</HelpCard>
                <HelpCard title="ATL" color="#f5a623">Fadiga recente acumulada.</HelpCard>
                <HelpCard title="CTL" color="#10b981">Forma/base construída.</HelpCard>
                <HelpCard title="TSB" color="#60a5fa">Quanto você está fresco ou carregado no estado calculado.</HelpCard>
                <HelpCard title="Ratio" color={meta.color}>ATL dividido por CTL.</HelpCard>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Data", "Carga", "ATL", "CTL", "TSB", "Ratio", "Status"].map((h) => (
                        <th key={h} style={{ padding: "4px 10px", color: "rgba(255,255,255,0.3)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastN(data.days, 14).reverse().map((day) => {
                      const m = STATUS_META[day.status];
                      return (
                        <tr key={day.date} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "5px 10px", color: "rgba(255,255,255,0.45)", textAlign: "right" }}>{formatDate(day.date)}</td>
                          <td style={{ padding: "5px 10px", color: day.trimp > 0 ? "var(--accent)" : "rgba(255,255,255,0.2)", textAlign: "right" }}>{day.trimp > 0 ? day.trimp.toFixed(0) : "—"}</td>
                          <td style={{ padding: "5px 10px", color: "#f5a623", textAlign: "right" }}>{day.atl.toFixed(1)}</td>
                          <td style={{ padding: "5px 10px", color: "#10b981", textAlign: "right" }}>{day.ctl.toFixed(1)}</td>
                          <td style={{ padding: "5px 10px", color: day.tsb >= 0 ? "#60a5fa" : "#ef4444", textAlign: "right" }}>
                            {formatSigned(day.tsb)}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: m.color }}>{day.ratio.toFixed(2)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right" }}>
                            <span style={{
                              background: `${m.color}1a`,
                              color: m.color,
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              border: `1px solid ${m.color}33`,
                            }}>
                              {m.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info técnica */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1.5rem" }}>
              {[
                { label: "T-pace (limiar)", value: formatPace(data.thresholdPaceSecPerKm), help: "Usado quando não há FC confiável." },
                { label: "VDOT dinâmico", value: data.vdot ? data.vdot.toFixed(1) : "—", help: "Base para estimar o limiar atual." },
                { label: "Atividades analisadas", value: String(data.totalActivities), help: "Corridas puxadas do Strava, incluindo aquecimento." },
                { label: "FC usada", value: `${data.hrMax ?? "—"}/${data.hrRest ?? "—"} bpm`, help: "FC máx/repouso do athlete-config.json." },
                { label: "Aquecimento CTL", value: `${data.warmupDays ?? 30}d`, help: "Calculado antes dos dias exibidos para evitar CTL artificialmente baixo." },
                { label: "Janela exibida", value: `${data.displayedDays ?? 90}d`, help: "Período visível no gráfico e na análise atual." },
                { label: "Fuso dos dias", value: data.timeZone?.replace("America/", "") ?? "São_Paulo", help: "Alinha o calendário ao horário local das atividades." },
                { label: "Método", value: "TRIMP / pace", help: `FC em ${data.loadMethod?.withHeartRate ?? "—"}; fallback por pace em ${data.loadMethod?.fallbackPace ?? "—"}.` },
              ].map((item) => (
                <div key={item.label} className="ba-card-soft" style={{ padding: "0.7rem 1rem", flex: "1 1 160px" }}>
                  <p className="ba-label">{item.label}</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                    {item.value}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4, lineHeight: 1.35 }}>
                    {item.help}
                  </p>
                </div>
              ))}
            </div>

            {/* Glossário final */}
            <div className="ba-card-soft" style={{ padding: "1rem 1.3rem" }}>
              <p className="ba-label" style={{ marginBottom: 10 }}>Regra prática do Jaja</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <HelpCard title="Para evoluir">
                  CTL subindo aos poucos, ATL controlado e ratio perto da zona verde/laranja clara.
                </HelpCard>
                <HelpCard title="Para performar">
                  TSB indo para perto de zero ou positivo, com ATL caindo antes da prova ou treino-chave.
                </HelpCard>
                <HelpCard title="Para não quebrar">
                  Evitar ratio acima de 1.3 por vários dias e TSB muito negativo sem recuperação planejada. É alerta de gestão de carga, não diagnóstico médico.
                </HelpCard>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
