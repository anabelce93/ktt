"use client";
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { fmtHM } from "@/lib/utils";

type Seg = {
  marketing_carrier: string;
  marketing_flight_number?: string;
  operating_carrier?: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  duration_minutes: number;
  stops: number;
  connection_airport?: string;
  connection_minutes?: number;
};

type Opt = {
  id: string;
  delta_vs_base_eur: number;
  out: Seg[];
  ret: Seg[];
  baggage_included: boolean;
  cabin: string;
};

export default function FlightsModal({
  open,
  onClose,
  origin,
  departure,
  ret,
  pax,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  origin: string;
  departure: string;
  ret: string;
  pax: number;
  onSelect: (optId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<Opt[]>([]);

  useEffect(() => {
    if (!open || !departure || !ret) return;
    setLoading(true);
    fetch(
      `/api/flight-options?origin=${origin}&departure=${departure}&return=${ret}&pax=${pax}`
    )
      .then((r) => r.json())
      .then((j) => {
        setOpts(j.options || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, origin, departure, ret, pax]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:w-[720px] max-h-[90vh] rounded-t-2xl md:rounded-2xl overflow-auto p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">
            Vuelos para {dayjs(departure).format("DD/MM")} →{" "}
            {dayjs(ret).format("DD/MM")}
          </h3>
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {loading && (
          <div className="text-sm text-gray-600">Buscando opciones…</div>
        )}
        {!loading && opts.length === 0 && (
          <div className="text-sm">
            No hay combinaciones disponibles con nuestras condiciones.
          </div>
        )}

        <div className="space-y-3">
          {opts.map((o) => (
            <div key={o.id} className="border rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  +{o.delta_vs_base_eur} €
                </div>
                <div className="space-x-2">
                  <span className="badge">Maleta incluida</span>
                  <span className="badge">Economy</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">IDA</div>
                  {o.out.length > 0 && (
                    <div className="text-sm">
                      <div>
                        <strong>{o.out[0].origin}</strong>{" "}
                        {fmtHM(o.out[0].departure)} →{" "}
                        <strong>{o.out[o.out.length - 1].destination}</strong>{" "}
                        {fmtHM(o.out[o.out.length - 1].arrival)}
                      </div>
                      <div>
                        Duración aprox. {Math.round((o.out[0].duration_minutes || 0) / 60)}h
                      </div>
                      <div>
                        {(o.out[0].stops || 0)} escala(s)
                        {o.out[0].connection_airport
                          ? `, conexión en ${o.out[0].connection_airport} ~${o.out[0].connection_minutes} min`
                          : ""}
                      </div>
                      <div>
                        Aerolínea: {o.out[0].marketing_carrier}
                        {o.out[0].operating_carrier
                          ? ` (operado por ${o.out[0].operating_carrier})`
                          : ""}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">VUELTA</div>
                  {o.ret.length > 0 && (
                    <div className="text-sm">
                      <div>
                        <strong>{o.ret[0].origin}</strong>{" "}
                        {fmtHM(o.ret[0].departure)} →{" "}
                        <strong>{o.ret[o.ret.length - 1].destination}</strong>{" "}
                        {fmtHM(o.ret[o.ret.length - 1].arrival)}
                      </div>
                      <div>
                        Duración aprox. {Math.round((o.ret[0].duration_minutes || 0) / 60)}h
                      </div>
                      <div>
                        {(o.ret[0].stops || 0)} escala(s)
                        {o.ret[0].connection_airport
                          ? `, conexión en ${o.ret[0].connection_airport} ~${o.ret[0].connection_minutes} min`
                          : ""}
                      </div>
                      <div>
                        Aerolínea: {o.ret[0].marketing_carrier}
                        {o.ret[0].operating_carrier
                          ? ` (operado por ${o.ret[0].operating_carrier})`
                          : ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 text-right">
                <button className="btn btn-primary" onClick={() => onSelect(o.id)}>
                  Seleccionar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
