import CorosWorkoutDayCard from "./CorosWorkoutDayCard";
import type { CalendarCell, WorkoutDeleteHandler } from "./types";
import { calendarGridStyle, WEEKDAY_HEADERS, weekdayHeaderGridStyle, weekdayHeaderStyle } from "./coros-calendar-utils";

type Props = {
  cells: CalendarCell[];
  adminSecret: string;
  deletingDate: string | null;
  onDelete: WorkoutDeleteHandler;
};

export default function CorosCalendarDesktop({ cells, adminSecret, deletingDate, onDelete }: Props) {
  return (
    <div className="coros-calendar-desktop">
      <div style={weekdayHeaderGridStyle}>
        {WEEKDAY_HEADERS.map((weekday) => (
          <div key={weekday} style={weekdayHeaderStyle}>
            {weekday}
          </div>
        ))}
      </div>

      <div style={calendarGridStyle}>
        {cells.map((cell) => (
          <CorosWorkoutDayCard
            key={cell.isoDate}
            cell={cell}
            layout="desktop"
            adminSecret={adminSecret}
            isDeleting={deletingDate === cell.workout?.date}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
