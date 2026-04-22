"use client";

import { useMemo, useState } from "react";

type StravaActivity = {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date_local: string;
};

type Props = {
  activities: StravaActivity[];
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes} min`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPace(distanceMeters: number, movingTimeSeconds: number) {
  if (!distanceMeters || !movingTimeSeconds) return "-";

  const paceInSecondsPerKm = movingTimeSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceInSecondsPerKm / 60);
  const seconds = Math.round(paceInSecondsPerKm % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

export default function ActivitiesPanel({ activities }: Props) {
  const [filter, setFilter] = useState("All");

  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(activities.map((activity) => activity.type)));
    return ["All", ...types];
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (filter === "All") return activities;
    return activities.filter((activity) => activity.type === filter);
  }, [activities, filter]);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Atividades recentes</h3>
          <p className="text-sm text-gray-500">
            Filtre por tipo e acompanhe seus treinos mais recentes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableTypes.map((type) => {
            const active = filter === type;

            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4">
        {filteredActivities.map((activity) => (
          <div
            key={activity.id}
            className="rounded-2xl border border-gray-200 p-4 transition hover:shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {activity.type}
                  </span>
                </div>

                <h4 className="text-lg font-semibold text-gray-900">{activity.name}</h4>
                <p className="text-sm text-gray-500">
                  {formatDate(activity.start_date_local)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <p className="text-gray-500">Distância</p>
                  <p className="font-semibold text-gray-900">
                    {(activity.distance / 1000).toFixed(2)} km
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Tempo</p>
                  <p className="font-semibold text-gray-900">
                    {formatDuration(activity.moving_time)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Pace</p>
                  <p className="font-semibold text-gray-900">
                    {activity.type === "Run"
                      ? formatPace(activity.distance, activity.moving_time)
                      : "-"}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Elevação</p>
                  <p className="font-semibold text-gray-900">
                    {activity.total_elevation_gain} m
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredActivities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            Nenhuma atividade encontrada para esse filtro.
          </div>
        )}
      </div>
    </section>
  );
}