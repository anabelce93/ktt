// app/api/flight-options/route.ts
import { NextResponse } from "next/server";
import { searchRoundTripBoth } from "@/lib/duffel"; // asegúrate de exportarlo en lib/duffel.ts

type SegmentInfo = {
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string;   // ISO
  duration_minutes?: number;
  marketing_carrier?: string;
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: string; // "Economy"
  total_amount_per_person: number; // por persona
  airline_codes?: string[];
};

function badRequest(msg: string) {
  return NextResponse.json({ ok: false, err: msg }, { status: 400 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") || "";
  // IMPORTANTE: el frontend está enviando `dep` y `ret` (no `departure`)
  const dep = url.searchParams.get("dep") || url.searchParams.get("departure") || "";
  const ret = url.searchParams.get("ret") || "";
  const paxStr = url.searchParams.get("pax") || "1";
  const limitStr = url.searchParams.get("limit") || "20";

  // Log básico para ver qué llega (se ve en los logs de la función)
  console.log("flight-options QUERY", { origin, dep, ret, paxStr, limitStr });

  // Validación rápida
  if (!origin) return badRequest("Missing param: origin");
  if (!dep) return badRequest("Missing param: dep");
  if (!ret) return badRequest("Missing param: ret");

  const pax = Math.max(1, parseInt(paxStr, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(limitStr, 10) || 20));

  // Probaremos ambas (ICN y GMP) y combinaremos
  const DESTS = ["ICN", "GMP"] as const;

  const diag: Array<{ dest: string; error?: string; count?: number }> = [];
  const all: FlightOption[] = [];

  try {
    for (const dest of DESTS) {
      try {
        const opts = await searchRoundTripBoth({
          origin,
          destination: dest,
          dep,
          ret,
          pax,
          limit, // que tu función respete este tope
        });

        if (Array.isArray(opts) && opts.length) {
          all.push(...opts);
          diag.push({ dest, count: opts.length });
        } else {
          diag.push({ dest, count: 0 });
        }
      } catch (e: any) {
        const msg =
          typeof e?.message === "string"
            ? e.message
            : typeof e === "string"
            ? e
            : JSON.stringify(e);
        console.error("Duffel search error", dest, msg);
        diag.push({ dest, error: msg });
      }
    }

    // Si no hemos conseguido nada de ninguna de las dos, devolvemos 502 con diagnóstico
    if (all.length === 0) {
      return NextResponse.json(
        { ok: false, err: "No options from Duffel", diag },
        { status: 502 }
      );
    }

    // Ordenamos por precio por persona y recortamos
    all.sort((a, b) => a.total_amount_per_person - b.total_amount_per_person);
    const options = all.slice(0, limit);

    return NextResponse.json(
      {
        ok: true,
        origin,
        dep,
        ret,
        pax,
        options,
        diag,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg =
      typeof e?.message === "string"
        ? e.message
        : typeof e === "string"
        ? e
        : JSON.stringify(e);
    console.error("flight-options FATAL", msg);
    return NextResponse.json({ ok: false, err: msg }, { status: 500 });
  }
}
