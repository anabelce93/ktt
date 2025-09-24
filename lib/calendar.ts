import { cheapestFor } from "./duffel";
import { baseFarePerPerson } from "./pricing";
import { cacheSet } from "./cache";

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
