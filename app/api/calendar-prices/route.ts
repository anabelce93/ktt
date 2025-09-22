// app/api/calendar-prices/route.ts
import { NextResponse } from "next/server";
import { addDaysISO } from "@/lib/utils";          // debe existir: (iso: string, days: number) => string
import { searchOffersRaw } from "@/lib/duffel";     // del lib/duffel.ts que te pasé
import { baseFarePerPerson as _baseFarePerPerson } from "@/lib/pricing"; // si no existe, devolvemos 0

// Constantes de negocio
const DESTS = ["ICN", "GMP"] as const;   // buscamos en ambos
const TRIP_LEN = 10;                     // 10 días
const LIMIT_PER_DAY = 1;                 // para el calendario nos basta con la mejor (1)

function roundEuros(n?: number | string): number {
  if (n == null) return 0;
  const num = typeof n === "string" ? parseFloat(n) : n;
  return Math.round(num);
}

// Precio por persona (redondeado) a partir de un DuffelOffer
function pricePerPersonFromOffer(offer: any, pax: number): number {
  // Preferir price por pasajero si está:
  const p0 = offer?.passengers?.[0];
  const ppLive = p0?.live_pricing?.total_amount;
  const ppPrice = p0?.price?.total_amount;

  if (ppLive) return roundEuros(ppLive);
  if (ppPrice) return roundEuros(ppPrice);

  // fallback: total_amount / pax
  const total = parseFloat(offer?.total_amount || "0");
  return roundEuros(total / Math.max(1, pax));
}

// Base fare helper (si tu firma difiere, atrapamos y devolvemos 0)
function baseFarePerPerson(origin: string, pax: number): number {
  try {
    // @ts-ignore – por si tu firma real es distinta
    return roundEuros(_baseFarePerPerson(origin, pax));
  } catch {
    return 0;
  }
}

// Genera todas las fechas (YYYY-MM-DD) del mes solicitado
function monthDays(year: number, month: number): string[] {
  // month: 1..12
  const y = year;
  const m0 = month - 1; // Date usa 0..11
  const first = new Date(Date.UTC(y, m0, 1));
  const nextMonth = new Date(Date.UTC(y, m0 + 1, 1));
  const days: string[] = [];
  for (let d = new Date(first); d < nextMonth; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    days.push(iso);
  }
  return days;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get("origin") || "BCN";
    const pax = parseInt(searchParams.get("pax") || "2", 10);
    const year = parseInt(searchParams.get("year") || "2025", 10);
    const month = parseInt(searchParams.get("month") || "10", 10);
    const nocache = searchParams.get("nocache"); // ignorado (si quieres, úsalo para saltarte tu redis)

    // Construimos los días del mes
    const daysISO = monthDays(year, month);

    // Precio base por persona (si aplica en tu UI)
    const base = baseFarePerPerson(origin, pax);

    const days = [];
    for (const dep of daysISO) {
      const ret = addDaysISO(dep, TRIP_LEN - 1);

      let best: number | null = null;
      // probamos ICN y GMP
      for (const destination of DESTS) {
        try {
          const offers = await searchOffersRaw({
            origin,
            destination,
            dep,
            ret,
            pax,
            limit: LIMIT_PER_DAY,
          });

          if (offers && offers.length > 0) {
            const perPerson = pricePerPersonFromOffer(offers[0], pax);
            if (best == null || perPerson < best) best = perPerson;
          }
        } catch (e) {
          // no rompemos el calendario por un error puntual; seguimos con el siguiente destino
          // opcional: podrías loguearlo en consola de servidor
        }
      }

      days.push({
        date: dep,
        show: best != null,                 // hay disponibilidad si encontramos al menos 1 offer
        priceFrom: best != null ? best : null, // número entero sin decimales, ya redondeado
        baseFare: base,                     // si no te cuadra, cámbialo o quítalo
      });
    }

    return NextResponse.json({
      origin,
      pax,
      year,
      month,
      days,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "calendar-prices error" },
      { status: 500 }
    );
  }
}
