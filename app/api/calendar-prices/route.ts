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
  if (month < 0 || month > 11) {
  return NextResponse.json({ error: "Mes fuera de rango (0–11)" }, { status: 400 });
}
  const debug = searchParams.get("debug") === "1";

  if (!year || !month) {
    return NextResponse.json({ error: "year y month requeridos" }, { status: 400 });
  }

  // ✅ CORREGIDO: convertir mes a 1–12 para buildCalendarGrid
  const grid = buildCalendarGrid(year, month + 1);
  const inMonthCells = grid.filter(c => c.inMonth);
  const days: CalendarDay[] = new Array(inMonthCells.length);
  let firstDiag: any = undefined;

  // ✅ LOG GENERAL DEL MES
  console.log("📦 Mes procesado:", year, month + 1, "→ días:", inMonthCells.length);

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

        const cheapest = options[0]?.total_amount_per_person ?? null;

        // ✅ LOG POR DÍA
        console.log("🔍 Día:", dep, "→ opciones:", options.length, "precio:", cheapest);

        if (!firstDiag && diag) firstDiag = diag;

        days[index] = {
          date: dep,
          show: cheapest !== null,
          priceFrom: cheapest,
          baseFare: BASE_FARE,
        };
      } catch (error) {
        console.error("❌ Error en día:", dep, error);
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
  
console.log("✅ Payload final:", JSON.stringify(payload, null, 2));
  
  return NextResponse.json(payload);
}
