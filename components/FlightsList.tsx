"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { airlineName, AirlineLogo, AIRLINE_LIST_FOR_LOADER } from "@/lib/airlines";
import { formatDuration, hhmm } from "@/lib/format";

type SegmentInfo = {
  marketing_carrier: string;
  origin: string;
  destination: string;
  departure: string;        // ISO
  arrival: string;          // ISO
  duration_minutes: number; // duración del segmento
  stops?: number;                 // 0 o 1
  connection_airport?: string;    // IATA
  connection_minutes?: number;    // minutos de conexión
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

/** Loader con:
 *  - Una aerolínea visible a la vez (rota)
 *  - Barra que progresa 0→100% una sola vez. Llega a ~90% y espera a datos para completar.
 */
function FancyLoaderOneByOne({
  done,
}: {
  done: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Rota aerolíneas una a una
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % AIRLINE_LIST_FOR_LOADER.length);
    }, 450);
    return () => clearInterval(t);
  }, []);

  // Progreso suave 0→~90, y al terminar datos, 100
  useEffect(() => {
    let mounted = true;
    const targetWhileLoading = 90; // % máximo antes de datos
    const tick = () => {
      setProgress((p) => {
        const target = done ? 100 : targetWhileLoading;
        const speed = done ? 6 : 1.2; // acelera al cierre
        const next = p + speed;
        return Math.min(next, target);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [done]);

  const current = AIRLINE_LIST_FOR_LOADER[idx];

  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-medium mb-2">Buscando las mejores ofertas…</div>
      <div className="w-full h-2 bg-gray-100 rounded overflow-hidden mb-3">
        <div
          className="h-2 transition-all"
          style={{
            width: `${progress}%`,
            backgroundColor: "#bdcbcd",
          }}
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
  onSelect: (id: string) => void;
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
        // eslint-disable-next-line no-console
        console.log("flight-options payload (count)", arr.length, j);
      })
      .catch((e) => {
        setError(String(e));
        // eslint-disable-next-line no-console
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
          {/* Tramo 1 */}
          <LegBlock s={s0} />
          {/* Conexión (solo si hay 2 segmentos) */}
          {s1 ? <ConnectionChip airport={s0?.destination} minutes={conn ?? undefined} /> : null}
          {/* Tramo 2 */}
          {s1 ? <LegBlock s={s1} /> : null}
        </div>
      </div>
    );
  };

  // Botón color #91c5c5 custom
  const SelectButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
    <button
      {...props}
      className={`px-3 py-2 rounded-xl text-sm font-semibold transition
        focus:outline-none focus:ring-2 focus:ring-offset-2`}
      style={{
        backgroundColor: "#91c5c5",
        color: "#0b2b2b",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#7bb2b2";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#91c5c5";
      }}
    />
  );

  return (
    <div>
      <div className="flex justify-between mb-3">
        <div className="text-sm opacity-70">
          Origen <strong>{origin}</strong> · {departure} → {ret} · {pax} pax
        </div>
        <button className="btn btn-secondary" onClick={onBack}>Cambiar fecha</button>
      </div>

      {/* Loader una sola pasada */}
      {loading && <FancyLoaderOneByOne done={!loading} />}

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
          {/* Cabecera */}
          <div className="flex items-start justify-between mb-3">
            <div className="text-xs uppercase tracking-wide opacity-70">{opt.cabin}</div>
            <div className="text-base font-semibold">
              {opt.delta_vs_base_eur === 0 ? "+0 €" : `+${opt.delta_vs_base_eur} €`}
            </div>
          </div>

          {/* IDA (fila) */}
          <TripRow label="IDA" segs={opt.out} />
          <div className="my-3 h-px bg-gray-200" />
          {/* VUELTA (fila) */}
          <TripRow label="VUELTA" segs={opt.ret} />

          {/* Pie */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs opacity-70">
              {opt.baggage_included ? "Maleta incluida · " : ""}Cabina: {opt.cabin}
            </div>
            <SelectButton onClick={() => onSelect(opt.id)}>
              Seleccionar
            </SelectButton>
          </div>
        </div>
      ))}
    </div>
  );
}
