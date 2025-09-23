"use client";

import React, { useState } from "react";
import StepHeader from "./StepHeader";
import Calendar from "./Calendar";
import FlightsList from "./FlightsList";
import { FlightOption } from "@/lib/types";
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

  const [summaryOpenMobile, setSummaryOpenMobile] = useState(false);
  const [baseFarePerPerson, setBaseFarePerPerson] = useState(0);
  const [calendarPrice, setCalendarPrice] = useState<number | null>(null);

  return (
    <div className="max-w-[1000px] w-full mx-auto">
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
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => setStep("cal")}>Siguiente</button>
            </div>
          </div>
        </div>
      )}

      {step === "cal" && (
        <div className="card">
          <StepHeader title="Selecciona fecha" subtitle="Mostramos fechas con disponibilidad" />
          <Calendar
            origin={origin}
            pax={pax}
            onSelect={(range) => {
              setDates(range);
              setSelectedOption(null);
              setStep("flights");
            }}
            onCursorChange={(c) => {
              // opcional: podrías guardar cursor si lo necesitas
            }}
          />
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
              calendarPrice={calendarPrice}
              onBack={() => setStep("cal")}
              onConfirm={(id, opt) => {
                setSelectedOption(opt);
                setStep("hot");
              }}
              onBaseFare={(fare) => setBaseFarePerPerson(fare)}
              onCalendarPrice={(price) => setCalendarPrice(price)}
            />
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

      {/* Los pasos hot, ins, sum siguen igual */}
    </div>
  );
}
