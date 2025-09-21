"use client";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

type Day = { date: string; show: boolean; priceFrom: number|null; };

export default function Calendar({ origin, pax, onPick }:{ origin:string; pax:number; onPick:(d:{date:string, ret:string})=>void }) {
  const start = dayjs().add(1,"month");
  const [cursor, setCursor] = useState({ y: start.year(), m: start.month() }); // 0-based month
  const [data, setData] = useState<{days:Day[]} | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(y:number,m:number){
    setLoading(true);
    const res = await fetch(`/api/calendar-prices?origin=${origin}&pax=${pax}&year=${y}&month=${m}`);
    const j = await res.json();
    setData({ days: j.days });
    setLoading(false);
  }

  useEffect(()=>{ load(cursor.y, cursor.m); }, [origin, pax, cursor.y, cursor.m]);

  const dateObj = dayjs().year(cursor.y).month(cursor.m).date(1);
  const daysIn = dateObj.daysInMonth();
  const grid: Array<Day & {d:number}> = [];
  for(let d=1; d<=daysIn; d++) {
    const item = data?.days[d-1];
    grid.push({ ...(item || { date: dateObj.date(d).format("YYYY-MM-DD"), show:false, priceFrom:null }), d });
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <button className="btn btn-secondary" onClick={()=> setCursor(c=> ({ y: dayjs().year(c.y).month(c.m).subtract(1,"month").year(), m: dayjs().year(c.y).month(c.m).subtract(1,"month").month() }))}>←</button>
        <div className="font-semibold">{dateObj.format("MMMM YYYY")}</div>
        <button className="btn btn-secondary" onClick={()=> setCursor(c=> ({ y: dayjs().year(c.y).month(c.m).add(1,"month").year(), m: dayjs().year(c.y).month(c.m).add(1,"month").month() }))}>→</button>
      </div>
      {loading && <div className="text-sm text-gray-600">Cargando…</div>}
      <div className="grid grid-cols-7 gap-2">
        {grid.map((g,i)=>{
          const disabled = !g.show;
          return (
            <button key={i} disabled={disabled} onClick={()=>{
              const ret = dayjs(g.date).add(9,"day").format("YYYY-MM-DD");
              onPick({ date: g.date, ret });
            }}
              className={`border rounded-xl p-2 text-left ${disabled? "opacity-40 cursor-not-allowed":"hover:border-brand1"}`}>
              <div className="text-xs">{g.d}</div>
              <div className="text-sm font-semibold">{g.priceFrom? `desde ${Math.round(g.priceFrom)} €`:""}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
