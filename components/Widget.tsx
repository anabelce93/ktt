"use client";
import React, { useState } from "react";
import StepHeader from "./StepHeader";
import Calendar from "./Calendar";
import FlightsList from "./FlightsList";

type Step = "op" | "cal" | "flt" | "hot" | "ins" | "sum";

export default function Widget() {
  const [origin, setOrigin] = useState("BCN");
  const [pax, setPax] = useState(2);
  const [step, setStep] = useState<Step>("op");
  const [dates, setDates] = useState<{ dep: string; ret: string } | null>(null);
  const [flightId, setFlightId] = useState<string | null>(null);
  const [lux, setLux] = useState(false);
  const [singleRooms, setSingleRooms] = useState(0);
  const [insurance, setInsurance] = useState(false);

  // Layout a pantalla completa desde que pasan de "op"
  return (
    <div className={step === "op" ? "max-w-[392px] w-full" : "fixed inset-0 z-40 bg-white overflow-y-auto"}>
      {step === "op" && (
        <div className="card">
          <StepHeader title="Origen y personas" subtitle="Elige tu ciudad y cuántos viajan" />
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Origen</label>
              <select className="select" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                <option value="BCN">Barcelona (BCN)</option>
                <option value="MAD">Madrid (MAD)</option>
                <option value="VLC">Valencia (VLC)</option>
                <option value="AGP">Málaga (AGP)</option>
                <option value="LPA">Las Palmas (LPA)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Personas</label>
              <select className="select" value={pax} onChange={(e) => setPax(parseInt(e.target.value))}>
                {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => setStep("cal")}>Siguiente</button>
            </div>
          </div>
        </div>
      )}

      {step === "cal" && (
        <div className="min-h-screen px-4 py-4 md:px-8 md:py-8">
          <div className="card max-w-6xl mx-auto">
            <StepHeader title="Selecciona fecha" subtitle="Muestra dos meses • viaje de 10 días" />
            <Calendar
              origin={origin}
              pax={pax}
              // Cuando el usuario confirma el día, nos da dep/ret y pasamos a la pantalla de vuelos
              onConfirm={(range) => {
                setDates(range);
                setFlightId(null);
                setStep("flt");
              }}
            />
            <div className="flex justify-between mt-3">
              <button className="btn btn-secondary" onClick={() => setStep("op")}>Atrás</button>
            </div>
          </div>
        </div>
      )}

      {step === "flt" && dates && (
        <div className="min-h-screen px-4 py-4 md:px-8 md:py-8">
          <div className="card max-w-5xl mx-auto">
            <StepHeader title="Vuelos disponibles" subtitle="Elige la combinación que prefieras" />
            <FlightsList
              origin={origin}
              departure={dates.dep}
              ret={dates.ret}
              pax={pax}
              onSelect={(id) => { setFlightId(id); setStep("hot"); }}
              onBack={() => setStep("cal")}
            />
          </div>
        </div>
      )}

      {step === "hot" && (
        <div className="min-h-screen px-4 py-4 md:px-8 md:py-8">
          <div className="card max-w-xl mx-auto">
            <StepHeader title="Alojamiento" subtitle="Elige tu estilo" />
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Opción</label>
                <select className="select" value={lux ? "lux" : "base"} onChange={(e) => setLux(e.target.value === "lux")}>
                  <option value="base">Base (+0 €)</option>
                  <option value="lux">Luxury (+400 €/persona)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Habitaciones individuales</label>
                <select className="select" value={singleRooms} onChange={(e) => setSingleRooms(parseInt(e.target.value))}>
                  {Array.from({ length: pax + 1 }).map((_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <div className="text-xs text-gray-600 mt-1">+280 € por persona en individual</div>
              </div>
              <div className="flex justify-between">
                <button className="btn btn-secondary" onClick={() => setStep("flt")}>Atrás</button>
                <button className="btn btn-primary" onClick={() => setStep("ins")}>Siguiente</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "ins" && (
        <div className="min-h-screen px-4 py-4 md:px-8 md:py-8">
          <div className="card max-w-xl mx-auto">
            <StepHeader title="Seguro" subtitle="Tranquilidad para tu viaje" />
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Cobertura</label>
                <select className="select" value={insurance ? "plus" : "base"} onChange={(e) => setInsurance(e.target.value === "plus")}>
                  <option value="base">Básico (+0 €)</option>
                  <option value="plus">Ampliado (+100 €/persona)</option>
                </select>
              </div>
              <div className="flex justify-between">
                <button className="btn btn-secondary" onClick={() => setStep("hot")}>Atrás</button>
                <button className="btn btn-primary" onClick={() => setStep("sum")}>Siguiente</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "sum" && (
        <div className="min-h-screen px-4 py-4 md:px-8 md:py-8">
          <div className="card max-w-xl mx-auto">
            <StepHeader title="Resumen" subtitle="Revisa antes de pagar" />
            <div className="text-sm space-y-1">
              <div>Origen: <strong>{origin}</strong></div>
              <div>Personas: <strong>{pax}</strong></div>
              <div>Fechas: <strong>{dates?.dep}</strong> → <strong>{dates?.ret}</strong></div>
              <div>Vuelo: <strong>{flightId ? "Seleccionado" : "No seleccionado"}</strong></div>
              <div>Alojamiento: <strong>{lux ? "Luxury +400€/persona" : "Base"}</strong></div>
              <div>Individuales: <strong>{singleRooms} × +280€</strong></div>
              <div>Seguro: <strong>{insurance ? "+100€/persona" : "Base"}</strong></div>
            </div>
            <div className="flex justify-between mt-3">
              <button className="btn btn-secondary" onClick={() => setStep("ins")}>Atrás</button>
              <button className="btn btn-primary" onClick={() => alert("Pago: lo implementamos en el siguiente paso (Stripe).")}>
                Pagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
