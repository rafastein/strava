"use client";

import { useEffect, useState } from "react";

type ZoneData = {
  zone: number;
  label: string;
  timeSec: number;
  pct: number;
  minPaceSec: number | null;
  maxPaceSec: number | null;
};

type Props = {
  activityId: number;
  compact?: boolean;
};

const ZONE_COLORS = ["#3b82f6", "#60a5fa", "#93c5fd", "#f5a623", "#10b981", "#6b7280"];

function formatPace(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
}

export default function ActivityZoneChart({ activityId, compact = false }: Props) {
  const [zones, setZones]   = useState<ZoneData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/strava/zones?id=${activityId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setZones(data.zones);
      })
      .catch(() => setError("Erro ao carregar zonas"))
      .finally(() => setLoading(false));
  }, [activityId]);

  if (loading) return (
    <div style={{ padding: compact ? "6px 0" : "12px 0", opacity: 0.4 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>
        Carregando zonas...
      </p>
    </div>
  );

  if (error || !zones) return null;

  const activeZones = zones.filter((z) => z.pct > 0);
  if (!activeZones.length) return null;

  return (
    <div style={{ marginTop: compact ? 8 : 16 }}>
      {!compact && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.3)", marginBottom: 10 }}>
          Zonas de ritmo
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 4 : 6 }}>
        {zones.map((z, i) => {
          const color = ZONE_COLORS[i] ?? "#6b7280";
          const paceRange = z.minPaceSec || z.maxPaceSec
            ? z.maxPaceSec && z.minPaceSec
              ? `${formatPace(z.maxPaceSec)}–${formatPace(z.minPaceSec)}`
              : z.maxPaceSec ? `< ${formatPace(z.maxPaceSec)}` : `> ${formatPace(z.minPaceSec)}`
            : "";
          return (
            <div key={z.zone} style={{ display: "grid", gridTemplateColumns: "28px 1fr 40px 70px", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: z.pct > 0 ? color : "rgba(255,255,255,.2)", fontWeight: 600 }}>
                {z.label}
              </span>
              <div style={{ height: compact ? 6 : 8, background: "rgba(255,255,255,.07)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${z.pct}%`, background: color, borderRadius: 999, transition: "width .6s ease" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: z.pct > 0 ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.2)", textAlign: "right", fontWeight: z.pct > 10 ? 600 : 400 }}>
                {z.pct}%
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.3)", textAlign: "right" }}>
                {paceRange}
              </span>
            </div>
          );
        })}
      </div>
      {!compact && (
        <p style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,.2)" }}>
          Total: {formatTime(zones.reduce((a, z) => a + z.timeSec, 0))} · via stream Strava
        </p>
      )}
    </div>
  );
}
