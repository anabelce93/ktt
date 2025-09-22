"use client";
import React, { useMemo } from "react";
import { airlineName } from "@/lib/airlines";
import { formatDateES, hhmm } from "@/lib/format";

type SegmentInfo = {
  origin: string;
  departure: string;
  destination: string;
  arrival: string;
  marketing_carrier: string;
};

export type FlightOption = {
  id: string;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  baggage_included: boolean;
  cabin: "Economy";
  total_amount_per_person: number; // <-- nos aseguramos de tenerlo aquí
};

export default function SummaryPanel({
  pax,
  origin,
  dates,
  selected,
  lux,
  singles,
  insurance,
}: {
  pax: number;
  origin: string;
  dates: { dep: string; ret: string } | null;
  selected: FlightOption | null;
  lux: boolean;
  singles: number;
  insurance: boolean;
}) {
  // Base por persona (según tu lógica ya existente en otro lugar):
  const baseFarePerPerson = useMemo(() => {
    // aquí normalmente vendría del helper de tarifas (alta/normal)
    // si ya lo calculas fuera, pásalo como prop; esto es placeholder:
    return 1200;
  }, []);

  // habitaciones individuales: regla de “no dejar 1 suelto”
  const singlesNormalized = useMemo(() => {
    if (singles === 0) return 0;
    if (pax === 1) return 1;
    if (singles % 2 === 1) return singles + 1; // si impar, subimos uno
    return singles;
  }, [singles, pax]);

  const singlesPlus = singlesNormalized * 280;

  // total por persona
  const perPerson = Math.round(
    baseFarePerPerson +
      (selected?.total_amount_per_person ?? 0) +
      (lux ? 400 : 0) +
      (insurance ? 100 : 0)
  );
  const total = perPerson * pax + singlesPlus;

  // 60/40 split
  const payNow = Math.round(total * 0.6);
  const payLater = total - payNow;

  const outFirst = selected?.out?.[0];
  const outLast = selected?.out?.[selected.out.length - 1 || 0];
  const retFirst = selected?.ret?.[0];
  const retLast = selected?.ret?.[selected.ret.length - 1 || 0];

  return (
    <aside className="w-full md:w-80 md:sticky md:top-4 bg-white border border-gray-200 rounded-xl p-4">
      <div className="font-semibold mb-1">Corea del Sur Esencial 10 días</div>
      <div className="text-xs opacity-70 mb-3">Resumen</div>

      <div className="space-y-2 text-sm">
        <div>
          <strong>{pax}</strong> persona{pax > 1 ? "s" : ""}
        </div>

        {selected && (
          <>
            <div className="mt-2">
              <div className="font-semibold text-xs opacity-70">Viaje de ida</div>
              <div>
                {outFirst?.origin} ({}) – {outLast?.destination} ({})
              </div>
              <div className="text-xs opacity-70">
                {formatDateES(outFirst?.departure || dates?.dep || "")} ·{" "}
                {hhmm(outFirst?.departure || "")} – {hhmm(outLast?.arrival || "")}
              </div>
            </div>

            <div className="mt-2">
              <div className="font-semibold text-xs opacity-70">Viaje de vuelta</div>
              <div>
                {retFirst?.origin} ({}) – {retLast?.destination} ({})
              </div>
              <div className="text-xs opacity-70">
                {formatDateES(retFirst?.departure || dates?.ret || "")} ·{" "}
                {hhmm(retFirst?.departure || "")} – {hhmm(retLast?.arrival || "")}
              </div>
            </div>
          </>
        )}

        <div className="mt-2">
          <div className="font-semibold text-xs opacity-70">Alojamiento</div>
          <div>{lux ? "Luxury (+400 €/persona)" : "Standard (incluido)"}</div>
        </div>

        <div className="mt-2">
          <div className="font-semibold text-xs opacity-70">Seguro</div>
          <div>{insurance ? "Ampliado (+100 €/persona)" : "Básico (incluido)"}</div>
        </div>

        {singlesNormalized > 0 && (
          <div className="mt-2">
            <div className="font-semibold text-xs opacity-70">Habitaciones individuales</div>
            <div>
              {singlesNormalized} × 280 € = {singlesPlus} €
            </div>
          </div>
        )}

        <hr className="my-3" />

        <div className="flex items-center justify-between">
          <div className="opacity-70">Precio por persona</div>
          <div className="font-semibold">{perPerson} €</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="opacity-70">Total</div>
          <div className="font-semibold">{total} €</div>
        </div>

        <hr className="my-3" />

        <div className="flex items-center justify-between">
          <div className="opacity-70">Hoy pagas (60%)</div>
          <div className="font-semibold">{payNow} €</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="opacity-70">Último pago (40%)</div>
          <div className="font-semibold">{payLater} €</div>
        </div>
      </div>
    </aside>
  );
}
