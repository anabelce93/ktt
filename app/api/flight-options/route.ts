// app/api/flight-options/route.ts
import { NextResponse } from "next/server";
import { searchOffers } from "@/lib/duffel"; // o searchRoundTripBoth si usas esa
// ^ usa la función real que tengas exportada (la que devuelve opciones)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get("origin") ?? "";
    // acepta 'dep' o 'departure'
    const dep = searchParams.get("dep") ?? searchParams.get("departure") ?? "";
    const ret = searchParams.get("ret") ?? "";
    const pax = Number(searchParams.get("pax") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");

    if (!origin || !dep || !ret || !pax) {
      return NextResponse.json(
        { ok: false, error: "missing_params", hint: { origin, dep, ret, pax } },
        { status: 400 }
      );
    }

    // Si usas un wrapper que ya busca ICN/GMP, llámalo aquí.
    // Si no, llama a searchOffers dos veces y une resultados.
    const destinations = ["ICN", "GMP"];
    const all = (
      await Promise.all(
        destinations.map((destination) =>
          searchOffers({ origin, destination, dep, ret, pax, limit })
        )
      )
    ).flat();

    // Ordena, recorta a 20 por si acaso
    const sorted = all.sort(
      (a, b) => a.total_amount_per_person - b.total_amount_per_person
    );
    return NextResponse.json({ ok: true, options: sorted.slice(0, limit) });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
