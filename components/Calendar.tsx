"use client";
import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { formatDateES } from "@/lib/format";

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Europe/Madrid");

/** Tipos que vienen de /api/calendar-prices */
type DayEntry = {
  date: string;        // "YYYY-MM-DD"
  show: boolean;       // disponible
  priceFrom: number | null; // precio vuelo + base por persona? (mostramos precio simple sin "desde")
  baseFare: number;    // por persona (alto/normal según vuestras reglas)
};

type MonthPayload = {
  origin: string;
  pax: number;
  year: number;
  month: number; // 0..11
  days: DayEntry[];
};

function toYMD(d: dayjs.Dayjs) {
  return d.format("YYYY-MM-DD");
}
function parseYMD(s: string) {
  return dayjs.tz(s, "Europe/Madrid");
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function isSameDay(a: dayjs.Dayjs, b: dayjs.Dayjs) {
  return a.year() === b.year() && a.month() === b.month() && a.date() === b.date();
}

function isInRangeInclusive(d: dayjs.Dayjs, start: dayjs.Dayjs, end: dayjs.Dayjs) {
  // [start, end]
  return (d.isAfter(start) || isSameDay(d, start)) && (d.isBefore(end) || isSameDay(d, end));
}

/** Estilos/colores (tus colores) */
const COLOR_PRIMARY = "#91c5c5"; // rango seleccionado
const COLOR_HIGHLIGHT_GREEN = "#DFF5E1"; // < 1990
const COLOR_HIGHLIGHT_YELLOW = "#FFF6CC"; // >= 1990
const COLOR_DISABLED = "#f2f2f2";
const TEXT_DEFAULT = "#111111";

/** Un día del grid */
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
    if (isInTrip) return COLOR_PRIMARY; // rango seleccionado
    if (!entry || !entry.show || !inMonth) return COLOR_DISABLED; // no disponible
    if (entry.priceFrom != null) {
      if (entry.priceFrom < 1990) return COLOR_HIGHLIGHT_GREEN; // oferta
      return COLOR_HIGHLIGHT_YELLOW;
    }
    return COLOR_DISABLED;
  })();

  const textColor = isInTrip ? "#ffffff" : TEXT_DEFAULT;
  const priceStr =
    entry && entry.show && entry.priceFrom != null ? `${entry.priceFrom}€` : "";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => clickable && onPickStart(iso)}
        disabled={!clickable}
        className="w-9 h-9 rounded-md flex items-center justify-center text-sm"
        style={{
          background: bg,
          color: isInTrip ? "#ffffff" : textColor,
          opacity: inMonth ? 1 : 0.4,
          boxShadow: isStart ? "inset 0 0 0 2px #000000" : "none", // marca el inicio
          cursor: clickable ? "pointer" : "default",
        }}
        aria-label={iso}
      >
        {date.date()}
      </button>
      {/* Precio debajo, fuera del recuadro, con espacio reservado para alinear las filas */}
      <div
        className="text-xs mt-1 text-center"
        style={{ minHeight: 16, lineHeight: "16px", width: "100%" }}
      >
        {priceStr}
      </div>
    </div>
  );
}

