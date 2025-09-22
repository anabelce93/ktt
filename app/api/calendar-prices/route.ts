import { NextResponse } from "next/server";
import { addDaysISO } from "@/lib/utils";
import { searchOffersRaw } from "@/lib/duffel";
import { baseFarePerPerson as _baseFarePerPerson } from "@/lib/pricing";

const DESTS = ["ICN", "GMP"] as const;
const TRIP_LEN = 10;
const LIMIT_PER_DAY = 1;

function roundEuros(n?: number | string): number {
  if (n == null) return 0;
  const num = typeof n === "string" ? parseFloat(n) : n;
  return Math.round(num);
}

function pricePerPersonFromOffer(offer: any, pax: number): number {
  // Duffel puede traer precio por pasajero o sólo total
  const p0 = offer?.passengers?.[0];
  const ppLive = p0?.live_pricing?.total_amount;
  const ppPrice = p0?.price?.total_amount;
  if (ppLive) return roundEuros(ppLive);
  if (ppPrice) return roundEuros(ppPrice);
  const total = parseFloat(offer?.total_amount || "0");
  return roundEuros(total / Math.max(1, pax));
}

function baseFarePerPerson(origin: string, pax: number): number {
  try {
    // @ts-ignore
    return roundEuros(_baseFarePerPerson(origin, pax));
  } catch {
    return 0;
  }
}

function monthDays(year: number, month: number): string[] {
  const y = year, m0 = month - 1;
  const first = new Date(Date.UTC(y, m0, 1));
  const next  = new Date(Date.UTC(y, m0 + 1, 1));
  const out: string[] = [];
  for (let d = new Date(first); d < next; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin") || "BCN";
  const pax    = parseInt(searchParams.get("pax") || "2", 10);
  const year   = parseInt(searchParams.get("year") || "2025", 10);
  const month  = parseInt(searchParams.get("month") || "10", 10);
  const debug  = searchParams.get("debug") === "1";

  try {
    const daysISO = monthDays(year, month);
    const base = baseFarePerPerson(origin, pax);

    const days: any[] = [];
    const diag: any[] = [];

    for (const dep of daysISO) {
      const ret = addDaysISO(dep, TRIP_LEN - 1);

      let best: number | null = null;
      let dayDiag: any = { dep, ret, tries: [] };

      for (const destination of DESTS) {
        try {
          const offers = await searchOffersRaw({
            origin, destination, dep, ret, pax, limit: LIMIT_PER_DAY,
          });
          if (offers?.length) {
            const pp = pricePerPersonFromOffer(offers[0], pax);
            dayDiag.tries.push({ destination, ok: true, pp });
            if (best == null || pp < best) best = pp;
          } else {
            dayDiag.tries.push({ destination, ok: false, reason: "no_offers" });
          }
        } catch (e: any) {
          dayDiag.tries.push({ destination, ok: false, error: e?.message || "error" });
        }
      }

      // HOTFIX: si no hay precio, igual mostramos el día para que no “desaparezca” el mes
      days.push({
        date: dep,
        show: true,                            // <-- forzamos visible
        priceFrom: best != null ? best : null, // null -> UI puede ocultar el número, pero el día se puede elegir
        baseFare: base,
      });

      if (debug) diag.push(dayDiag);
    }

    const payload: any = { origin, pax, year, month, days };
    if (debug) payload.diag = diag;

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "calendar-prices error" },
      { status: 500 }
    );
  }
}
