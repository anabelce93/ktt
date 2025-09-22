// app/api/_debug-duffel/route.ts
import { NextResponse } from "next/server";
import { searchRoundTripBoth } from "@/lib/duffel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { options, diag } = await searchRoundTripBoth({
    origin: "BCN",
    dep: "2025-10-21",
    ret: "2025-10-30",
    pax: 2,
    limit: 3
  });
  return NextResponse.json({ count: options.length, first: options[0], diag });
}
