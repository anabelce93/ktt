// lib/airlines.tsx
import React from "react";

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
  TW: "T'Way",
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

/** Si existe /airlines/XX.svg lo usamos.
 *  Si no, dibujamos un circulito con las siglas (fallback).
 */
export function AirlineLogo({ code, size = 20 }: { code?: string; size?: number }) {
  const c = (code || "").toUpperCase() || "??";
  const svgPath = `/airlines/${c}.svg`;
  const [exists, setExists] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let mounted = true;
    // comprobación rápida si existe (HEAD)
    fetch(svgPath, { method: "HEAD" })
      .then((r) => mounted && setExists(r.ok))
      .catch(() => mounted && setExists(false));
    return () => { mounted = false; };
  }, [svgPath]);

  if (exists) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={svgPath}
        alt={c}
        width={size}
        height={size}
        style={{ display: "inline-block", borderRadius: 4, objectFit: "contain" }}
      />
    );
  }

  // Fallback insignia
  const palette: Record<string, { bg: string; fg: string }> = {
    QR: { bg: "#8a1538", fg: "#ffffff" },
    TK: { bg: "#c60c30", fg: "#ffffff" },
    KE: { bg: "#1ba0d7", fg: "#ffffff" },
    OZ: { bg: "#6e2a8c", fg: "#ffffff" },
    AF: { bg: "#002654", fg: "#ffffff" },
    KL: { bg: "#00a1de", fg: "#ffffff" },
    LH: { bg: "#ffcc00", fg: "#1a1a1a" },
    IB: { bg: "#d32f2f", fg: "#ffffff" },
    UX: { bg: "#2e7d32", fg: "#ffffff" },
    BA: { bg: "#1b3a6b", fg: "#ffffff" },
    ZH: { bg: "#b31e22", fg: "#ffffff" },
  };
  const colors = palette[c] || { bg: "#91c5c5", fg: "#123" };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-label={c}
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
        {c}
      </text>
    </svg>
  );
}

export const AIRLINE_LIST_FOR_LOADER = [
  "QR", "TK", "KE", "OZ", "AF", "KL", "LH", "IB", "UX", "BA", "ZH",
].map((code) => ({ code, name: AIRLINES[code] || code }));
