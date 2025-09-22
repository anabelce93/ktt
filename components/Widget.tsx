"use client";
import React, { useMemo, useState } from "react";
import StepHeader from "./StepHeader";
import Calendar from "./Calendar";
import FlightsList from "./FlightsList";
import SummaryPanel from "./SummaryPanel";
import dayjs from "dayjs";

type Step = "op" | "cal" | "air" | "hot" | "ins" | "sum";

/* ===========================================================
   TARIFAS (por persona) según temporada y nº de personas
   Ventanas de temporada alta (inclusive) dadas por el cliente
   =========================================================== */

type Range = { start: string; end: string }; // formato "YYYY-MM-DD"
const HIGH_SEASON_WINDOWS: Range[] = [
  // 2025
  { start: "2025-10-10", end: "2025-11-05" },
  { start: "2025-12-23", end: "2026-01-01" },
  // 2026
  { start: "2026-02-14", end: "2026-02-18" },
  { start: "2026-03-25", end: "2026-04-15" },
  { start: "2026-07-10", end: "2026-08-25" },
  { start: "2026-09-23", end: "2026-09-27" },
  { start: "2026-10-10", end: "2026-11-05" },
  { start: "2026-12-23", end: "2027-01-01" },
];

function isInRange(dateISO: string, r: Range) {
  const d = dayjs(dateISO);
  return d.isSame(dayjs(r.start)) || d.isSame(dayjs(r.end)) || (d.isAfter(r.start) && d.isBefore(r.end));
}
function isHighSeason(depISO: string) {
  return HIGH_SEASON_WINDOWS.some((r) => isInRange(depISO, r));
}

const FARES_HIGH: Record<number, number> = {
  1: 1470, 2: 1295, 3: 1245, 4: 1220, 5: 1195, 6: 1170,
};
const FARES_NORMAL: Record<number, number> = {
  1: 1290, 2: 1175, 3: 1125, 4: 1100, 5: 1075, 6: 1050,
};

function baseFarePerPerson(depISO: string, pax: number) {
  const p = Math.min(Math.max(pax, 1), 6);
  const table = isHighSeason(depISO) ? FARES_HIGH : FARES_NORMAL;
  return table[p];
}

/* ===========================================================
   WIDGET
   =========================================================== */

