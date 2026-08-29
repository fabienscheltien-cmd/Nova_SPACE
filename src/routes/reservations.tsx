import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarX2, Trash2, Users } from "lucide-react";
import { Header } from "@/components/Header";
import {
  ROOMS,
  cancelReservation,
  formatDateFR,
  getReservations,
} from "@/lib/rooms";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "Mes réservations — Nova Zen" },
      {
        name: "description",
        content: "Suivez et gérez vos réservations de salles de réunion.",
      },
      { property: "og:title", content: "Mes réservations — Nova Zen" },
      {
        property: "og:description",
        content: "Suivez et gérez vos réservations de salles de réunion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  const [reservations, setReservations] = useState<ReturnType<typeof getReservations>>([]);

  useEffect(() => {
    setReservations(getReservations());
  }, []);

  function handleCancel(id: string) {
    cancelReservation(id);
    setReservations(getReservations());
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-28">
        <h1 className="text-4xl font-bold tracking-tight">Mes réservations</h1>
        <p className="mt-3 text-muted-foreground">
          Retrouvez ici tous vos créneaux, passés et à venir.
        </p>

        {reservations.length === 0 ? (
          <div className="mt-16 flex flex-col items-center rounded-2xl border border-dashed border-border p-16 text-center">
            <CalendarX2 className="size-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">
              Aucune réservation pour le moment
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Réservez votre première salle en quelques secondes.
            </p>
            <Link
              to="/reserver"
              className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Réserver une salle
            </Link>
          </div>
        ) : (
          <ul className="mt-10 space-y-4">
            {reservations.map((r) => {
              const room = ROOMS.find((x) => x.id === r.roomId);
              const upcoming = r.date >= new Date().toISOString().slice(0, 10);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-card p-5"
                >
                  {room && (
                    <img
                      src={room.image}
                      alt={room.name}
                      loading="lazy"
                      width={1024}
                      height={768}
                      className="size-20 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{room?.name ?? r.roomId}</p>
                    <p className="mt-1 text-sm capitalize text-muted-foreground">
                      {formatDateFR(r.date)} — {r.slot} · {r.hours}h ·{" "}
                      {(room?.pricePerHour ?? 0) * r.hours} €
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.name} · {r.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        upcoming
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {upcoming ? "À venir" : "Terminée"}
                    </span>
                    <button
                      onClick={() => handleCancel(r.id)}
                      aria-label="Annuler cette réservation"
                      className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          Besoin d'une configuration spéciale ? Écrivez-nous à
          contact@nova-serenity.fr
        </p>
      </main>
    </div>
  );
}
