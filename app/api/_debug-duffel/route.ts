// app/api/_debug-duffel/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RAW = process.env.DUFFEL_TOKEN || process.env.DUFFEL_API_KEY || "";
const AUTH = RAW.startsWith("Bearer ") ? RAW : `Bearer ${RAW}`;
const VER = process.env.DUFFEL_VERSION || "v2";

async function asBody(res: Response) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? await res.json().catch(() => null) : await res.text();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") || "BCN";
  const dep = url.searchParams.get("dep") || "2025-11-10";
  const ret = url.searchParams.get("ret") || "2025-11-19";
  const pax = Number(url.searchParams.get("pax") || 2);

  const body = {
    data: {
      passengers: Array.from({ length: pax }, () => ({ type: "adult" })),
      slices: [
        { origin, destination: "ICN", departure_date: dep },
        { origin: "ICN", destination: origin, departure_date: ret },
      ],
      cabin_class: "economy",
    }
  };

  const r = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true", {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Duffel-Version": VER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const id1 = r.headers.get("x-request-id") || undefined;
  const status1 = r.status;
  const b1 = await asBody(r);

  let offersCount = 0;
  let firstOffer: any = null;

  if (r.ok) {
    const offersInline: any[] = b1?.data?.offers?.data || b1?.data?.offers || b1?.included_offers || [];
    offersCount = Array.isArray(offersInline) ? offersInline.length : 0;
    firstOffer = offersInline?.[0] || null;
  }

  return NextResponse.json({
    ok: r.ok,
    step: "offer_requests",
    status: status1,
    x_request_id: id1,
    offersCount,
    sampleFirstOffer: firstOffer ? {
      id: firstOffer.id,
      total_amount: firstOffer.total_amount,
      currency: firstOffer.total_currency,
      slices: firstOffer.slices?.length
    } : null,
    // si hay error, lo verás aquí
    error: r.ok ? null : b1
  }, { status: 200 });
}
