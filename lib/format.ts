// lib/format.ts
export function formatDuration(mins?: number | null): string {
  if (!mins && mins !== 0) return "";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

export function hhmm(iso: string | undefined): string {
  if (!iso) return "";
  // Mostramos HH:MM en 24h, sin forzar zona (usamos la local del server/cliente)
  // Si quisieras la de Madrid siempre: añade { timeZone: "Europe/Madrid" }
  try {
    return new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(11, 16); // fallback "HH:MM" del ISO
  }
}
