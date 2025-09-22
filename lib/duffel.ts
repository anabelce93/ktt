// lib/duffel.ts
// ---------------------------------------------------------
// Implementación de helpers para consultar Duffel y mapear
// respuestas a tu modelo de UI (FlightOption, SegmentInfo).
// ---------------------------------------------------------

// =============== Tipos compartidos con la UI ===============
export type SegmentInfo = {
  origin: string;           // IATA
  destination: string;      // IATA
  departure: string;        // ISO
  arrival: string;          // ISO
  duration_minutes?: number;
  marketing_carrier?: string; // IATA
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[];         // ida
  ret: SegmentInfo[];         // vuelta
  baggage_included: boolean;
  cabin: string;              // "Economy", etc.
  total_amount_per_person: number; // € por persona (redondeado)
  airline_codes?: string[];   // para logos
};

// =============== Tipos mínimos de Duffel ===============
type DuffelPlace = {
  iata_code: string;
};

type DuffelCarrier = {
  iata_code: string;
};

type DuffelSegment = {
  origin: DuffelPlace;
  destination: DuffelPlace;
  marketing_carrier: DuffelCarrier;
  operating_carrier?: DuffelCarrier;
  departing_at: string;  // ISO
  arriving_at: string;   // ISO
  duration?: string;     // "PT6H35M"
  // opcionalmente baggage o cabin por segmento; lo normal es en fare_brand
};

type DuffelSlice = {
  segments: DuffelSegment[];
};

type DuffelOffer = {
  id: string;
  slices: DuffelSlice[];         // [0] ida, [1] vuelta
  total_amount: string;          // "2415.00"
  total_currency: string;        // "EUR"
  owner?: { iata_code?: string } // aerolínea "dueña"
  // equipaje/cabina suelen ir en "included_services", "baggage" o "conditions"
  // Duffel añade a veces "passengers" con price_per_passenger
  passengers?: Array<{
    type?: string;
    id?: string;
    baggages?: any[];
    // precio por pasajero (si viene):
    live_pricing?: { total_amount?: string; total_currency?: string } | null;
    // o algunos esquemas tienen "price" por pasajero:
    price?: { total_amount?: string; currency?: string } | null;
  }>;
  // A veces cada offer tiene "cabin_class" o por slice en services:
  cabin_class?: string | null;
  // Baggage:
  included_service?: any;
};

// =============== Utilidades ===============
const DUFFEL_API = "https://api.duffel.com/air/offer_requests";
const DUFFEL_TOKEN = process.env.DUFFEL_TOKEN || "";
const DUFFEL_VERSION = process.env.DUFFEL_VERSION || "v1";

// ISO-8601 duration -> minutos (e.g. "PT6H35M")
function isoDurationToMinutes(iso?: string): number | undefined {
  if (!iso) return undefined;
  const m = iso.match(/P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!m) return undefined;
  const h = parseInt(m[1] || "0", 10);
  const mm = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 60 + mm + (s ? Math.round(s / 60) : 0);
}

function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

