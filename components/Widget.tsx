"use client";

import React, { useState } from "react";
import StepHeader from "./StepHeader";
import Calendar from "./Calendar";
import FlightsList, { FlightOption } from "./FlightsList";
import SummaryPanel from "./SummaryPanel";

type Step = "op" | "cal" | "flights" | "hot" | "ins" | "sum";

export default function Widget() {
  const [origin, setOrigin] = useState("BCN");
  const [pax, setPax] = useState(2);
  const [step, setStep] = useState<Step>("op");

  const [dates, setDates] = useState<{ dep: string; ret: string } | null>(null);
  const [selectedOption, setSelectedOption] = useState<FlightOption | null>(null);

  const [lux, setLux] = useState(false);
  const [singleRooms, setSingleRooms] = useState(0);
  const [insurance, setInsurance] = useState(false);

  // “bottom sheet” del resumen en móvil
  const [summaryOpenMobile, setSummaryOpenMobile] = useState(false);

  // base fare por persona (en función pax y temporada) — asumo que tu lógica ya está en backend
  // aquí solo la recibimos después; si no la tienes aún, pon un número fijo o pásala desde API
  const [baseFarePerPerson, setBaseFarePerPerson] = useState(0);

  return (
    <div className="max-w-[1000px] w-full mx-auto">
      {step === "op" && (
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
      )}

      {step === "cal" && (
        <div className="card">
          <StepHeader title="Selecciona fecha" subtitle="Mostramos fechas con disponibilidad" />

          {/* Calendario pantalla completa dentro de la tarjeta */}
          <Calendar
            origin={origin}
            pax={pax}
            onSelect={(range) => {
              setDates(range);
              // aquí NO mostramos ningún texto de fechas, lo quitamos del componente
            }}
          />

          <div className="flex justify-between mt-4">
            <button className="btn btn-secondary" onClick={() => setStep("op")}>
              Atrás
            </button>
            <button
              className="btn btn-primary"
              disabled={!dates}
              onClick={() => {
                setSelectedOption(null); // reseteamos por si venías de atrás
                setStep("flights");
              }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {step === "flights" && dates && (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="card">
            <StepHeader title="Vuelos disponibles" subtitle="Elige tu combinación" />
            <FlightsList
              origin={origin}
              departure={dates.dep}
              ret={dates.ret}
              pax={pax}
              onBack={() => setStep("cal")}
              onConfirm={(id, opt) => {
                setSelectedOption(opt);
                // si tienes la baseFare en el backend, puedes traerla y setearla aquí.
                setStep("hot");
              }}
            />
          </div>

          {/* RESUMEN: solo aparece a partir de que ya se ha seleccionado vuelo */}
          {selectedOption && (
            <aside>
              <SummaryPanel
                openMobile={summaryOpenMobile}
                onToggleMobile={setSummaryOpenMobile}
                origin={origin}
                pax={pax}
                dates={dates}
                selected={selectedOption}
                lux={lux}
                singleRooms={singleRooms}
                insurance={insurance}
                baseFarePerPerson={baseFarePerPerson}
              />
            </aside>
          )}
        </div>
      )}

      {step === "hot" && (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
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
                  <option value="base">Base (+0 €)</option>
                  <option value="lux">Luxury (+400 €/persona)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Habitaciones individuales</label>
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
                  +280 € por persona en individual (aplicamos regla de no dejar 1 “suelt@”)
                </div>
              </div>

              <div className="flex justify-between">
                <button className="btn btn-secondary" onClick={() => setStep("flights")}>
                  Atrás
                </button>
                <button className="btn btn-primary" onClick={() => setStep("ins")}>
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          {selectedOption && (
            <aside>
              <SummaryPanel
                openMobile={summaryOpenMobile}
                onToggleMobile={setSummaryOpenMobile}
                origin={origin}
                pax={pax}
                dates={dates}
                selected={selectedOption}
                lux={lux}
                singleRooms={singleRooms}
                insurance={insurance}
                baseFarePerPerson={baseFarePerPerson}
              />
            </aside>
          )}
        </div>
      )}

      {step === "ins" && (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
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

          {selectedOption && (
            <aside>
              <SummaryPanel
                openMobile={summaryOpenMobile}
                onToggleMobile={setSummaryOpenMobile}
                origin={origin}
                pax={pax}
                dates={dates}
                selected={selectedOption}
                lux={lux}
                singleRooms={singleRooms}
                insurance={insurance}
                baseFarePerPerson={baseFarePerPerson}
              />
            </aside>
          )}
        </div>
      )}

      {step === "sum" && (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="card">
            <StepHeader title="Resumen final" subtitle="Revisa antes de pagar" />
            <div className="text-sm opacity-70 mb-3">
              Aquí añadiremos itinerario y detalles incluidos (lo vemos contigo luego).
            </div>
            <div className="flex justify-between">
              <button className="btn btn-secondary" onClick={() => setStep("ins")}>
                Atrás
              </button>
              <button
                className="btn btn-primary"
                onClick={() => alert("Pago: lo implementamos en el siguiente paso (Stripe).")}
              >
                Pagar
              </button>
            </div>
          </div>

          {selectedOption && (
            <aside>
              <SummaryPanel
                openMobile={summaryOpenMobile}
                onToggleMobile={setSummaryOpenMobile}
                origin={origin}
                pax={pax}
                dates={dates}
                selected={selectedOption}
                lux={lux}
                singleRooms={singleRooms}
                insurance={insurance}
                baseFarePerPerson={baseFarePerPerson}
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
