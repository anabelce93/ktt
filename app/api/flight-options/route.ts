// app/api/flight-options/route.ts
import { NextResponse } from "next/server";
import { searchRoundTripBoth } from "@/lib/duffel"; // esta función ya consulta ICN y GMP internamente

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
  // el frontend puede mandar dep o departure: aceptamos ambos
  const dep = url.searchParams.get("dep") || url.searchParams.get("departure") || "";
  const ret = url.searchParams.get("ret") || "";
  const paxStr = url.searchParams.get("pax") || "1";
  const limitStr = url.searchParams.get("limit") || "20";

  console.log("flight-options QUERY", { origin, dep, ret, paxStr, limitStr });

  if (!origin) return badRequest("Missing param: origin");
  if (!dep) return badRequest("Missing param: dep");
  if (!ret) return badRequest("Missing param: ret");

  const pax = Math.max(1, parseInt(paxStr, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(limitStr, 10) || 20));

  try {
    // Llamada única: la función ya prueba ICN/GMP por dentro
    const got = await searchRoundTripBoth({
      origin,
      dep,
      ret,
      pax,
      limit,
    } as any);

    if (!Array.isArray(got) || got.length === 0) {
      return NextResponse.json(
        { ok: false, err: "No options from Duffel" },
        { status: 502 }
      );
    }

    const options = got
      .slice()
      .sort((a, b) => a.total_amount_per_person - b.total_amount_per_person)
      .slice(0, limit);

    return NextResponse.json(
      {
        ok: true,
        origin,
        dep,
        ret,
        pax,
        options,
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