function roundEuros(n?: number | string): number {
  if (n == null) return 0;
  const num = typeof n === "string" ? parseFloat(n) : n;
  return Math.round(num);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// =============== Construcción del payload a Duffel ===============
type SearchOffersArgs = {
  origin: string;
  destination: string;
  dep: string; // YYYY-MM-DD
  ret: string; // YYYY-MM-DD
  pax: number; // adultos
  limit?: number;
};

// POST /air/offer_requests
// Devuelve los "offers" dentro del propio cuerpo de la respuesta.
export async function searchOffersRaw({
  origin,
  destination,
  dep,
  ret,
  pax,
  limit = 20,
}: SearchOffersArgs): Promise<DuffelOffer[]> {
  if (!DUFFEL_TOKEN) {
    throw new Error("DUFFEL_TOKEN ausente en variables de entorno");
  }

  // Construimos slices ida/vuelta (solo fecha; Duffel permite +/- horarios flexibles)
  const body = {
    slices: [
      { origin, destination, departure_date: dep },
      { origin: destination, destination: origin, departure_date: ret },
    ],
    passengers: Array.from({ length: pax }).map(() => ({ type: "adult" as const })),
    cabin_class: "economy",
    max_connections: 2,
    return_offers: true,
    supplier_timeout: 20000, // 20s por si tardan
  };

  const res = await fetch(DUFFEL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Duffel-Version": DUFFEL_VERSION,
      "Authorization": `Bearer ${DUFFEL_TOKEN}`,
    },
    body: JSON.stringify(body),
    // No caches: esto va siempre a Duffel
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Duffel ${res.status}: ${text}`);
  }

  const json = await res.json();
  // Duffel devuelve { data: { offers: [...], ... } } o { data: [...] } según versión.
  const offers: DuffelOffer[] =
    (json?.data?.offers as DuffelOffer[]) ||
    (json?.data as DuffelOffer[]) ||
    [];

  // limitamos por si vienen demasiadas
  return offers.slice(0, limit);
}

// Alias exportado para compatibilidad con tu /api/calendar-prices
export async function searchOffers(args: SearchOffersArgs) {
  return searchOffersRaw(args);
}

// =============== Mapeo Duffel -> FlightOption ===============
function mapSegment(seg: DuffelSegment): SegmentInfo {
  return {
    origin: seg.origin?.iata_code,
    destination: seg.destination?.iata_code,
    departure: seg.departing_at,
    arrival: seg.arriving_at,
    duration_minutes: isoDurationToMinutes(seg.duration),
    marketing_carrier: seg.marketing_carrier?.iata_code,
  };
}

function mapOfferToOption(offer: DuffelOffer, pax: number): FlightOption {
  const out = (offer.slices?.[0]?.segments || []).map(mapSegment);
  const ret = (offer.slices?.[1]?.segments || []).map(mapSegment);

  // Precio total → por persona (redondeado)
  // Preferimos, si existe, price por pasajero; si no, prorrateamos total/pax
  let perPerson = 0;
  const p0 = offer.passengers?.[0];
  const pp1 = p0?.live_pricing?.total_amount;
  const pp2 = p0?.price?.total_amount;
  if (pp1) perPerson = roundEuros(pp1);
  else if (pp2) perPerson = roundEuros(pp2);
  else perPerson = roundEuros(parseFloat(offer.total_amount || "0") / Math.max(1, pax));

  // Equipaje incluido: si no tenemos señal clara, lo ponemos a true solo si airline owner es legacy (heurística floja)
  const baggage_included = true; // ⚠️ si tienes lectura exacta de baggage, cámbialo aquí

  // Cabina:
  const cabin =
    (offer.cabin_class?.[0]?.toUpperCase() + (offer.cabin_class?.slice(1) || "")) ||
    "Economy";

  // Logos: owner o carriers que aparecen
  const carrierCodes: string[] = uniq(
    (offer.slices || [])
      .flatMap((sl) => sl.segments || [])
      .map((s) => s.marketing_carrier?.iata_code)
      .filter(Boolean) as string[]
  );

  return {
    id: offer.id,
    out,
    ret,
    baggage_included,
    cabin,
    total_amount_per_person: perPerson,
    airline_codes: carrierCodes,
  };
}

// =============== Búsqueda ICN / GMP con merge y debug ===============
type SearchBothArgs = {
  origin: string;
  dep: string;
  ret: string;
  pax: number;
  limit?: number;
  debug?: boolean;
};

export async function searchRoundTripBoth({
  origin,
  dep,
  ret,
  pax,
  limit = 20,
  debug = false,
}: SearchBothArgs): Promise<{ options: FlightOption[]; diag: any }> {
  const DESTS = ["ICN", "GMP"] as const;

  const diag: any = {
    input: { origin, dep, ret, pax, limit, debug },
    perDest: [] as any[],
    merged_count: 0,
    after_map: 0,
  };

  const allOffers: DuffelOffer[] = [];

  for (const destination of DESTS) {
    try {
      const offers = await searchOffersRaw({ origin, destination, dep, ret, pax, limit });
      diag.perDest.push({ destination, offers: offers.length });
      allOffers.push(...offers);
    } catch (e: any) {
      diag.perDest.push({ destination, error: String(e?.message || e) });
    }
  }

  diag.merged_count = allOffers.length;

  // Mapeamos y ordenamos por precio por persona ascendente
  const mapped = allOffers.map((o) => mapOfferToOption(o, pax));
  diag.after_map = mapped.length;

  // Orden asc
  mapped.sort((a, b) => a.total_amount_per_person - b.total_amount_per_person);

  // Limit final (por si ambos destinos suman más de lo deseado)
  const options = mapped.slice(0, limit);

  return { options, diag: debug ? diag : undefined };
}
