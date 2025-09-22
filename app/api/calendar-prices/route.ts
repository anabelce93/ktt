export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import { baseFarePerPerson } from "@/lib/pricing";
import { addDaysISO } from "@/lib/utils";
import { searchOffers } from "@/lib/duffel";
import { cacheGet, cacheSet } from "@/lib/cache";

const DESTS = ["ICN", "GMP"] as const; // buscamos en ambos
const TTL_SECONDS = 60 * 60 * 12; // 12h

// limitador simple de concurrencia
function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    if (queue.length) queue.shift()!();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then((v) => {
            next();
            resolve(v);
          })
          .catch((e) => {
            next();
            reject(e);
          });
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origin = (searchParams.get("origin") || "BCN").toUpperCase();
  const pax = Math.max(1, Math.min(6, parseInt(searchParams.get("pax") || "1", 10)));
  const year = parseInt(searchParams.get("year") || dayjs().year().toString(), 10);
  // por defecto: mes siguiente (0-based)
  const month = parseInt(
    searchParams.get("month") || dayjs().add(1, "month").month().toString(),
    10
  );
  const noCache = searchParams.get("nocache") === "1";

  const first = dayjs().year(year).month(month).date(1);
  const daysIn = first.daysInMonth();
  const minStart = dayjs().add(30, "day").startOf("day"); // mínimo +30 días

  const monthKey = `cal:v6:${origin}:${pax}:${year}-${month}`;

  // 1) Cache a nivel de mes (si no forzamos nocache)
  if (!noCache) {
    const cachedMonth = await cacheGet<any>(monthKey);
    if (cachedMonth) return NextResponse.json(cachedMonth);
  }

  // 2) Reunimos días con cache por día
  const limiter = pLimit(6); // sube/baja según te deje Duffel
  const dayPromises: Promise<{
    date: string;
    show: boolean;
    priceFrom: number | null;
    baseFare: number;
  }>[] = [];

  for (let d = 1; d <= daysIn; d++) {
    dayPromises.push(
      limiter(async () => {
        const date = first.date(d);
        const dep = date.format("YYYY-MM-DD");
        const ret = addDaysISO(dep, 9); // viaje 10 días
        const baseFare = baseFarePerPerson(dep, pax);

        const dayKey = `day:v1:${origin}:${pax}:${dep}`;

        // 2.a) Intentar leer el día de Redis (si no forzamos nocache)
        if (!noCache) {
          const cachedDay = await cacheGet<{
            date: string;
            show: boolean;
            priceFrom: number | null;
            baseFare: number;
          }>(dayKey);
          if (cachedDay) return cachedDay;
        }

        // 2.b) Si no hay cache, calcular el día
        // fuera de ventana: no mostramos
        if (!date.isAfter(minStart.subtract(1, "day"))) {
          const dayData = { date: dep, show: false, priceFrom: null, baseFare };
          await cacheSet(dayKey, dayData, TTL_SECONDS);
          return dayData;
        }

        // Buscamos ICN y GMP y nos quedamos con el vuelo más barato válido (pp)
        let best: number | null = null;
        for (const dest of DESTS) {
          try {
            const offers = await searchOffers({
  origin,
  destination: dest,
  dep,   // ✅ usa 'dep'
  ret,
  pax,
});
            if (offers.length > 0) {
              const pp = offers[0].total_amount_per_person;
              if (best == null || pp < best) best = pp;
            }
          } catch (e) {
            // log opcional:
            // console.error("Duffel day error", { origin, dest, dep, ret, err: String(e) });
          }
        }

        let show = false;
        let priceFrom: number | null = null;
        if (best != null) {
          const totalPerPerson = baseFare + best; // base p.p. + vuelo p.p.
          if (totalPerPerson < 2500) {
            show = true;
            priceFrom = totalPerPerson;
          }
        }

        const dayData = { date: dep, show, priceFrom, baseFare };
        await cacheSet(dayKey, dayData, TTL_SECONDS);
        return dayData;
      })
    );
  }

  const days = await Promise.all(dayPromises);

  // 3) (Opcional) Guardar también el mes ya montado
  const payload = { origin, pax, year, month, days };
  await cacheSet(monthKey, payload, TTL_SECONDS);

  return NextResponse.json(payload);
}
