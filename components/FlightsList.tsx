"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { airlineName, AirlineLogo, AIRLINE_LIST_FOR_LOADER } from "@/lib/airlines";
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

type DiagItem = { dest: string; count?: number; error?: string };

function extractOptions(j: any): Option[] {
  if (j && Array.isArray(j.options)) return j.options as Option[];
  if (j && j.data && Array.isArray(j.data.options)) return j.data.options as Option[];
  if (Array.isArray(j)) return j as Option[];
  return [];
}

/** Loader cíclico:
 *  - Muestra una aerolínea a la vez, rotando.
 *  - Barra que sube 0→100 y reinicia mientras no llegan datos.
 */
function FancyLoaderLoop() {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % AIRLINE_LIST_FOR_LOADER.length);
    }, 450);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const tick = () => {
      setProgress((p) => {
        const next = p + 2;
        return next >= 100 ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const current = AIRLINE_LIST_FOR_LOADER[idx];

  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-medium mb-2">Buscando las mejores ofertas…</div>
      <div className="w-full h-2 bg-gray-100 rounded overflow-hidden mb-3">
        <div
          className="h-2 transition-all"
          style={{ width: `${progress}%`, backgroundColor: "#bdcbcd" }}
          aria-hidden
        />
      </div>

      <div className="flex items-center gap-3 text-sm">
        <AirlineLogo code={current.code} size={22} />
        <div className="font-medium">{current.name}</div>
        <div className="text-xs opacity-60">({current.code})</div>
      </div>
    </div>
  );
}

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
  onSelect: (id: string, opt: any) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<DiagItem[] | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOptions([]);
    setDiag(null);

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
        console.log("flight-options payload (count)", arr.length, j);
      })
      .catch((e) => {
        setError(String(e));
        console.error("flight-options error", e);
      })
      .finally(() => setLoading(false));
  }, [origin, departure, ret, pax]);

  const LegBlock: React.FC<{ s?: SegmentInfo }> = ({ s }) => {
    if (!s) return null;
    return (
      <div className="min-w-[200px]">
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
    const s1 = segs[1];
    const conn = s0?.connection_minutes ?? null;

    return (
      <div>
        <div className="text-xs font-semibold mb-1">{label}</div>
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <LegBlock s={s0} />
          {s1 ? <ConnectionChip airport={s0?.destination} minutes={conn ?? undefined} /> : null}
          {s1 ? <LegBlock s={s1} /> : null}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between mb-3">
        <div className="text-sm opacity-70">
          Origen <strong>{origin}</strong> · {departure} → {ret} · {pax} pax
        </div>
        <button className="btn btn-secondary" onClick={onBack}>Atrás</button>
      </div>

      {loading && <FancyLoaderLoop />}

      {error && <div className="text-sm text-red-600 mt-3">Error al cargar opciones: {error}</div>}

      {!loading && !error && (
        <div className="text-xs opacity-70 mb-2">Opciones encontradas: {options.length}</div>
      )}

      {!loading && !error && options.length === 0 && (
        <div className="text-sm opacity-80">
          No hay combinaciones disponibles para esa fecha.
          {diag && (
            <div className="mt-2 rounded-lg border p-2 text-xs">
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
        <div key={opt.id} className="border rounded-2xl p-4 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="text-xs uppercase tracking-wide opacity-70">{opt.cabin}</div>
            <div className="text-base font-semibold">
              {opt.delta_vs_base_eur === 0 ? "+0 €" : `+${opt.delta_vs_base_eur} €`}
            </div>
          </div>

          <TripRow label="IDA" segs={opt.out} />
          <div className="my-3 h-px bg-gray-200" />
          <TripRow label="VUELTA" segs={opt.ret} />

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs opacity-70">
              {opt.baggage_included ? "Maleta incluida · " : ""}Cabina: {opt.cabin}
            </div>
            <button className="btn btn-primary" onClick={() => onSelect(opt.id, opt)}
              Seleccionar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
