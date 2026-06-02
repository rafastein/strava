"use client";

import { useEffect, useState, useCallback } from "react";

type ZoneData = {
  zone: number;
  label: string;
  timeSec: number;
  pct: number;
  minPaceSec: number | null;
  maxPaceSec: number | null;
};

type ApiResponse = {
  zones: ZoneData[];
  runCount: number;
  cachedCount: number;
  missingCount: number;
  period: string;
  error?: string;
};

type Period = "week" | "month" | "cycle";

const ZONE_COLORS = ["#3b82f6", "#60a5fa", "#93c5fd", "#f5a623", "#10b981", "#6b7280"];
const ZONE_NAMES  = ["Velocidade", "Limiar alto", "Limiar", "Aeróbico", "Resistência", "Recuperação"];

const TABS: { id: Period; label: string }[] = [
  { id: "week",  label: "Esta semana" },
  { id: "month", label: "Este mês"    },
  { id: "cycle", label: "Ciclo (16s)" },
];

function formatPace(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function ZonesAggregate() {
  const [period, setPeriod]       = useState<Period>("week");
  const [data, setData]           = useState<Record<Period, ApiResponse | null>>({ week: null, month: null, cycle: null });
  const [loading, setLoading]     = useState<Record<Period, boolean>>({ week: true, month: false, cycle: false });
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const fetchPeriod = useCallback(async (p: Period, force = false) => {
    if (data[p] && !force) return;
    setLoading((prev) => ({ ...prev, [p]: true }));
    try {
      const res  = await fetch(`/api/strava/zones-aggregate?period=${p}`);
      const json = await res.json() as ApiResponse;
      setData((prev) => ({ ...prev, [p]: json }));
    } catch {
      setData((prev) => ({ ...prev, [p]: { zones: [], runCount: 0, cachedCount: 0, missingCount: 0, period: p, error: "Erro ao carregar" } }));
    } finally {
      setLoading((prev) => ({ ...prev, [p]: false }));
    }
  }, [data]);

  // Batch process: keep calling until missingCount = 0
  const processAll = useCallback(async () => {
    setProcessing(true);
    setProcessedCount(0);
    let missing = 999;
    let attempts = 0;
    while (missing > 0 && attempts < 20) {
      try {
        const res  = await fetch(`/api/strava/zones-aggregate?period=cycle`);
        const json = await res.json() as ApiResponse;
        missing = json.missingCount ?? 0;
        setProcessedCount(json.cachedCount ?? 0);
        // Update all periods with fresh data
        setData({ week: null, month: null, cycle: json });
        if (missing === 0) break;
        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 800));
      } catch { break; }
      attempts++;
    }
    // Reload current period
    await fetchPeriod(period, true);
    setProcessing(false);
  }, [period, fetchPeriod]);

  useEffect(() => { fetchPeriod("week"); }, []);

  function handleTab(p: Period) {
    setPeriod(p);
    fetchPeriod(p);
  }

  const current  = data[period];
  const isLoading = loading[period];
  const zones    = current?.zones?.filter((z) => z.pct > 0) ?? [];
  const allZones = current?.zones ?? [];

  return (
    <div className="ba-card" style={{ padding: "1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.25rem" }}>
        <div>
          <p className="ba-eyebrow">Distribuição de esforço</p>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", letterSpacing: ".03em", color: "var(--text)", lineHeight: 1, marginTop: 2 }}>
            Zonas de ritmo
          </h3>
        </div>
        {current && !isLoading && (
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.3)" }}>
              {current.runCount} corrida{current.runCount !== 1 ? "s" : ""}
            </p>
            {current.missingCount > 0 && !processing && (
              <button
                onClick={processAll}
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", color: "#f5a623", padding: "4px 10px", borderRadius: 999, cursor: "pointer" }}
              >
                Processar {current.missingCount} corridas
              </button>
            )}
            {processing && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(245,166,35,.7)" }}>
                Processando... {processedCount} cacheadas
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTab(t.id)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".07em",
              textTransform: "uppercase",
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: period === t.id ? "var(--accent)" : "rgba(255,255,255,.06)",
              color: period === t.id ? "#111" : "rgba(255,255,255,.5)",
              fontWeight: period === t.id ? 700 : 400,
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ padding: "2rem 0", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,.3)", letterSpacing: ".1em" }}>
            Carregando streams...
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,.2)", marginTop: 6 }}>
            Primeira carga pode demorar alguns segundos
          </p>
        </div>
      ) : current?.error ? (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,.3)" }}>{current.error}</p>
      ) : !zones.length ? (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,.3)" }}>Nenhuma corrida com dados de zona no período.</p>
      ) : (
        <>
          {/* Zone bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allZones.map((z, i) => {
              const color   = ZONE_COLORS[i] ?? "#6b7280";
              const name    = ZONE_NAMES[i]  ?? z.label;
              const paceRange = z.maxPaceSec && z.minPaceSec
                ? `${formatPace(z.maxPaceSec)}–${formatPace(z.minPaceSec)}`
                : z.maxPaceSec ? `< ${formatPace(z.maxPaceSec)}`
                : z.minPaceSec ? `> ${formatPace(z.minPaceSec)}` : "";

              return (
                <div key={z.zone}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, fontWeight: 700, width: 20 }}>{z.label}</span>
                      <span style={{ fontSize: 12, color: z.pct > 0 ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.2)" }}>{name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {z.pct > 0 && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.3)" }}>
                          {formatTime(z.timeSec)}
                        </span>
                      )}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: z.pct > 5 ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.25)", fontWeight: z.pct > 10 ? 600 : 400, width: 32, textAlign: "right" }}>
                        {z.pct}%
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.25)", width: 90, textAlign: "right" }}>
                        {paceRange}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,.06)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${z.pct}%`,
                      background: color,
                      borderRadius: 999,
                      opacity: z.pct > 0 ? 1 : 0,
                      transition: "width .7s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total time */}
          <p style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "rgba(255,255,255,.2)" }}>
            Total: {formatTime(allZones.reduce((a, z) => a + z.timeSec, 0))} · via stream Strava
            {(current?.missingCount ?? 0) > 0 && !processing && ` · ${current!.missingCount} corrida${current!.missingCount > 1 ? "s" : ""} sem cache`}
          </p>
        </>
      )}
    </div>
  );
}
