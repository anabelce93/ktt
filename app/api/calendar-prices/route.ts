// app/api/calendar-prices/route.ts
import { NextResponse } from "next/server";
import { addDaysISO } from "@/lib/utils";
// IMPORTA tu buscador de opciones que ya usas en /api/flight-options
import { searchRoundTripBoth } from "@/lib/duffel";

const TRIP_LEN = 10; // días

type DayInfo = {
  date: string;      // YYYY-MM-DD
  show: boolean;
  priceFrom: number | null;
  baseFare: number;
};

type CalendarPayload = {
  origin: string;
  pax: number;
  year: number;
  month: number;
  days: DayInfo[];
};

// util: YYYY, MM (1-12) -> array de YYYY-MM-DD del mes
function monthDays(year: number, month: number) {
  const out: string[] = [];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month, 1));
  for (let d = new Date(first); d < next; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function ensureInt(n: any, def: number) {
  const v = parseInt(String(n), 10);
  return Number.isFinite(v) ? v : def;
}

function roundEuros(n: number) {
  return Math.round(n); // sin céntimos
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = String(searchParams.get("origin") || "BCN");
    const pax = ensureInt(searchParams.get("pax"), 2);
    const year = ensureInt(searchParams.get("year"), new Date().getUTCFullYear());
    const month = ensureInt(searchParams.get("month"), new Date().getUTCMonth() + 1);

    // Puedes traer baseFare por reglas propias; de momento fijo genérico
    const BASE_FARE = 1175;

    // 1) Construimos estructura base
    const daysISO = monthDays(year, month);
    const payload: CalendarPayload = {
      origin,
      pax,
      year,
      month,
      days: daysISO.map((d) => ({
        date: d,
        show: true,           // se puede afinar si quieres bloquear fines de semana o pasados
        priceFrom: null,      // lo rellenamos abajo
        baseFare: BASE_FARE,
      })),
    };

    // 2) Para cada día, buscamos la opción más barata y metemos priceFrom
    //    (limit = 1 para no gastar más de la cuenta)
    //    Si tu función soporta debug, quítalo aquí para compilar en Vercel.
    for (let i = 0; i < payload.days.length; i++) {
      const d = payload.days[i];
      if (!d.show) continue;

      const dep = d.date;
      const ret = addDaysISO(dep, TRIP_LEN - 1);

      try {
        const { options } = await searchRoundTripBoth({
          origin,
          dep,
          ret,
          pax,
          limit: 1,
        });

        if (options && options.length > 0) {
          // Prioridad: usa total_amount_per_person si existe en tu tipo
          const best = options[0] as any;

          // Cubrimos ambos casos:
          // A) Tu tipo ya trae total_amount_per_person
          // B) Sólo trae total_amount (total del grupo) y hay que dividir entre pax
          let perPerson =
            typeof best.total_amount_per_person === "number"
              ? best.total_amount_per_person
              : (Number(best.total_amount) || 0) / Math.max(1, pax);

          if (!Number.isFinite(perPerson) || perPerson <= 0) {
            // fallback ultra seguro: deja null
            d.priceFrom = null;
          } else {
            d.priceFrom = roundEuros(perPerson);
          }
        } else {
          d.priceFrom = null;
        }
      } catch (e) {
        // Si falla Duffel en ese día, no tiramos el mes entero
        d.priceFrom = null;
      }
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "calendar-prices failed" },
      { status: 500 }
    );
  }
}
