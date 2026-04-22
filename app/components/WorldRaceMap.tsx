"use client";

import { ComposableMap, Geographies, Geography } from "@vnedyalk0v/react19-simple-maps";
import worldGeo from "world-atlas/countries-110m.json";

type Props = {
  counts: Record<string, number>;
};

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const COUNTRY_ALIASES: Record<string, string> = {
  brasil: "brazil",
  brazil: "brazil",

  alemanha: "germany",
  germany: "germany",
  deutschland: "germany",

  "estados unidos": "united states of america",
  "estados unidos da america": "united states of america",
  eua: "united states of america",
  usa: "united states of america",
  "united states": "united states of america",
  "united states of america": "united states of america",

  japao: "japan",
  japão: "japan",
  japan: "japan",

  portugal: "portugal",

  "reino unido": "united kingdom",
  "united kingdom": "united kingdom",
  uk: "united kingdom",
  inglaterra: "united kingdom",

  espanha: "spain",
  spain: "spain",

  franca: "france",
  frança: "france",
  france: "france",

  italia: "italy",
  itália: "italy",
  italy: "italy",

  holanda: "netherlands",
  "paises baixos": "netherlands",
  "países baixos": "netherlands",
  netherlands: "netherlands",

  argentina: "argentina",
  chile: "chile",

  paraguai: "paraguay",
  paraguay: "paraguay",

  peru: "peru",

  mexico: "mexico",
  méxico: "mexico",
  canada: "canada",
  canad\u00e1: "canada",
  australia: "australia",
  austrália: "australia",
  irlanda: "ireland",
  ireland: "ireland",
  suica: "switzerland",
  suíça: "switzerland",
  switzerland: "switzerland",
  austria: "austria",
  áustria: "austria",
  belgica: "belgium",
  bélgica: "belgium",
  belgium: "belgium",
  dinamarca: "denmark",
  denmark: "denmark",
  suecia: "sweden",
  suécia: "sweden",
  sweden: "sweden",
  noruega: "norway",
  norway: "norway",
  finlandia: "finland",
  finlândia: "finland",
  finland: "finland",
  polonia: "poland",
  polônia: "poland",
  poland: "poland",
  "republica tcheca": "czechia",
  "república tcheca": "czechia",
  tchequia: "czechia",
  tchéquia: "czechia",
  czechia: "czechia",
  "czech republic": "czechia",
  hungria: "hungary",
  hungary: "hungary",
  grecia: "greece",
  grécia: "greece",
  greece: "greece",
  turquia: "turkey",
  turkey: "turkey",
  "emirados arabes unidos": "united arab emirates",
  "emirados árabes unidos": "united arab emirates",
  uae: "united arab emirates",
  "united arab emirates": "united arab emirates",
  "africa do sul": "south africa",
  "áfrica do sul": "south africa",
  "south africa": "south africa",
  "nova zelandia": "new zealand",
  "nova zelândia": "new zealand",
  "new zealand": "new zealand",
};

function canonicalCountryName(value: string) {
  const normalized = normalizeText(value);
  return COUNTRY_ALIASES[normalized] ?? normalized;
}

function buildCanonicalCounts(counts: Record<string, number>) {
  const result: Record<string, number> = {};

  for (const [country, count] of Object.entries(counts)) {
    const canonical = canonicalCountryName(country);
    result[canonical] = (result[canonical] ?? 0) + count;
  }

  return result;
}

function getFill(count: number) {
  if (count >= 8) return "#9a3412";
  if (count >= 4) return "#ea580c";
  if (count >= 2) return "#fb923c";
  if (count >= 1) return "#fed7aa";
  return "#e5e7eb";
}

export default function WorldRaceMap({ counts }: Props) {
  const canonicalCounts = buildCanonicalCounts(counts);
  const hasHighlights = Object.values(canonicalCounts).some((value) => value > 0);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Mapa-múndi</h2>
      <p className="mt-1 text-sm text-gray-500">
        Visualização geográfica das corridas identificadas por país.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] px-2 py-1">
        <div className="w-full rounded-xl bg-white">
          <ComposableMap
            projection="geoEqualEarth"
            projectionConfig={{ scale: 175 }}
            width={980}
            height={380}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            <Geographies geography={worldGeo}>
              {({ geographies }) =>
                geographies.map((geo, index) => {
                  const rawName = String(geo.properties?.name ?? "");
                  const canonicalName = canonicalCountryName(rawName);
                  const count = canonicalCounts[canonicalName] ?? 0;
                  const isHighlighted = count > 0;

                  return (
                    <Geography
                      key={`${rawName}-${geo.rsmKey ?? index}-${index}`}
                      geography={geo}
                      fill={getFill(count)}
                      stroke="#f8fafc"
                      strokeWidth={0.7}
                      style={{
                        default: {
                          outline: "none",
                          transition: "all 0.2s ease",
                          filter: isHighlighted
                            ? "drop-shadow(0 3px 6px rgba(0,0,0,0.08))"
                            : "none",
                        },
                        hover: {
                          outline: "none",
                          fill: isHighlighted ? "#f97316" : "#d1d5db",
                        },
                        pressed: {
                          outline: "none",
                        },
                      }}
                    >
                      <title>{`${rawName}: ${count} corrida(s)`}</title>
                    </Geography>
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
        <Legend color="#e5e7eb" label="0" />
        <Legend color="#fed7aa" label="1" />
        <Legend color="#fb923c" label="2-3" />
        <Legend color="#ea580c" label="4-7" />
        <Legend color="#9a3412" label="8+" />
      </div>

      {!hasHighlights && (
        <p className="mt-3 text-sm text-gray-500">
          O mapa carregou, mas nenhum país recebeu destaque ainda.
        </p>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-sm border border-gray-200"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}