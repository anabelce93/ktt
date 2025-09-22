// lib/duffel.ts
type DuffelSlice = {
  origin: string;
  destination: string;
  departing_at: string;
  arriving_at: string;
  marketing_carrier?: string;
  duration_minutes?: number;
};

type DuffelOffer = {
  id: string;
  slices: DuffelSlice[][]; // [outSegments[], retSegments[]]
  total_amount: string;    // total para todos los pax
  currency: string;
  baggage_included?: boolean;
  cabin?: string;
  airline_codes?: string[];
};

export type SegmentInfo = {
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  duration_minutes?: number;
  marketing_carrier?: string;
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: string;
  total_amount_per_person: number;
  airline_codes?: string[];
};

type SearchArgs = {
  origin: string;
  dep: string; // YYYY-MM-DD
  ret: string; // YYYY-MM-DD
  pax: number;
  limit?: number;
  debug?: boolean;
};

function diffMinutes(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

function mapOfferToOption(of: DuffelOffer, pax: number): FlightOption | null {
  if (!of.slices || of.slices.length < 2) return null;
  const [outSegs, retSegs] = of.slices;

  const mapSeg = (s: DuffelSlice): SegmentInfo => ({
    origin: s.origin,
    destination: s.destination,
    departure: s.departing_at,
    arrival: s.arriving_at,
    duration_minutes: s.duration_minutes,
    marketing_carrier: s.marketing_carrier,
  });

  const out = outSegs.map(mapSeg);
  const ret = retSegs.map(mapSeg);

  const total = Number(of.total_amount || 0);
  const perPerson = pax > 0 ? Math.round(total / pax) : total;

  return {
    id: of.id,
    out,
    ret,
    baggage_included: !!of.baggage_included,
    cabin: of.cabin || "Economy",
    total_amount_per_person: perPerson,
    airline_codes: of.airline_codes || [],
  };
}

// Comprueba que cada escala (entre tramos contiguos) ≤ maxLayoverMin
function checkLayoversMax(segments: SegmentInfo[], maxLayoverMin: number) {
  if (segments.length <= 1) return true;
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    const lay = diffMinutes(prev.arrival, curr.departure);
    if (lay > maxLayoverMin) return false;
  }
  return true;
}

// Este método debe usar tu cliente real de Duffel para buscar ofertas.
// Aquí asumo que tienes algo como `searchOffersRaw({ origin, destination, dep, ret, pax, limit })` que devuelve DuffelOffer[].
// Si tu función se llama distinto, cambia el nombre aquí.
async function searchOffersRaw(args: {
  origin: string;
  destination: string;
  dep: string;
  ret: string;
  pax: number;
  limit?: number;
}): Promise<DuffelOffer[]> {
  // TODO: llama a tu integración real con Duffel.
  // Devuelve un array de ofertas crudas (sin filtrar).
  throw new Error("searchOffersRaw not implemented");
}

export async function searchRoundTripBoth(
  { origin, dep, ret, pax, limit = 20, debug = false }: SearchArgs
): Promise<{ options: FlightOption[]; diag: any }> {
  const DESTS = ["ICN", "GMP"] as const;

  const diag: any = {
    input: { origin, dep, ret, pax, limit },
    perDest: [] as any[],
    merged_count: 0,
    after_filters: 0,
  };

  const all: DuffelOffer[] = [];

  // 1) Pedimos a ICN y a GMP por separado y juntamos
  for (const destination of DESTS) {
    try {
      const offers = await searchOffersRaw({ origin, destination, dep, ret, pax, limit });
      diag.perDest.push({ destination, offers: offers.length });
      all.push(...offers);
    } catch (e: any) {
      diag.perDest.push({ destination, error: String(e?.message || e) });
    }
  }

  diag.merged_count = all.length;

  // 2) Mapeamos a nuestra Option
  const mapped = all
    .map((of) => mapOfferToOption(of, pax))
    .filter((x): x is FlightOption => !!x);

  // 3) Filtros razonables:
  //    - máx 1 escala por trayecto
  //    - cada escala ≤ 12h (720 min)
  //    - (OPCIONAL) maleta incluida – desactivado por ahora para no matar resultados
  const MAX_LAYOVER_MIN = 12 * 60;

  const filtered = mapped.filter((opt) => {
    const outStops = Math.max(0, opt.out.length - 1);
    const retStops = Math.max(0, opt.ret.length - 1);
    if (outStops > 1 || retStops > 1) return false;

    if (!checkLayoversMax(opt.out, MAX_LAYOVER_MIN)) return false;
    if (!checkLayoversMax(opt.ret, MAX_LAYOVER_MIN)) return false;

    // Si quieres exigir maleta incluida, descomenta:
    // if (!opt.baggage_included) return false;

    return true;
  });

  diag.after_filters = filtered.length;

  // 4) Ordenamos por precio por persona y truncamos
  filtered.sort((a, b) => a.total_amount_per_person - b.total_amount_per_person);
  const options = filtered.slice(0, limit);

  return { options, diag: debug ? diag : undefined };
}
