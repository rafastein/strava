"use client";

import { useEffect, useRef } from "react";
import type { ChartDataset } from "chart.js";

export type ShoeUsageEntry = {
  name: string;
  totalKm: number;
  maxKm: number;
  lastUse: string;
  activities: number;
};

type Props = {
  shoes: ShoeUsageEntry[];
};

function wearColor(pct: number): string {
  if (pct >= 85) return "#ef4444";
  if (pct >= 65) return "#f97316";
  if (pct >= 40) return "#f59e0b";
  return "#10b981";
}

function wearLabel(pct: number): { text: string; cls: string } {
  if (pct >= 85) return { text: "Trocar em breve", cls: "bg-red-100 text-red-700" };
  if (pct >= 65) return { text: "Atenção", cls: "bg-orange-100 text-orange-700" };
  if (pct >= 40) return { text: "Moderado", cls: "bg-amber-100 text-amber-700" };
  return { text: "Novo", cls: "bg-emerald-100 text-emerald-700" };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch { return iso.slice(0, 10); }
}

export default function ShoeUsageChart({ shoes }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!chartRef.current || shoes.length === 0) return;

      const { Chart, registerables } = await import("chart.js");
      Chart.register(...registerables);

      if (cancelled || !chartRef.current) return;
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
        chartInstance.current = null;
      }

      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const tickColor = isDark ? "#9ca3af" : "#6b7280";

      const sorted = [...shoes].sort((a, b) => b.totalKm - a.totalKm);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datasets: ChartDataset<any, any>[] = [
        {
          type: "bar" as const,
          label: "Km rodados",
          data: sorted.map((s) => s.totalKm),
          backgroundColor: sorted.map((s) =>
            wearColor((s.totalKm / s.maxKm) * 100)
          ),
          borderRadius: 4,
          order: 1,
        },
        {
          type: "bar" as const,
          label: "Vida restante",
          data: sorted.map((s) => Math.max(s.maxKm - s.totalKm, 0)),
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          borderRadius: 4,
          order: 2,
        },
      ];

      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: sorted.map((s) => s.name.length > 20 ? s.name.slice(0, 20) + "…" : s.name),
          datasets,
        },
        options: {
          indexAxis: "y" as const,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const shoe = sorted[ctx.dataIndex];
                  if (ctx.datasetIndex === 0)
                    return `Rodados: ${shoe.totalKm.toFixed(0)} km (${((shoe.totalKm / shoe.maxKm) * 100).toFixed(0)}% da vida útil)`;
                  return `Restam: ${Math.max(shoe.maxKm - shoe.totalKm, 0).toFixed(0)} km de ${shoe.maxKm} km`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              ticks: { color: tickColor, font: { size: 10 }, callback: (v: unknown) => `${v} km` },
              grid: { color: gridColor },
            },
            y: {
              stacked: true,
              ticks: { color: tickColor, font: { size: 10 } },
              grid: { display: false },
            },
          },
        },
      });
    }

    render();
    return () => { cancelled = true; };
  }, [shoes]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy();
      }
    };
  }, []);

  const alerts = shoes.filter((s) => (s.totalKm / s.maxKm) >= 0.65);

  return (
    <div className="ba-card" style={{ padding: "1.5rem" }}>
      <div className="mb-4">
        <p className="ba-eyebrow">Desgaste por tênis</p>
        <p className="ba-muted" style={{ marginTop: 4 }}>
          Km rodados vs. vida útil estimada. Verde = novo · Amarelo = moderado · Laranja = atenção · Vermelho = trocar em breve.
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.map((s) => {
            const pct = (s.totalKm / s.maxKm) * 100;
            const { text, cls } = wearLabel(pct);
            return (
              <div key={s.name} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${cls}`}>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-sm font-semibold">
                  {s.totalKm.toFixed(0)}/{s.maxKm} km · {text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="relative"
        style={{ height: `${Math.max(shoes.length * 42 + 60, 200)}px` }}
      >
        <canvas
          ref={chartRef}
          role="img"
          aria-label="Gráfico de km rodados por tênis com vida útil restante"
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <th style={{ paddingBottom: 8, textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Tênis</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Km</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Vida útil</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Desgaste</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Último uso</th>
              <th style={{ paddingBottom: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...shoes]
              .sort((a, b) => b.totalKm / b.maxKm - a.totalKm / a.maxKm)
              .map((s) => {
                const pct = (s.totalKm / s.maxKm) * 100;
                const { text, cls } = wearLabel(pct);
                return (
                  <tr key={s.name} className="border-b border-gray-50">
                    <td style={{ padding: "8px 0", fontWeight: 500, color: "var(--text)" }}>{s.name}</td>
                    <td style={{ padding: "8px 0", textAlign: "right", color: "var(--text-muted)" }}>{s.totalKm.toFixed(0)}</td>
                    <td style={{ padding: "8px 0", textAlign: "right", color: "var(--text-faint)" }}>{s.maxKm} km</td>
                    <td className="py-2 text-right">
                      <div style={{ marginLeft: "auto", height: 5, width: 64, borderRadius: 999, background: "rgba(255,255,255,.07)" }}>
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            background: wearColor(pct),
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: "8px 0", textAlign: "right", color: "var(--text-faint)" }}>{formatDate(s.lastUse)}</td>
                    <td className="py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>
                        {text}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
