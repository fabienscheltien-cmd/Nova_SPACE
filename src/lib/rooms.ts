import roomBoardroom from "@/assets/room-boardroom.jpg";
import roomCreative from "@/assets/room-creative.jpg";
import roomFormation from "@/assets/room-formation.jpg";

export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  image: string;
  description: string;
  equipements: string[];
}

export const ROOMS: Room[] = [
  {
    id: "conseil",
    name: "Salle du Conseil",
    capacity: 12,
    location: "8ᵉ étage — Salle 102",
    image: roomBoardroom,
    description:
      "Notre salle prestige avec vue panoramique, grande table en noyer et visioconférence 4K.",
    equipements: ["Écran 75\"", "Visioconférence", "Tableau blanc", "Café offert"],
  },
  {
    id: "atelier",
    name: "Salon Atelier",
    capacity: 4,
    location: "6ᵉ étage — Salle 604",
    image: roomCreative,
    description:
      "Un écrin feutré pour vos entretiens, sessions de coaching ou réunions confidentielles.",
    equipements: ["Fauteuils lounge", "Wi-Fi fibre", "Luminaire design"],
  },
  {
    id: "formation",
    name: "Amphithéâtre Formation",
    capacity: 60,
    location: "2ᵉ étage — Auditorium 201",
    image: roomFormation,
    description:
      "Configuration séminaire avec vidéoprojecteur, sonorisation et tables modulables.",
    equipements: ["Vidéoprojecteur", "Sonorisation", "60 postes", "Paperboard"],
  },
];

/** Créneaux toutes les 30 minutes, de 08:00 à 19:30. */
export const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Durées réservables, en heures (pas de 30 minutes). */
export const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

export function toMinutes(time: string) {
  const [h = "0", m = "0"] = time.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/** "1h30", "30 min", "2h" */
export function formatDuration(hours: number) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}


export interface Reservation {
  id: string;
  roomId: string;
  date: string;
  slot: string;
  hours: number;
  name: string;
  email: string;
  subject: string;
  location: string;
  confidential: boolean;
  createdAt: string;
}

export interface OccupiedSlot {
  slot: string;
  hours: number;
}

/**
 * Créneaux de départ impossibles : ceux qui chevaucheraient une réservation
 * existante (ou qui déborderaient après la fermeture à 20:00).
 */
export function computeBlockedSlots(occupied: OccupiedSlot[], durationHours: number) {
  const ranges = occupied.map((o) => {
    const start = toMinutes(o.slot);
    return [start, start + Math.round(o.hours * 60)] as const;
  });
  const duration = Math.round(durationHours * 60);
  const closing = 20 * 60;
  const blocked = new Set<string>();
  for (const time of TIME_SLOTS) {
    const start = toMinutes(time);
    const end = start + duration;
    if (end > closing || ranges.some(([s, e]) => start < e && end > s)) blocked.add(time);
  }
  return blocked;
}

const KEY = "zen-reservation-ids";

/** Identifiants des réservations créées depuis ce navigateur. */
export function getStoredIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberReservation(id: string) {
  localStorage.setItem(KEY, JSON.stringify([id, ...getStoredIds().filter((x) => x !== id)]));
}

export function forgetReservation(id: string) {
  localStorage.setItem(KEY, JSON.stringify(getStoredIds().filter((x) => x !== id)));
}



export function formatDateFR(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

/** Libellé affiché dans le calendrier (masqué si confidentiel). */
export function calendarTitle(r: Reservation, roomName: string) {
  if (r.confidential) return `Réservé — ${roomName} (confidentiel)`;
  return `${r.subject || "Réunion"} — ${r.name} (${formatDuration(r.hours)})`;
}

function icsDate(date: string, time: string, addHours = 0) {
  const d = new Date(`${date}T${time}:00`);
  d.setMinutes(d.getMinutes() + Math.round(addHours * 60));

  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0") +
    "T" +
    String(d.getUTCHours()).padStart(2, "0") +
    String(d.getUTCMinutes()).padStart(2, "0") +
    "00Z"
  );
}

function escapeICS(v: string) {
  return v.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

/** Génère le contenu .ics qui bloque le créneau dans le calendrier. */
export function buildICS(r: Reservation, roomName: string) {
  const title = calendarTitle(r, roomName);
  const description = r.confidential
    ? "Créneau bloqué — détails confidentiels."
    : `Objet : ${r.subject || "Réunion"}\nRéservé par : ${r.name} (${r.email})\nDurée : ${formatDuration(r.hours)}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nova Zen//Reservation//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${r.id}@nova-zen`,
    `DTSTAMP:${icsDate(r.date, r.slot)}`,
    `DTSTART:${icsDate(r.date, r.slot)}`,
    `DTEND:${icsDate(r.date, r.slot, r.hours)}`,
    `SUMMARY:${escapeICS(title)}`,
    `LOCATION:${escapeICS(r.location)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `CLASS:${r.confidential ? "PRIVATE" : "PUBLIC"}`,
    "TRANSP:OPAQUE",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Lien data: téléchargeable pour bloquer le créneau dans n'importe quel agenda. */
export function icsHref(r: Reservation, roomName: string) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildICS(r, roomName))}`;
}

/** Lien Google Agenda pré-rempli. */
export function googleCalendarHref(r: Reservation, roomName: string) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(r, roomName),
    dates: `${icsDate(r.date, r.slot)}/${icsDate(r.date, r.slot, r.hours)}`,
    location: r.location,
    details: r.confidential
      ? "Créneau bloqué — détails confidentiels."
      : `Objet : ${r.subject || "Réunion"} | Réservé par : ${r.name} | Durée : ${formatDuration(r.hours)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
