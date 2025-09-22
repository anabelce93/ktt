// app/api/flight-options/route.ts
import { NextResponse } from "next/server";
import { searchRoundTripBoth } from "@/lib/duffel"; // tu función actual

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const origin  = searchParams.get("origin") || "";
    const dep     = searchParams.get("departure") || "";
    const ret     = searchParams.get("return") || "";
    const paxStr  = searchParams.get("pax") || "1";
    const pax     = Math.max(1, Math.min(6, Number(paxStr) || 1));

    if (!origin || !dep || !ret) {
      return NextResponse.json(
        { options: [], diag: [{ error: "missing_params", detail: { origin, dep, ret } }] },
        { status: 200 }
      );
    }

    const { options, diag } = await searchRoundTripBoth({ origin, dep, ret, pax, limit: 20 });

    return NextResponse.json({ origin, departure: dep, return: ret, pax, options, diag }, { status: 200 });
  } catch (err: any) {
    const safe = typeof err?.message === "string" ? err.message : "unknown_error";
    const diag = [{ error: "exception", detail: safe }];
    return NextResponse.json({ options: [], diag }, { status: 200 });
  }
}
