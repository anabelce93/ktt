"use client";
import React, { useEffect, useState } from "react";
import { airlineName } from "@/lib/airlines";
import { formatDuration, hhmm } from "@/lib/format";

type SegmentInfo = {
  marketing_carrier: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  duration_minutes: number;
  stops?: number;
  connection_airport?: string;
  connection_minutes?: number;
};

type Option = {
  id: string;
  delta_vs_base_eur: number;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: "Economy";
};

export default function FlightsList({
  origin,
  departure,
  ret,
  pax,
  onSelect,
  onBack,
}: {
  origin: string;
  departure: string;
  ret: string;
  pax: number;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOptions([]);
    const url = `/api/flight-options?origin=${encodeURIComponent(origin)}&departure=${encodeURIComponent(departure)}&return=${encodeURIComponent(ret)}&pax=${pax}`;
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((j) => setOptions(j?.options || []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [origin, departure, ret, pax]);

  const Leg: React.FC<{ s?: SegmentInfo }> = ({ s }) => {
    if (!s) return null;
    return (
      <div className="text-sm">
        <div className="font-medium">
          {s.origin} {hhmm(s.departure)} → {s.destination} {hhmm(s.arrival)}
        </div>
        <div className="opacity-70">Duración: {formatDuration(s.duration_minutes)}</div>
      </div>
    );
  };

  const TripCol: React.FC<{ label: string; segs: SegmentInfo[] }> = ({ label, segs }) => {
    const s0 = segs[0];
    const s1 = segs[1];
    const conn = s0?.connection_minutes ?? null;
    const airline = airlineName(s0?.marketing_carrier);
    return (
      <div className="flex-1">
        <div className="text-xs font-semibold mb-1">{label}</div>
        {s1 ? (
          <>
            <Leg s={s0} />
            {conn != null && (
              <div className="my-1 text-xs opacity-70">
                Conexión en <span className="font-medium">{s0.destination}</span> · {formatDuration(conn)}
              </div>
            )}
            <Leg s={s1} />
          </>
        ) : (
          <Leg s={s0} />
        )}
        <div className="mt-1 text-xs">Aerolínea: {airline}</div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between mb-3">
        <div className="text-sm opacity-70">
          Origen <strong>{origin}</strong> · {departure} → {ret} · {pax} pax
        </div>
        <button className="btn btn-secondary" onClick={onBack}>Cambiar fecha</button>
      </div>

      {loading && <div className="text-sm opacity-70">Cargando opciones…</div>}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}
      {!loading && !error && options.length === 0 && (
        <div className="text-sm opacity-70">No hay combinaciones disponibles para esa fecha.</div>
      )}

      {!loading && !error && options.map((opt) => (
        <div key={opt.id} className="border rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-4">
            {/* Columna IDA */}
            <TripCol label="IDA" segs={opt.out} />
            {/* Separador */}
            <div className="hidden md:block w-px bg-gray-200 mx-2" />
            {/* Columna VUELTA */}
            <TripCol label="VUELTA" segs={opt.ret} />

            {/* Lateral derecho con precio y CTA */}
            <div className="ml-auto flex flex-col items-end gap-2">
              <div className="text-base font-semibold">
                {opt.delta_vs_base_eur === 0 ? "+0 €" : `+${opt.delta_vs_base_eur} €`}
              </div>
              <div className="text-xs opacity-70">
                {opt.baggage_included ? "Maleta incluida · " : ""}Cabina: {opt.cabin}
              </div>
              <button className="btn btn-primary" onClick={() => onSelect(opt.id)}>
                Elegir vuelo
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
