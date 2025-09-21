"use client";
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

// ➜ AÑADE ESTOS 2 IMPORTS
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

// ➜ Y ACTÍVALOS
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type DayItem = { date: string; show: boolean; priceFrom: number | null; baseFare: number };
type MonthPayload = { origin: string; pax: number; year: number; month: number; days: DayItem[] };

function addDaysISO(iso: string, n: number) {
  return dayjs(iso).add(n, "day").format("YYYY-MM-DD");
}

function MonthGrid({
  baseYear,
  baseMonth,
  payload,
  selectedStart,
  tripLen,
  onPickStart,
}: {
  baseYear: number;
  baseMonth: number; // 0-based
  payload: MonthPayload | null;
  selectedStart: string | null;
  tripLen: number;
  onPickStart: (iso: string) => void;
}) {
  const first = dayjs().year(baseYear).month(baseMonth).date(1);
  const daysIn = first.daysInMonth();
  const startWeekday = first.day(); // 0 domingo, 1 lunes...
  const cells: Array<DayItem & { inRange: boolean; isStart: boolean; isDisabled: boolean }> = [];

  const selectedEnd = selectedStart ? addDaysISO(selectedStart, tripLen - 1) : null;

  const byDate: Record<string, DayItem> = {};
  (payload?.days || []).forEach((d) => (byDate[d.date] = d));

  for (let i = 0; i < startWeekday; i++) {
    cells.push({
      date: "",
      show: false,
      priceFrom: null,
      baseFare: 0,
      inRange: false,
      isStart: false,
      isDisabled: true,
    });
  }
  for (let d = 1; d <= daysIn; d++) {
    const iso = first.date(d).format("YYYY-MM-DD");
    const it = byDate[iso] || { date: iso, show: false, priceFrom: null, baseFare: 0 };
    const inRange =
      !!selectedStart &&
      !!selectedEnd &&
      dayjs(iso).isSameOrAfter(dayjs(selectedStart)) &&
      dayjs(iso).isSameOrBefore(dayjs(selectedEnd));

    const isStart = selectedStart === iso;

    cells.push({
      ...it,
      inRange,
      isStart,
      isDisabled: false,
    });
  }

  return (
    <div className="w-full md:w-1/2">
      <div className="grid grid-cols-7 gap-1 text-xs font-semibold mb-1 opacity-70">
        {["L","M","X","J","V","S","D"].map((d) => <div key={d} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => {
          if (c.isDisabled) return <div key={idx} />;
          const canPick = c.show; // solo permitimos inicio en días disponibles
          const priceVisible = c.priceFrom != null && (!c.inRange || c.isStart);
          const cls = [
            "rounded-lg p-2 text-center border",
            c.isStart ? "bg-[#bdcbcd] text-black border-[#bdcbcd]" : c.inRange ? "bg-[#f6f8f8] text-gray-700 border-[#e5eded]" : "bg-white",
            canPick ? "cursor-pointer hover:border-[#91c5c5]" : "opacity-40",
          ].join(" ");
          return (
            <div
              key={idx}
              className={cls}
              onClick={() => canPick && onPickStart(c.date)}
              title={c.date}
            >
              <div className="text-sm font-medium">{dayjs(c.date).date()}</div>
              {priceVisible && (
                <div className="text-[11px] mt-1">desde {Math.round(c.priceFrom!)}€</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar({
  origin,
  pax,
  onConfirm,
}: {
  origin: string;
  pax: number;
  onConfirm: (range: { dep: string; ret: string }) => void;
}) {
  const [cursor, setCursor] = useState(dayjs().add(1, "month").startOf("month")); // mes izquierdo
  const leftYear = cursor.year();
  const leftMonth = cursor.month();
  const right = cursor.add(1, "month");
  const rightYear = right.year();
  const rightMonth = right.month();

  const [payloadLeft, setPayloadLeft] = useState<MonthPayload | null>(null);
  const [payloadRight, setPayloadRight] = useState<MonthPayload | null>(null);

  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const tripLen = 10;

  // carga meses (usa tu endpoint con Redis ya implementado)
  useEffect(() => {
    setPayloadLeft(null);
    fetch(`/api/calendar-prices?origin=${origin}&pax=${pax}&year=${leftYear}&month=${leftMonth}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setPayloadLeft)
      .catch(() => setPayloadLeft(null));
  }, [origin, pax, leftYear, leftMonth]);

  useEffect(() => {
    setPayloadRight(null);
    fetch(`/api/calendar-prices?origin=${origin}&pax=${pax}&year=${rightYear}&month=${rightMonth}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setPayloadRight)
      .catch(() => setPayloadRight(null));
  }, [origin, pax, rightYear, rightMonth]);

  const canConfirm = useMemo(() => !!selectedStart, [selectedStart]);
  const dep = selectedStart || "";
  const ret = dep ? addDaysISO(dep, tripLen - 1) : "";

  return (
    <div>
      {/* Controles de mes */}
      <div className="flex items-center justify-between mb-3">
        <button className="btn btn-secondary" onClick={() => setCursor((c) => c.subtract(1, "month"))}>Mes anterior</button>
        <div className="text-sm font-semibold">
          {cursor.format("MMMM YYYY")} &nbsp;•&nbsp; {right.format("MMMM YYYY")}
        </div>
        <button className="btn btn-secondary" onClick={() => setCursor((c) => c.add(1, "month"))}>Mes siguiente</button>
      </div>

      {/* Dos meses en columnas */}
      <div className="flex flex-col md:flex-row gap-4">
        <MonthGrid
          baseYear={leftYear}
          baseMonth={leftMonth}
          payload={payloadLeft}
          selectedStart={selectedStart}
          tripLen={tripLen}
          onPickStart={(iso) => setSelectedStart(iso)}
        />
        <MonthGrid
          baseYear={rightYear}
          baseMonth={rightMonth}
          payload={payloadRight}
          selectedStart={selectedStart}
          tripLen={tripLen}
          onPickStart={(iso) => setSelectedStart(iso)}
        />
      </div>

      {/* Barra inferior de confirmación */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm">
          {selectedStart ? (
            <>
              Salida: <strong>{dep}</strong> · Vuelta: <strong>{ret}</strong> &nbsp;
              <span className="opacity-70">(viaje de {tripLen} días)</span>
            </>
          ) : (
            <span className="opacity-70">Selecciona el día de salida</span>
          )}
        </div>
        <button className="btn btn-primary" disabled={!canConfirm} onClick={() => onConfirm({ dep, ret })}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
