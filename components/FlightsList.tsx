"use client";
import React, { useEffect, useMemo, useState } from "react";
import { airlineName } from "@/lib/airlines";
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

const AIRLINE_LOGOS = [
  { code: "QR", name: "Qatar Airways" },
  { code: "TK", name: "Turkish Airlines" },
  { code: "KE", name: "Korean Air" },
  { code: "OZ", name: "Asiana" },
  { code: "AF", name: "Air France" },
  { code: "KL", name: "KLM" },
  { code: "LH", name: "Lufthansa" },
  { code: "IB", name: "Iberia" },
  { code: "UX", name: "Air Europa" },
  { code: "BA", name: "British Airways" },
];

function extractOptions(j: any): Option[] {
  if (j && Array.isArray(j.options)) return j.options as Option[];
  if (j && j.data && Array.isArray(j.data.options)) return j.data.options as Option[];
  if (Array.isArray(j)) return j as Option[];
  return [];
}

// Loader con barra y “logos” (texto + chip)
function FancyLoader() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % AIRLINE_LOGOS.length), 500);
    return () => clearInterval(t);
  }, []);
  const pct = useMemo(() => ((idx + 1) / AIRLINE_LOGOS.length) * 100, [idx]);
  const current = AIRLINE_LOGOS[idx];

  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-medium mb-2">Buscando las mejores ofertas…</div>
      <div className="w-full h-2 bg-gray-100 rounded overflow-hidden mb-3">
        <div
          className="h-2 bg-[#bdcbcd] transition-all"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {AIRLINE_LOGOS.map((a, i) => (
          <div
            key={a.code}
            className={`px-2 py-1 rounded-full border ${i === idx ? "bg-[#f8fafa] border-[#91c5c5] text-[#2b3d3d]" : "opacity-60"}`}
          >
            {a.name} ({a.code})
          </div>
        ))}
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

  const TripBlock: React.FC<{ label: string; segs: SegmentInfo[] }> = ({ label, segs }) => {
    const s0 = segs[0];
    const s1 = segs[1];
    const conn = s0?.connection_minutes ?? null;
    const airline = airlineName(s0?.marketing_carrier);

    return (
      <div>
        <div className="text-xs font-semibold mb-1">{label}</div>
        {s1 ? (
          <>
            <Leg s={s0} />
            {conn != null && (
              <div className="my-2">
                <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-[#91c5c5] bg-[#e8f4f4]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#91c5c5]" />
                  1 escala en <strong>{s0.destination}</strong> · {formatDuration(conn)}
                </span>
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

      {loading && <FancyLoader />}

      {error && <div className="text-sm text-red-600">Error al cargar opciones: {error}</div>}

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
          {/* Cabecera: delta y extras */}
          <div className="flex items-start justify-between mb-3">
            <div className="text-xs uppercase tracking-wide opacity-70">{opt.cabin}</div>
            <div className="text-base font-semibold">
              {opt.delta_vs_base_eur === 0 ? "+0 €" : `+${opt.delta_vs_base_eur} €`}
            </div>
          </div>

          {/* Cuerpo: vertical IDA / VUELTA */}
          <div className="space-y-4">
            <TripBlock label="IDA" segs={opt.out} />
            <div className="h-px bg-gray-200" />
            <TripBlock label="VUELTA" segs={opt.ret} />
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs opacity-70">
              {opt.baggage_included ? "Maleta incluida · " : ""}Cabina: {opt.cabin}
            </div>
            <button className="btn btn-primary" onClick={() => onSelect(opt.id)}>
              Elegir vuelo
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
