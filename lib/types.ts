// lib/types.ts
export const TRIP_LEN = 10;

// --- Calendario ---
export type CalendarDay = {
  date: string;           // "YYYY-MM-DD"
  show: boolean;          // hay disponibilidad
  priceFrom: number | null; // EUR por persona (entero) o null
  baseFare: number;       // EUR por persona (constante negocio)
};

export type CalendarPayload = {
  origin: string;
  pax: number;
  year: number;
  month: number; // 1-12
  days: CalendarDay[];
};

export type DayPayload = {
  date: string;
  show: boolean;
  priceFrom: number | null;
  baseFare: number;
};

// --- Vuelos ---
export type SegmentInfo = {
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string;   // ISO
  duration_minutes?: number;
  marketing_carrier?: string; // IATA
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[]; // ida
  ret: SegmentInfo[]; // vuelta
  baggage_included: boolean;
  cabin: "Economy" | "Premium Economy" | "Business" | "First" | string;
  total_amount_per_person: number; // EUR entero
  airline_codes?: string[];
};

export type FlightOptionsPayload = {
  options: FlightOption[];
  diag?: any;
};

// --- Búsquedas Duffel ---
export type RoundTripSearch = {
  origin: string;
  dep: string; // "YYYY-MM-DD"
  ret: string; // "YYYY-MM-DD"
  pax: number;
  limit?: number;
};
