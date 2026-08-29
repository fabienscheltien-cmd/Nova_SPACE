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

export const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

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

const KEY = "zen-reservations";

export function getReservations(): Reservation[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Reservation[];
  } catch {
    return [];
  }
}

export function addReservation(r: Omit<Reservation, "id" | "createdAt">) {
  const reservations = getReservations();
  const reservation: Reservation = {
    ...r,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([reservation, ...reservations]));
  return reservation;
}

export function cancelReservation(id: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(getReservations().filter((r) => r.id !== id)),
  );
}

export function isSlotTaken(roomId: string, date: string, slot: string) {
  const start = parseInt(slot, 10);
  return getReservations().some((r) => {
    if (r.roomId !== roomId || r.date !== date) return false;
    const rStart = parseInt(r.slot, 10);
    return start >= rStart && start < rStart + r.hours;
  });
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
  return `${r.subject || "Réunion"} — ${r.name} (${r.hours}h)`;
}

function icsDate(date: string, time: string, addHours = 0) {
  const d = new Date(`${date}T${time}:00`);
  d.setHours(d.getHours() + addHours);
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
    : `Objet : ${r.subject || "Réunion"}\nRéservé par : ${r.name} (${r.email})\nDurée : ${r.hours}h`;
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
      : `Objet : ${r.subject || "Réunion"} | Réservé par : ${r.name} | Durée : ${r.hours}h`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
