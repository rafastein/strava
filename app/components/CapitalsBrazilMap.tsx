"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "@vnedyalk0v/react19-simple-maps";
import { feature } from "topojson-client";

type CapitalStatus = "completed" | "next" | "locked";

type CapitalMapItem = {
  state: string;
  city: string;
  status: CapitalStatus;
  raceLabel: string;
  dateLabel: string;
  time?: string;
  pace?: string;
  photoUrl?: string | null;
  activityUrl?: string;
};

type Props = {
  items: CapitalMapItem[];
};

const geoUrl = "/maps/brazil-states.geojson";
const MAP_CENTER = [-53.4, -16.2] as any;
const MAP_STROKE = "#2b313d";
const EMPTY_FILL = "#16181d";

const STATE_NAME_BY_UF: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isFeatureCollection(data: any) {
  return data?.type === "FeatureCollection" && Array.isArray(data.features);
}

function isTopology(data: any) {
  return data?.type === "Topology" && data.objects;
}

function getStateKeys(geo: any) {
  const rawSigla = String(
    geo?.properties?.sigla ??
      geo?.properties?.SIGLA ??
      geo?.properties?.uf ??
      geo?.properties?.UF ??
      "",
  ).trim();

  const rawNome = String(
    geo?.properties?.name ??
      geo?.properties?.NAME ??
      geo?.properties?.nome ??
      geo?.properties?.NOME ??
      geo?.properties?.estado ??
      "",
  ).trim();

  return {
    sigla: normalizeText(rawSigla),
    nome: normalizeText(rawNome),
    rawSigla,
    rawNome,
  };
}

function getFill(status?: CapitalStatus) {
  if (status === "completed") return "#047857";
  if (status === "next") return "#b45309";
  return EMPTY_FILL;
}

function getHoverFill(status?: CapitalStatus) {
  if (status === "completed") return "#10b981";
  if (status === "next") return "#f59e0b";
  return "#222832";
}

function getStatusLabel(status: CapitalStatus) {
  if (status === "completed") return "Concluída";
  if (status === "next") return "Próxima";
  return "Pendente";
}

function getStatusDot(status: CapitalStatus) {
  if (status === "completed") return "#10b981";
  if (status === "next") return "#f59e0b";
  return EMPTY_FILL;
}

