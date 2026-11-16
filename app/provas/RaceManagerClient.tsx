"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAdminRetry } from "../lib/admin-client";
import type { ManagedRace, SeasonRaceStatus } from "../lib/race-calendar";

type Props = {
  initialRaces: ManagedRace[];
  todayKey: string;
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

export default function RaceManagerClient({ initialRaces, todayKey }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<RaceFormState>(EMPTY_FORM);
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ManagedRace[]>();
    for (const race of initialRaces) {
      if (race.dateKey < todayKey) continue;
      const label = monthLabel(race.dateKey);
      map.set(label, [...(map.get(label) ?? []), race]);
    }
    return Array.from(map.entries());
  }, [initialRaces, todayKey]);

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


  function startEdit(race: ManagedRace) {
    setForm(raceToForm(race));
    // No celular o formulário fica abaixo da lista: leva até ele.
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="ui-stack">
      {grouped.length === 0 ? (
        <p className="ui-muted">Nenhuma prova futura cadastrada. Use o formulário abaixo para incluir a próxima.</p>
      ) : (
        <div className="ui-list" style={{ margin: "0 -20px", borderTop: "1px solid var(--ui-border)", borderBottom: "1px solid var(--ui-border)" }}>
          {grouped.flatMap(([, races]) => races).map((race) => (
            <div key={race.id} className="ui-row" style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}>
              <span className="ui-row__main">
                <span className="ui-row__title" style={{ whiteSpace: "normal" }}>{race.name}</span>
                <span className="ui-muted" style={{ fontSize: 12 }}>
                  {[formatDate(race.dateKey), race.location, formatDistance(race.distanceKm), race.objective, race.badge, race.isGoal ? "prova-alvo" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button type="button" className="ui-btn ui-btn--ghost" style={{ cursor: "pointer", padding: "0 12px" }} onClick={() => startEdit(race)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  style={{ cursor: "pointer", padding: "0 12px", color: "#ff8a7a", opacity: busyId === race.id ? 0.55 : 1 }}
                  disabled={busyId === race.id}
                  onClick={() => handleDelete(race)}
                >
                  Apagar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="ui-stack" style={{ scrollMarginTop: 72 }}>
        <h3 className="ui-h2" style={{ fontSize: 16 }}>{form.id ? "Editar prova" : "Nova prova"}</h3>

        <label className="ui-label">
          Nome
          <input className="ui-field" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Meia de Goiânia" required />
        </label>

        <div className="race-form-grid">
          <label className="ui-label">
            Data
            <input className="ui-field" value={form.dateKey} onChange={(e) => update("dateKey", e.target.value)} type="date" min={todayKey} required />
          </label>
          <label className="ui-label">
            Distância (km)
            <input className="ui-field" value={form.distanceKm} onChange={(e) => update("distanceKm", e.target.value)} inputMode="decimal" placeholder="21.1" required />
          </label>
        </div>

        <label className="ui-label">
          Local
          <input className="ui-field" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Brasília" required />
        </label>

        <div className="race-form-grid">
          <label className="ui-label">
            Objetivo
            <input className="ui-field" value={form.objective} onChange={(e) => update("objective", e.target.value)} placeholder="Treino, all-in, sub-3:45" />
          </label>
          <label className="ui-label">
            Pace alvo
            <input className="ui-field" value={form.targetPace} onChange={(e) => update("targetPace", e.target.value)} placeholder="5:20 ou 320" />
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14 }}>
          <input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} style={{ width: 20, height: 20 }} />
          Aparece nos resultados da temporada
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14 }}>
          <input type="checkbox" checked={form.isGoal} onChange={(e) => update("isGoal", e.target.checked)} style={{ width: 20, height: 20 }} />
          Prova-alvo
        </label>

        <details className="ui-details" style={{ margin: "0 -20px", borderTop: "1px solid var(--ui-border)" }}>
          <summary>Mais opções</summary>
          <div className="ui-details__body">
            <div className="race-form-grid">
              <label className="ui-label">
                Selo
                <input className="ui-field" value={form.badge} onChange={(e) => update("badge", e.target.value)} placeholder="27 Capitais" />
              </label>
              <label className="ui-label">
                Status fixo
                <select className="ui-field" value={form.fixedStatus} onChange={(e) => update("fixedStatus", e.target.value as RaceFormState["fixedStatus"])}>
                  <option value="">Automático</option>
                  <option value="simulation">Simulado</option>
                  <option value="mission">Missão</option>
                  <option value="next">Próxima</option>
                  <option value="completed">Concluída</option>
                </select>
              </label>
              <label className="ui-label">
                Horário da largada
                <input className="ui-field" value={form.timeLocal} onChange={(e) => update("timeLocal", e.target.value)} placeholder="07:00:00" />
              </label>
              <label className="ui-label">
                Fuso
                <input className="ui-field" value={form.timezoneOffset} onChange={(e) => update("timezoneOffset", e.target.value)} placeholder="-03:00" />
              </label>
            </div>
            <label className="ui-label">
              Link interno
              <input className="ui-field" value={form.href} onChange={(e) => update("href", e.target.value)} placeholder="/buenos-aires" />
            </label>
          </div>
        </details>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" className="ui-btn" style={{ border: 0, cursor: "pointer", opacity: busyId === "form" ? 0.55 : 1 }} disabled={busyId === "form"}>
            {busyId === "form" ? "Salvando…" : form.id ? "Salvar edição" : "Incluir prova"}
          </button>
          {form.id ? (
            <button type="button" className="ui-btn ui-btn--ghost" style={{ cursor: "pointer", minHeight: 48 }} onClick={() => setForm(EMPTY_FORM)}>
              Cancelar edição
            </button>
          ) : null}
        </div>
        <p className="ui-muted">A senha administrativa é pedida ao salvar, se for preciso.</p>
        {status ? <p role="status" style={{ fontSize: 14 }}>{status}</p> : null}
      </form>
    </div>
  );
}
