"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { STATUS_META, type DayLoad } from "../lib/training-load";

type ApiResponse = {
  days: DayLoad[];
  thresholdPaceSecPerKm: number;
  vdot: number | null;
  totalActivities: number;
};

function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// Últimos N dias da série
function lastN(days: DayLoad[], n: number): DayLoad[] {
  return days.slice(-n);
}

export default function CargaPage() {
  const [data, setData]       = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [window, setWindow]   = useState<30 | 60 | 90>(60);
  const canvasRef             = useRef<HTMLCanvasElement>(null);
  const chartRef              = useRef<unknown>(null);

  useEffect(() => {
    fetch("/api/strava/training-load")
      .then((r) => r.json())
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar dados"); setLoading(false); });
  }, []);

  // Renderiza chart.js quando dados chegam ou janela muda
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const visible = lastN(data.days, window);
    const labels  = visible.map((d) => formatDate(d.date));
    const ctlData = visible.map((d) => d.ctl);
    const atlData = visible.map((d) => d.atl);
    const tsbData = visible.map((d) => d.tsb);

    // Carrega chart.js dinamicamente
    import("chart.js/auto").then(({ default: Chart }) => {
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
      }

      chartRef.current = new Chart(canvasRef.current!, {
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
              ticks: {
                color: "rgba(255,255,255,0.3)",
                font: { size: 10, family: "DM Mono" },
              },
              grid: { color: "rgba(255,255,255,0.06)" },
            },
            y2: {
              position: "right",
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
      if (chartRef.current) {
        (chartRef.current as { destroy: () => void }).destroy();
        chartRef.current = null;
      }
    };
  }, [data, window]);

  const today   = data ? data.days[data.days.length - 1] : null;
  const meta    = today ? STATUS_META[today.status] : null;

  return (
    <div className="page">
      <Navbar />

      <div className="ba-page">
        {/* Header */}
        <div className="ba-page-header">
          <div>
            <p className="ba-eyebrow">Buenos Aires · 20 set 2026</p>
            <h1 className="ba-title">CARGA</h1>
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
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  Média ~42 dias
                </p>
              </div>

              <div className="ba-card-soft" style={{ padding: "1.1rem 1.3rem" }}>
                <p className="ba-label">ATL — Fadiga</p>
                <p className="ba-value ba-value--accent" style={{ fontSize: "2rem" }}>
                  {today.atl.toFixed(1)}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  Média ~7 dias
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
                  {today.tsb > 0 ? "+" : ""}{today.tsb.toFixed(1)}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  CTL − ATL
                </p>
              </div>
            </div>

            {/* Ratio bar */}
            <div
              className="ba-card-soft"
              style={{ padding: "1rem 1.3rem", marginBottom: "1.5rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p className="ba-label">Ratio ATL / CTL</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: meta.color }}>
                  {today.ratio.toFixed(2)}
                </p>
              </div>
              <div style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                {/* Zonas coloridas */}
                <div style={{ position: "absolute", left: 0, width: "53.8%", height: "100%", background: "rgba(167,139,250,0.3)" }} />
                <div style={{ position: "absolute", left: "53.8%", width: "15.4%", height: "100%", background: "rgba(96,165,250,0.3)" }} />
                <div style={{ position: "absolute", left: "61.5%", width: "15.4%", height: "100%", background: "rgba(16,185,129,0.3)" }} />
                <div style={{ position: "absolute", left: "76.9%", width: "23.1%", height: "100%", background: "rgba(245,166,35,0.3)" }} />
                <div style={{ position: "absolute", left: "100%", width: "0%", height: "100%", background: "rgba(239,68,68,0.3)" }} />
                {/* Marcador */}
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(today.ratio / 1.5 * 100, 100)}%`,
                    top: 0,
                    width: 3,
                    height: "100%",
                    background: meta.color,
                    borderRadius: 2,
                    transform: "translateX(-50%)",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                <span>0.0</span>
                <span>0.7 recup.</span>
                <span>0.8 perform.</span>
                <span>1.0 ótimo</span>
                <span>1.3 sobrecarga</span>
              </div>
            </div>

            {/* Gráfico */}
            <div className="ba-card" style={{ padding: "1.4rem 1.5rem", marginBottom: "1.5rem" }}>
              {/* Legenda manual */}
              <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                  { color: "#10b981", label: "CTL — Forma" },
                  { color: "#f5a623", label: "ATL — Fadiga" },
                  { color: "#60a5fa", label: "TSB — Frescor (eixo direito)" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                    <span style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, background: item.color }} />
                    {item.label}
                  </div>
                ))}

                {/* Seletor de janela */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {([30, 60, 90] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindow(w)}
                      style={{
                        background: window === w ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${window === w ? "rgba(245,166,35,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: window === w ? "var(--accent)" : "rgba(255,255,255,0.4)",
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

              <div style={{ position: "relative", height: 280 }}>
                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label={`Gráfico de carga de treino — CTL, ATL e TSB nos últimos ${window} dias`}
                >
                  CTL {today.ctl.toFixed(1)}, ATL {today.atl.toFixed(1)}, TSB {today.tsb.toFixed(1)}
                </canvas>
              </div>
            </div>

            {/* Tabela últimos 14 dias */}
            <div className="ba-card-soft" style={{ padding: "1.2rem 1.4rem", marginBottom: "1.5rem" }}>
              <p className="ba-label" style={{ marginBottom: 12 }}>Últimos 14 dias</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Data", "TRIMP", "ATL", "CTL", "TSB", "Ratio", "Status"].map((h) => (
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
                            {day.tsb > 0 ? "+" : ""}{day.tsb.toFixed(1)}
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
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "T-pace (limiar)", value: formatPace(data.thresholdPaceSecPerKm) },
                { label: "VDOT dinâmico", value: data.vdot ? data.vdot.toFixed(1) : "—" },
                { label: "Atividades analisadas", value: String(data.totalActivities) },
                { label: "Método", value: "TRIMP + rTSS" },
              ].map((item) => (
                <div key={item.label} className="ba-card-soft" style={{ padding: "0.7rem 1rem", flex: "1 1 160px" }}>
                  <p className="ba-label">{item.label}</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}