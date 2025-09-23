"use client";

import { useEffect, useState, useRef } from "react";
import dayjs from "dayjs";
import { CalendarPayload } from "@/lib/types";
import { addDaysISO } from "@/lib/calendar";

const TRIP_LEN = 10;

function same(a?: string, b?: string) {
  return a && b && a === b;
}

function inRange(x: string, start: string, end: string) {
  return x >= start && x <= end;
}

type DayPayload = {
  date: string;
  show: boolean;
  priceFrom: number | null;
  baseFare: number;
};

export default function Calendar({
  origin,
  pax,
  initialCursor,
  onCursorChange,
  onSelect,
}: {
  origin: string;
  pax: number;
  initialCursor?: dayjs.Dayjs;
  onCursorChange?: (c: dayjs.Dayjs) => void;
  onSelect?: (range: { dep: string; ret: string }) => void;
}) {
  const [cursor, setCursor] = useState(() =>
    initialCursor || dayjs().add(1, "month").startOf("month")
  );
  const [left, setLeft] = useState<CalendarPayload | null>(null);
  const [right, setRight] = useState<CalendarPayload | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cacheRef = useRef<Map<string, CalendarPayload>>(new Map());

  const minMonth = dayjs().add(1, "month").startOf("month");
  const maxMonth = dayjs().add(10, "month").startOf("month");
  const isAtMinMonth = cursor.isSame(minMonth, "month");
  const isAtMaxMonth = cursor.isSame(maxMonth, "month");

  useEffect(() => {
    const leftYear = cursor.year();
    const leftMonth = cursor.month();
    const right = cursor.add(1, "month");
    const rightYear = right.year();
    const rightMonth = right.month();

    const keyL = `${origin}:${pax}:${leftYear}:${leftMonth}`;
    const keyR = `${origin}:${pax}:${rightYear}:${rightMonth}`;

    const fetchMonth = async (year: number, month: number) => {
      const res = await fetch(
        `/api/calendar-prices?origin=${origin}&pax=${pax}&year=${year}&month=${month}`
      );
      return await res.json();
    };

    const load = async () => {
      setLoading(true);

      const L = cacheRef.current.get(keyL) || await fetchMonth(leftYear, leftMonth);
      const R = cacheRef.current.get(keyR) || await fetchMonth(rightYear, rightMonth);

      cacheRef.current.set(keyL, L);
      cacheRef.current.set(keyR, R);

      setLeft(L);
      setRight(R);
      setLoading(false);
    };

    load();
  }, [cursor, origin, pax]);

  useEffect(() => {
    const handler = (ev: any) => {
      const { dep, ret } = ev.detail;
      setSelectedStart(dep);
      onSelect?.({ dep, ret });
    };
    window.addEventListener("calendar:select", handler);
    return () => window.removeEventListener("calendar:select", handler);
  }, [onSelect]);

  const next = () => {
    const nextCursor = cursor.add(1, "month");
    setCursor(nextCursor);
    onCursorChange?.(nextCursor);
  };

  const prev = () => {
    const prevCursor = cursor.subtract(1, "month");
    setCursor(prevCursor);
    onCursorChange?.(prevCursor);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between mb-2">
        {!isAtMinMonth && (
          <button
            className="btn btn-secondary"
            onClick={prev}
            aria-label="Mes anterior"
          >
            ‹
          </button>
        )}
        {!isAtMaxMonth && (
          <button
            className="btn btn-secondary"
            onClick={next}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-500 py-8">Cargando precios…</div>
      ) : (
        <div className="flex gap-4 items-start">
          <MonthGrid
            title={cursor.format("MMMM")}
            baseYear={cursor.year()}
            baseMonth={cursor.month()}
            payload={left}
            selectedStart={selectedStart}
          />
          <MonthGrid
            title={cursor.add(1, "month").format("MMMM")}
            baseYear={cursor.add(1, "month").year()}
            baseMonth={cursor.add(1, "month").month()}
            payload={right}
            selectedStart={selectedStart}
          />
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  title,
  baseYear,
  baseMonth,
  payload,
  selectedStart,
}: {
  title: string;
  baseYear: number;
  baseMonth: number;
  payload: CalendarPayload | null;
  selectedStart?: string | null;
}) {
  const firstDay = dayjs(new Date(baseYear, baseMonth, 1));
  const startWeekDay = firstDay.day();
  const daysInMonth = firstDay.daysInMonth();

  const startISO = selectedStart || null;
  const endISO = startISO ? addDaysISO(startISO, TRIP_LEN - 1) : null;

  const cells: Array<{ iso?: string; day?: number; info?: DayPayload }> = [];
  for (let i = 0; i < startWeekDay; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = dayjs(new Date(baseYear, baseMonth, d)).format("YYYY-MM-DD");
    const info = payload?.days.find((x) => x.date === iso);
    cells.push({ iso, day: d, info });
  }

  const hasPrices = cells.some(c => c.info?.show && typeof c.info.priceFrom === "number");

  return (
    <div className="flex-1">
      <div className="text-center font-semibold mb-2 capitalize">{title}</div>
      <div className="grid grid-cols-7 text-xs opacity-70 mb-1">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          if (!c.iso || !c.day) return <div key={idx} className="h-12" />;

          const isStart = same(c.iso, startISO || undefined);
          const partOfTrip = startISO && endISO ? inRange(c.iso, startISO, endISO) : false;

          let bg = "";
          let text = "text-black";
          if (isStart) {
            bg = "bg-[#91c5c5]";
          } else if (partOfTrip) {
            bg = "bg-[#91c5c5]/30";
          } else if (c.info?.show && typeof c.info.priceFrom === "number") {
            bg = c.info.priceFrom < 1990 ? "bg-[#cdecce]" : "bg-[#fff6cc]";
          } else {
            bg = "bg-transparent";
            text = "text-gray-400";
          }

          return (
            <button
              key={idx}
              type="button"
              className={`rounded-lg ${bg} ${text} p-2 h-16 flex flex-col items-center justify-center`}
              onClick={() => {
                if (!c.info?.show) return;
                const dep = c.iso!;
                const ret = addDaysISO(dep, TRIP_LEN - 1);
                const ev = new CustomEvent("calendar:select", { detail: { dep, ret } });
                window.dispatchEvent(ev as any);
              }}
            >
              <div className="text-sm font-medium">{c.day}</div>
              <div className="text-[11px] mt-1">
                {typeof c.info?.priceFrom === "number"
  ? `${Math.round(c.info.priceFrom + c.info.baseFare)}€`
  : "–"}
              </div>
            </button>
          );
        })}
      </div>
      
            {!hasPrices && (
        <div className="text-center text-sm text-gray-500 mt-4">
          No hay disponibilidad para este mes.
        </div>
      )}
    </div>
  );
}

