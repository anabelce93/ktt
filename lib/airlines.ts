// lib/airlines.ts
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
};

export function airlineName(iata: string | undefined): string {
  if (!iata) return "Aerolínea desconocida";
  const code = iata.trim().toUpperCase();
  return AIRLINES[code] ? `${AIRLINES[code]} (${code})` : code;
}
