// app/api/flight-options/route.ts
import { NextResponse } from "next/server";
import { searchRoundTripBoth } from "@/lib/duffel";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, err: msg }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") || "";
  const dep = url.searchParams.get("dep") || url.searchParams.get("departure") || "";
  const ret = url.searchParams.get("ret") || "";
  const pax = Math.max(1, parseInt(url.searchParams.get("pax") || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "20", 10)));
  const debug = url.searchParams.get("debug") === "1";

  if (!origin) return bad("Missing param: origin");
  if (!dep) return bad("Missing param: dep");
  if (!ret) return bad("Missing param: ret");

  try {
    const { options, diag } = await searchRoundTripBoth({ origin, dep, ret, pax, limit, debug });

    if (!options.length) {
      // Devolvemos diagnóstico para ver en consola del navegador por qué estamos a cero
      return NextResponse.json(
        { ok: false, err: "No options from Duffel", diag },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, origin, dep, ret, pax, options, diag: debug ? diag : undefined },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : String(e);
    console.error("flight-options FATAL", msg);
    return NextResponse.json({ ok: false, err: msg }, { status: 500 });
  }
}
