"use client";
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import isoWeek from "dayjs/plugin/isoWeek";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { formatDateES } from "@/lib/format";

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Europe/Madrid");
dayjs.locale("es");

type DayEntry = {
  date: string;
  show: boolean;
  priceFrom: number | null;
  baseFare: number;
};

type MonthPayload = {
  origin: string;
  pax: number;
  year: number;
  month: number;
  days: DayEntry[];
};

function toYMD(d: dayjs.Dayjs) {
  return d.format("YYYY-MM-DD");
}
function parseYMD(s: string) {
  return dayjs.tz(s, "Europe/Madrid");
}
function isSameDay(a: dayjs.Dayjs, b: dayjs.Dayjs) {
  return a.year() === b.year() && a.month() === b.month() && a.date() === b.date();
}
function isInRangeInclusive(d: dayjs.Dayjs, start: dayjs.Dayjs, end: dayjs.Dayjs) {
  return (d.isAfter(start) || isSameDay(d, start)) && (d.isBefore(end) || isSameDay(d, end));
}

const COLOR_PRIMARY = "#91c5c5"; // rango seleccionado
const COLOR_HIGHLIGHT_GREEN = "#DFF5E1"; // < 1990
const COLOR_HIGHLIGHT_YELLOW = "#FFF6CC"; // >= 1990
const COLOR_DISABLED = "#f2f2f2";
const TEXT_DEFAULT = "#111111";

