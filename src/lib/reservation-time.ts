const TIME_ZONE = "Europe/Paris";

/** Décalage (en minutes) du fuseau Europe/Paris pour un instant donné. */
function zoneOffsetMinutes(utcDate: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcDate);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtc - utcDate.getTime()) / 60000;
}

/** Convertit une date/heure locale (Europe/Paris) + durée en instants ISO UTC. */
export function toIsoRange(date: string, slot: string, hours: number) {
  const [y = "1970", m = "01", d = "01"] = date.split("-");
  const [hh = "00", mm = "00"] = slot.split(":");
  const naive = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  // Deux passes pour gérer les bascules d'heure d'été.
  let start = new Date(naive - zoneOffsetMinutes(new Date(naive)) * 60000);
  start = new Date(naive - zoneOffsetMinutes(start) * 60000);
  const end = new Date(start.getTime() + Math.round(hours * 60) * 60000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
