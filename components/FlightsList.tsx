"use client";

import { useEffect, useState } from "react";
import { FlightOption } from "@/lib/types";
import { baseFarePerPerson } from "@/lib/pricing";
import { minutesBetween } from "@/lib/format";

type Props = {
  origin: string;
  departure: string;
  ret: string;
  pax: number;
  calendarPrice: number | null;
  onBack: () => void;
  onConfirm: (id: string, option: FlightOption) => void;
  onBaseFare?: (fare: number) => void;
  onCalendarPrice?: (price: number) => void;
};

function AirlineLoader() {
  const logos = ["QR", "TK", "KE", "OZ", "AF", "KL", "LH", "IB", "UX", "BA"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % logos.length);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const code = logos[index];
  const src = `/airlines/${code}.svg`;

  return (
    <div className="flex flex-col items-center py-6 text-sm text-gray-500">
      <div className="mb-2">Buscando vuelos disponibles…</div>
      <img src={src} alt={code} className="h-6 w-auto" />
    </div>
  );
}

export default function FlightsList({
  origin,
  departure,
  ret,
  pax,
  calendarPrice,
  onBack,
  onConfirm,
  onBaseFare,
  onCalendarPrice,
}: Props) {
  const [options, setOptions] = useState<FlightOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch(`/api/flight-options?origin=${origin}&dep=${departure}&ret=${ret}&pax=${pax}`);
      const json = await res.json();

      const escalaOk = (segs: any[]) => {
        if (segs.length <= 1) return true;
        const layover = minutesBetween(segs[0].arrival, segs[1].departure);
        return layover <= 720;
      };

      const filtered = (json.options || []).filter((x: FlightOption) =>
        x.out.length <= 2 &&
        x.ret.length <= 2 &&
        escalaOk(x.out) &&
        escalaOk(x.ret) &&
        x.baggage_included
      );

      setOptions(filtered);
      setLoading(false);

      const baseFare = baseFarePerPerson(departure, pax);
      onBaseFare?.(baseFare);
      if (filtered[0]) {
        onCalendarPrice?.(filtered[0].total_amount_per_person + baseFare);
      }
    };
    load();
  }, [origin, departure, ret, pax]);

  if (loading) return <AirlineLoader />;

  if (!loading && options.length === 0) {
    return (
      <div className="text-sm text-red-500">
        No hay vuelos disponibles para esas fechas con los filtros actuales.
        Prueba con otras fechas o ajusta los requisitos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {options.map((opt) => {
        const total = opt.total_amount_per_person + baseFarePerPerson(departure, pax);
        const extra = calendarPrice != null ? total - calendarPrice : 0;
        const label = extra <= 0 ? "+0€" : `+${extra}€`;

        return (
          <button
            key={opt.id}
            className="border rounded-lg p-3 w-full text-left hover:bg-gray-50"
            onClick={() => onConfirm(opt.id, opt)}
          >
            <div className="font-medium">{label}</div>
            <div className="text-sm text-gray-600">
              {opt.out[0]?.origin} → {opt.ret[opt.ret.length - 1]?.destination}
            </div>
          </button>
        );
      })}
    </div>
  );
}
