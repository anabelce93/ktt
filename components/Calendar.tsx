"use client";
import React, { useEffect, useState } from "react";
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
    <div className="w-full md:w-1/2 md:flex-1">
      <div className="h-6 w-40 mx-auto rounded bg-gray-100 animate-pulse mb-3" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="flex flex-col items-stretch">
            <div className="h-12 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 mt-1 rounded bg-gray-100 animate-pulse" />
          </div>
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
  const startWeekday = (first.day() + 6) % 7; // lunes=0

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

    cells.push({ ...it, inRange, isStart, isDisabled: false });
  }

  return (
    <div className="w-full md:w-1/2 md:flex-1">
      <div className="text-sm font-semibold text-center mb-2">{title}</div>

      <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold mb-1 opacity-70">
        {["L","M","X","J","V","S","D"].map((d) => <div key={d} className="text-center">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          if (c.isDisabled) {
            return (
              <div key={idx} className="flex flex-col items-stretch">
                <div />
                <div className="h-4 mt-1" />
              </div>
            );
          }

          const canPick = c.show;
          const priceVisible = c.priceFrom != null && (!c.inRange || c.isStart);

          const GREEN_BG = "#e6f7ec";
          const YELLOW_BG = "#fff7e0";
          const RANGE_BG = "#91c5c5"; // todo el rango mismo color
          const dayBg = c.inRange
            ? RANGE_BG
            : c.priceFrom != null
              ? (c.priceFrom < 1990 ? GREEN_BG : YELLOW_BG)
              : "#ffffff";
          const dayTextClass = c.inRange ? "text-white" : "text-black";

          const boxBase =
            "rounded-lg p-2 text-center transition min-h-[48px] flex items-center justify-center";
          const interactivity = canPick
            ? "cursor-pointer hover:brightness-95"
            : "opacity-40";

          return (
            <div key={idx} className="flex flex-col items-stretch">
              <div
                className={`${boxBase} ${dayTextClass} ${interactivity}`}
                style={{ backgroundColor: dayBg }}
                onClick={() => canPick && onPickStart(c.date)}
                title={c.date}
              >
                <div className="text-sm font-medium">{dayjs(c.date).date()}</div>
              </div>
              <div className="h-4 mt-1 text-[11px] text-center leading-4">
                {priceVisible ? `${Math.round(c.priceFrom!)}€` : ""}
              </div>
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
  // cuando el usuario termina de elegir rango (10 días):
  onConfirm({ dep: startIso, ret: endIso });
}
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

  const dep = selectedStart || "";
  const ret = dep ? addDaysISO(dep, tripLen - 1) : "";

  const prev = () => setCursor((c) => c.subtract(1, "month"));
  const next = () => setCursor((c) => c.add(1, "month"));

  const canConfirm = !!selectedStart;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="btn btn-secondary" onClick={prev} aria-label="Mes anterior">
          ‹
        </button>
        <div className="text-sm font-semibold opacity-80" />
        <button className="btn btn-secondary" onClick={next} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      {/* Móvil: 1 mes. Desktop: 2 meses, con gap y ambos usando todo su ancho */}
      <div className="flex flex-col md:flex-row md:gap-8">
        <MonthGrid
          title={cursor.format("MMMM YYYY")}
          baseYear={leftYear}
          baseMonth={leftMonth}
          payload={payloadLeft}
          selectedStart={selectedStart}
          tripLen={tripLen}
          onPickStart={setSelectedStart}
        />
        <div className="hidden md:flex md:flex-1">
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
      </div>

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
          {/* Sin botón Atrás aquí para no duplicarlo con el de Widget */}
          <button className="btn btn-primary" disabled={!canConfirm} onClick={() => onConfirm({ dep, ret })}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