export default function CapitalsBrazilMap({ items }: Props) {
  const [geographyData, setGeographyData] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CapitalMapItem | null>(null);

  const itemsByKey = useMemo(() => {
    const map = new Map<string, CapitalMapItem>();

    items.forEach((item) => {
      const uf = item.state.toUpperCase();
      map.set(normalizeText(uf), item);

      const stateName = STATE_NAME_BY_UF[uf];
      if (stateName) map.set(normalizeText(stateName), item);
    });

    return map;
  }, [items]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { completed: 0, next: 0, locked: 0 } as Record<CapitalStatus, number>,
    );
  }, [items]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoadError(null);

        const response = await fetch(geoUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (isFeatureCollection(data)) {
          if (active) setGeographyData(data);
          return;
        }

        if (isTopology(data)) {
          const key = Object.keys(data.objects)[0];
          if (!key) throw new Error("TopoJSON inválido");

          const converted = feature(data, data.objects[key]);
          if (active) setGeographyData(converted);
          return;
        }

        throw new Error("Formato não suportado");
      } catch (error) {
        console.error("Erro mapa 27 capitais:", error);
        if (active) {
          setGeographyData(null);
          setLoadError("Não foi possível carregar o mapa.");
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="ba-card capitals-brazil-map-card" style={{ padding: "1.25rem" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .capitals-brazil-map-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
              gap: 1rem;
              align-items: stretch;
              margin-top: 1rem;
            }

            .capitals-brazil-map-frame {
              overflow: hidden;
              border-radius: 18px;
              border: 1px solid rgba(255,255,255,0.10);
              background: #0f1115;
              padding: .25rem;
              min-height: 420px;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .capitals-brazil-map-side {
              display: grid;
              gap: .75rem;
              align-content: start;
            }

            .capitals-brazil-map-stat {
              border-radius: 16px;
              border: 1px solid rgba(255,255,255,0.08);
              background: rgba(0,0,0,0.22);
              padding: .95rem;
            }

            .capitals-brazil-map-legend {
              display: grid;
              gap: .6rem;
              margin-top: .85rem;
            }

            .capitals-brazil-map-photo {
              overflow: hidden;
              border-radius: 18px;
              border: 1px solid rgba(16,185,129,0.18);
              background: linear-gradient(180deg, rgba(16,185,129,0.10), rgba(255,255,255,0.03));
            }

            .capitals-brazil-map-photo-image {
              width: 100%;
              aspect-ratio: 16 / 10;
              object-fit: cover;
              display: block;
              background: rgba(255,255,255,0.04);
            }

            .capitals-brazil-map-photo-empty {
              display: flex;
              min-height: 185px;
              align-items: center;
              justify-content: center;
              padding: 1rem;
              text-align: center;
              color: var(--text-muted);
              background: radial-gradient(circle at top, rgba(16,185,129,0.12), transparent 42%), rgba(0,0,0,0.22);
            }

            .capitals-brazil-map-state-clickable {
              cursor: pointer;
            }

            @media (max-width: 900px) {
              .capitals-brazil-map-grid {
                grid-template-columns: 1fr;
              }

              .capitals-brazil-map-frame {
                min-height: 320px;
              }
            }

            @media (max-width: 520px) {
              .capitals-brazil-map-card {
                padding: 1rem !important;
              }

              .capitals-brazil-map-frame {
                min-height: 270px;
              }
            }
          `,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="ba-eyebrow">Mapa do Brasil</p>
          <h2
            style={{
              marginTop: ".35rem",
              color: "#fff",
              fontSize: "clamp(2rem, 3.2vw, 3rem)",
              lineHeight: 1.02,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            Capitais por status
          </h2>
          <p className="ba-muted" style={{ marginTop: ".45rem" }}>
            Clique em uma capital concluída no mapa para ver a foto da prova.
          </p>
        </div>
      </div>

      <div className="capitals-brazil-map-grid">
        <div className="capitals-brazil-map-frame">
          {loadError ? (
            <div
              className="flex h-[420px] items-center justify-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {loadError}
            </div>
          ) : !geographyData ? (
            <div
              className="flex h-[420px] items-center justify-center text-sm"
              style={{ color: "var(--text-faint)" }}
            >
              Carregando mapa...
            </div>
          ) : (
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 700,
                center: MAP_CENTER,
              }}
              width={540}
              height={540}
              style={{
                width: "100%",
                maxWidth: 560,
                height: "auto",
                background: "#0f1115",
              }}
            >
              <Geographies geography={geographyData}>
                {({ geographies }) =>
                  geographies.map((geo: any, index: number) => {
                    const { sigla, nome, rawSigla, rawNome } = getStateKeys(geo);
                    const item = itemsByKey.get(sigla) ?? itemsByKey.get(nome);
                    const highlight = item?.status !== "locked";

                    return (
                      <Geography
                        key={`${rawSigla || rawNome || "uf"}-${index}`}
                        geography={geo}
                        fill={getFill(item?.status)}
                        stroke={MAP_STROKE}
                        strokeWidth={0.8}
                        className={item?.status === "completed" ? "capitals-brazil-map-state-clickable" : undefined}
                        onClick={() => {
                          if (item?.status === "completed") setSelectedItem(item);
                        }}
                        onKeyDown={(event) => {
                          if (
                            item?.status === "completed" &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            setSelectedItem(item);
                          }
                        }}
                        role={item?.status === "completed" ? "button" : undefined}
                        tabIndex={item?.status === "completed" ? 0 : undefined}
                        style={{
                          default: {
                            outline: "none",
                            transition: "all .2s",
                            filter: highlight
                              ? `drop-shadow(0 0 10px ${
                                  item?.status === "completed"
                                    ? "rgba(16,185,129,0.28)"
                                    : "rgba(245,158,11,0.28)"
                                })`
                              : "none",
                          },
                          hover: {
                            outline: "none",
                            fill: getHoverFill(item?.status),
                          },
                          pressed: { outline: "none" },
                        }}
                      >
                        <title>
                          {item
                            ? `${item.city} (${item.state}) · ${getStatusLabel(item.status)} · ${item.dateLabel}${
                                item.time ? ` · ${item.time} · ${item.pace ?? ""}` : ""
                              }`
                            : `${rawNome || rawSigla}: sem dados`}
                        </title>
                      </Geography>
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          )}
        </div>

        <aside className="capitals-brazil-map-side">
          <MapStat label="Concluídas" value={totals.completed} status="completed" />
          <MapStat label="Próximas" value={totals.next} status="next" />
          <MapStat label="Pendentes" value={totals.locked} status="locked" />

          {selectedItem ? (
            <SelectedPhotoPanel item={selectedItem} />
          ) : (
            <div className="capitals-brazil-map-stat">
              <p className="ba-label">Foto da prova</p>
              <p className="ba-muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
                Clique em um estado concluído para abrir a foto vinculada à atividade no Strava.
              </p>
            </div>
          )}

          <div className="capitals-brazil-map-stat">
            <p className="ba-label">Legenda</p>
            <div className="capitals-brazil-map-legend">
              <Legend color="#047857" label="Capital concluída" />
              <Legend color="#b45309" label="Próxima missão" />
              <Legend color={EMPTY_FILL} label="Pendente" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}


function SelectedPhotoPanel({ item }: { item: CapitalMapItem }) {
  return (
    <div className="capitals-brazil-map-photo">
      {item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt={`Foto da prova em ${item.city}`}
          className="capitals-brazil-map-photo-image"
          loading="lazy"
        />
      ) : (
        <div className="capitals-brazil-map-photo-empty">
          Nenhuma foto vinculada a esta atividade foi encontrada no Strava.
        </div>
      )}

      <div style={{ padding: "0.95rem" }}>
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <p className="ba-label">Capital selecionada</p>
            <h3
              style={{
                marginTop: 5,
                color: "#fff",
                fontSize: 20,
                fontWeight: 900,
                lineHeight: 1.05,
              }}
            >
              {item.city} <span style={{ color: "rgba(255,255,255,0.38)" }}>{item.state}</span>
            </h3>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 22,
              padding: "0 .68rem",
              borderRadius: 999,
              border: "1px solid rgba(16,185,129,0.25)",
              background: "rgba(16,185,129,0.12)",
              color: "#34d399",
              fontSize: 9,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Concluída
          </span>
        </div>

        <p
          className="ba-muted"
          title={item.raceLabel}
          style={{
            marginTop: 10,
            fontSize: 12,
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.raceLabel}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
            marginTop: 12,
          }}
        >
          <MiniMetric label="Data" value={item.dateLabel} />
          <MiniMetric label="Tempo" value={item.time ?? "—"} />
          <MiniMetric label="Pace" value={item.pace ?? "—"} />
        </div>

        {item.activityUrl && (
          <a
            href={item.activityUrl}
            target="_blank"
            rel="noreferrer"
            className="ba-button ba-button--ghost"
            style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
          >
            Abrir no Strava
          </a>
        )}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.075)",
        background: "rgba(0,0,0,0.20)",
        padding: ".65rem .7rem",
      }}
    >
      <p className="ba-label" style={{ fontSize: 9, whiteSpace: "nowrap" }}>
        {label}
      </p>
      <p
        style={{
          marginTop: 5,
          color: "#fff",
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1.05,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function MapStat({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: CapitalStatus;
}) {
  return (
    <div className="capitals-brazil-map-stat">
      <div className="flex items-center justify-between gap-3">
        <p className="ba-label">{label}</p>
        <span
          className="h-3 w-3 rounded-full border border-white/10"
          style={{ backgroundColor: getStatusDot(status) }}
        />
      </div>
      <p className="ba-value" style={{ marginTop: 6, fontSize: 34 }}>
        {value}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
      <span
        className="h-3 w-3 rounded-sm border border-white/10"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
