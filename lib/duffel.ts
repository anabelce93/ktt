// lib/duffel.ts

// ===== Tipos para Duffel =====
type Passenger = { type: "adult" };
type SliceInput = { origin: string; destination: string; departure_date: string };
type OfferReq = {
  slices: SliceInput[];
  passengers: Passenger[];
  cabin_class: "economy";
  // Puedes activar filtros nativos de Duffel aquí si quieres:
  // max_connections?: number;
  // departure_time?: { from: string; to: string };
  // arrival_time?: { from: string; to: string };
};

// ===== Config =====
const DUFFEL_API = "https://api.duffel.com/air";
const hdrs = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  "Duffel-Version": "v2", // ← antes poníamos v1
  Authorization: `Bearer ${process.env.DUFFEL_API_KEY}`,
});

// ===== Tipos internos =====
export type SegmentInfo = {
  marketing_carrier: string;
  marketing_flight_number?: string;
  operating_carrier?: string;
  origin: string;
  origin_terminal?: string;
  destination: string;
  destination_terminal?: string;
  departure: string; // ISO
  arrival: string; // ISO
  duration_minutes: number; // del segmento (si no viene, lo estimamos)
  stops: number; // lo rellenamos a nivel de slice
  connection_airport?: string; // de la PRIMERA conexión
  connection_minutes?: number; // minutos de esa conexión
};

export type Option = {
  id: string;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: "Economy";
  total_amount_per_person: number; // EUR por persona
};

// ===== Utilidades =====
function minutesBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

function countStops(segments: any[]): number {
  return Math.max(0, (segments?.length || 0) - 1);
}

function extractSegments(slice: any): SegmentInfo[] {
  return (slice?.segments || []).map((s: any) => {
    let durMins = 0;
    if (typeof s.duration === "string" && s.duration.startsWith("PT")) {
      const m = s.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      const h = m?.[1] ? parseInt(m[1], 10) : 0;
      const mm = m?.[2] ? parseInt(m[2], 10) : 0;
      durMins = h * 60 + mm;
    } else if (s.departing_at && s.arriving_at) {
      durMins = minutesBetween(s.departing_at, s.arriving_at);
    }
    return {
      marketing_carrier: s.marketing_carrier?.iata_code || s.marketing_carrier || "",
      marketing_flight_number: s.marketing_flight_number,
      operating_carrier: s.operating_carrier?.iata_code,
      origin: s.origin?.iata_code || s.origin,
      origin_terminal: s.origin?.terminal,
      destination: s.destination?.iata_code || s.destination,
      destination_terminal: s.destination?.terminal,
      departure: s.departing_at,
      arrival: s.arriving_at,
      duration_minutes: durMins,
      stops: 0,
    };
  });
}

function sliceDurationMinutes(slice: { segments: { departing_at: string; arriving_at: string }[] }): number {
  const segs = slice.segments || [];
  if (!segs.length) return 0;
  const first = segs[0];
  const last = segs[segs.length - 1];
  return minutesBetween(first.departing_at, last.arriving_at);
}

// PRIMERA conexión (si hay una)
function firstConnectionInfo(slice: any): { connection_airport?: string; connection_minutes?: number } {
  const segs = slice?.segments || [];
  if (segs.length <= 1) return {};
  const s1 = segs[0];
  const s2 = segs[1];
  return {
    connection_airport: s1.destination?.iata_code || s1.destination,
    connection_minutes: minutesBetween(s1.arriving_at, s2.departing_at),
  };
}

// No exigimos maleta estrictamente (aceptas añadirla como extra si aplica)
function checkedBagsIncludedPerPax(_offer: any): boolean {
  return true;
}

// Reglas
const MAX_LAYOVER_MIN = 12 * 60;      // tu regla: conexión ≤ 12h
const MAX_SLICE_DURATION_MIN = 36 * 60; // sanity check por trayecto