/** Un mes completo en grid 7x6 */
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
  baseMonth: number; // 0..11
  payload: MonthPayload | null;
  selectedStart: string | null; // YYYY-MM-DD
  tripLen: number;
  onPickStart: (iso: string) => void;
}) {
  const firstOfMonth = dayjs.tz().year(baseYear).month(baseMonth).date(1);
  const daysInMonth = firstOfMonth.daysInMonth();
  // Offset para empezar lunes (ISO): dayjs().isoWeekday() -> 1..7, nosotros queremos 0..6
  const startWeekday = (firstOfMonth.isoWeekday() + 6) % 7; // lunes=0, ..., domingo=6
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const selStart = selectedStart ? parseYMD(selectedStart) : null;
  const selEnd = selStart ? selStart.add(tripLen - 1, "day") : null;

  // Mapa rápido para encontrar DayEntry por fecha
  const map = useMemo(() => {
    const m = new Map<string, DayEntry>();
    if (payload?.days) {
      for (const d of payload.days) m.set(d.date, d);
    }
    return m;
  }, [payload]);

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const d = firstOfMonth.add(i - startWeekday, "day");
    const inMonth = d.month() === baseMonth;
    const entry = map.get(toYMD(d));

    const isTrip =
      selStart && selEnd ? isInRangeInclusive(d, selStart, selEnd) : false;
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
      <div className="text-center font-semibold mb-2">{title}</div>
      {/* Cabecera de días */}
      <div className="grid grid-cols-7 text-xs opacity-70 mb-1">
        <div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div><div>D</div>
      </div>
      {/* Celdas */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells}
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
  const TRIP_LEN = 10; // 10 días: salida + 9
  const [cursor, setCursor] = useState(() => {
    // mostrar SIEMPRE el mes siguiente al actual
    const now = dayjs.tz();
    return now.add(1, "month").startOf("month");
  });

  const [payloadLeft, setPayloadLeft] = useState<MonthPayload | null>(null);
  const [payloadRight, setPayloadRight] = useState<MonthPayload | null>(null);
  const [loadingLeft, setLoadingLeft] = useState(false);
  const [loadingRight, setLoadingRight] = useState(false);

  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const leftYear = cursor.year();
  const leftMonth = cursor.month();
  const right = cursor.add(1, "month");
  const rightYear = right.year();
  const rightMonth = right.month();

  // fetch de precios para el mes izquierdo
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingLeft(true);
      try {
        const url = `/api/calendar-prices?origin=${encodeURIComponent(
          origin
        )}&pax=${pax}&year=${leftYear}&month=${leftMonth}`;
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) setPayloadLeft(j as MonthPayload);
      } catch (e) {
        if (!cancelled) setPayloadLeft(null);
      } finally {
        if (!cancelled) setLoadingLeft(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [origin, pax, leftYear, leftMonth]);

  // fetch de precios para el mes derecho (solo desktop; en móvil no hace falta, pero no pasa nada si carga)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingRight(true);
      try {
        const url = `/api/calendar-prices?origin=${encodeURIComponent(
          origin
        )}&pax=${pax}&year=${rightYear}&month=${rightMonth}`;
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) setPayloadRight(j as MonthPayload);
      } catch (e) {
        if (!cancelled) setPayloadRight(null);
      } finally {
        if (!cancelled) setLoadingRight(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [origin, pax, rightYear, rightMonth]);

  const dep = selectedStart ? selectedStart : "";
  const ret = selectedStart ? toYMD(parseYMD(selectedStart).add(TRIP_LEN - 1, "day")) : "";
  const tripLen = TRIP_LEN;

  const next = () => {
    setCursor((c) => c.add(1, "month").startOf("month"));
    // mantenemos la selección si cae dentro del nuevo rango? mejor limpiarla para evitar líos
    setSelectedStart(null);
  };
  const prev = () => {
    setCursor((c) => c.subtract(1, "month").startOf("month"));
    setSelectedStart(null);
  };

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
      <div className="flex flex-col md:flex-row md:gap-10">
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
              Salida: <strong>{formatDateES(dep)}</strong> · Vuelta:{" "}
              <strong>{formatDateES(ret)}</strong>{" "}
              <span className="opacity-70">(viaje de {tripLen} días)</span>
            </>
          ) : (
            <span className="opacity-70">Selecciona el día de salida</span>
          )}
        </div>
        <div className="flex gap-2 md:justify-end">
          {/* Sin botón Atrás aquí para no duplicar con el de Widget */}
          <button
            className="btn btn-primary"
            disabled={!canConfirm}
            onClick={() => onConfirm({ dep, ret })}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
