// components/FlightsModal.tsx
"use client";
import React, { useEffect, useState } from "react";
import { airlineName } from "@/lib/airlines";
import { formatDuration, hhmm } from "@/lib/format";

type SegmentInfo = {
  marketing_carrier: string;           // IATA (QR, TK, etc.)
  origin: string;                      // IATA aeropuerto (BCN)
  destination: string;                 // IATA (DOH / ICN)
  departure: string;                   // ISO
  arrival: string;                     // ISO
  duration_minutes: number;            // duración del segmento
  // en el primer segmento de cada trayecto añadimos:
  stops?: number;                      // 0 o 1 (máx 1 escala por trayecto)
  connection_airport?: string;         // IATA de conexión (si hay)
  connection_minutes?: number;         // duración de la conexión
};

type Option = {
  id: string;
  delta_vs_base_eur: number;           // +Δ€ vs la opción más barata
  out: SegmentInfo[];                  // ida (1 o 2 segmentos)
  ret: SegmentInfo[];                  // vuelta (1 o 2 segmentos)
  baggage_included: boolean;
  cabin: "Economy";
};

type Props = {
  open: boolean;
  onClose: () => void;
  origin: string;
  departure: string;
  ret: string;
  pax: number;
  onSelect: (id: string) => void;
};

export default function FlightsModal({
  open,
  onClose,
  origin,
  departure,
  ret,
  pax,
  onSelect,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setOptions([]);

    const url = `/api/flight-options?origin=${encodeURIComponent(
      origin
    )}&departure=${encodeURIComponent(departure)}&return=${encodeURIComponent(
      ret
    )}&pax=${pax}`;

    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        const arr: Option[] = json?.options || [];
        setOptions(arr);
        if (arr.length === 0) {
          // Si quieres ver diagnóstico, puedes inspeccionar json.diag en la consola
          // console.log("diag", json?.diag);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open, origin, departure, ret, pax]);

  if (!open) return null;

  // Componente pequeño para mostrar un tramo
  const Leg: React.FC<{
    from?: string; to?: string; dep?: string; arr?: string; dur?: number | null;
  }> = ({ from, to, dep, arr, dur }) => (
    <div className="text-sm">
      <div className="font-medium">
        {from} {hhmm(dep)} → {to} {hhmm(arr)}
      </div>
      <div className="opacity-70">Duración: {formatDuration(dur ?? undefined)}</div>
    </div>
  );

  const Card: React.FC<{ opt: Option }> = ({ opt }) => {
    // IDA
    const outSegs = opt.out;
    const out0 = outSegs[0];
    const out1 = outSegs[1];
    const outConnMins = out0?.connection_minutes ?? null;
    const outAirline = airlineName(out0?.marketing_carrier);

    // VUELTA
    const retSegs = opt.ret;
    const ret0 = retSegs[0];
    const ret1 = retSegs[1];
    const retConnMins = ret0?.connection_minutes ?? null;
    const retAirline = airlineName(ret0?.marketing_carrier);

    return (
      <div className="border rounded-xl p-4 mb-3">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide opacity-70">{opt.cabin}</div>
          <div className="text-base font-semibold">
            {opt.delta_vs_base_eur === 0 ? "+0 €" : `+${opt.delta_vs_base_eur} €`}
          </div>
        </div>

        {/* IDA */}
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1">IDA</div>
          {out1 ? (
            <>
              <Leg
                from={out0.origin}
                to={out0.destination}
                dep={out0.departure}
                arr={out0.arrival}
                dur={out0.duration_minutes}
              />
              {outConnMins != null && (
                <div className="my-1 text-xs opacity-70">
                  Conexión en <span className="font-medium">{out0.destination}</span> · {formatDuration(outConnMins)}
                </div>
              )}
              <Leg
                from={out1.origin}
                to={out1.destination}
                dep={out1.departure}
                arr={out1.arrival}
                dur={out1.duration_minutes}
              />
            </>
          ) : (
            <Leg
              from={out0?.origin}
              to={out0?.destination}
              dep={out0?.departure}
              arr={out0?.arrival}
              dur={out0?.duration_minutes}
            />
          )}
          <div className="mt-1 text-xs">Aerolínea: {outAirline}</div>
        </div>

        {/* VUELTA */}
        <div className="mb-2">
          <div className="text-xs font-semibold mb-1">VUELTA</div>
          {ret1 ? (
            <>
              <Leg
                from={ret0.origin}
                to={ret0.destination}
                dep={ret0.departure}
                arr={ret0.arrival}
                dur={ret0.duration_minutes}
              />
              {retConnMins != null && (
                <div className="my-1 text-xs opacity-70">
                  Conexión en <span className="font-medium">{ret0.destination}</span> · {formatDuration(retConnMins)}
                </div>
              )}
              <Leg
                from={ret1.origin}
                to={ret1.destination}
                dep={ret1.departure}
                arr={ret1.arrival}
                dur={ret1.duration_minutes}
              />
            </>
          ) : (
            <Leg
              from={ret0?.origin}
              to={ret0?.destination}
              dep={ret0?.departure}
              arr={ret0?.arrival}
              dur={ret0?.duration_minutes}
            />
          )}
          <div className="mt-1 text-xs">Aerolínea: {retAirline}</div>
        </div>

        {/* Extras + botón */}
        <div className="text-xs opacity-70 mb-2">
          {opt.baggage_included ? "Maleta incluida · " : ""}
          Cabina: {opt.cabin}
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={() => onSelect(opt.id)}>
            Elegir este vuelo
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Vuelos disponibles</div>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>

        {loading && <div className="text-sm opacity-70">Cargando opciones…</div>}
        {error && <div className="text-sm text-red-600">Error: {error}</div>}
        {!loading && !error && options.length === 0 && (
          <div className="text-sm opacity-70">No hay combinaciones disponibles para esa fecha.</div>
        )}

        {!loading && !error && options.map((opt) => <Card key={opt.id} opt={opt} />)}
      </div>
    </div>
  );
}

