"use client";
import React, { useEffect, useRef, useState } from "react";
import { airlineName, AirlineLogo, AIRLINE_LIST_FOR_LOADER } from "@/lib/airlines";
import { formatDuration, hhmm } from "@/lib/format";

type SegmentInfo = {
  marketing_carrier: string;
  origin: string;
  destination: string;
  departure: string;        // ISO
  arrival: string;          // ISO
  duration_minutes: number; // minutos de vuelo para ese segmento
  stops?: number;                 // 0 o 1
  connection_airport?: string;    // IATA (del primer trayecto)
  connection_minutes?: number;    // minutos de conexión (del primer trayecto)
};

export type FlightOption = {
  id: string;
  delta_vs_base_eur: number; // +Δ € por persona vs opción base
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: "Economy";
};

type DiagItem = { dest: string; count?: number; error?: string };

function extractOptions(j: any): FlightOption[] {
  if (j && Array.isArray(j.options)) return j.options as FlightOption[];
  if (j && j.data && Array.isArray(j.data.options)) return j.data.options as FlightOption[];
  if (Array.isArray(j)) return j as FlightOption[];
  return [];
}

/** Loader con barra indeterminada + aerolíneas rotando de UNA EN UNA */
function FancyLoaderLoop() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % AIRLINE_LIST_FOR_LOADER.length);
    }, 600);
    return () => clearInterval(t);
  }, []);
  const current = AIRLINE_LIST_FOR_LOADER[idx];
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-medium mb-2">Buscando las mejores ofertas…</div>
      <div className="loader-rail mb-3"><div className="loader-bar" /></div>
      <div className="flex items-center gap-3 text-sm">
        <AirlineLogo code={current.code} size={22} />
        <div className="font-medium">{current.name}</div>
        <div className="text-xs opacity-60">({current.code})</div>
      </div>
    </div>
  );
}

const Card: React.FC<{
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ selected, onClick, children }) => (
  <div
    className={`border rounded-2xl p-4 mb-4 transition cursor-pointer ${
      selected ? "border-black ring-1 ring-black" : "hover:border-gray-400"
    }`}
    onClick={onClick}
  >
    {children}
  </div>
);

const LegBlock: React.FC<{ s?: SegmentInfo }> = ({ s }) => {
  if (!s) return null;
  return (
    <div className="min-w-[220px]">
      <div className="text-sm font-medium whitespace-nowrap">
        {s.origin} {hhmm(s.departure)} → {s.destination} {hhmm(s.arrival)}
      </div>
      <div className="text-xs opacity-70 mt-0.5">Duración: {formatDuration(s.duration_minutes)}</div>
      <div className="flex items-center gap-1 mt-1 text-xs">
        <AirlineLogo code={s.marketing_carrier} size={16} />
        <span className="opacity-80">{airlineName(s.marketing_carrier)}</span>
      </div>
    </div>
  );
};

