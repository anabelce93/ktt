import { NextResponse } from "next/server";
import { buildCalendarGrid, addDaysISO } from "@/lib/calendar";
import { cheapestFor } from "@/lib/duffel";
import { TRIP_LEN, CalendarDay, CalendarPayload, RoundTripSearch } from "@/lib/types";

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

  if (!year || !month) {
    return NextResponse.json({ error: "year y month requeridos" }, { status: 400 });
  }

  const grid = buildCalendarGrid(year, month);
  const days: CalendarDay[] = [];
  let firstDiag: any = undefined;

  for (const cell of grid.filter(c => c.inMonth)) {
    const dep = cell.dateISO;
    const ret = addDaysISO(dep, TRIP_LEN - 1);
    const { price, diag } = await cheapestFor({ origin, dep, ret, pax } as RoundTripSearch);
    if (!firstDiag && diag) firstDiag = diag; // guarda la primera diag para inspección
    days.push({
      date: dep,
      show: price !== null,
      priceFrom: price,
      baseFare: BASE_FARE,
    });
  }

  const payload: CalendarPayload & { diag?: any } = { origin, pax, year, month, days };
  if (firstDiag) payload.diag = firstDiag;
  return NextResponse.json(payload);
}
