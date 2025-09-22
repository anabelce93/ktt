// app/api/flight-options/route.ts
import { NextResponse } from "next/server";
import { searchRoundTripBoth } from "@/lib/duffel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin") || "BCN";
  const dep = searchParams.get("dep");
  const ret = searchParams.get("ret");
  const pax = Number(searchParams.get("pax") || 2);
  const limit = Number(searchParams.get("limit") || 20);

  if (!dep || !ret) {
    return NextResponse.json({ error: "dep y ret requeridos" }, { status: 400 });
  }

  const { options, diag } = await searchRoundTripBoth({ origin, dep, ret, pax, limit });
  return NextResponse.json({ options, diag });
}
