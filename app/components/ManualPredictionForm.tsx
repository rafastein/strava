"use client";

import { useState } from "react";

type Props = {
  initialValue: string;
};

export default function ManualPredictionForm({ initialValue }: Props) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState("");

  async function handleSave() {
    try {
      setStatus("Salvando...");

      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stravaMarathonPrediction: value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || "Erro ao salvar.");
        return;
      }

      setStatus("Previsão atualizada com sucesso.");
      window.location.reload();
    } catch {
      setStatus("Erro ao salvar previsão.");
    }
  }

  return (
    <div className="manual-prediction-form">
      <label className="manual-prediction-label" htmlFor="manual-strava-prediction">
        Previsão manual do Strava
      </label>

      <div className="manual-prediction-row">
        <input
          id="manual-strava-prediction"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex: 03:49:00"
          className="manual-prediction-input"
        />

        <button onClick={handleSave} className="manual-prediction-button">
          Salvar
        </button>
      </div>

      {status && <p className="manual-prediction-status">{status}</p>}
    </div>
  );
}
