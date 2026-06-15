"use client";

import { useState, type CSSProperties } from "react";

type SavedWorkoutCard = {
  redisKey: string;
  date: string;
  dateLabel: string;
  title: string;
  sourceLabel: string;
  type: string;
  shoeName: string | null;
};

type DeleteResponse = {
  success?: boolean;
  key?: string;
  error?: string;
};

export default function CorosSavedWorkoutsList({ workouts }: { workouts: SavedWorkoutCard[] }) {
  const [items, setItems] = useState(workouts);
  const [adminSecret, setAdminSecret] = useState("");
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleDelete(workout: SavedWorkoutCard) {
    const confirmed = window.confirm(`Excluir o treino de ${workout.dateLabel}?\n\n${workout.title}`);
    if (!confirmed) return;

    setDeletingDate(workout.date);
    setFeedback(null);

    try {
      const response = await fetch(`/api/planned-workout?date=${encodeURIComponent(workout.date)}`, {
        method: "DELETE",
        headers: {
          "x-admin-secret": adminSecret,
        },
      });

      const body = (await response.json()) as DeleteResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Falha ao excluir treino.");
      }

      setItems((current) => current.filter((item) => item.date !== workout.date));
      setFeedback({ type: "success", message: `Treino de ${workout.dateLabel} excluído do Upstash.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Falha ao excluir treino.",
      });
    } finally {
      setDeletingDate(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="ba-muted" style={{ marginTop: "1rem", fontSize: 13 }}>
        Nenhum treino estruturado salvo no Upstash. Importe a agenda COROS abaixo para preencher esta lista.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="ba-card-soft" style={{ padding: "1rem" }}>
        <label className="grid gap-2 md:max-w-md">
          <span className="ba-label">ADMIN_SECRET para excluir treinos</span>
          <input
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            type="password"
            placeholder="Senha administrativa da Vercel"
            style={fieldStyle}
          />
        </label>
        <p className="ba-muted" style={{ marginTop: ".6rem", fontSize: 12 }}>
          A exclusão remove a chave <strong>planned-workout:AAAA-MM-DD</strong> do Upstash.
        </p>
      </div>

      {feedback && (
        <div className="ba-card-soft" style={{ padding: ".9rem 1rem" }}>
          <p style={{ color: feedback.type === "success" ? "#86efac" : "#fca5a5", fontWeight: 800, fontSize: 13 }}>
            {feedback.message}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {items.map((workout) => {
          const isDeleting = deletingDate === workout.date;

          return (
            <div key={workout.redisKey} className="ba-card-soft" style={{ padding: "1rem" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="ba-label">{workout.dateLabel}</p>
                  <p style={{ marginTop: 6, fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{workout.title}</p>
                </div>
                <button
                  type="button"
                  disabled={!adminSecret || isDeleting}
                  onClick={() => handleDelete(workout)}
                  title={!adminSecret ? "Informe o ADMIN_SECRET para excluir" : `Excluir ${workout.dateLabel}`}
                  style={deleteButtonStyle}
                >
                  {isDeleting ? "..." : "Excluir"}
                </button>
              </div>
              <p className="ba-muted" style={{ marginTop: 4, fontSize: 12 }}>{workout.sourceLabel} · {workout.type}</p>
              <p className="ba-muted" style={{ marginTop: 4, fontSize: 12 }}>Tênis · {workout.shoeName ?? "sem recomendação"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "var(--text)",
  padding: ".8rem 1rem",
  outline: "none",
  fontSize: 13,
};

const deleteButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(252,165,165,0.35)",
  background: "rgba(127,29,29,0.18)",
  color: "#fecaca",
  padding: ".35rem .65rem",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: ".06em",
};