function DayCell({
  date,
  inMonth,
  entry,
  isInTrip,
  isStart,
  onPickStart,
}: {
  date: dayjs.Dayjs;
  inMonth: boolean;
  entry: DayEntry | undefined;
  isInTrip: boolean;
  isStart: boolean;
  onPickStart: (iso: string) => void;
}) {
  const iso = toYMD(date);
  const clickable = !!entry?.show && inMonth;

  const bg = (() => {
    if (isInTrip) return COLOR_PRIMARY;
    if (!entry || !entry.show || !inMonth) return COLOR_DISABLED;
    if (entry.priceFrom != null) {
      if (entry.priceFrom < 1990) return COLOR_HIGHLIGHT_GREEN;
      return COLOR_HIGHLIGHT_YELLOW;
    }
    return COLOR_DISABLED;
  })();

  // Precio: solo lo mostramos si NO está en el rango, o si es el inicio del rango
  const showPrice =
    entry && entry.show && entry.priceFrom != null && (!isInTrip || isStart);

  const priceStr = showPrice ? `${Math.round(entry!.priceFrom!)}€` : "";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => clickable && onPickStart(iso)}
        disabled={!clickable}
        className="w-9 h-9 rounded-md flex items-center justify-center text-sm"
        style={{
          background: bg,
          color: isInTrip ? "#ffffff" : TEXT_DEFAULT,
          opacity: inMonth ? 1 : 0.4,
          boxShadow: isStart ? "inset 0 0 0 2px #000000" : "none",
          cursor: clickable ? "pointer" : "default",
        }}
        aria-label={iso}
      >
        {date.date()}
      </button>
      <div
        className="text-xs mt-1 text-center"
        style={{ minHeight: 16, lineHeight: "16px", width: "100%" }}
      >
        {priceStr}
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
  baseMonth: number;
  payload: MonthPayload | null;
  selectedStart: string | null;
  tripLen: number;
  onPickStart: (iso: string) => void;
}) {
  const firstOfMonth = dayjs.tz().year(baseYear).month(baseMonth).date(1);
  const daysInMonth = firstOfMonth.daysInMonth();
  const startWeekday = (firstOfMonth.isoWeekday() + 6) % 7; // lunes=0
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const selStart = selectedStart ? parseYMD(selectedStart) : null;
  const selEnd = selStart ? selStart.add(tripLen - 1, "day") : null;

  const map = useMemo(() => {
    const m = new Map<string, DayEntry>();
    if (payload?.days) for (const d of payload.days) m.set(d.date, d);
    return m;
  }, [payload]);

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const d = firstOfMonth.add(i - startWeekday, "day");
    const inMonth = d.month() === baseMonth;
    const entry = map.get(toYMD(d));
    const isTrip = selStart && selEnd ? isInRangeInclusive(d, selStart, selEnd) : false;
    const isStart = selStart ? isSameDay(d, selStart) : false;

    cells.push(
      <div key={i} className="py-1">
        <DayCell
          date={d}
          inMonth={!!inMonth}
          entry={entry}
          isInTrip={!!isTrip}
          isStart={!!isStart}
          onPickStart={onPickStart}
        />
      </div>
    );
  }

  return (
    <div className="flex-1">
      <div className="text-center font-semibold mb-2 capitalize">{title}</div>
      <div className="grid grid-cols-7 text-xs opacity-70 mb-1">
        <div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div><div>D</div>
      </div>
      <div className="grid grid-cols-7 gap-y-1">{cells}</div>
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
  const TRIP_LEN = 10;
  const [cursor, setCursor] = useState(() => {
    const now = dayjs.tz();
    return now.add(1, "month").startOf("month");
  });

  const [payloadLeft, setPayloadLeft] = useState<MonthPayload | null>(null);
  const [payloadRight, setPayloadRight] = useState<MonthPayload | null>(null);

  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const leftYear = cursor.year();
  const leftMonth = cursor.month();
  const right = cursor.add(1, "month");
  const rightYear = right.year();
  const rightMonth = right.month();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `/api/calendar-prices?origin=${encodeURIComponent(
          origin
        )}&pax=${pax}&year=${leftYear}&month=${leftMonth}`;
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) setPayloadLeft(j as MonthPayload);
      } catch {
        if (!cancelled) setPayloadLeft(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, pax, leftYear, leftMonth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = `/api/calendar-prices?origin=${encodeURIComponent(
          origin
        )}&pax=${pax}&year=${rightYear}&month=${rightMonth}`;
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) setPayloadRight(j as MonthPayload);
      } catch {
        if (!cancelled) setPayloadRight(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, pax, rightYear, rightMonth]);

  const dep = selectedStart ? selectedStart : "";
  const ret = selectedStart ? toYMD(parseYMD(selectedStart).add(TRIP_LEN - 1, "day")) : "";

  const next = () => {
    setCursor((c) => c.add(1, "month").startOf("month"));
    setSelectedStart(null);
  };
  const prev = () => {
    setCursor((c) => c.subtract(1, "month").startOf("month"));
    setSelectedStart(null);
  };

  const canConfirm = !!selectedStart;

  return (
    <div>
      {/* Botonera superior con flechas */}
      <div className="flex items-center justify-between mb-4">
        <button className="btn btn-secondary" onClick={prev} aria-label="Mes anterior">
          ‹
        </button>
        <div className="text-sm font-semibold opacity-80" />
        <button className="btn btn-secondary" onClick={next} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      {/* Móvil: 1 mes. Desktop: 2 meses con separación */}
      <div className="flex flex-col md:flex-row md:gap-10">
        <MonthGrid
          title={cursor.format("MMMM YYYY")}
          baseYear={leftYear}
          baseMonth={leftMonth}
          payload={payloadLeft}
          selectedStart={selectedStart}
          tripLen={TRIP_LEN}
          onPickStart={setSelectedStart}
        />
        <div className="hidden md:flex md:flex-1">
          <MonthGrid
            title={right.format("MMMM YYYY")}
            baseYear={rightYear}
            baseMonth={rightMonth}
            payload={payloadRight}
            selectedStart={selectedStart}
            tripLen={TRIP_LEN}
            onPickStart={setSelectedStart}
          />
        </div>
      </div>

      {/* Fila inferior SIEMPRE en una sola línea: texto a la izquierda, botón a la derecha */}
      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="text-sm min-h-[20px]">
          {selectedStart ? (
            <>
              Salida: <strong>{formatDateES(dep)}</strong> · Vuelta:{" "}
              <strong>{formatDateES(ret)}</strong>{" "}
              <span className="opacity-70">(viaje de {TRIP_LEN} días)</span>
            </>
          ) : (
            <span className="opacity-70">Selecciona el día de salida</span>
          )}
        </div>
        <button
          className="btn btn-primary"
          disabled={!canConfirm}
          onClick={() => onConfirm({ dep, ret })}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