export default function Widget() {
  const [origin, setOrigin] = useState("BCN");
  const [pax, setPax] = useState(2);

  const [step, setStep] = useState<Step>("op");
  const [dates, setDates] = useState<{ dep: string; ret: string } | null>(null);

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<any | null>(null);

  const [lux, setLux] = useState(false);
  const [singleRooms, setSingleRooms] = useState(0);
  const [insurance, setInsurance] = useState(false);

  // Tarifa terrestre (por persona) calculada cuando haya fecha seleccionada
  const baseFare = useMemo(() => {
    if (!dates?.dep) return 0;
    return baseFarePerPerson(dates.dep, pax);
  }, [dates?.dep, pax]);

  /* ======== Paso 1: Origen + Personas (compacto); desde aquí todo full-width ======== */

  if (step === "op") {
    return (
      <div className="max-w-[420px] w-full">
        <div className="card">
          <StepHeader title="Origen y personas" subtitle="Elige tu ciudad y cuántos viajan" />
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Origen</label>
              <select
                className="select"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              >
                <option value="BCN">Barcelona (BCN)</option>
                <option value="MAD">Madrid (MAD)</option>
                <option value="VLC">Valencia (VLC)</option>
                <option value="AGP">Málaga (AGP)</option>
                <option value="LPA">Las Palmas (LPA)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Personas</label>
              <select
                className="select"
                value={pax}
                onChange={(e) => setPax(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => setStep("cal")}>
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ======== A partir de aquí: Layout full (contenido a la izquierda + resumen a la derecha) ======== */

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* COLUMNA IZQUIERDA: flujo de pasos */}
        <div className="flex-1 min-w-0">
          {step === "cal" && (
            <div className="card">
              <StepHeader
                title="Selecciona fecha"
                subtitle="Mostramos fechas con disponibilidad"
              />

              {/* Calendario a pantalla completa (en móvil 1 mes, en desktop 2 meses; ya lo hace el componente) */}
              <Calendar
                origin={origin}
                pax={pax}
                onConfirm={({ dep, ret }) => {
                  setDates({ dep, ret });
                  // pasar directo a vuelos (pantalla completa)
                  setStep("air");
                  // reset selección de vuelo si vuelven atrás y cambian fecha
                  setSelectedFlightId(null);
                  setSelectedOption(null);
                }}
              />

              {/* Barra de navegación inferior del calendario */}
              <div className="flex justify-between mt-4">
                <button className="btn btn-secondary" onClick={() => setStep("op")}>
                  Atrás
                </button>
                {/* El botón "Siguiente" lo controla el propio calendario al tener fecha (onConfirm) */}
              </div>
            </div>
          )}

          {step === "air" && dates && (
            <div className="card">
              <StepHeader
                title="Elige tu vuelo"
                subtitle="Ordenamos por menor diferencia de precio"
              />
              {/* LISTA DE VUELOS: IMPORTANTE — onSelect devuelve (id, opt) */}
              <FlightsList
                origin={origin}
                departure={dates.dep}
                ret={dates.ret}
                pax={pax}
                onBack={() => setStep("cal")}
                onSelect={(id: string, opt: any) => {
                  setSelectedFlightId(id);
                  setSelectedOption(opt);
                  setStep("hot");
                }}
              />
            </div>
          )}

          {step === "hot" && (
            <div className="card">
              <StepHeader title="Alojamiento" subtitle="Elige tu estilo" />
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Opción</label>
                  <select
                    className="select"
                    value={lux ? "lux" : "base"}
                    onChange={(e) => setLux(e.target.value === "lux")}
                  >
                    <option value="base">Standard (+0 €)</option>
                    <option value="lux">Luxury (+400 €/persona)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Habitaciones individuales
                  </label>
                  <select
                    className="select"
                    value={singleRooms}
                    onChange={(e) => setSingleRooms(parseInt(e.target.value))}
                  >
                    {Array.from({ length: pax + 1 }).map((_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-600 mt-1">
                    +280 € por persona en individual
                  </div>
                </div>
                <div className="flex justify-between">
                  <button className="btn btn-secondary" onClick={() => setStep("air")}>
                    Atrás
                  </button>
                  <button className="btn btn-primary" onClick={() => setStep("ins")}>
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "ins" && (
            <div className="card">
              <StepHeader title="Seguro" subtitle="Tranquilidad para tu viaje" />
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Cobertura</label>
                  <select
                    className="select"
                    value={insurance ? "plus" : "base"}
                    onChange={(e) => setInsurance(e.target.value === "plus")}
                  >
                    <option value="base">Básico (+0 €)</option>
                    <option value="plus">Ampliado (+100 €/persona)</option>
                  </select>
                </div>
                <div className="flex justify-between">
                  <button className="btn btn-secondary" onClick={() => setStep("hot")}>
                    Atrás
                  </button>
                  <button className="btn btn-primary" onClick={() => setStep("sum")}>
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "sum" && (
            <div className="card">
              <StepHeader title="Resumen" subtitle="Revisa antes de pagar" />
              <div className="text-sm space-y-2">
                <div>
                  Origen: <strong>{origin}</strong>
                </div>
                <div>
                  Personas: <strong>{pax}</strong>
                </div>
                <div>
                  Fechas: <strong>{dates?.dep}</strong> → <strong>{dates?.ret}</strong>
                </div>
                <div>
                  Vuelo: <strong>{selectedFlightId ? "Seleccionado" : "No seleccionado"}</strong>
                </div>
                <div>
                  Alojamiento: <strong>{lux ? "Luxury +400€/persona" : "Standard"}</strong>
                </div>
                <div>
                  Individuales: <strong>{singleRooms} × +280€</strong>
                </div>
                <div>
                  Seguro: <strong>{insurance ? "+100€/persona" : "Básico"}</strong>
                </div>
              </div>
              <div className="flex justify-between mt-3">
                <button className="btn btn-secondary" onClick={() => setStep("ins")}>
                  Atrás
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    alert("Pago: lo implementamos en el siguiente paso (Stripe).")
                  }
                >
                  Pagar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: RESUMEN (aparece tras seleccionar vuelo) */}
        <SummaryPanel
          visible={!!selectedOption}
          pax={pax}
          option={selectedOption}
          lux={lux}
          singleRooms={singleRooms}
          insurance={insurance}
          baseFarePerPerson={baseFare}
        />
      </div>
    </div>
  );
}
