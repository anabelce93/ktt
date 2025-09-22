"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
dayjs.locale("es");

type DayPayload = {
  date: string;       // YYYY-MM-DD
  show: boolean;      // disponible
  priceFrom: number | null; // precio base+vuelo por persona (entero) o null
};
type CalendarPayload = {
  origin: string;
  pax: number;
  year: number;
  month: number; // 0-based para JS, pero en API usamos 0=enero? (nuestro endpoint ya convierte)
  days: DayPayload[];
};

type Props = {
  origin: string;
  pax: number;
  onSelect: (range: { dep: string; ret: string } | null) => void; // avisamos al padre
};

const TRIP_LEN = 10; // 10 días totales -> vuelta 9 días después

function isoYMD(d: dayjs.Dayjs) {
  return d.format("YYYY-MM-DD");
}

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
  baseMonth, // 0..11
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
  const startWeekDay = firstDay.day(); // 0 dom..6 sab
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
      <div className="text-center font-semibold mb-2 capitalize">
        {title}
      </div>

      <div className="grid grid-cols-7 text-xs opacity-70 mb-1">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          if (!c.iso || !c.day) {
            return <div key={idx} className="h-12" />;
          }

          const isStart = same(c.iso, startISO || undefined);
          const partOfTrip =
            startISO && endISO ? inRange(c.iso, startISO, endISO) : false;

          // colores:
          // - día seleccionado (inicio): 91c5c5
          // - rango del viaje: 91c5c5 más suave
          // - disponible <1990€: verde claro (#CDECCE aprox), texto negro
          // - disponible >=1990€: amarillo pálido (#FFF6CC aprox), texto negro
          let bg = "";
          let text = "text-black";
          if (isStart) {
            bg = "bg-[#91c5c5]";
          } else if (partOfTrip) {
            bg = "bg-[#91c5c5]/30";
          } else if (c.info?.show && typeof c.info.priceFrom === "number") {
            if ((c.info.priceFrom as number) < 1990) bg = "bg-[#cdecce]";
            else bg = "bg-[#fff6cc]";
          } else {
            bg = "bg-transparent";
            text = "text-gray-400";
          }

          // Hacemos click en el día solo si es seleccionable (show=true).
          // La “confirmación” real la hará el usuario con el botón Siguiente en el padre.
          return (
            <button
              key={idx}
              type="button"
              className={`rounded-lg ${bg} ${text} p-2 h-16 flex flex-col items-center justify-center`}
              onClick={() => {
                // El propio padre es quien guarda la selección,
                // aquí no hacemos nada más que enviar el rango.
                // Si el día no es seleccionable, no hacemos nada.
                if (!c.info?.show) return;
                const dep = c.iso;
                const ret = addDaysISO(dep, TRIP_LEN - 1);
                // Notificamos selección provisional:
                const ev = new CustomEvent("calendar:select", {
                  detail: { dep, ret },
                });
                window.dispatchEvent(ev as any);
              }}
            >
              <div className="text-sm font-medium">{c.day}</div>
              {/* Precio debajo, centrado; si el día está dentro del rango, escondemos precio, salvo el día inicio */}
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
  const [cursor, setCursor] = useState(dayjs().add(1, "month").startOf("month")); // mes siguiente
  const [payloadLeft, setPayloadLeft] = useState<CalendarPayload | null>(null);
  const [payloadRight, setPayloadRight] = useState<CalendarPayload | null>(null);
  const [selected, setSelected] = useState<{ dep: string; ret: string } | null>(
    null
  );

  const leftYear = cursor.year();
  const leftMonth = cursor.month();
  const right = cursor.add(1, "month");
  const rightYear = right.year();
  const rightMonth = right.month();

  // escucha selección provisional desde los días
  useEffect(() => {
    const onPick = (e: any) => {
      setSelected(e.detail);
      onSelect(e.detail); // avisamos al padre para habilitar “Siguiente”
    };
    window.addEventListener("calendar:select", onPick as any);
    return () => window.removeEventListener("calendar:select", onPick as any);
  }, [onSelect]);

  // carga datos 2 meses
  async function fetchMonth(y: number, m: number) {
    const qs = new URLSearchParams({
      origin,
      pax: String(pax),
      year: String(y),
      month: String(m),
    });
    const res = await fetch(`/api/calendar-prices?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`calendar ${y}-${m}: ${res.status}`);
    return (await res.json()) as CalendarPayload;
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
        <button className="btn btn-secondary" onClick={prev} aria-label="Mes anterior">
          ‹
        </button>
        <div className="text-sm font-semibold opacity-0">.</div>
        <button className="btn btn-secondary" onClick={next} aria-label="Mes siguiente">
          ›
        </button>
      </div>

      {/* Móvil: 1 mes. Desktop: 2 meses con separación amplia */}
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
      {/* IMPORTANTE: ya NO mostramos texto “Salida… Vuelta…”. 
          El botón Siguiente/Atrás lo pone Widget, así quedan alineados en la misma fila. */}
    </div>
  );
}
