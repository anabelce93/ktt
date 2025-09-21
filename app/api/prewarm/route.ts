export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// limitador muy simple para no disparar demasiadas peticiones a la vez
function pLimit(concurrency: number) {
  let active = 0;
  const q: Array<() => void> = [];
  const next = () => {
    active--;
    if (q.length) q.shift()!();
  };
  return async <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn().then((v) => { next(); resolve(v); }).catch((e) => { next(); reject(e); });
      };
      if (active < concurrency) run();
      else q.push(run);
    });
}

function parsePax(input: string | null): number[] {
  if (!input) return [2]; // por defecto 2 pax
  if (input.includes("-")) {
    const [a, b] = input.split("-").map((n) => parseInt(n, 10));
    const from = Math.max(1, Math.min(6, a || 1));
    const to = Math.max(1, Math.min(6, b || 6));
    const out: number[] = [];
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) out.push(i);
    return out;
  }
  return input.split(",").map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= 6);
}

function parseMonthsExplicit(input: string | null): number[] | null {
  if (!input) return null;
  return input.split(",").map((m) => parseInt(m, 10)).filter((m) => m >= 0 && m <= 11);
}

function nextMonths(count: number): { year: number; month: number }[] {
  const now = new Date();
  const baseYear = now.getUTCFullYear();
  const baseMonth = now.getUTCMonth(); // 0-based
  const out: { year: number; month: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const m = baseMonth + i;
    const y = baseYear + Math.floor(m / 12);
    const mm = m % 12;
    out.push({ year: y, month: mm });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl; // base para construir enlaces internos
  const base = `${url.origin}/api/calendar-prices`;

  const origins = (url.searchParams.get("origins") || "BCN,MAD,VLC,AGP,LPA")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const paxList = parsePax(url.searchParams.get("pax"));              // ej: "1-6" o "1,2,3"
  const monthsExplicit = parseMonthsExplicit(url.searchParams.get("months")); // ej: "9,10,11" (0-based)
  const monthsAhead = parseInt(url.searchParams.get("months_ahead") || "3", 10); // ej: 3 = próximos 3 meses (desde el siguiente)
  const yearOverride = url.searchParams.get("year");

  // Calculamos los (año, mes) a precalentar
  let targets: { year: number; month: number }[] = [];
  if (monthsExplicit && yearOverride) {
    const y = parseInt(yearOverride, 10);
    targets = monthsExplicit.map((m) => ({ year: y, month: m }));
  } else if (monthsExplicit && !yearOverride) {
    // Si pasan meses explícitos sin año, asumimos año del próximo mes en adelante
    const nm = nextMonths(12);
    targets = nm.filter((t) => monthsExplicit.includes(t.month)).slice(0, monthsExplicit.length);
  } else {
    targets = nextMonths(Math.max(1, monthsAhead));
  }

  // Concurrencia baja para no sobrecargar (cada calendar-prices ya hace sus sub-llamadas)
  const limit = pLimit(2);

  const jobs: Array<Promise<{ ok: boolean; url: string; ms: number; status?: number }>> = [];

  for (const origin of origins) {
    for (const pax of paxList) {
      for (const t of targets) {
        const targetUrl = `${base}?origin=${origin}&pax=${pax}&year=${t.year}&month=${t.month}&nocache=1`;
        jobs.push(
          limit(async () => {
            const t0 = Date.now();
            try {
              const res = await fetch(targetUrl, { cache: "no-store" });
              const ms = Date.now() - t0;
              return { ok: res.ok, url: targetUrl, ms, status: res.status };
            } catch {
              const ms = Date.now() - t0;
              return { ok: false, url: targetUrl, ms };
            }
          })
        );
      }
    }
  }

  const results = await Promise.all(jobs);
  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;

  return NextResponse.json({
    summary: {
      total_jobs: results.length,
      ok,
      fail,
      avg_ms: Math.round(results.reduce((a, r) => a + r.ms, 0) / Math.max(1, results.length)),
    },
    results,
  });
}

