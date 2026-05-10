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

type Props = { races: Race[] };

export default function NextRaceCard({ races }: Props) {
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
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-orange-500">
            Próxima prova
          </p>
          <h3 className="mt-1 text-xl font-bold text-gray-900">{next.name}</h3>
          <p className="text-sm text-gray-500">
            {formatDate(next.date)} · {next.location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
            {days}d
          </span>
          <span className="text-xs text-gray-400">{next.distanceKm} km</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2">
          <span className="text-sm text-gray-500">Objetivo</span>
          <span className="text-sm font-semibold text-gray-900">{next.objective}</span>
        </div>
        {next.targetPaceSecPerKm && (
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2">
            <span className="text-sm text-gray-500">Pace-alvo</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatPace(next.targetPaceSecPerKm)}
            </span>
          </div>
        )}
      </div>

      {upcoming.length > 1 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Em seguida
          </p>
          <div className="space-y-1.5">
            {upcoming.slice(1, 3).map((r) => (
              <div
                key={r.date}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-700">{r.name}</span>
                <span className="text-gray-400">
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
