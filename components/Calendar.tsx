"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
dayjs.locale("es");

type DayPayload = {
  date: string;
  show: boolean;
  priceFrom: number | null;
};

type CalendarPayload = {
  origin: string;
  pax: number;
  year: number;
  month: number;
  days: DayPayload[];
};

type Props = {
  origin: string;
  pax: number;
  onSelect: (range: { dep: string; ret: string } | null) => void;
};

const TRIP_LEN = 10;

function addDaysISO(iso: string, n: number) {
  return dayjs(iso).add(n, "day").format("YYYY-MM-DD");
}

function same(isoA?: string, isoB?: string) {
  return !!isoA && !!isoB && isoA === isoB;
}

function inRange(iso: string, start?: string, end?: string) {
  if (!start || !end) return false;
  const t = dayjs(iso).valueOf();
  return t >= dayjs(start).valueOf() && t <= dayjs(end).valueOf();
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

          console.log("📅 Día:", c.iso, "Mostrar:", c.info?.show, "Precio:", c.info?.priceFrom);

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
              {!partOfTrip || isStart ? (
                <div className="text-[11px] mt-1">
                  {typeof c.info?.priceFrom === "number"
                    ? `${Math.round(c.info.priceFrom)}€`
                    : ""}
                </div>
              ) : (
                <div className="text-[11px] mt-1">&nbsp;</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Calendar({ origin, pax, onSelect }: Props) {
  const [cursor, setCursor] = useState(() => dayjs().add(1, "month").startOf("month"));
  const [payloadLeft, setPayloadLeft] = useState<CalendarPayload | null>(null);
  const [payloadRight, setPayloadRight] = useState<CalendarPayload | null>(null);
  const [selected, setSelected] = useState<{ dep: string; ret: string } | null>(null);

  const leftYear = cursor.year();
  const leftMonth = cursor.month();
  const right = cursor.add(1, "month");
  const rightYear = right.year();
  const rightMonth = right.month();

  const minMonth = dayjs().add(1, "month").startOf("month");
  const maxMonth = dayjs().add(10, "month").startOf("month");
  const isAtMinMonth = cursor.isSame(minMonth, "month");
  const isAtMaxMonth = cursor.isSame(maxMonth.subtract(1, "month"), "month");

  useEffect(() => {
    const onPick = (e: any) => {
      setSelected(e.detail);
      onSelect(e.detail);
    };
    window.addEventListener("calendar:select", onPick as any);
    return () => window.removeEventListener("calendar:select", onPick as any);
  }, [onSelect]);

  async function fetchMonth(y: number, m: number) {
    console.log("📦 Fetching:", y, m);
    const qs = new URLSearchParams({
      origin,
      pax: String(pax),
      year: String(y),
      month: String(m),
      forceRefresh: "1",
    });
    const res = await fetch(`/api/calendar-prices?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`calendar ${y}-${m}: ${res.status}`);
    const result = await res.json();
    console.log("✅ Recibido:", result.days);
    return result as CalendarPayload;
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [L, R] = await Promise.all([
          fetchMonth(leftYear, leftMonth),
          fetchMonth(rightYear, rightMonth),
        ]);
        if (!alive) return;
        setPayloadLeft(L);
        setPayloadRight(R);
      } catch (e) {
        console.error("calendar error", e);
        if (!alive) return;
        setPayloadLeft(null);
        setPayloadRight(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [origin, pax, leftYear, leftMonth, rightYear, rightMonth]);

  const prev = () => setCursor((c) => c.subtract(1, "month"));
  const next = () => setCursor((c) => c.add(1, "month"));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {!isAtMinMonth && (
          <button
            className="btn btn-secondary"
            onClick={prev}
            aria-label="Mes anterior"
          >
            ‹
          </button>
        )}
        <div className="text-sm font-semibold opacity-0">.</div>
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

      <div className="flex flex-col md:flex-row md:gap-10">
        <MonthGrid
          title={cursor.format("MMMM YYYY")}
          baseYear={leftYear}
          baseMonth={leftMonth}
          payload={payloadLeft}
          selectedStart={selected?.dep}
        />
          <div className="hidden md:flex md:flex-1">
          <MonthGrid
            title={right.format("MMMM YYYY")}
            baseYear={rightYear}
            baseMonth={rightMonth}
            payload={payloadRight}
            selectedStart={selected?.dep}
          />
        </div>
      </div>
    </div>
  );
}
