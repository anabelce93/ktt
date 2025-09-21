// lib/cache.ts
const URL = process.env.UPSTASH_REDIS_REST_URL!;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

type UpstashResp<T> = { result: T };

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  if (!URL || !TOKEN) return null;
  const r = await fetch(`${URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const json = (await r.json()) as UpstashResp<string | null>;
  if (!json?.result) return null;
  try {
    return JSON.parse(json.result as string) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!URL || !TOKEN) return;
  const body = JSON.stringify(value);
  await fetch(`${URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(body)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  await fetch(`${URL}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
}
