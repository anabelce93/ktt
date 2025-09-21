import dayjs from "dayjs";

const inRange = (x:string, s:string, e:string) => {
  const d=dayjs(x), a=dayjs(s), b=dayjs(e);
  return d.isAfter(a.subtract(1,"day")) && d.isBefore(b.add(1,"day"));
};

export function getSeason(dateISO: string): "alta" | "normal" {
  const y = dayjs(dateISO).year();
  if (y===2025) {
    if (inRange(dateISO,"2025-10-10","2025-11-05")) return "alta";
    if (inRange(dateISO,"2025-12-23","2026-01-01")) return "alta";
  }
  if (y===2026) {
    if (inRange(dateISO,"2026-02-14","2026-02-18")) return "alta";
    if (inRange(dateISO,"2026-03-25","2026-04-15")) return "alta";
    if (inRange(dateISO,"2026-07-10","2026-08-25")) return "alta";
    if (inRange(dateISO,"2026-09-23","2026-09-27")) return "alta";
    if (inRange(dateISO,"2026-10-10","2026-11-05")) return "alta";
    if (inRange(dateISO,"2026-12-23","2027-01-01")) return "alta";
  }
  if (y===2027) {
    if (inRange(dateISO,"2026-12-23","2027-01-01")) return "alta";
  }
  return "normal";
}

export function baseFarePerPerson(dateISO: string, pax: number) {
  const alta = {1:1470,2:1295,3:1245,4:1220,5:1195,6:1170} as Record<number,number>;
  const normal = {1:1290,2:1175,3:1125,4:1100,5:1075,6:1050} as Record<number,number>;
  const t = getSeason(dateISO)==="alta" ? alta : normal;
  const p = Math.max(1, Math.min(6, pax));
  return t[p];
}