// ===== Búsqueda y parseo =====
export async function searchOffers(params: {
  origin: string;
  destination: "ICN" | "GMP";
  departure: string;
  ret: string;
  pax: number;
}): Promise<Option[]> {
  if (!process.env.DUFFEL_API_KEY) throw new Error("DUFFEL_API_KEY not set");

  const { origin, destination, departure, ret, pax } = params;

  const body: OfferReq = {
    slices: [
      { origin, destination, departure_date: departure },
      { origin: destination, destination: origin, departure_date: ret },
    ],
    passengers: Array.from({ length: Math.max(1, Math.min(6, pax)) }).map(() => ({
      type: "adult" as const,
    })),
    cabin_class: "economy",
    // max_connections: 1, // si quieres que Duffel ya limite
  };

  // Duffel usa JSON:API => { data: ... }
  const res = await fetch(`${DUFFEL_API}/offer_requests?return_offers=true`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify({ data: body }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Duffel error ${res.status}: ${t}`);
  }

  const json = await res.json();
  const data = json?.data ?? json;

  let offers = data?.offers ?? data?.data?.offers ?? [];
  const offerReqId = data?.id ?? data?.data?.id;

  // Si no vinieron embebidas, las pedimos aparte
  if ((!offers || offers.length === 0) && offerReqId) {
    const res2 = await fetch(`${DUFFEL_API}/offer_requests/${offerReqId}/offers?limit=50`, {
      headers: hdrs(),
    });
    if (res2.ok) {
      const j2 = await res2.json();
      offers = j2?.data ?? [];
    }
  }

  // Parseo y filtros
  const parsed: Option[] = (offers as any[])
    .map((o: any) => {
      const slOut = o.slices?.[0];
      const slRet = o.slices?.[1];
      if (!slOut || !slRet) return null;

      const outSegs = extractSegments(slOut);
      const retSegs = extractSegments(slRet);

      const outStops = countStops(slOut.segments || []);
      const retStops = countStops(slRet.segments || []);

      const outConn = firstConnectionInfo(slOut);
      const retConn = firstConnectionInfo(slRet);

      if (outSegs.length) {
        outSegs[0].stops = outStops;
        if (outConn.connection_airport) {
          outSegs[0].connection_airport = outConn.connection_airport;
          outSegs[0].connection_minutes = outConn.connection_minutes;
        }
      }
      if (retSegs.length) {
        retSegs[0].stops = retStops;
        if (retConn.connection_airport) {
          retSegs[0].connection_airport = retConn.connection_airport;
          retSegs[0].connection_minutes = retConn.connection_minutes;
        }
      }

      const priceTotal = parseFloat(o.total_amount); // total para TODOS los pax
      const perPerson = priceTotal / Math.max(1, pax);

      const item: Option = {
        id: o.id,
        out: outSegs,
        ret: retSegs,
        baggage_included: checkedBagsIncludedPerPax(o),
        cabin: "Economy",
        total_amount_per_person: perPerson,
      };
      return item;
    })
    .filter((x): x is Option => !!x)
    .filter((opt) => {
      // REGLAS:
      // - máx 1 escala por trayecto
      // - si hay 1 escala, layover ≤ 12h
      // - sanity: duración total por trayecto ≤ 36h
      const outDur = sliceDurationMinutes({
        segments: opt.out.map((s) => ({ departing_at: s.departure, arriving_at: s.arrival })),
      });
      const retDur = sliceDurationMinutes({
        segments: opt.ret.map((s) => ({ departing_at: s.departure, arriving_at: s.arrival })),
      });

      const outStops = opt.out[0]?.stops ?? 0;
      const retStops = opt.ret[0]?.stops ?? 0;
      const stopsOk = outStops <= 1 && retStops <= 1;

      const outLay = opt.out[0]?.connection_minutes ?? 0;
      const retLay = opt.ret[0]?.connection_minutes ?? 0;
      const layoverOk =
        (outStops === 0 || outLay <= MAX_LAYOVER_MIN) &&
        (retStops === 0 || retLay <= MAX_LAYOVER_MIN);

      const durOk = outDur <= MAX_SLICE_DURATION_MIN && retDur <= MAX_SLICE_DURATION_MIN;

      return stopsOk && layoverOk && durOk;
    });

  parsed.sort((a, b) => a.total_amount_per_person - b.total_amount_per_person);
  return parsed.slice(0, 10);
}