const ConnectionChip: React.FC<{ airport?: string; minutes?: number }> = ({ airport, minutes }) => {
  if (!airport || minutes == null) return null;
  return (
    <div className="flex flex-col items-center justify-center px-3">
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-[#91c5c5] bg-[#e8f4f4] text-xs whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#91c5c5]" />
        1 escala en <strong>&nbsp;{airport}&nbsp;</strong>
      </div>
      <div className="text-xs opacity-70 mt-1">Escala: {formatDuration(minutes)}</div>
    </div>
  );
};

const TripRow: React.FC<{ label: string; segs: SegmentInfo[] }> = ({ label, segs }) => {
  const s0 = segs[0];
  const s1 = segs[1]; // como máximo 1 escala
  const conn = s0?.connection_minutes ?? null;
  return (
    <div>
      <div className="text-xs font-semibold mb-2">{label}</div>
      {/* Desktop: horizontal en 3 columnas; Mobile: apilado */}
      <div className="grid grid-cols-1 md:grid-cols-3 md:items-start md:gap-4">
        <div className="md:justify-self-start"><LegBlock s={s0} /></div>
        <div className="md:justify-self-center md:self-center">
          {s1 ? <ConnectionChip airport={s0?.destination} minutes={conn ?? undefined} /> : null}
        </div>
        <div className="md:justify-self-end"><LegBlock s={s1} /></div>
      </div>
    </div>
  );
};

export default function FlightsList({
  origin,
  departure,
  ret,
  pax,
  onConfirm,
  onBack,
}: {
  origin: string;
  departure: string;
  ret: string;
  pax: number;
  onConfirm: (id: string, opt: FlightOption) => void; // “Continuar” envía selección
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FlightOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiagItem[] | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOptions([]);
    setDiag(null);
    setSelectedId(null);

    const url = `/api/flight-options?origin=${encodeURIComponent(
      origin
    )}&departure=${encodeURIComponent(departure)}&return=${encodeURIComponent(
      ret
    )}&pax=${pax}`;

    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        const txt = await r.text();
        if (!r.ok) throw new Error(`${r.status} ${r.statusText} ${txt}`);
        try { return JSON.parse(txt); } catch { return {}; }
      })
      .then((j) => {
        if (j?.diag) setDiag(j.diag as DiagItem[]);
        const arr = extractOptions(j);
        setOptions(arr);
        if (arr.length > 0) {
          // marcar por defecto la más barata (+0€)
          setSelectedId(arr[0].id);
        }
      })
      .catch((e) => {
        setError(String(e));
        console.error("flight-options error", e);
      })
      .finally(() => setLoading(false));
  }, [origin, departure, ret, pax]);

  const selectedOpt = options.find((o) => o.id === selectedId) || null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm opacity-70">
          Origen <strong>{origin}</strong> · {departure} → {ret} · {pax} pax
        </div>
      </div>

      {loading && (
        <>
          <FancyLoaderLoop />
          <div className="mt-4 flex justify-center">
            <button className="btn btn-secondary" onClick={onBack}>Atrás</button>
          </div>
        </>
      )}

      {error && <div className="text-sm text-red-600 mt-3">Error al cargar opciones: {error}</div>}

      {!loading && !error && (
        <div className="text-xs opacity-70 mb-2">Opciones encontradas: {options.length}</div>
      )}

      {!loading && !error && options.length === 0 && (
        <div className="text-sm opacity-80">
          No hay combinaciones disponibles para esa fecha.
          <div className="mt-3 flex justify-center">
            <button className="btn btn-secondary" onClick={onBack}>Atrás</button>
          </div>
          {diag && (
            <div className="mt-3 rounded-lg border p-2 text-xs">
              <div className="font-semibold mb-1">Diagnóstico</div>
              {diag.map((d, i) => (
                <div key={i} className="mb-1">
                  <span className="font-medium">{d.dest}:</span>{" "}
                  {typeof d.count === "number" ? (
                    <span>{d.count} opciones</span>
                  ) : d.error ? (
                    <span className="text-red-600">{d.error}</span>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !error && options.map((opt) => (
        <Card
          key={opt.id}
          selected={opt.id === selectedId}
          onClick={() => setSelectedId(opt.id)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-xs uppercase tracking-wide opacity-70">{opt.cabin}</div>
            <div className="text-base font-semibold">
              {opt.delta_vs_base_eur === 0 ? "+0 €" : `+${opt.delta_vs_base_eur} €`}
            </div>
          </div>

          {/* IDA / ESCALA / VUELTA en horizontal (desktop) */}
          <TripRow label="IDA" segs={opt.out} />
          <div className="my-3 h-px bg-gray-200" />
          <TripRow label="VUELTA" segs={opt.ret} />
        </Card>
      ))}

      {!loading && !error && options.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-between">
          <button className="btn btn-secondary" onClick={onBack}>Atrás</button>
          <button
            className="btn btn-primary"
            disabled={!selectedOpt}
            onClick={() => selectedOpt && onConfirm(selectedOpt.id, selectedOpt)}
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
