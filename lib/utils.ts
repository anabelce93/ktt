import dayjs from "dayjs";

export const TZ = process.env.WIDGET_TIMEZONE || "Europe/Madrid";

export function addDaysISO(dateISO: string, n: number) {
  return dayjs(dateISO).add(n, "day").format("YYYY-MM-DD");
}
export function clamp(n:number,min:number,max:number){ return Math.max(min, Math.min(max,n)); }
export function fmtHM(dateISO: string) {
  // Keep as HH:mm, assumes local at airport (frontend clarifies TZ)
  return dayjs(dateISO).format("HH:mm");
}
