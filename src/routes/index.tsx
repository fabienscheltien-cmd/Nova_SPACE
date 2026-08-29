import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users, Clock, Euro } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { ROOMS } from "@/lib/rooms";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZenRooms — Réservation de salles de réunion" },
      {
        name: "description",
        content:
          "Réservez une salle de réunion en 30 secondes. Choisissez votre salle, votre créneau, et c'est fait.",
      },
      { property: "og:title", content: "ZenRooms — Réservation de salles de réunion" },
      {
        property: "og:description",
        content:
          "Réservez une salle de réunion en 30 secondes. Choisissez votre salle, votre créneau, et c'est fait.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative flex min-h-[92vh] items-center">
        <img
          src={hero}
          alt="Salle de réunion élégante le soir, baignée de lumière bleue"
          className="absolute inset-0 size-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-16">
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Réservez une salle en 30 secondes, sans quitter le bureau.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Choisissez votre salle, visualisez le prix et les créneaux
            disponibles, puis confirmez. On s'occupe du reste.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/reserver"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.03]"
            >
              Réserver une salle
              <ArrowRight className="size-5" />
            </Link>
            <Link
              to="/reservations"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-8 py-4 font-semibold backdrop-blur transition-colors hover:bg-accent"
            >
              Suivre mes réservations
            </Link>
          </div>
        </div>
      </section>

      {/* Salles */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Nos espaces
        </h2>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Trois ambiances, une même exigence : votre confort.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {ROOMS.map((room) => (
            <article
              key={room.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={room.image}
                  alt={room.name}
                  loading="lazy"
                  width={1024}
                  height={768}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold">{room.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {room.description}
                </p>
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-primary" />
                    {room.capacity} pers.
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Euro className="size-4 text-primary" />
                    {room.pricePerHour} €/h
                  </span>
                </div>
                <Link
                  to="/reserver"
                  search={{ room: room.id }}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Choisir cette salle
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Bandeau */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
          <Clock className="size-10 text-primary" />
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
            Ouvert 7j/7, de 8h à 20h
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Confirmation immédiate, annulation gratuite jusqu'à 24h avant votre
            créneau.
          </p>
          <Link
            to="/reserver"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.03]"
          >
            Réserver maintenant
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        ZENROOMS — Vos réunions, en toute sérénité.
      </footer>
    </div>
  );
}
