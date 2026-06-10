"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Race = {
  name: string;
  date: string;
  location: string;
  distanceKm: number;
  objective: string;
  targetPaceSecPerKm: number | null;
  href?: string;
};

function formatPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string, now: number): number {
  return Math.ceil((new Date(iso).getTime() - now) / (1000 * 60 * 60 * 24));
}

type Props = { races: Race[]; dark?: boolean };

export default function NextRaceCard({ races }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initial = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  if (now === null) return null;

  const upcoming = races
    .filter((r) => new Date(r.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (upcoming.length === 0) return null;

  const next = upcoming[0];
  const days = daysUntil(next.date, now);

  return (
    <div className="ba-card" style={{ padding: "1.25rem 1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: "1rem" }}>
        <div>
          <p className="ba-eyebrow" style={{ marginBottom: 4 }}>Próxima prova</p>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{next.name}</h3>
          <p className="ba-muted" style={{ fontSize: 12 }}>{formatDate(next.date)} · {next.location}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span className="badge badge--accent" style={{ fontSize: 13, fontWeight: 700, padding: "3px 10px" }}>{days}d</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.3)", fontFamily: "var(--font-mono)" }}>{next.distanceKm} km</span>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
        <div className="ba-card-soft" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px" }}>
          <span className="ba-label">Objetivo</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{next.objective}</span>
        </div>
        {next.targetPaceSecPerKm && (
          <div className="ba-card-soft" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px" }}>
            <span className="ba-label">Pace-alvo</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
              {formatPace(next.targetPaceSecPerKm)}
            </span>
          </div>
        )}
      </div>

      {/* Em seguida */}
      {upcoming.length > 1 && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: "1rem" }}>
          <p className="ba-label" style={{ marginBottom: 8 }}>Em seguida</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {upcoming.slice(1, 3).map((r) => (
              <div key={r.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,.6)" }}>{r.name}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,.3)" }}>
                  {formatDate(r.date)} · {daysUntil(r.date, now)}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {next.href && (
        <Link href={next.href} className="ba-pill ba-pill-orange" style={{ marginTop: "1rem", width: "100%", justifyContent: "center" }}>
          Ver painel completo →
        </Link>
      )}
    </div>
  );
}
