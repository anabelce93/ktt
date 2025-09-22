// components/SummaryPanel.tsx
"use client";

import React from "react";

// Utilidades simples
function formatMoneyEUR(n: number) {
  // sin puntos ni comas, entero
  return `${Math.round(n)}€`;
}
function formatDateES(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

// Tipos locales (relajados para no chocar con otros)
type FlightSegment = {
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string;   // ISO
};
type FlightSlice = {
  segments: FlightSegment[];
};
type FlightOptionLoose = {
  id: string;
  // cualquiera de estos nombres puede existir según la versión
  total_amount_per_person?: number;
  pricePerPerson?: number;
  per_person?: number;
  // para el resumen básico
  out?: FlightSegment[]; // ida
  ret?: FlightSegment[]; // vuelta
  // o bien slices
  slices?: FlightSlice[];
  // nombre de aerolínea, etc. (no imprescindible aquí)
  [key: string]: any;
};

type Props = {
  // control “cajón” móvil (bottom sheet)
  openMobile?: boolean;
  onToggleMobile?: (v: boolean) => void;

  // datos del flujo
  origin: string;
  pax: number;
  dates: { dep: string; ret: string } | null;
  selected: FlightOptionLoose | null;
  lux: boolean;
  singleRooms: number;          // ¡coincide con Widget!
  insurance: boolean;
  baseFarePerPerson: number;    // tarifa base por persona (según temporada)
};

export default function SummaryPanel({
  openMobile,
  onToggleMobile,
  origin,
  pax,
  dates,
  selected,
  lux,
  singleRooms,
  insurance,
  baseFarePerPerson,
}: Props) {
  // 1) Reglas de habitaciones individuales:
  // - Si (pax - singleRooms) === 1 -> cobramos todos en individual (no puede quedar 1 “suelt@”)
  // - En el resto de casos, respetamos singleRooms tal cual (así cubrimos tus ejemplos: 2->1 => 2; 6->5 => 6; 4->2 => 2).
  const billedSingles =
    pax - singleRooms === 1 ? pax : Math.max(0, Math.min(singleRooms, pax));
  const singlesPlus = billedSingles * 280;

  // 2) Suplementos por persona (luxury y seguro)
  const plusPerPerson = (lux ? 400 : 0) + (insurance ? 100 : 0);

  // 3) Precio de vuelo por persona (según lo que traiga la opción)
  const flightPerPerson =
    (selected?.total_amount_per_person ??
      selected?.pricePerPerson ??
      selected?.per_person ??
      0) | 0; // fuerza entero si viniese float

  // 4) Total por persona
  const perPerson = baseFarePerPerson + plusPerPerson + flightPerPerson;

  // 5) Totales
  const total = perPerson * pax + singlesPlus;
  const payNow = Math.round(total * 0.6);
  const payLater = total - payNow;

  // 6) Extraer ida/vuelta para el texto del resumen (inicio/fin de cada trayecto)
  function firstLast(seg?: FlightSegment[]) {
    if (!seg || seg.length === 0) return { from: "-", to: "-", dep: "", arr: "" };
    const first = seg[0];
    const last = seg[seg.length - 1];
    return { from: first.origin, to: last.destination, dep: first.departure, arr: last.arrival };
    // Nota: si usas slices en lugar de out/ret, podemos mapear de forma similar desde selected.slices[0/1].segments
  }

  let outSegs: FlightSegment[] | undefined = selected?.out;
  let retSegs: FlightSegment[] | undefined = selected?.ret;

  // fallback si sólo vienen slices
  if ((!outSegs || !retSegs) && selected?.slices && selected.slices.length >= 2) {
    outSegs = selected.slices[0]?.segments as any;
    retSegs = selected.slices[1]?.segments as any;
  }

  const ida = firstLast(outSegs);
  const vuelta = firstLast(retSegs);

  // Contenido del panel
  const content = (
    <div className="text-sm">
      <div className="font-semibold mb-1">Corea del Sur Esencial · 10 días</div>

      <div className="opacity-70 mb-2">Resumen</div>

      <div className="space-y-1 mb-3">
        <div>Personas: <strong>{pax}</strong></div>

        <div className="mt-2 font-medium">Viaje de ida</div>
        <div>{ida.from} – {ida.to}</div>
        <div>{formatDateES(ida.dep)} · {ida.dep ? ida.dep.slice(11, 16) : "--"} — {ida.arr ? ida.arr.slice(11, 16) : "--"}</div>

        <div className="mt-2 font-medium">Viaje de vuelta</div>
        <div>{vuelta.from} – {vuelta.to}</div>
        <div>{formatDateES(vuelta.dep)} · {vuelta.dep ? vuelta.dep.slice(11, 16) : "--"} — {vuelta.arr ? vuelta.arr.slice(11, 16) : "--"}</div>

        <div className="mt-2 font-medium">Alojamiento</div>
        <div>{lux ? "Luxury (+400 €/persona)" : "Estándar (incluido)"}</div>

        <div className="mt-2 font-medium">Habitaciones individuales</div>
        <div>
          Solicitadas: {singleRooms} · Facturadas: {billedSingles} × 280€
        </div>

        <div className="mt-2 font-medium">Seguro</div>
        <div>{insurance ? "Ampliado (+100 €/persona)" : "Básico (incluido)"}</div>
      </div>

      <div className="border-t pt-3 space-y-1">
        <div>Precio por persona: <strong>{formatMoneyEUR(perPerson)}</strong></div>
        <div>Total: <strong>{formatMoneyEUR(total)}</strong></div>
        <div className="mt-2">Hoy pagas (60%): <strong>{formatMoneyEUR(payNow)}</strong></div>
        <div>Último pago (40%): <strong>{formatMoneyEUR(payLater)}</strong></div>
      </div>
    </div>
  );

  // Versión escritorio: panel fijo a la derecha (padre decide layout). Versión móvil: cajón deslizante.
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block sticky top-4 border rounded-2xl p-4 bg-white shadow-sm">
        {content}
      </div>

      {/* Móvil: bottom sheet con pestañita */}
      <div className="md:hidden">
        <button
          className="fixed bottom-0 left-0 right-0 mx-auto w-full bg-white/90 backdrop-blur border-t p-3 flex items-center justify-between"
          style={{ maxWidth: 640 }}
          onClick={() => onToggleMobile?.(!openMobile)}
          aria-label={openMobile ? "Cerrar resumen" : "Abrir resumen"}
        >
          <span className="font-medium">Resumen</span>
          <span className="text-xs opacity-70">
            {formatMoneyEUR(total)} · {pax} pax
          </span>
        </button>

        <div
          className={`fixed left-1/2 -translate-x-1/2 w-full bg-white rounded-t-2xl shadow-lg border-t transition-transform duration-300 ${
            openMobile ? "translate-y-0" : "translate-y-[78%]"
          }`}
          style={{ bottom: 0, maxWidth: 640 }}
        >
          <div className="p-4">
            <div className="flex justify-center mb-2">
              <div
                className="h-1.5 w-14 rounded-full bg-gray-300"
                onClick={() => onToggleMobile?.(!openMobile)}
              />
            </div>
            {content}
          </div>
        </div>
      </div>
    </>
  );
}
