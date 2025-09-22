// lib/duffel.ts
const DUFFEL_URL = "https://api.duffel.com/air/offer_requests";
const DUFFEL_KEY = process.env.DUFFEL_TOKEN!;
const DUFFEL_VERSION = process.env.DUFFEL_VERSION || "2024-05-20";

async function duffelFetch(url: string, init: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${DUFFEL_KEY}`,
      "Duffel-Version": DUFFEL_VERSION,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Duffel ${res.status}: ${text || res.statusText}`);
  }

  return res.json();
}

export async function searchRoundTripBoth({ origin, dep, ret, pax, limit = 20 }:{
  origin: string; dep: string; ret: string; pax: number; limit?: number;
}) {
  const dests = ["ICN", "GMP"];
  const allDiag: any[] = [];
  const allOptions: any[] = [];

  for (const dest of dests) {
    try {
      const body = {
        data: {
          slices: [
            { origin, destination: dest, departure_date: dep },
            { origin: dest, destination: origin, departure_date: ret },
          ],
          passengers: Array.from({ length: pax }).map((_, i) => ({ type: "adult", id: `pax_${i+1}` })),
          cabin_class: "economy",
          max_connections: 1,
          max_stops: 1,
        },
      };

      const created = await duffelFetch(DUFFEL_URL, { method: "POST", body: JSON.stringify(body) });
      const reqId = created?.data?.id;
      if (!reqId) continue;

      const list = await duffelFetch(`${DUFFEL_URL}/${reqId}/offers?limit=${limit}`, { method: "GET" });
      const options = (list?.data || []).map(mapDuffelOfferToOption);
      allOptions.push(...options);
    } catch (e: any) {
      allDiag.push({ dest, error: e?.message || String(e) });
    }
  }

  allOptions.sort((a, b) => (a.total_amount_per_person ?? 0) - (b.total_amount_per_person ?? 0));
  const seen = new Set<string>();
  const unique = allOptions.filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)));

  return { options: unique.slice(0, limit), diag: allDiag };
}
