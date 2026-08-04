"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAdminRetry } from "../lib/admin-client";
import type { ManagedRace, SeasonRaceStatus } from "../lib/race-calendar";

type Props = {
  initialRaces: ManagedRace[];
};

type RaceFormState = {
  id: string;
  name: string;
  dateKey: string;
  location: string;
  distanceKm: string;
  objective: string;
  targetPace: string;
  featured: boolean;
  badge: string;
  fixedStatus: "" | SeasonRaceStatus;
  href: string;
  isGoal: boolean;
  timeLocal: string;
  timezoneOffset: string;
};

const EMPTY_FORM: RaceFormState = {
  id: "",
  name: "",
  dateKey: "",
  location: "Brasil",
  distanceKm: "21.1",
  objective: "Treino",
  targetPace: "",
  featured: true,
  badge: "",
  fixedStatus: "",
  href: "",
  isGoal: false,
  timeLocal: "07:00:00",
  timezoneOffset: "-03:00",
};

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year} · ${weekday}`;
}

function formatDistance(km: number) {
  return `${km.toFixed(km % 1 === 0 ? 0 : 1).replace(".", ",")} km`;
}

function formatPace(seconds: number | null) {
  if (!seconds) return "—";
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

function parseTargetPace(value: string) {
  const clean = value.trim();
  if (!clean) return null;

  if (/^\d+$/.test(clean)) return Number(clean);

  const match = /^(\d{1,2}):(\d{2})/.exec(clean);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function raceToForm(race: ManagedRace): RaceFormState {
  return {
    id: race.id,
    name: race.name,
    dateKey: race.dateKey,
    location: race.location,
    distanceKm: String(race.distanceKm),
    objective: race.objective,
    targetPace: race.targetPaceSecPerKm ? formatPace(race.targetPaceSecPerKm).replace("/km", "") : "",
    featured: race.featured,
    badge: race.badge ?? "",
    fixedStatus: race.fixedStatus ?? "",
    href: race.href ?? "",
    isGoal: Boolean(race.isGoal),
    timeLocal: race.timeLocal ?? "07:00:00",
    timezoneOffset: race.timezoneOffset ?? "-03:00",
  };
}

function toPayload(form: RaceFormState) {
  return {
    id: form.id || undefined,
    name: form.name.trim(),
    dateKey: form.dateKey,
    location: form.location.trim(),
    distanceKm: Number(form.distanceKm.replace(",", ".")),
    objective: form.objective.trim() || "Treino",
    targetPaceSecPerKm: parseTargetPace(form.targetPace),
    featured: form.featured,
    badge: form.badge.trim() || undefined,
    fixedStatus: form.fixedStatus || undefined,
    href: form.href.trim() || undefined,
    isGoal: form.isGoal,
    timeLocal: form.timeLocal.trim() || "07:00:00",
    timezoneOffset: form.timezoneOffset.trim() || "-03:00",
  };
}

function monthLabel(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  if (!year || !month) return "Sem mês";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export default function RaceManagerClient({ initialRaces }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<RaceFormState>(EMPTY_FORM);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ManagedRace[]>();
    for (const race of initialRaces) {
      const label = monthLabel(race.dateKey);
      map.set(label, [...(map.get(label) ?? []), race]);
    }
    return Array.from(map.entries());
  }, [initialRaces]);

  function update<K extends keyof RaceFormState>(key: K, value: RaceFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Salvando prova...");
    setBusyId("form");

    try {
      const response = await fetchWithAdminRetry("/api/races", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const body = await response.json();

      if (!response.ok) {
        setStatus(body.error || "Erro ao salvar prova.");
        return;
      }

      setForm(EMPTY_FORM);
      setStatus("Prova salva com sucesso.");
      router.refresh();
    } catch {
      setStatus("Erro ao salvar prova.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(race: ManagedRace) {
    const ok = window.confirm(`Apagar ${race.name} de ${formatDate(race.dateKey)}?`);
    if (!ok) return;

    setStatus("Apagando prova...");
    setBusyId(race.id);

    try {
      const response = await fetchWithAdminRetry(`/api/races?id=${encodeURIComponent(race.id)}`, {
        method: "DELETE",
      });
      const body = await response.json();

      if (!response.ok) {
        setStatus(body.error || "Erro ao apagar prova.");
        return;
      }

      setStatus("Prova apagada com sucesso.");
      router.refresh();
    } catch {
      setStatus("Erro ao apagar prova.");
    } finally {
      setBusyId(null);
    }
  }


  return (
    <div className="race-manager-layout">
      <section className="ba-card race-manager-panel race-manager-list-panel">
        <div className="race-manager-heading">
          <div>
            <p className="ba-eyebrow">Calendário salvo</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", color: "#fff", marginTop: 4 }}>Provas cadastradas</h2>
            <p className="ba-muted" style={{ marginTop: ".35rem" }}>Essas provas alimentam Home, Longões e calendário da temporada.</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {grouped.map(([label, races]) => (
            <div key={label}>
              <p className="ba-label" style={{ marginBottom: ".6rem", textTransform: "capitalize" }}>{label}</p>
              <div style={{ display: "grid", gap: ".65rem" }}>
                {races.map((race) => (
                  <div key={race.id} className="ba-card-soft race-manager-item">
                    <div className="race-manager-item__content">
                      <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, marginBottom: 3 }}>{race.name}</p>
                      <p className="ba-muted race-manager-item__meta">{formatDate(race.dateKey)} · {race.location} · {formatDistance(race.distanceKm)}</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: ".55rem" }}>
                        <span className="badge badge--accent">{race.objective}</span>
                        {race.badge && <span className="badge badge--purple">{race.badge}</span>}
                        {race.fixedStatus && <span className="badge badge--blue">{race.fixedStatus}</span>}
                        {race.isGoal && <span className="badge badge--orange">prova-alvo</span>}
                      </div>
                    </div>
                    <div className="race-manager-item__actions">
                      <button type="button" onClick={() => setForm(raceToForm(race))} className="ba-pill ba-pill-dark">Editar</button>
                      <button type="button" onClick={() => handleDelete(race)} className="ba-pill ba-pill-dark" disabled={busyId === race.id} style={{ opacity: busyId === race.id ? .55 : 1 }}>
                        Apagar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="ba-card race-manager-panel race-manager-form-panel">
        <p className="ba-eyebrow">Cadastro</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", color: "#fff", marginTop: 4 }}>{form.id ? "Editar prova" : "Nova prova"}</h2>
        <p className="ba-muted" style={{ marginTop: ".35rem", marginBottom: "1rem" }}>A senha administrativa será solicitada automaticamente se necessário.</p>

        <div style={{ display: "grid", gap: ".8rem" }}>
          <label style={labelStyle}>
            <span className="ba-label">Nome</span>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Meia de Goiânia" style={fieldStyle} required />
          </label>

          <div className="race-form-grid-2">
            <label style={labelStyle}>
              <span className="ba-label">Data</span>
              <input value={form.dateKey} onChange={(e) => update("dateKey", e.target.value)} type="date" style={fieldStyle} required />
            </label>
            <label style={labelStyle}>
              <span className="ba-label">Distância km</span>
              <input value={form.distanceKm} onChange={(e) => update("distanceKm", e.target.value)} inputMode="decimal" placeholder="21.1" style={fieldStyle} required />
            </label>
          </div>

          <label style={labelStyle}>
            <span className="ba-label">Local</span>
            <input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Brasília" style={fieldStyle} required />
          </label>

          <label style={labelStyle}>
            <span className="ba-label">Objetivo</span>
            <input value={form.objective} onChange={(e) => update("objective", e.target.value)} placeholder="Treino / All-in / Sub-3:45" style={fieldStyle} />
          </label>

          <div className="race-form-grid-2">
            <label style={labelStyle}>
              <span className="ba-label">Pace alvo</span>
              <input value={form.targetPace} onChange={(e) => update("targetPace", e.target.value)} placeholder="5:20 ou 320" style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              <span className="ba-label">Badge</span>
              <input value={form.badge} onChange={(e) => update("badge", e.target.value)} placeholder="27 Capitais" style={fieldStyle} />
            </label>
          </div>

          <div className="race-form-grid-2">
            <label style={labelStyle}>
              <span className="ba-label">Status fixo</span>
              <select value={form.fixedStatus} onChange={(e) => update("fixedStatus", e.target.value as RaceFormState["fixedStatus"])} style={fieldStyle}>
                <option value="">Automático</option>
                <option value="simulation">simulation</option>
                <option value="mission">mission</option>
                <option value="next">next</option>
                <option value="completed">completed</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span className="ba-label">Link</span>
              <input value={form.href} onChange={(e) => update("href", e.target.value)} placeholder="/buenos-aires" style={fieldStyle} />
            </label>
          </div>

          <div className="race-form-grid-2">
            <label style={labelStyle}>
              <span className="ba-label">Horário</span>
              <input value={form.timeLocal} onChange={(e) => update("timeLocal", e.target.value)} placeholder="07:00:00" style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              <span className="ba-label">Fuso</span>
              <input value={form.timezoneOffset} onChange={(e) => update("timezoneOffset", e.target.value)} placeholder="-03:00" style={fieldStyle} />
            </label>
          </div>

          <div className="race-form-checks">
            <label style={checkboxLabelStyle}>
              <input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} />
              Aparece na temporada
            </label>
            <label style={checkboxLabelStyle}>
              <input type="checkbox" checked={form.isGoal} onChange={(e) => update("isGoal", e.target.checked)} />
              Prova-alvo
            </label>
          </div>

          <div className="race-form-actions">
            <button type="submit" className="ba-pill ba-pill-orange" disabled={busyId === "form"} style={{ opacity: busyId === "form" ? .55 : 1 }}>
              {busyId === "form" ? "Salvando..." : form.id ? "Salvar edição" : "Incluir prova"}
            </button>
            {form.id && (
              <button type="button" className="ba-pill ba-pill-dark" onClick={() => setForm(EMPTY_FORM)}>
                Cancelar edição
              </button>
            )}
          </div>

          {status && <p className="ba-muted" style={{ fontSize: 12 }}>{status}</p>}
        </div>
      </form>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "grid",
  gap: ".4rem",
};

const checkboxLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: ".45rem",
  color: "rgba(255,255,255,.55)",
  fontSize: 13,
};

const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text)",
  padding: ".78rem .9rem",
  outline: "none",
  fontSize: 13,
};
