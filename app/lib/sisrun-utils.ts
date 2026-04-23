import { getBRDate, getBRDateKey, getActivityDate } from "./date-utils";

/**
 * Tipagem básica de atividade (ajusta se quiser depois)
 */
type Activity = {
  start_date?: string | null;
  start_date_local?: string | null;
  distance?: number;
  moving_time?: number;
};

/**
 * Retorna a semana (YYYY-WW) baseada no timezone do Brasil
 */
export function getWeekKey(date: Date) {
  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);

  // Quinta define a semana ISO
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));

  const week1 = new Date(temp.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(
      ((temp.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );

  return `${temp.getFullYear()}-${String(weekNumber).padStart(2, "0")}`;
}

/**
 * Agrupa atividades por semana (corrigido timezone)
 */
export function groupActivitiesByWeek(activities: Activity[]) {
  const weeks: Record<string, Activity[]> = {};

  activities.forEach((activity) => {
    const date = getBRDate(getActivityDate(activity));
    if (!date) return;

    const weekKey = getWeekKey(date);

    if (!weeks[weekKey]) {
      weeks[weekKey] = [];
    }

    weeks[weekKey].push(activity);
  });

  return weeks;
}

/**
 * Soma distância da semana (km)
 */
export function getWeeklyDistance(activities: Activity[]) {
  return activities.reduce((total, act) => {
    return total + (act.distance ?? 0);
  }, 0) / 1000;
}

/**
 * Soma tempo da semana (min)
 */
export function getWeeklyTime(activities: Activity[]) {
  return activities.reduce((total, act) => {
    return total + (act.moving_time ?? 0);
  }, 0) / 60;
}

/**
 * Retorna atividades da semana atual (Brasil)
 */
export function getCurrentWeekActivities(activities: Activity[]) {
  const todayKey = getBRDateKey(new Date().toISOString());

  return activities.filter((activity) => {
    const dateKey = getBRDateKey(getActivityDate(activity));
    return dateKey === todayKey;
  });
}

/**
 * Retorna atividades até hoje (sem puxar "futuro bugado")
 */
export function filterPastActivities(activities: Activity[]) {
  const todayKey = getBRDateKey(new Date().toISOString());

  return activities.filter((activity) => {
    const activityKey = getBRDateKey(getActivityDate(activity));
    return activityKey <= todayKey;
  });
}

/**
 * Ordena atividades corretamente (timezone BR)
 */
export function sortActivitiesByDate(activities: Activity[]) {
  return [...activities].sort((a, b) => {
    const dateA = new Date(getActivityDate(a)).getTime();
    const dateB = new Date(getActivityDate(b)).getTime();

    return dateB - dateA;
  });
}