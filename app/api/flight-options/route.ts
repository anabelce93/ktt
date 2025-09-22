export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { searchOffers } from "@/lib/duffel";

const DESTS = ["ICN", "GMP"] as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = (searchParams.get("origin") || "BCN").toUpperCase();
    const departure = searchParams.get("departure");
    const ret = searchParams.get("return");
    const pax = Math.max(1, Math.min(6, parseInt(searchParams.get("pax") || "1", 10)));

    if (!departure || !ret) {
      return NextResponse.json(
        { error: "Faltan parámetros: departure y return son obligatorios." },
        { status: 400 }
      );
    }

    let all: any[] = [];
    const diag: Array<{ dest: string; count?: number; error?: string }> = [];

    // Consultamos Duffel para ICN y GMP sin caché
    for (const dest of DESTS) {
      try {
        const offers = await searchOffers({
          origin,
          destination: dest as "ICN" | "GMP",
          departure,
          ret,
          pax,
        });
        diag.push({ dest, count: offers.length });
        all = all.concat(offers);
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.error("Duffel search error", { origin, dest, departure, ret, pax, err: msg });
        diag.push({ dest, error: msg });
      }
    }

    if (all.length === 0) {
      return NextResponse.json({ origin, departure, return: ret, pax, options: [], diag });
    }

    const cheapest = Math.min(...all.map((o) => o.total_amount_per_person));

    // Devolvemos hasta 10 opciones ordenadas y con +Δ€ (sin precio total)
    const options = all
      .sort((a, b) => a.total_amount_per_person - b.total_amount_per_person)
      .slice(0, 20)
      .map((o) => ({
        id: o.id,
        delta_vs_base_eur: Math.round(o.total_amount_per_person - cheapest),
        out: o.out,
        ret: o.ret,
        baggage_included: o.baggage_included,
        cabin: o.cabin,
      }));

    return NextResponse.json({ origin, departure, return: ret, pax, options, diag });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error("flight-options fatal", { err: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
