"use client";
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { formatDateES } from "@/lib/format";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type DayItem = { date: string; show: boolean; priceFrom: number | null; baseFare: number };
type MonthPayload = { origin: string; pax: number; year: number; month: number; days: DayItem[] };

function addDaysISO(iso: string, n: number) {
  return dayjs(iso).add(n, "day").format("YYYY-MM-DD");
}

function MonthSkeleton() {
  return (
    <div className="w-full md:w-1/2">
      <div className="h-6 w-40 mx-auto rounded bg-gray-100 animate-pulse mb-3" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function MonthGrid({
  title,
  baseYear,
  baseMonth,
  payload,
  selectedStart,
  tripLen,
  onPickStart,
}: {
  title: string;
  baseYear: number;
  baseMonth: number; // 0-based
  payload: MonthPayload | null;
  selectedStart: string | null;
  tripLen: number;
  onPickStart: (iso: string) => void;
}) {
  if (!payload) return <MonthSkeleton />;

  const first = dayjs().year(baseYear).month(baseMonth).date(1);
  const daysIn = first.daysInMonth();
  const startWeekday = (first.day() + 6) % 7; // L=0..D=6 (ajuste para empezar en lunes)

  const selectedEnd = selectedStart ? addDaysISO(selectedStart, tripLen - 1) : null;
  const byDate: Record<string, DayItem> = {};
  (payload?.days || []).forEach((d) => (byDate[d.date] = d));

  const cells: Array<DayItem & {
    inRange: boolean; isStart: boolean; isDisabled: boolean;
  }> = [];

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
      <div className="border rounded-2xl p-3">
        <div className="text-sm font-semibold text-center mb-2">
          {title}
        </div>

        <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold mb-1 opacity-70">
          {["L","M","X","J","V","S","D"].map((d) => <div key={d} className="text-center">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((c, idx) => {
            if (c.isDisabled) return <div key={idx} />;
            const canPick = c.show; // inicio solo en días disponibles
            const priceVisible = c.priceFrom != null && (!c.inRange || c.isStart);

            const baseCls = "rounded-lg p-2 text-center border transition";
            const cls =
              c.isStart
                ? `${baseCls} border-[#f08e80] bg-[#fdf0ee]`
                : c.inRange
                  ? `${baseCls} border-[#91c5c5] bg-[#e8f4f4]`
                  : `${baseCls} bg-white`;

            const interactivity = canPick ? "cursor-pointer hover:border-[#91c5c5]" : "opacity-40";

            return (
              <div
                key={idx}
                className={`${cls} ${interactivity}`}
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
  // mes izquierdo = siguiente al actual
  const [cursor, setCursor] = useState(dayjs().add(1, "month").startOf("month"));
  const leftYear = cursor.year();
  const leftMonth = cursor.month();
  const right = cursor.add(1, "month");
  const rightYear = right.year();
  const rightMonth = right.month();

  const [payloadLeft, setPayloadLeft] = useState<MonthPayload | null>(null);
  const [payloadRight, setPayloadRight] = useState<MonthPayload | null>(null);

  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const tripLen = 10;

  // Carga mes izquierdo
  useEffect(() => {
    setPayloadLeft(null);
    fetch(`/api/calendar-prices?origin=${origin}&pax=${pax}&year=${leftYear}&month=${leftMonth}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setPayloadLeft)
      .catch(() => setPayloadLeft(null));
  }, [origin, pax, leftYear, leftMonth]);

  // Carga mes derecho
  useEffect(() => {
    setPayloadRight(null);
    fetch(`/api/calendar-prices?origin=${origin}&pax=${pax}&year=${rightYear}&month=${rightMonth}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setPayloadRight)
      .catch(() => setPayloadRight(null));
  }, [origin, pax, rightYear, rightMonth]);

  const dep = selectedStart || "";
  const ret = dep ? addDaysISO(dep, tripLen - 1) : "";

  // navegación ilimitada (si quieres limitar a 10 meses, pon un guard con diff)
  const prev = () => setCursor((c) => c.subtract(1, "month"));
  const next = () => setCursor((c) => c.add(1, "month"));

  const canConfirm = !!selectedStart;

  return (
    <div>
      {/* Controles de mes */}
      <div className="flex items-center justify-between mb-4">
        <button className="btn btn-secondary" onClick={prev}>Mes anterior</button>
        <div className="text-sm font-semibold opacity-80">
          {/* el título de cada mes está en cada card; aquí dejamos limpio */}
        </div>
        <button className="btn btn-secondary" onClick={next}>Mes siguiente</button>
      </div>

      {/* Dos meses con más separación */}
      <div className="flex flex-col md:flex-row gap-8">
        <MonthGrid
          title={cursor.format("MMMM YYYY")}
          baseYear={leftYear}
          baseMonth={leftMonth}
          payload={payloadLeft}
          selectedStart={selectedStart}
          tripLen={tripLen}
          onPickStart={setSelectedStart}
        />
        <MonthGrid
          title={right.format("MMMM YYYY")}
          baseYear={rightYear}
          baseMonth={rightMonth}
          payload={payloadRight}
          selectedStart={selectedStart}
          tripLen={tripLen}
          onPickStart={setSelectedStart}
        />
      </div>

      {/* Barra inferior alineada */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
        <div className="text-sm">
          {selectedStart ? (
            <>
              Salida: <strong>{formatDateES(dep)}</strong> · Vuelta: <strong>{formatDateES(ret)}</strong>{" "}
              <span className="opacity-70">(viaje de {tripLen} días)</span>
            </>
          ) : (
            <span className="opacity-70">Selecciona el día de salida</span>
          )}
        </div>
        <div className="flex gap-2 md:justify-end">
          <button className="btn btn-secondary">Atrás</button>
          <button className="btn btn-primary" disabled={!canConfirm} onClick={() => onConfirm({ dep, ret })}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
