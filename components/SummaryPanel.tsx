"use client";
import React, { useMemo, useState } from "react";
import { hhmm, formatDateES } from "@/lib/format";

type SegmentInfo = {
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string;   // ISO
};

type OptionLike = {
  id: string;
  out: SegmentInfo[];
  ret: SegmentInfo[];
  delta_vs_base_eur: number;     // +Δ€ vs opción base (por persona)
  per_person_flight?: number;    // opcional: precio vuelo por persona (si tu backend lo manda)
};

export default function SummaryPanel({
  visible,
  pax,
  option,
  lux,
  singleRooms,
  insurance,
  baseFarePerPerson,
}: {
  visible: boolean;
  pax: number;
  option: OptionLike | null;
  lux: boolean;
  singleRooms: number;
  insurance: boolean;
  baseFarePerPerson: number; // tarifa terrestre por persona según temporada/pax (ya calculada)
}) {
  const [openMobile, setOpenMobile] = useState(false);

  // cálculos
  const luxSupp = lux ? 400 : 0;       // €/persona
  const singleSuppTotal = singleRooms * 280; // € total (no por persona)
  const insSupp = insurance ? 100 : 0; // €/persona

  // Si el backend manda per_person_flight úsalo; si no, asumimos que delta_vs_base_eur ya va referido a base de vuelo
  const perPersonFlight = option?.per_person_flight || 0;
  const delta = option?.delta_vs_base_eur || 0;

  const pricePerPerson = useMemo(() => {
    // base terrestre + vuelo base (si lo tienes) + delta + suplementos por persona
    return Math.round(baseFarePerPerson + perPersonFlight + delta + luxSupp + insSupp);
  }, [baseFarePerPerson, perPersonFlight, delta, luxSupp, insSupp]);

  const total = useMemo(() => {
    return pricePerPerson * pax + singleSuppTotal;
  }, [pricePerPerson, pax, singleSuppTotal]);

  const upfront = Math.round(total * 0.6 * 100) / 100;
  const last = Math.round(total * 0.4 * 100) / 100;

  const firstOut = option?.out?.[0];
  const lastOut = option?.out?.slice(-1)[0];
  const firstRet = option?.ret?.[0];
  const lastRet = option?.ret?.slice(-1)[0];

  const content = (
    <div className="text-sm space-y-2">
      <div className="font-semibold text-base">Corea del Sur Esencial 10 días</div>
      <div className="opacity-60">Resumen</div>

      <div><strong>{pax}</strong> persona{pax === 1 ? "" : "s"}</div>

      {option && (
        <>
          <div className="mt-2 font-medium">Viaje de ida</div>
          <div>
            {firstOut?.origin} &nbsp;–&nbsp; {lastOut?.destination}
          </div>
          <div>
            {firstOut && `${formatDateES(firstOut.departure)} · ${hhmm(firstOut.departure)}`}
            {" "}–{" "}
            {lastOut && `${hhmm(lastOut.arrival)}`}
          </div>

          <div className="mt-2 font-medium">Viaje de vuelta</div>
          <div>
            {firstRet?.origin} &nbsp;–&nbsp; {lastRet?.destination}
          </div>
          <div>
            {firstRet && `${formatDateES(firstRet.departure)} · ${hhmm(firstRet.departure)}`}
            {" "}–{" "}
            {lastRet && `${hhmm(lastRet.arrival)}`}
          </div>
        </>
      )}

      <div className="mt-2 font-medium">Alojamiento</div>
      <div>{lux ? "Luxury (+400 €/persona)" : "Standard · Incluido"}</div>
      {singleRooms > 0 && <div>Habitaciones individuales: {singleRooms} × +280 €</div>}

      <div className="mt-2 font-medium">Seguro</div>
      <div>{insurance ? "Ampliado (+100 €/persona)" : "Básico · Incluido"}</div>

      <div className="mt-3 border-t pt-2">
        <div>Precio por persona:</div>
        <div className="text-lg font-semibold">{pricePerPerson.toLocaleString("es-ES")} €</div>
      </div>

      <div className="border-t pt-2">
        <div>Total:</div>
        <div className="text-lg font-semibold">{total.toLocaleString("es-ES")} €</div>
      </div>

      <div className="border-t pt-2">
        <div>Hoy pagas (60%):</div>
        <div className="font-semibold">{upfront.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
      </div>
      <div>
        <div>Último pago (40%):</div>
        <div className="font-semibold">{last.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</div>
      </div>
    </div>
  );

  if (!visible) return null;

  return (
    <>
      {/* Desktop: panel fijo a la derecha */}
      <div className="hidden lg:block sticky top-4 self-start w-[320px] border rounded-2xl p-4">
        {content}
        <button className="btn btn-primary mt-3 w-full">Reservar</button>
      </div>

      {/* Móvil: barra anclada con pestañita */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0">
        <div className="mx-auto max-w-screen-sm">
          <div className="bg-white border-t rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div
              className="flex items-center justify-between p-3"
              onClick={() => setOpenMobile((o) => !o)}
            >
              <div className="text-sm">
                Total: <strong>{total.toLocaleString("es-ES")} €</strong>
              </div>
              <div className="text-sm opacity-70">{openMobile ? "▼" : "▲"}</div>
            </div>
            {openMobile && (
              <div className="p-4 border-t">
                {content}
                <button className="btn btn-primary mt-3 w-full">Reservar</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
