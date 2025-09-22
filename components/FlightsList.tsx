"use client";

import React, { useEffect, useMemo, useState } from "react";
import { airlineName } from "@/lib/airlines";

type SegmentInfo = {
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string;   // ISO
  duration_minutes?: number;
  marketing_carrier?: string; // IATA
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: string; // "Economy"
  total_amount_per_person: number; // por persona
  airline_codes?: string[]; // para logos si lo usas
};

type Props = {
  origin: string;
  departure: string; // ISO (prop del componente)
  ret: string;       // ISO
  pax: number;
  onBack: () => void;
  onConfirm: (id: string, opt: FlightOption) => void;
};

// ---------- Utils de formato ----------
function hhmm(iso?: string) {
  if (!iso) return "--:--";
  return iso.slice(11, 16);
}
function fmtDur(min?: number) {
  if (min === undefined || min === null) return "--";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${m} min`;
}
function diffMinutes(a: string, b: string) {
  return Math.max(
    0,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  );
}

export default function FlightsList({
  origin,
  departure,
  ret,
  pax,
  onBack,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FlightOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ---------- Loader: logos rotando uno a uno ----------
  const LOGOS: string[] = useMemo(
    () => ["QR", "KE", "OZ", "EK", "EY", "TK", "AF", "KL", "LX", "ZH", "TW", "7C", "LJ"],
    []
  );
  const [logoIdx, setLogoIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLogoIdx((i) => (i + 1) % LOGOS.length), 500);
    return () => clearInterval(t);
  }, [LOGOS.length]);

  // ---------- Fetch opciones ----------
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setOptions([]);
    setSelectedId(null);

    (async () => {
      try {
        // IMPORTANTE: la API espera 'dep', no 'departure'
        const qs = new URLSearchParams({
          origin,
          dep: departure,
          ret,
          pax: String(pax),
          limit: "20",
        });
        const res = await fetch(`/api/flight-options?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!alive) return;

        if (!res.ok) {
          setError(data?.error || data?.err || `Error ${res.status}`);
          setLoading(false);
          return;
        }

        const opts: FlightOption[] = Array.isArray(data?.options)
          ? data.options.slice(0, 20)
          : [];

        setOptions(opts);
        if (opts[0]) setSelectedId(opts[0].id); // preselecciona la +barata
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        console.error("flights fetch error", e);
        setError(e?.message || "Error");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [origin, departure, ret, pax]);

  // ---------- Barra fija inferior ----------
  const BottomBar = (
    <div className="fixed left-0 right-0 bottom-0 bg-white border-t p-3 z-40">
      <div className="max-w-5xl mx-auto flex justify-between gap-3">
        <button className="btn btn-secondary" onClick={onBack}>
          Atrás
        </button>
        <button
          className="btn btn-primary"
          disabled={!selectedId}
          onClick={() => {
            const opt = options.find((o) => o.id === selectedId);
            if (opt) onConfirm(opt.id, opt);
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  );

  // ---------- Estados de carga / error / sin resultados ----------
  if (loading) {
    const code = LOGOS[logoIdx];
    return (
      <div className="relative min-h-[40vh] flex flex-col items-center justify-center">
        {/* barra indeterminada “continua” */}
        <div className="w-64 h-2 bg-gray-200 rounded overflow-hidden mb-6">
          <div className="h-2 w-1/3 bg-gray-400 animate-pulse" />
        </div>

        {/* logo único centrado */}
        <img
          src={`/airlines/${code}.svg`}
          alt={airlineName(code)}
          style={{ height: 48, width: "auto", maxWidth: 220 }}
        />

        {BottomBar}
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
          Ha ocurrido un error cargando los vuelos: {String(error)}
        </div>
        {BottomBar}
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="relative">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          No hay combinaciones disponibles para esas fechas.
        </div>
        {BottomBar}
      </div>
    );
  }

  // ---------- Tarjeta de opción ----------
  function Card({ opt }: { opt: FlightOption }) {
    const diff = Math.round(opt.total_amount_per_person); // ya por persona
    const selected = opt.id === selectedId;

    // Render horizontal de tramos + píldoras de escala
    const renderSlice = (segs: SegmentInfo[]) => {
      if (!segs.length) return null;

      const blocks: React.ReactNode[] = [];

      // primer tramo
      const first = segs[0];
      blocks.push(
        <div key="leg0" className="min-w-[200px]">
          <div className="font-medium">
            {first.origin} {hhmm(first.departure)} → {first.destination} {hhmm(first.arrival)}
          </div>
          <div className="text-xs opacity-70 mt-0.5">
            Duración: {fmtDur(first.duration_minutes)}
          </div>
          {first.marketing_carrier ? (
            <div className="flex items-center gap-1 mt-1 text-xs">
              <img
                src={`/airlines/${first.marketing_carrier}.svg`}
                alt={airlineName(first.marketing_carrier)}
                style={{ height: 18, width: "auto", maxWidth: 120 }}
              />
              <span className="opacity-80">{airlineName(first.marketing_carrier)}</span>
            </div>
          ) : null}
        </div>
      );

      for (let i = 1; i < segs.length; i++) {
        const prev = segs[i - 1];
        const curr = segs[i];
        const lay = diffMinutes(prev.arrival, curr.departure);

        // píldora de escala con ciudad + duración
        blocks.push(
          <div
            key={`lay${i}`}
            className="px-3 py-1 rounded-full bg-[#91c5c5]/20 text-xs font-medium self-center"
          >
            {`1 escala en ${prev.destination} – ${fmtDur(lay)}`}
          </div>
        );

        // tramo siguiente
        blocks.push(
          <div key={`leg${i}`} className="min-w-[200px]">
            <div className="font-medium">
              {curr.origin} {hhmm(curr.departure)} → {curr.destination} {hhmm(curr.arrival)}
            </div>
            <div className="text-xs opacity-70 mt-0.5">
              Duración: {fmtDur(curr.duration_minutes)}
            </div>
            {curr.marketing_carrier ? (
              <div className="flex items-center gap-1 mt-1 text-xs">
                <img
                  src={`/airlines/${curr.marketing_carrier}.svg`}
                  alt={airlineName(curr.marketing_carrier)}
                  style={{ height: 18, width: "auto", maxWidth: 120 }}
                />
                <span className="opacity-80">{airlineName(curr.marketing_carrier)}</span>
              </div>
            ) : null}
          </div>
        );
      }

      return <div className="flex flex-wrap items-start gap-3">{blocks}</div>;
    };

    return (
      <label
        className={`block rounded-2xl border p-4 bg-white transition-shadow cursor-pointer ${
          selected ? "border-black shadow-md" : "border-gray-200"
        }`}
        onClick={() => setSelectedId(opt.id)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-xs mb-2">
              {opt.baggage_included ? "Maleta incluida" : "Sin maleta"} · {opt.cabin}
            </div>

            <div className="text-sm font-semibold mb-1">IDA</div>
            {renderSlice(opt.out)}

            <div className="text-sm font-semibold mt-4 mb-1">VUELTA</div>
            {renderSlice(opt.ret)}
          </div>

          <div className="text-right whitespace-nowrap">
            <div className="text-lg font-bold">{diff === 0 ? "+0€" : `+${diff}€`}</div>
            <div className="mt-2">
              <input
                type="radio"
                name="opt"
                checked={selected}
                onChange={() => setSelectedId(opt.id)}
              />
            </div>
          </div>
        </div>
      </label>
    );
  }

  // ---------- Render ----------
  return (
    <div className="pb-20">
      <div className="grid gap-3">
        {options.map((o) => (
          <Card key={o.id} opt={o} />
        ))}
      </div>

      {/* separador por la barra fija */}
      <div className="h-16" />

      {/* barra fija inferior */}
      {BottomBar}
    </div>
  );
}
