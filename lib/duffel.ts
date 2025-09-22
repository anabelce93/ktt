// lib/duffel.ts
// Implementación centralizada de llamadas a Duffel y mapeo a objetos "FlightOption"

type SegmentInfo = {
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string;   // ISO
  duration_minutes: number;
  marketing_carrier: string; // IATA
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[]; // ida
  ret: SegmentInfo[]; // vuelta
  baggage_included: boolean;
  cabin: "Economy";
  total_amount_per_person: number; // número, por persona
};

const DUFFEL_URL = "https://api.duffel.com/air/offer_requests";
const DUFFEL_KEY = process.env.DUFFEL_TOKEN!;
const DUFFEL_VERSION = process.env.DUFFEL_VERSION || "2024-05-20"; // asegúrate de tener esto en Vercel

function ensureEnv() {
  if (!DUFFEL_KEY) throw new Error("Missing DUFFEL_TOKEN env var");
}

async function duffelFetch(url: string, init: RequestInit) {
  ensureEnv();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${DUFFEL_KEY}`,
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Duffel ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/** Utilidades */

function minutesBetween(isoStart: string, isoEnd: string): number {
  const a = new Date(isoStart).getTime();
  const b = new Date(isoEnd).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
}

function sliceDurationMinutes(segs: { departing_at: string; arriving_at: string }[]): number {
  if (!segs.length) return 0;
  const start = segs[0].departing_at;
  const end = segs[segs.length - 1].arriving_at;
  return minutesBetween(start, end);
}

function baggageIncludedFromOffer(offer: any): boolean {
  // Intentar detectar “1x checked bag” de forma conservadora
  const included = offer?.slices?.flatMap((s: any) => s?.segments || []) || [];
  const bag = included.some((seg: any) =>
    seg?.passengers?.some((p: any) =>
      (p?.baggages || []).some((b: any) => (b?.type || "").includes("checked"))
    )
  );
  return !!bag;
}

function toSegmentInfo(seg: any): SegmentInfo {
  const dep = seg?.departing_at || seg?.departure_time || seg?.origin_terminal_time;
  const arr = seg?.arriving_at || seg?.arrival_time || seg?.destination_terminal_time;
  const origin = seg?.origin?.iata_code || seg?.origin;
  const destination = seg?.destination?.iata_code || seg?.destination;
  const marketing = seg?.marketing_carrier?.iata_code || seg?.marketing_carrier;
  const dur = minutesBetween(dep, arr);
  return {
    origin,
    destination,
    departure: dep,
    arrival: arr,
    duration_minutes: dur,
    marketing_carrier: marketing,
  };
}

function mapDuffelOfferToOption(offer: any): FlightOption {
  const slices = offer?.slices || [];
  const outSegments = (slices[0]?.segments || []).map(toSegmentInfo);
  const retSegments = (slices[1]?.segments || []).map(toSegmentInfo);

  const totalStr = offer?.total_amount || "0";
  const currency = offer?.total_currency || "EUR";
  // Dividimos por pax más abajo (oferta es para TODOS los pasajeros)
  // Aquí guardamos total por persona: luego lo ajustamos en los helpers.
  const totalNumber = Number(totalStr);

  return {
    id: String(offer?.id || cryptoRandomId()),
    out: outSegments,
    ret: retSegments,
    baggage_included: baggageIncludedFromOffer(offer),
    cabin: "Economy",
    total_amount_per_person: Number.isFinite(totalNumber) ? totalNumber : 0,
  };
}

function cryptoRandomId() {
  // fallback leve para id
  return "tmp_" + Math.random().toString(36).slice(2);
}

/** Lógica de búsqueda */

// Busca ida+vuelta, probando ICN y GMP, limita conexiones y devuelve ordenado por precio (por persona).
export async function searchRoundTripBoth({
  origin,
  dep,
  ret,
  pax,
  limit = 20,
}: {
  origin: string;
  dep: string;
  ret: string;
  pax: number;
  limit?: number;
}): Promise<{ options: FlightOption[]; diag: any[] }> {
  const dests = ["ICN", "GMP"];
  const diag: any[] = [];
  const list: FlightOption[] = [];

  for (const dest of dests) {
    try {
      const body = {
        data: {
          slices: [
            { origin, destination: dest, departure_date: dep },
            { origin: dest, destination: origin, departure_date: ret },
          ],
          passengers: Array.from({ length: pax }).map((_, i) => ({
            type: "adult",
            id: `pax_${i + 1}`,
          })),
          cabin_class: "economy",
          max_connections: 1,
          max_stops: 1,
        },
      };

      const created = await duffelFetch(DUFFEL_URL, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const reqId = created?.data?.id;
      if (!reqId) continue;

      const offers = await duffelFetch(
        `${DUFFEL_URL}/${reqId}/offers?limit=${limit}`,
        { method: "GET" }
      );

      const mapped: FlightOption[] = (offers?.data || []).map(mapDuffelOfferToOption);

      // Ajuste: Duffel.total_amount es TOTAL para todos los pax. Convertimos a “por persona”.
      const perPerson = mapped.map((m) => ({
        ...m,
        total_amount_per_person: Math.round((m.total_amount_per_person / Math.max(pax, 1)) * 100) / 100,
      }));

      list.push(...perPerson);
    } catch (e: any) {
      diag.push({ dest, error: e?.message || String(e) });
    }
  }

  // Orden por precio/persona asc
  list.sort(
    (a, b) =>
      (a.total_amount_per_person ?? 0) - (b.total_amount_per_person ?? 0)
  );

  // Deduplicado por id (por si ICN/GMP devuelve clones)
  const seen = new Set<string>();
  const unique = list.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));

  return { options: unique.slice(0, limit), diag };
}

/**
 * searchOffers
 * Helper simple para “calendario”: para una fecha concreta y 1 destino,
 * devuelve *al menos* la oferta más barata (por persona) o vacío.
 * Puedes llamarlo varias veces por día/mes/destino desde /api/calendar-prices.
 */
export async function searchOffers({
  origin,
  destination,
  dep,
  ret,
  pax,
  limit = 5,
}: {
  origin: string;
  destination: string;
  dep: string;
  ret: string;
  pax: number;
  limit?: number;
}): Promise<FlightOption[]> {
  const body = {
    data: {
      slices: [
        { origin, destination, departure_date: dep },
        { origin: destination, destination: origin, departure_date: ret },
      ],
      passengers: Array.from({ length: pax }).map((_, i) => ({
        type: "adult",
        id: `pax_${i + 1}`,
      })),
      cabin_class: "economy",
      max_connections: 1,
      max_stops: 1,
    },
  };

  const created = await duffelFetch(DUFFEL_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const reqId = created?.data?.id;
  if (!reqId) return [];

  const offers = await duffelFetch(`${DUFFEL_URL}/${reqId}/offers?limit=${limit}`, {
    method: "GET",
  });

  const mapped: FlightOption[] = (offers?.data || []).map(mapDuffelOfferToOption);

  // Igual que antes: total_amount es total del grupo → lo pasamos a “por persona”
  const perPerson = mapped.map((m) => ({
    ...m,
    total_amount_per_person: Math.round((m.total_amount_per_person / Math.max(pax, 1)) * 100) / 100,
  }));

  // Orden ascendente por precio/persona
  perPerson.sort(
    (a, b) =>
      (a.total_amount_per_person ?? 0) - (b.total_amount_per_person ?? 0)
  );

  return perPerson;
}
