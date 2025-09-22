// app/api/_env/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mask(v?: string | null) {
  if (!v) return null;
  const s = String(v);
  if (s.length <= 8) return "********";
  return s.slice(0, 6) + "…" + s.slice(-4);
}

export async function GET() {
  const DUFFEL_TOKEN = process.env.DUFFEL_TOKEN || process.env.DUFFEL_API_KEY || null;
  const DUFFEL_VERSION = process.env.DUFFEL_VERSION || null;
  const UP_URL = process.env.UPSTASH_REDIS_REST_URL || null;
  const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || null;
  const TZ = process.env.WIDGET_TIMEZONE || null;
  const ORIGINS = process.env.WIDGET_ALLOWED_ORIGINS || null;

  return NextResponse.json({
    // NO mostramos el valor entero, sólo enmascarado
    DUFFEL_TOKEN_masked: mask(DUFFEL_TOKEN),
    DUFFEL_VERSION,
    UPSTASH_REDIS_REST_URL_masked: mask(UP_URL),
    UPSTASH_REDIS_REST_TOKEN_masked: mask(UP_TOKEN),
    WIDGET_TIMEZONE: TZ,
    WIDGET_ALLOWED_ORIGINS: ORIGINS,
    // pista rápida: qué nombre de var detectó
    token_source: process.env.DUFFEL_TOKEN ? "DUFFEL_TOKEN"
                  : process.env.DUFFEL_API_KEY ? "DUFFEL_API_KEY"
                  : "NONE",
    node_env: process.env.NODE_ENV,
  });
}
