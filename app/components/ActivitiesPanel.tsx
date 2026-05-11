import { formatBRDate, getActivityDate } from "../lib/date-utils";

type Activity = {
  id: number;
  name?: string;
  type?: string;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  total_elevation_gain?: number | null;
  start_date?: string | null;
  start_date_local?: string | null;
  average_speed?: number | null;
};

type Props = {
  activities: Activity[];
  dark?: boolean;
};

function formatDistance(distance?: number | null) {
  const meters = typeof distance === "number" ? distance : 0;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Math.round(typeof seconds === "number" ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(date?: string | null) {
  return formatBRDate(date);
}

function formatPace(distance?: number | null, movingTime?: number | null) {
  const meters = typeof distance === "number" ? distance : 0;
  const seconds = typeof movingTime === "number" ? movingTime : 0;

  if (meters <= 0 || seconds <= 0) return "-";

  const paceSeconds = seconds / (meters / 1000);
  const min = Math.floor(paceSeconds / 60);
  const sec = Math.round(paceSeconds % 60);

  if (sec === 60) {
    return `${min + 1}:00/km`;
  }

  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

export default function ActivitiesPanel({ activities, dark = false }: Props) {
  const recentActivities = [...activities]
    .sort((a, b) => {
      const da = new Date(getActivityDate(a)).getTime();
      const db = new Date(getActivityDate(b)).getTime();
      return db - da;
    })
    .slice(0, 12);

  return (
    <section style={{ background: "transparent", padding: "1.25rem 1.5rem" }}>
      <div className="mb-4">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: dark ? "#fff" : "#111" }}>Atividades recentes</h2>
        <p style={{ marginTop: 4, fontSize: 12, color: dark ? "rgba(255,255,255,0.4)" : "#6b7280" }}>
          Últimos treinos puxados do Strava.
        </p>
      </div>

      {recentActivities.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma atividade encontrada.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {recentActivities.map((activity) => {
            const date = getActivityDate(activity);

            return (
              <div
                key={activity.id}
                style={{ background: dark ? "rgba(255,255,255,0.04)" : "#f9fafb", border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb", borderRadius: 14, padding: "1rem" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: dark ? "#fff" : "#111" }}>
                      {activity.name ?? "Atividade"}
                    </p>
                    <p style={{ marginTop: 2, fontSize: 12, color: dark ? "rgba(255,255,255,0.4)" : "#6b7280" }}>
                      {activity.type ?? "Sem tipo"} • {formatDate(date)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div style={{ background: dark ? "rgba(255,255,255,0.06)" : "#fff", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.35)" : "#6b7280" }}>Distância</p>
                    <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: dark ? "#fff" : "#111" }}>
                      {formatDistance(activity.distance)}
                    </p>
                  </div>

                  <div style={{ background: dark ? "rgba(255,255,255,0.06)" : "#fff", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.35)" : "#6b7280" }}>Tempo</p>
                    <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: dark ? "#fff" : "#111" }}>
                      {formatDuration(activity.moving_time ?? activity.elapsed_time)}
                    </p>
                  </div>

                  <div style={{ background: dark ? "rgba(255,255,255,0.06)" : "#fff", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.35)" : "#6b7280" }}>Pace</p>
                    <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: dark ? "#fff" : "#111" }}>
                      {formatPace(activity.distance, activity.moving_time)}
                    </p>
                  </div>

                  <div style={{ background: dark ? "rgba(255,255,255,0.06)" : "#fff", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: dark ? "rgba(255,255,255,0.35)" : "#6b7280" }}>Elevação</p>
                    <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: dark ? "#fff" : "#111" }}>
                      {Math.round(activity.total_elevation_gain ?? 0)} m
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}