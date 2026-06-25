import CorosWorkoutDayCard from "./CorosWorkoutDayCard";
import type { CalendarCell, WorkoutDeleteHandler } from "./types";
import { parseIsoDate, WEEKDAY_HEADERS } from "./coros-calendar-utils";

type Props = {
  cells: CalendarCell[];
  adminSecret: string;
  deletingDate: string | null;
  onDelete: WorkoutDeleteHandler;
};

export default function CorosCalendarMobile({ cells, adminSecret, deletingDate, onDelete }: Props) {
  return (
    <div className="coros-calendar-mobile">
      {cells.map((cell) => {
        const weekday = WEEKDAY_HEADERS[(parseIsoDate(cell.isoDate).getDay() + 6) % 7];
        return (
          <CorosWorkoutDayCard
            key={cell.isoDate}
            cell={cell}
            layout="mobile"
            weekday={weekday}
            adminSecret={adminSecret}
            isDeleting={deletingDate === cell.workout?.date}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
