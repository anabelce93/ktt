import { NextResponse } from "next/server";
import { buildCalendarGrid, addDaysISO } from "@/lib/calendar";
import { TRIP_LEN, CalendarDay, CalendarPayload, RoundTripSearch } from "@/lib/types";
import { searchRoundTripBoth } from "@/lib/duffel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const BASE_FARE = 1175;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin") || "BCN";
  const pax = Number(searchParams.get("pax") || 2);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const debug = searchParams.get("debug") === "1";

  if (!year || !month) {
    return NextResponse.json({ error: "year y month requeridos" }, { status: 400 });
  }

  const grid = buildCalendarGrid(year, month +1);
  const inMonthCells = grid.filter(c => c.inMonth);
  const days: CalendarDay[] = new Array(inMonthCells.length);
  let firstDiag: any = undefined;

  await Promise.all(
    inMonthCells.map(async (cell, index) => {
      const dep = cell.dateISO;
      const ret = addDaysISO(dep, TRIP_LEN - 1);

      try {
        const { options, diag } = await searchRoundTripBoth({
          origin,
          dep,
          ret,
          pax,
          limit: 1,
        } as RoundTripSearch);

        if (!firstDiag && diag) firstDiag = diag;

        const cheapest = options[0]?.total_amount_per_person ?? null;
        days[index] = {
          date: dep,
          show: cheapest !== null,
          priceFrom: cheapest,
          baseFare: BASE_FARE,
        };
      } catch (error) {
        days[index] = {
          date: dep,
          show: false,
          priceFrom: null,
          baseFare: BASE_FARE,
        };
      }
    })
  );

  const payload: CalendarPayload & { diag?: any } = {
    origin,
    pax,
    year,
    month,
    days,
  };

  if (debug && firstDiag) payload.diag = firstDiag;

  return NextResponse.json(payload);
}
