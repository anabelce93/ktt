// lib/duffel.ts
import { RoundTripSearch, FlightOption, SegmentInfo } from "@/lib/types";

const DUFFEL_TOKEN = process.env.DUFFEL_TOKEN!;
const DUFFEL_VERSION = process.env.DUFFEL_VERSION!; // Debe existir en Vercel

function parseDurationToMinutes(iso?: string) {
  if (!iso) return undefined;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return undefined;
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
}

export async function searchRoundTripBoth(
  { origin, dep, ret, pax, limit = 20 }: RoundTripSearch
): Promise<{ options: FlightOption[]; diag?: any }> {
  const body = {
    data: {
      passengers: Array.from({ length: pax }, () => ({ type: "adult" })),
      slices: [
        { origin, destination: "ICN", departure_date: dep },
        { origin: "ICN", destination: origin, departure_date: ret },
      ],
      cabin_class: "economy",
    },
  };

  const r = await fetch("https://api.duffel.com/air/offer_requests", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DUFFEL_TOKEN}`,
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) {
    return { options: [], diag: { step: "offer_requests", status: r.status, text: await r.text() } };
  }

  const req = await r.json();
  const offersUrl =
    req?.data?.offers?.links?.self || req?.data?.links?.offers || req?.data?.links?.offers_url;
  if (!offersUrl) {
    return { options: [], diag: { step: "extract_offers_url", body: req } };
  }

  const r2 = await fetch(offersUrl, {
    headers: {
      Authorization: `Bearer ${DUFFEL_TOKEN}`,
      "Duffel-Version": DUFFEL_VERSION,
    },
    cache: "no-store",
  });
  if (!r2.ok) {
    return { options: [], diag: { step: "offers", status: r2.status, text: await r2.text() } };
  }

  const offersRes = await r2.json();
  const offers: any[] = offersRes?.data || offersRes?.offers || [];

  const options: FlightOption[] = offers.map((o: any) => {
    const [outSlice, retSlice] = o.slices || [];
    const mapSegs = (sl: any): SegmentInfo[] =>
      (sl?.segments || []).map((sg: any) => ({
        origin: sg?.origin?.iata_code,
        destination: sg?.destination?.iata_code,
        departure: sg?.departing_at,
        arrival: sg?.arriving_at,
        duration_minutes: parseDurationToMinutes(sg?.duration),
        marketing_carrier: sg?.marketing_carrier?.iata_code,
      }));

    const out = mapSegs(outSlice);
    const retSegs = mapSegs(retSlice);

    const perPerson = Math.round(Number(o.total_amount || 0) / pax);

    const airlineCodes = new Set<string>();
    [...out, ...retSegs].forEach(s => s.marketing_carrier && airlineCodes.add(s.marketing_carrier));

    return {
      id: o.id,
      out,
      ret: retSegs,
      baggage_included: Boolean(o?.included_bags || o?.baggage),
      cabin: (o?.cabin_class || "Economy") as FlightOption["cabin"],
      total_amount_per_person: perPerson,
      airline_codes: Array.from(airlineCodes),
    };
  })
  .filter(o => Number.isFinite(o.total_amount_per_person) && o.total_amount_per_person > 0)
  .sort((a, b) => a.total_amount_per_person - b.total_amount_per_person)
  .slice(0, limit);

  return { options };
}

export async function cheapestFor(args: RoundTripSearch): Promise<number | null> {
  const { options } = await searchRoundTripBoth({ ...args, limit: 1 });
  return options[0]?.total_amount_per_person ?? null;
}
