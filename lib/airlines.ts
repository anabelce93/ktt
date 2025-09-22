// lib/airlines.ts
import React from "react";

// Mapa IATA -> Nombre visible
const AIRLINES: Record<string, string> = {
  QR: "Qatar Airways",
  EK: "Emirates",
  EY: "Etihad Airways",
  KE: "Korean Air",
  OZ: "Asiana Airlines",
  TK: "Turkish Airlines",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  IB: "Iberia",
  UX: "Air Europa",
  BA: "British Airways",
  AY: "Finnair",
  CX: "Cathay Pacific",
  JL: "Japan Airlines",
  NH: "ANA (All Nippon Airways)",
  SQ: "Singapore Airlines",
  TG: "Thai Airways",
  CA: "Air China",
  MU: "China Eastern",
  CZ: "China Southern",
  ET: "Ethiopian Airlines",
  ZH: "Shenzhen Airlines",
};

export function airlineName(iata?: string): string {
  if (!iata) return "Aerolínea desconocida";
  const code = iata.trim().toUpperCase();
  return AIRLINES[code] ? `${AIRLINES[code]} (${code})` : code;
}

/**
 * Logo simple inline (SVG) por aerolínea/código.
 * No es el logo oficial: es una chapita circular con las siglas.
 */
export function AirlineLogo({ code, size = 20 }: { code?: string; size?: number }) {
  const c = (code || "").toUpperCase();
  const label = c || "??";

  // paletas por código para variar (fallback a #91c5c5)
  const palette: Record<string, { bg: string; fg: string }> = {
    QR: { bg: "#8a1538", fg: "#ffffff" }, // Qatar granate
    TK: { bg: "#c60c30", fg: "#ffffff" }, // Turkish rojo
    KE: { bg: "#1ba0d7", fg: "#ffffff" }, // Korean azul
    OZ: { bg: "#6e2a8c", fg: "#ffffff" }, // Asiana violeta
    AF: { bg: "#002654", fg: "#ffffff" }, // Air France azul
    KL: { bg: "#00a1de", fg: "#ffffff" }, // KLM azul
    LH: { bg: "#ffcc00", fg: "#1a1a1a" }, // Lufthansa amarillo
    IB: { bg: "#d32f2f", fg: "#ffffff" }, // Iberia rojo
    UX: { bg: "#2e7d32", fg: "#ffffff" }, // Air Europa (estilizado)
    BA: { bg: "#1b3a6b", fg: "#ffffff" }, // BA azul
    ZH: { bg: "#b31e22", fg: "#ffffff" }, // Shenzhen rojo
  };
  const colors = palette[c] || { bg: "#91c5c5", fg: "#123" };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-label={label}
      role="img"
      style={{ borderRadius: "50%", flexShrink: 0 }}
    >
      <circle cx="20" cy="20" r="20" fill={colors.bg} />
      <text
        x="50%"
        y="53%"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="14"
        fontWeight="700"
        fill={colors.fg}
      >
        {label}
      </text>
    </svg>
  );
}

// Lista de aerolíneas a rotar en el loader
export const AIRLINE_LIST_FOR_LOADER = [
  "QR", "TK", "KE", "OZ", "AF", "KL", "LH", "IB", "UX", "BA", "ZH",
].map((code) => ({ code, name: AIRLINES[code] || code }));
