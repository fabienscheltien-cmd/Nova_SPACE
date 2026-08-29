import roomBoardroom from "@/assets/room-boardroom.jpg";
import roomCreative from "@/assets/room-creative.jpg";
import roomFormation from "@/assets/room-formation.jpg";

export interface Room {
  id: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  image: string;
  description: string;
  equipements: string[];
}

export const ROOMS: Room[] = [
  {
    id: "conseil",
    name: "Salle du Conseil",
    capacity: 12,
    pricePerHour: 45,
    image: roomBoardroom,
    description:
      "Notre salle prestige avec vue panoramique, grande table en noyer et visioconférence 4K.",
    equipements: ["Écran 75\"", "Visioconférence", "Tableau blanc", "Café offert"],
  },
  {
    id: "atelier",
    name: "Salon Atelier",
    capacity: 4,
    pricePerHour: 18,
    image: roomCreative,
    description:
      "Un écrin feutré pour vos entretiens, sessions de coaching ou réunions confidentielles.",
    equipements: ["Fauteuils lounge", "Wi-Fi fibre", "Luminaire design"],
  },
  {
    id: "formation",
    name: "Amphithéâtre Formation",
    capacity: 60,
    pricePerHour: 120,
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
