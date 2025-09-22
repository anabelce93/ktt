"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  // diferencia sobre la más barata en el calendario (por persona)
  total_amount_per_person: number;
  airline_codes?: string[]; // para logos
};

type Props = {
  origin: string;
  departure: string;
  ret: string;
  pax: number;
  onBack: () => void;
  onConfirm: (id: string, opt: FlightOption) => void; // Continuar
};

function hhmm(iso?: string) {
  if (!iso) return "--:--";
  return iso.slice(11, 16);
}
function fmtDur(min?: number) {
  if (!min && min !== 0) return "--";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${m} min`;
}
function diffMinutes(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
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

  // loader ciclando logos
  const LOGOS: string[] = useMemo(
    () => ["QR", "KE", "OZ", "EK", "EY", "TK", "AF", "KL", "LX", "ZH", "TW", "7C", "LJ"],
    []
  );
  const [logoIdx, setLogoIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLogoIdx((i) => (i + 1) % LOGOS.length), 450);
    return () => clearInterval(t);
  }, [LOGOS.length]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setOptions([]);
    setSelectedId(null);

    (async () => {
      try {
        const qs = new URLSearchParams({
          origin,
          departure,
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
          setError(data?.err || `Error ${res.status}`);
          setLoading(false);
          return;
        }

        const opts: FlightOption[] = (data?.options || []).slice(0, 20);
        setOptions(opts);
        if (opts[0]) setSelectedId(opts[0].id); // preseleccionamos la +barata (borde destacado)
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

  // barra fija abajo
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

  if (loading) {
    const code = LOGOS[logoIdx];
    return (
      <div className="relative min-h-[40vh] flex flex-col items-center justify-center">
        {/* barra indeterminada */}
        <div className="w-64 h-2 bg-gray-200 rounded overflow-hidden mb-4">
          <div className="h-2 w-1/3 bg-gray-500 animate-pulse" />
        </div>

        {/* logo grande centrado */}
        <div className="flex items-center gap-3">
          <img
            src={`/airlines/${code}.svg`}
            alt={airlineName(code)}
            style={{ height: 40, width: "auto", maxWidth: 200 }}
          />
        </div>

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

  // tarjeta de una opción
  function Card({ opt, idx }: { opt: FlightOption; idx: number }) {
    const diff = Math.round(opt.total_amount_per_person); // ya viene por persona
    const selected = opt.id === selectedId;

    // construir “píldoras” de escalas y duraciones
    function renderSlice(segs: SegmentInfo[]) {
      if (!segs.length) return null;
      const first = segs[0];
      const last = segs[segs.length - 1];

      const blocks: React.ReactNode[] = [];

      // primer tramo
      const d1 = segs[0];
      blocks.push(
        <div key="leg0" className="min-w-[180px]">
          <div className="font-medium">
            {d1.origin} {hhmm(d1.departure)} → {d1.destination} {hhmm(d1.arrival)}
          </div>
          <div className="text-xs opacity-70 mt-0.5">
            Duración: {fmtDur(d1.duration_minutes)}
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            {d1.marketing_carrier ? (
              <>
                <img
                  src={`/airlines/${d1.marketing_carrier}.svg`}
                  alt={airlineName(d1.marketing_carrier)}
                  style={{ height: 18, width: "auto", maxWidth: 120 }}
                />
                <span className="opacity-80">{airlineName(d1.marketing_carrier)}</span>
              </>
            ) : null}
          </div>
        </div>
      );

      // si hay escala(s)
      for (let i = 1; i < segs.length; i++) {
        const prev = segs[i - 1];
        const curr = segs[i];
        const lay = diffMinutes(prev.arrival, curr.departure);

        // píldora escala
        blocks.push(
          <div
            key={`lay${i}`}
            className="px-3 py-1 rounded-full bg-[#91c5c5]/20 text-xs font-medium self-center"
          >
            {`1 escala en ${prev.destination} - ${fmtDur(lay)}`}
          </div>
        );

        // siguiente tramo
        blocks.push(
          <div key={`leg${i}`} className="min-w-[180px]">
            <div className="font-medium">
              {curr.origin} {hhmm(curr.departure)} → {curr.destination} {hhmm(curr.arrival)}
            </div>
            <div className="text-xs opacity-70 mt-0.5">
              Duración: {fmtDur(curr.duration_minutes)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {curr.marketing_carrier ? (
                <>
                  <img
                    src={`/airlines/${curr.marketing_carrier}.svg`}
                    alt={airlineName(curr.marketing_carrier)}
                    style={{ height: 18, width: "auto", maxWidth: 120 }}
                  />
                  <span className="opacity-80">
                    {airlineName(curr.marketing_carrier)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-wrap items-start gap-3">
          {blocks}
        </div>
      );
    }

    return (
      <label
        className={`block rounded-2xl border p-4 bg-white transition-shadow cursor-pointer ${
          selected ? "border-black shadow-md" : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-xs mb-2">
              {opt.baggage_included ? "Maleta incluida" : "Sin maleta"} · {opt.cabin}
            </div>

            {/* IDA */}
            <div className="text-sm font-semibold mb-1">IDA</div>
            {renderSlice(opt.out)}

            {/* VUELTA */}
            <div className="text-sm font-semibold mt-4 mb-1">VUELTA</div>
            {renderSlice(opt.ret)}
          </div>

          {/* +Δ€ */}
          <div className="text-right whitespace-nowrap">
            <div className="text-lg font-bold">
              {diff === 0 ? "+0€" : `+${diff}€`}
            </div>
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

  return (
    <div className="pb-20">
      <div className="grid gap-3">
        {options.map((o, i) => (
          <Card key={o.id} opt={o} idx={i} />
        ))}
      </div>
      {/* barra fija */}
      <div className="h-16" />
      {/* render real */}
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
    </div>
  );
}
