// lib/calendar.ts
export type DayCell = { dateISO: string; inMonth: boolean };

export function buildCalendarGrid(
  year: number,
  month1to12: number,
  weekStartsOn: 1 | 0 = 1
): DayCell[] {
  const m = month1to12 - 1; // 0-based
  const firstUTC = new Date(Date.UTC(year, m, 1));
  const firstWeekday = firstUTC.getUTCDay(); // 0..6 (Sun..Sat)
  const offset =
    weekStartsOn === 1 ? (firstWeekday === 0 ? 6 : firstWeekday - 1) : firstWeekday;
  const start = new Date(Date.UTC(year, m, 1 - offset));
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push({
      dateISO: d.toISOString().slice(0, 10), // YYYY-MM-DD
      inMonth: d.getUTCMonth() === m
    });
  }
  return cells;
}

export const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
