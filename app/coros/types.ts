export type WorkoutCompletionStatus = "done" | "off_target" | "today" | "missed" | "future";

export type SavedWorkoutCard = {
  redisKey: string;
  date: string;
  dateLabel: string;
  title: string;
  sourceLabel: string;
  type: string;
  shoeName: string | null;
  distanceKm?: number | null;
  estimatedTime?: string | null;
  loadTl?: number | null;
  actualKm?: number | null;
  status: WorkoutCompletionStatus;
};

export type CalendarCell = {
  isoDate: string;
  dayNumber: number;
  shortDateLabel: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  status: WorkoutCompletionStatus | "empty";
  workout?: SavedWorkoutCard;
};

export type MonthOption = {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
};

export type WorkoutDeleteHandler = (workout: SavedWorkoutCard) => void;
