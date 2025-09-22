"use client";
import React, { useMemo, useState, useEffect } from "react";
import { formatDateES } from "@/lib/format";
import { airlineName } from "@/lib/airlines";
import type { FlightOption } from "./FlightsList";

export default function SummaryPanel({
  openMobile = false,
  onToggleMobile,
  origin,
  pax,
  dates,
  selected,
  lux,
  singleRooms,
  insurance,
  baseFarePerPerson, // pásame el base según temporada
}: {
  openMobile?: boolean;
  onToggleMobile?: (open: boolean) => void;
  origin: string;
  pax: number;
  dates: { dep: string; ret: string } | null;
  selected: FlightOption | null;
  lux: boolean;
  singleRooms: number;
  insurance: boolean;
  baseFarePerPerson: number;
}) {
  const safeSingles = useMemo(() => {
    // regla: no puede quedar 1 persona “suelta”
    if (singleRooms === 0) return 0;
    if (singleRooms >= pax) return pax;
    // si el número de personas es par, 2,4,6... se puede tener singles en par sin problema
    // si es impar, ajustamos: 1 single -> 1 (los otros forman dobles); 3 singles de 5 -> 5, etc.
    const parityIssue = (pax - singleRooms) === 1; // quedaría 1 suelto
    return parityIssue ? singleRooms + 1 : singleRooms;
  }, [singleRooms, pax]);

  // costes
  const hotelPlus = lux ? 400 * pax : 0;
  const singlesPlus = 280 * safeSingles;
  const insurancePlus = insurance ? 100 * pax : 0;

  // vuelo (por persona) viene en selected?.total_amount_per_person
  const perPerson = Math.round(
    baseFarePerPerson + (selected ? selected.total_amount_per_person : 0) + (lux ? 400 : 0) + (insurance ? 100 : 0)
  );

  const total = perPerson * pax + singlesPlus;

  // escalas resumen
  const scaleOut = selected && selected.out.length > 1 ? selected.out.slice(0, -1).map(s => s.destination).join(" · ") : "—";
  const scaleRet = selected && selected.ret.length > 1 ? selected.ret.slice(0, -1).map(s => s.destination).join(" · ") : "—";

  // móvil: cajón inferior
  const [open, setOpen] = useState(openMobile);
  useEffect(() => setOpen(openMobile), [openMobile]);
  const toggle = () => {
    const v = !open;
    setOpen(v);
    onToggleMobile && onToggleMobile(v);
  };

  const content = (
    <div className="text-sm space-y-2">
      <div className="font-semibold">Corea del Sur Esencial · 10 días</div>

      <div>Personas: <strong>{pax}</strong></div>
      <div>Origen: <strong>{origin}</strong></div>

      <div className="mt-2">
        <div className="font-medium text-xs opacity-70">Viaje de ida</div>
        {selected ? (
          <>
            <div>
              {selected.out[0].origin} ({hh(selected.out[0].departure)}) – {selected.out[selected.out.length - 1].destination} ({hh(selected.out[selected.out.length - 1].arrival)})
            </div>
            <div className="text-xs opacity-70">Escalas: {scaleOut}</div>
            <div className="text-xs opacity-70">
              {formatDateES(dates?.dep || "")}
            </div>
          </>
        ) : (
          <div className="opacity-50">—</div>
        )}
      </div>

      <div>
        <div className="font-medium text-xs opacity-70">Viaje de vuelta</div>
        {selected ? (
          <>
            <div>
              {selected.ret[0].origin} ({hh(selected.ret[0].departure)}) – {selected.ret[selected.ret.length - 1].destination} ({hh(selected.ret[selected.ret.length - 1].arrival)})
            </div>
            <div className="text-xs opacity-70">Escalas: {scaleRet}</div>
            <div className="text-xs opacity-70">
              {formatDateES(dates?.ret || "")}
            </div>
          </>
        ) : (
          <div className="opacity-50">—</div>
        )}
      </div>

      <div className="mt-2">
        <div>Alojamiento: <strong>{lux ? "Luxury (+400€/persona)" : "Standard (incluido)"}</strong></div>
        <div>Individuales: <strong>{safeSingles}</strong>{safeSingles>0 && <span> · +{safeSingles * 280}€</span>}</div>
        <div>Seguro: <strong>{insurance ? "Ampliado (+100€/persona)" : "Básico (incluido)"}</strong></div>
      </div>

      <div className="pt-2 border-t">
        <div className="font-medium">Precio por persona: <strong>{perPerson} €</strong></div>
        <div className="font-semibold">Total: <strong>{total} €</strong></div>
      </div>

      <div className="pt-2 border-t">
        <div>Hoy pagas (60%): <strong>{Math.round(total * 0.6)} €</strong></div>
        <div>Último pago (40%): <strong>{Math.round(total * 0.4)} €</strong></div>
      </div>
    </div>
  );

  return (
    <>
      {/* Escritorio: panel lateral */}
      <div className="hidden lg:block sticky top-4 p-3 rounded-lg border border-gray-200 bg-white">
        {content}
        <button className="btn btn-primary w-full mt-3">Reservar</button>
      </div>

      {/* Móvil: cajón inferior con pestaña */}
      <div className="lg:hidden fixed left-0 right-0 bottom-0 z-40">
        <div className="flex justify-center">
          <button
            aria-label="Abrir resumen"
            onClick={toggle}
            className="w-10 h-5 rounded-t bg-gray-300"
          />
        </div>
        <div
          className="bg-white border-t border-gray-200 p-4 transition-transform"
          style={{
            transform: open ? "translateY(0)" : "translateY(70%)",
            height: "70vh",
          }}
        >
          <div className="flex justify-center mb-2">
            <button
              aria-label="Cerrar resumen"
              onClick={toggle}
              className="w-10 h-1.5 rounded bg-gray-300"
            />
          </div>
          {content}
          <button className="btn btn-primary w-full mt-3">Reservar</button>
        </div>
      </div>
    </>
  );
}

function hh(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
