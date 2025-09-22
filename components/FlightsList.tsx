"use client";
import React, { useEffect, useMemo, useState } from "react";
import { airlineName } from "@/lib/airlines";
import { formatDuration, hhmm, minutesBetween } from "@/lib/format";

type SegmentInfo = {
  origin: string;
  departure: string; // ISO
  destination: string;
  arrival: string;   // ISO
  marketing_carrier: string; // IATA
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: "Economy";
  total_amount_per_person: number;
  airline_codes: string[]; // para logos
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
  onConfirm: (id: string, opt: FlightOption) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<FlightOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = `/api/flight-options?origin=${encodeURIComponent(
          origin
        )}&departure=${departure}&return=${ret}&pax=${pax}&limit=20`;
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) {
          const arr = (j.options || []) as FlightOption[];
          setOptions(arr);
          if (arr.length > 0) setSelectedId(arr[0].id); // marca la más barata por defecto
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, departure, ret, pax]);

  const selectedOpt = useMemo(
    () => options.find((o) => o.id === selectedId) || null,
    [options, selectedId]
  );

  return (
    <div className="relative">
      <div className="flex justify-between mb-3">
        <div className="text-sm opacity-70">
          Origen <strong>{origin}</strong> · {departure} → {ret} · {pax} pax
        </div>
      </div>

      {loading ? (
        <div className="min-h-[260px] flex flex-col items-center justify-center gap-4">
          {/* Loader bar animada continua */}
          <div className="w-full max-w-[480px] h-2 bg-gray-200 rounded overflow-hidden">
            <div className="h-2 bg-gray-400 animate-pulse" style={{ width: "100%" }} />
          </div>

          {/* Logos girando: solo imagen, centrado y grande */}
          <RotatingLogos />
          <div className="text-sm opacity-70">Buscando las mejores opciones…</div>
        </div>
      ) : options.length === 0 ? (
        <div className="p-6 text-center text-sm">No hay vuelos disponibles con los filtros.</div>
      ) : (
        <div className="space-y-4 pb-24">
          {options.map((opt, idx) => {
            const selected = selectedId === opt.id;
            return (
              <div
                key={opt.id}
                className={`p-3 rounded-lg border ${selected ? "border-black" : "border-gray-200"} bg-white`}
              >
                {/* Top: logos + info básica */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AirlineLogoRow codes={opt.airline_codes} />
                    <div className="text-xs opacity-60">
                      Maleta incluida · {opt.cabin === "Economy" ? "Economy" : opt.cabin}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {idx === 0
                      ? "+0 €"
                      : `+${Math.round(
                          opt.total_amount_per_person - options[0].total_amount_per_person
                        )} €`}
                  </div>
                </div>

                {/* Grid horizontal: IDA | ESCALA (píldora) | VUELTA */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <LegBlock title="IDA" segs={opt.out} />
                  <ScalePill segs={opt.out} />
                  <LegBlock title="VUELTA" segs={opt.ret} />
                </div>

                {/* Botón seleccionar */}
                <div className="mt-3 flex justify-end">
                  <button
                    className={`px-3 py-2 rounded ${selected ? "bg-black text-white" : "bg-[#91c5c5] text-white"}`}
                    onClick={() => setSelectedId(opt.id)}
                  >
                    {selected ? "Seleccionado" : "Seleccionar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barra inferior fija con Atrás / Continuar */}
      <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between z-40">
        <button className="btn btn-secondary" onClick={onBack}>
          Atrás
        </button>
        <button
          className="btn btn-primary"
          disabled={!selectedOpt}
          onClick={() => selectedOpt && onConfirm(selectedOpt.id, selectedOpt)}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

/* ---- Subcomponentes de FlightsList ---- */

function AirlineLogoRow({ codes }: { codes: string[] }) {
  // muestra hasta 3 logos, un poco más grandes
  const top = codes.slice(0, 3);
  return (
    <div className="flex items-center gap-3">
      {top.map((code) => (
        <img
          key={code}
          src={`/airlines/${code}.svg`}
          alt={airlineName[code] || code}
          style={{ height: 36, width: "auto", maxWidth: 160 }}
        />
      ))}
    </div>
  );
}

function LegBlock({ title, segs }: { title: string; segs: SegmentInfo[] }) {
  if (!segs || segs.length === 0) return null;
  const first = segs[0];
  const last = segs[segs.length - 1];

  return (
    <div>
      <div className="text-xs font-semibold mb-1">{title}</div>

      {/* Primer tramo o tramo único */}
      <div className="text-sm">
        {first.origin} {hhmm(first.departure)} →{" "}
        {segs.length > 1 ? segs[0].destination : last.destination}{" "}
        {hhmm(segs.length > 1 ? segs[0].arrival : last.arrival)}
      </div>
      <div className="text-xs opacity-70 mb-1">
        Duración:{" "}
        {formatDuration(
          first.departure,
          segs.length > 1 ? segs[0].arrival : last.arrival
        )}{" "}
        · {airlineName[first.marketing_carrier] || first.marketing_carrier}
      </div>

      {/* Tramos siguientes si existen */}
      {segs.length > 1 &&
        segs.slice(1).map((s, i) => (
          <div key={i} className="mt-1">
            <div className="text-xs opacity-70">
              Conexión en {s.origin} · Espera: {formatDuration(segs[i].arrival, s.departure)}
            </div>
            <div className="text-sm">
              {s.origin} {hhmm(s.departure)} → {s.destination} {hhmm(s.arrival)}
            </div>
            <div className="text-xs opacity-70">
              Duración: {formatDuration(s.departure, s.arrival)} ·{" "}
              {airlineName[s.marketing_carrier] || s.marketing_carrier}
            </div>
          </div>
        ))}
    </div>
  );
}

/** 🔹 AHORA visible también en móvil: ya no usamos `hidden md:flex` */
function ScalePill({ segs }: { segs: SegmentInfo[] }) {
  // Si no hay escala, marcamos "Directo"
  if (!segs || segs.length < 2) {
    return (
      <div className="flex items-center justify-center">
        <span className="px-3 py-2 rounded-full bg-gray-100 text-sm">Directo</span>
      </div>
    );
  }

  const stops = segs.slice(0, -1).map((s) => s.destination);
  const stopCount = stops.length;

  // Sumar el tiempo total de espera entre tramos
  let totalLayoverMin = 0;
  for (let i = 0; i < segs.length - 1; i++) {
    totalLayoverMin += minutesBetween(segs[i].arrival, segs[i + 1].departure);
  }
  const layoverStr = minsToPretty(totalLayoverMin);

  const label =
    stopCount === 1
      ? `1 escala en ${stops[0]} – ${layoverStr}`
      : `${stopCount} escalas en ${stops.join(" · ")} – ${layoverStr}`;

  return (
    <div className="flex items-center justify-center">
      <span
        className="px-3 py-2 rounded-full text-sm"
        style={{ background: "#F0F4F4", color: "#111" }}
      >
        {label}
      </span>
    </div>
  );
}

function RotatingLogos() {
  // rota una lista fija de códigos (asegúrate de tener estos SVGs en /public/airlines/)
  const codes = ["KE", "OZ", "QR", "EK", "TK", "AY", "JL", "NH", "ET", "SU"];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % codes.length), 700);
    return () => clearInterval(t);
  }, []);
  const code = codes[idx];
  return (
    <div className="h-10 flex items-center justify-center">
      <img
        src={`/airlines/${code}.svg`}
        alt={code}
        style={{ height: 40, width: "auto", maxWidth: 180 }}
      />
    </div>
  );
}

/* Utils locales */

function minsToPretty(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
