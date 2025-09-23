import { RoundTripSearch, FlightOption, SegmentInfo } from "@/lib/types";
import { minutesBetween } from "@/lib/format";

const RAW_TOKEN = process.env.DUFFEL_TOKEN || process.env.DUFFEL_API_KEY || "";
const AUTH = RAW_TOKEN.startsWith("Bearer ") ? RAW_TOKEN : `Bearer ${RAW_TOKEN}`;
const DUFFEL_VERSION = process.env.DUFFEL_VERSION || "v2";

function parseDurationToMinutes(iso?: string) {
  if (!iso) return undefined;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return undefined;
  return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
}

type DuffelDiag = { step: string; status?: number; id?: string; text?: string; body?: any };

async function bodyAs(res: Response) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? await res.json().catch(() => null) : await res.text();
}

export async function searchRoundTripBoth(
  { origin, dep, ret, pax, limit = 20 }: RoundTripSearch
): Promise<{ options: FlightOption[]; diag?: DuffelDiag[] }> {
  const diag: DuffelDiag[] = [];

  const offerReq = {
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
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(offerReq),
    cache: "no-store",
  });

  const reqId1 = r.headers.get("x-request-id") || undefined;
  if (!r.ok) {
    diag.push({ step: "offer_requests", status: r.status, id: reqId1, text: String(await bodyAs(r)) });
    return { options: [], diag };
  }

  const req = await r.json();
  const inlineOffers: any[] = req?.data?.offers?.data || req?.data?.offers || req?.included_offers || [];
  let offers: any[] = inlineOffers;

  if (!offers?.length) {
    const offersUrl = req?.data?.offers?.links?.self || req?.data?.links?.offers || req?.data?.links?.offers_url;
    if (offersUrl) {
      const r2 = await fetch(offersUrl, {
        headers: { Authorization: AUTH, "Duffel-Version": DUFFEL_VERSION },
        cache: "no-store",
      });
      const reqId2 = r2.headers.get("x-request-id") || undefined;
      if (!r2.ok) {
        diag.push({ step: "offers", status: r2.status, id: reqId2, text: String(await bodyAs(r2)) });
        return { options: [], diag };
      }
      const offersRes: any = await r2.json();
      offers = offersRes?.data || offersRes?.offers || [];
    }
  }

  const options: FlightOption[] = (offers || []).map((o: any) => {
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
    const back = mapSegs(retSlice);

    const perPerson = Math.round(Number(o.total_amount || 0) / Math.max(1, pax));
    const airlineCodes = Array.from(new Set([...out, ...back].map(s => s.marketing_carrier).filter(Boolean))) as string[];

    return {
      id: o.id,
      out,
      ret: back,
      baggage_included: Boolean(o?.included_bags || o?.baggage),
      cabin: (o?.cabin_class || "Economy") as FlightOption["cabin"],
      total_amount_per_person: perPerson,
      airline_codes: airlineCodes,
    };
  })
  .filter(x => {
    const escalaOk = (segs: SegmentInfo[]) => {
      if (segs.length <= 1) return true;
      const layover = minutesBetween(segs[0].arrival, segs[1].departure);
      return layover <= 720;
    };

    return (
      x.out.length <= 2 &&
      x.ret.length <= 2 &&
      escalaOk(x.out) &&
      escalaOk(x.ret) &&
      x.baggage_included
    );
  })
  .sort((a, b) => a.total_amount_per_person - b.total_amount_per_person)
  .slice(0, limit);

  if (!options.length) {
    diag.push({ step: "no_offers_returned", body: { inlineCount: inlineOffers?.length ?? 0 } });
  }

   return { options, diag: diag.length ? diag : undefined };
}

export async function cheapestFor(args: RoundTripSearch): Promise<{ price: number | null; diag?: DuffelDiag[] }> {
  const { options, diag } = await searchRoundTripBoth({ ...args, limit: 1 });
  return { price: options[0]?.total_amount_per_person ?? null, diag };
}
