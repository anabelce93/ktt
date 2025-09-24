import { cheapestFor } from "./duffel";
import { baseFarePerPerson } from "./pricing";
import { cacheSet } from "./cache";

export type DayCell = { dateISO: string; inMonth: boolean };

/**
 * Construye una cuadrícula de 6 semanas (42 días) para un mes dado.
 * @param year Año completo (ej. 2025)
 * @param month1to12 Mes en formato 1–12 (ej. octubre = 10)
 * @param weekStartsOn Día de inicio de semana (1 = lunes, 0 = domingo)
 */
export function buildCalendarGrid(
  year: number,
  month1to12: number,
  weekStartsOn: 1 | 0 = 1
): DayCell[] {
  const m = month1to12 - 1; // convertir a 0-based para Date.UTC
  const firstUTC = new Date(Date.UTC(year, m, 1));
  const firstWeekday = firstUTC.getUTCDay(); // 0..6 (Sun..Sat)

  const offset =
    weekStartsOn === 1
      ? firstWeekday === 0
        ? 6
        : firstWeekday - 1
      : firstWeekday;

  const start = new Date(Date.UTC(year, m, 1 - offset));
  const cells: DayCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push({
      dateISO: d.toISOString().slice(0, 10), // YYYY-MM-DD
      inMonth: d.getUTCMonth() === m,
    });
  }

  return cells;
}

/**
 * Suma días a una fecha ISO (YYYY-MM-DD)
 */
export const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Precalienta los precios de un mes completo y los guarda en Redis
 */
export async function prewarmMonth(origin: string, pax: number, year: number, month: number) {
  const grid = buildCalendarGrid(year, month);
  const days = [];

  for (const cell of grid) {
    const dateISO = cell.dateISO;
    const ret = addDaysISO(dateISO, 9);
    const baseFare = baseFarePerPerson(dateISO, pax);

    let price: number | null = null;
    try {
      const res = await cheapestFor({ origin, dep: dateISO, ret, pax });
      price = res.price;
    } catch (err) {
      console.warn("Duffel error for", dateISO, err);
    }

    days.push({
      date: dateISO,
      show: price !== null,
      priceFrom: price,
      baseFare,
    });
  }

  const payload = { origin, pax, year, month, days };
  const key = `cal:${origin}:${pax}:${year}:${month}`;
  await cacheSet(key, payload, 86400 * 7); // 7 días

  return payload;
}
