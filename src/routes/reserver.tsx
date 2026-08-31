import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarPlus, Check, Download, Lock, MapPin, Users } from "lucide-react";
import { Header } from "@/components/Header";
import {
  ROOMS,
  TIME_SLOTS,
  DURATIONS,
  formatDuration,
  addReservation,
  isSlotTaken,
  formatDateFR,
  icsHref,
  googleCalendarHref,
  type Reservation,
} from "@/lib/rooms";


export const Route = createFileRoute("/reserver")({
  validateSearch: (search: Record<string, unknown>): { room?: string } =>
    typeof search["room"] === "string" ? { room: search["room"] as string } : {},
  head: () => ({
    meta: [
      { title: "Réserver une salle — Nova Zen Space" },
      {
        name: "description",
        content: "Choisissez votre salle, votre date et votre créneau horaire.",
      },
      { property: "og:title", content: "Réserver une salle — Nova Zen Space" },
      {
        property: "og:description",
        content: "Choisissez votre salle, votre date et votre créneau horaire.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReserverPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ReserverPage() {
  const { room: initialRoom } = Route.useSearch();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState(initialRoom ?? ROOMS[0]!.id);
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<string | null>(null);
  const [hours, setHours] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [confidential, setConfidential] = useState(false);
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [, forceRefresh] = useState(0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const room = ROOMS.find((r) => r.id === roomId) ?? ROOMS[0]!;

  const slots = useMemo(
    () =>
      TIME_SLOTS.map((s) => ({
        time: s,
        taken: hydrated ? isSlotTaken(roomId, date, s) : false,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, roomId, date, confirmed, forceRefresh],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot || !name || !email || !subject) return;
    const created = addReservation({
      roomId,
      date,
      slot,
      hours,
      name,
      email,
      subject,
      location: room.location,
      confidential,
    });
    setConfirmed(created);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-28">
        {confirmed ? (
          <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-border bg-card p-12 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/15">
              <Check className="size-8 text-primary" />
            </span>
            <h1 className="mt-6 text-3xl font-bold">Réservation confirmée</h1>
            <p className="mt-3 text-muted-foreground">
              {room.name} ({room.location}) — {formatDateFR(date)} à {slot},
              pour {formatDuration(hours)}. Un récapitulatif a été envoyé à {email}.
            </p>
            <div className="mt-6 w-full rounded-xl border border-border bg-background/60 p-4 text-left text-sm">
              <p className="font-semibold">Bloquer le créneau dans l'agenda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {confidential
                  ? "L'événement s'affichera comme « Réservé (confidentiel) », sans objet ni nom."
                  : `L'événement affichera : « ${subject} — ${name} (${formatDuration(hours)}) ».`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={icsHref(confirmed, room.name)}
                  download={`nova-zen-${confirmed.date}-${confirmed.slot.replace(":", "h")}.ics`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
                >
                  <Download className="size-3.5" /> Fichier .ics
                </a>
                <a
                  href={googleCalendarHref(confirmed, room.name)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
                >
                  <CalendarPlus className="size-3.5" /> Google Agenda
                </a>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate({ to: "/reservations" })}
                className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                Voir mes réservations
              </button>
              <button
                onClick={() => {
                  setConfirmed(null);
                  setSlot(null);
                  forceRefresh((n) => n + 1);
                }}
                className="rounded-xl border border-border px-6 py-3 font-semibold transition-colors hover:bg-accent"
              >
                Nouvelle réservation
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-tight">
              Réserver une salle
            </h1>
            <p className="mt-3 text-muted-foreground">
              Trois étapes : la salle, le créneau, vos coordonnées.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]"
            >
              <div className="space-y-10">
                {/* Choix de la salle */}
                <section>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    1. La salle
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {ROOMS.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          setRoomId(r.id);
                          setSlot(null);
                        }}
                        className={`overflow-hidden rounded-xl border text-left transition-all ${
                          r.id === roomId
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <img
                          src={r.image}
                          alt={r.name}
                          loading="lazy"
                          width={1024}
                          height={768}
                          className="h-28 w-full object-cover"
                        />
                        <div className="bg-card p-3">
                          <p className="text-sm font-bold">{r.name}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="size-3 shrink-0" /> {r.capacity} pers.
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0 text-brand-green" />{" "}
                            {r.location}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Date & créneau */}
                <section>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    2. Date & créneau
                  </h2>
                  <div className="flex flex-wrap items-center gap-4">
                    <input
                      type="date"
                      value={date}
                      min={todayISO()}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setSlot(null);
                      }}
                      className="rounded-lg border border-input bg-card px-4 py-2.5 text-sm [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <select
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value))}
                      className="rounded-lg border border-input bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {[1, 2, 3, 4].map((h) => (
                        <option key={h} value={h}>
                          {h} heure{h > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.map(({ time, taken }) => (
                      <button
                        type="button"
                        key={time}
                        disabled={taken}
                        onClick={() => setSlot(time)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          taken
                            ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/40 line-through"
                            : slot === time
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:border-primary/60"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Coordonnées */}
                <section>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    3. Vos coordonnées
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      placeholder="Nom complet"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-lg border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Adresse e-mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-lg border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Objet de la réunion"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="rounded-lg border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:col-span-2"
                    />
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4">
                    <input
                      type="checkbox"
                      checked={confidential}
                      onChange={(e) => setConfidential(e.target.checked)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span className="text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <Lock className="size-3.5" /> Réunion confidentielle
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        L'objet et le nom du réservataire seront masqués dans
                        l'agenda partagé : seul « Réservé (confidentiel) »
                        apparaîtra.
                      </span>
                    </span>
                  </label>
                </section>
              </div>

              {/* Récapitulatif */}
              <aside className="h-fit rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
                <h2 className="text-lg font-bold">Récapitulatif</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Salle</dt>
                    <dd className="font-medium">{room.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Date</dt>
                    <dd className="font-medium capitalize">
                      {formatDateFR(date)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Créneau</dt>
                    <dd className="font-medium">{slot ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Durée</dt>
                    <dd className="font-medium">{formatDuration(hours)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-3">
                    <dt className="text-muted-foreground">Localisation</dt>
                    <dd className="text-right font-medium">{room?.location ?? "—"}</dd>
                  </div>

                </dl>
                <button
                  type="submit"
                  disabled={!slot || !name || !email || !subject}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirmer la réservation
                  <ArrowRight className="size-4" />
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Annulation gratuite jusqu'à 24h avant.
                </p>
              </aside>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
