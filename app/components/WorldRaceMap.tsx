/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";

type Props = {
  counts: Record<string, number>;
};

const EMPTY_FILL = "#16181d";
const MAP_STROKE = "#2b313d";

function normalize(text: string) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mapCountryName(name: string) {
  const n = normalize(name);

  const map: Record<string, string> = {
    "united states": "estados unidos",
    "united states of america": "estados unidos",
    usa: "estados unidos",
    germany: "alemanha",
    deutschland: "alemanha",
    brazil: "brasil",
    netherlands: "paises baixos",
    holland: "paises baixos",
    paraguay: "paraguai",
    "republic of paraguay": "paraguai",
    spain: "espanha",
    france: "franca",
    italy: "italia",
    japan: "japao",
  };

  return map[n] || n;
}

function getCountForCountry(name: string, counts: Record<string, number>) {
  const mapped = mapCountryName(name);
  return counts[mapped] ?? counts[normalize(name)] ?? 0;
}

function getFillColor(count: number) {
  if (count >= 8) return "#f59e0b";
  if (count >= 4) return "#d97706";
  if (count >= 2) return "#a85a16";
  if (count >= 1) return "#6b3f12";
  return EMPTY_FILL;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-3 w-3 rounded-sm border border-white/10"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export default function WorldRaceMap({ counts }: Props) {
  const [geoData, setGeoData] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoadError(null);
        const res = await fetch("/maps/world.geojson");

        if (!res.ok) throw new Error("Erro ao carregar o mapa-múndi.");

        const data = await res.json();
        setGeoData(data);
      } catch (err) {
        console.error("Erro mapa mundo:", err);
        setLoadError("Não foi possível carregar o mapa-múndi.");
      }
    }

    load();
  }, []);

  const hasHighlights = useMemo(
    () => Object.values(counts).some((count) => count > 0),
    [counts]
  );

  const projection = geoData ? geoMercator().fitSize([1000, 540], geoData) : null;
  const pathGenerator = projection ? geoPath().projection(projection) : null;

  return (
    <div className="ba-card" style={{ padding: "1.5rem" }}>
      <p className="ba-eyebrow">Mapa-múndi</p>

      <p className="ba-muted" style={{ marginTop: 4 }}>
        Visualização das corridas por país.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1115] p-1">
        <div className="w-full rounded-xl bg-[#0f1115]">
          {loadError ? (
            <div
              className="flex h-[460px] items-center justify-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {loadError}
            </div>
          ) : !geoData || !pathGenerator ? (
            <div
              className="flex h-[460px] items-center justify-center text-sm"
              style={{ color: "var(--text-faint)" }}
            >
              Carregando mapa...
            </div>
          ) : (
            <svg
              viewBox="0 0 1000 540"
              className="w-full h-auto"
              style={{ background: "#0f1115" }}
            >
              {geoData.features.map((feature: any, index: number) => {
                const name =
                  feature.properties?.name ||
                  feature.properties?.NAME ||
                  feature.properties?.ADMIN ||
                  "País";

                const count = getCountForCountry(name, counts);
                const highlight = count > 0;

                return (
                  <path
                    key={`${name}-${index}`}
                    d={pathGenerator(feature) || ""}
                    fill={getFillColor(count)}
                    stroke={MAP_STROKE}
                    strokeWidth={0.6}
                    style={{
                      outline: "none",
                      transition: "all .2s",
                      filter: highlight
                        ? "drop-shadow(0 0 10px rgba(245,158,11,0.25))"
                        : "none",
                    }}
                  >
                    <title>{`${name}: ${count} corrida(s)`}</title>
                  </path>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-3 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <Legend color={EMPTY_FILL} label="0" />
        <Legend color="#6b3f12" label="1" />
        <Legend color="#a85a16" label="2-3" />
        <Legend color="#d97706" label="4-7" />
        <Legend color="#f59e0b" label="8+" />
      </div>

      {!loadError && !hasHighlights && (
        <p className="ba-muted" style={{ marginTop: 12 }}>
          Nenhum país com corrida foi encontrado para destacar no mapa.
        </p>
      )}
    </div>
  );
}
