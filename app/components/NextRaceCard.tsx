"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Race = {
  name: string;
  date: string; // ISO
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
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

type Props = { races: Race[]; dark?: boolean };

export default function NextRaceCard({ races, dark }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const upcoming = races
    .filter((r) => new Date(r.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (upcoming.length === 0) return null;

  const next = upcoming[0];
  const days = daysUntil(next.date);

  return (
    <div style={{ background: dark ? "rgba(255,255,255,0.04)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.08)" : "none", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f5a623", marginBottom: 4 }}>
            Próxima prova
          </p>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: dark ? "#fff" : "#111", marginBottom: 2 }}>{next.name}</h3>
          <p style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.4)" : "#6b7280" }}>
            {formatDate(next.date)} · {next.location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span style={{ background: "rgba(245,166,35,0.15)", color: "#f5a623", padding: "3px 10px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
            {days}d
          </span>
          <span style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>{next.distanceKm} km</span>
        </div>
      </div>

      <div className="space-y-2">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(255,255,255,0.05)" : "#f9fafb", borderRadius: 10, padding: "8px 14px" }}>
          <span style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.4)" : "#6b7280" }}>Objetivo</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: dark ? "#fff" : "#111" }}>{next.objective}</span>
        </div>
        {next.targetPaceSecPerKm && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: dark ? "rgba(255,255,255,0.05)" : "#f9fafb", borderRadius: 10, padding: "8px 14px" }}>
            <span style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.4)" : "#6b7280" }}>Pace-alvo</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: dark ? "#f5a623" : "#111" }}>
              {formatPace(next.targetPaceSecPerKm)}
            </span>
          </div>
        )}
      </div>

      {upcoming.length > 1 && (
        <div style={{ marginTop: 12, borderTop: dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid #f3f4f6", paddingTop: 12 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: dark ? "rgba(255,255,255,0.25)" : "#9ca3af", marginBottom: 8 }}>
            Em seguida
          </p>
          <div className="space-y-1.5">
            {upcoming.slice(1, 3).map((r) => (
              <div
                key={r.date}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}
              >
                <span style={{ color: dark ? "rgba(255,255,255,0.6)" : "#374151" }}>{r.name}</span>
                <span style={{ color: dark ? "rgba(255,255,255,0.3)" : "#9ca3af" }}>
                  {formatDate(r.date)} · {daysUntil(r.date)}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {next.href && (
        <Link
          href={next.href}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          Ver painel completo →
        </Link>
      )}
    </div>
  );
}
