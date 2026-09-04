import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, Download, Lock, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import {
  ROOMS,
  formatDateFR,
  formatDuration,
  icsHref,
  googleCalendarHref,
  type Reservation,
} from "@/lib/rooms";
import { getReservationsByIds } from "@/lib/reservations.functions";

export const Route = createFileRoute("/_authenticated/confirmation/$id")({
  head: () => ({
    meta: [
      { title: "Réservation confirmée — Nova Zen Space" },
      {
        name: "description",
        content:
          "Votre salle de réunion est réservée : récapitulatif et lien pour bloquer le créneau dans votre agenda.",
      },
      { property: "og:title", content: "Réservation confirmée — Nova Zen Space" },
      {
        property: "og:description",
        content: "Récapitulatif de votre réservation et ajout à votre agenda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { id } = Route.useParams();
  const fetchByIds = useServerFn(getReservationsByIds);

  const query = useQuery({
    queryKey: ["reservation", id],
    queryFn: () => fetchByIds({ data: { ids: [id] } }),
  });

  const r = query.data?.[0] as Reservation | undefined;
  const room = r ? ROOMS.find((x) => x.id === r.roomId) : undefined;
  const roomName = room?.name ?? r?.roomId ?? "";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-28">
        {query.isPending && <p className="text-muted-foreground">Chargement…</p>}
        {!query.isPending && !r && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-lg font-semibold">Réservation introuvable</p>
            <Link
              to="/reserver"
              className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
            >
              Réserver une salle
            </Link>
          </div>
        )}

        {r && (
          <>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-8 text-brand-green" />
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Réservation confirmée
              </h1>
            </div>
            <p className="mt-3 text-muted-foreground">
              Votre créneau est bloqué. Ajoutez-le à votre agenda en un clic.
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <dl className="space-y-3 text-sm">
                <Row label="Salle" value={roomName} />
                <Row label="Date" value={formatDateFR(r.date)} capitalize />
                <Row label="Créneau" value={`${r.slot} · ${formatDuration(r.hours)}`} />
                <Row label="Réservé par" value={`${r.name} · ${r.email}`} />
                <Row
                  label="Objet"
                  value={r.confidential ? "Confidentiel" : r.subject}
                />
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <dt className="text-muted-foreground">Localisation</dt>
                  <dd className="flex items-center gap-1.5 text-right font-medium text-brand-green">
                    <MapPin className="size-3.5 shrink-0" /> {r.location}
                  </dd>
                </div>
              </dl>

              {r.confidential && (
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="size-3.5" /> L'agenda partagé affichera seulement
                  « Réservé (confidentiel) ».
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={googleCalendarHref(r, roomName)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
                >
                  <CalendarPlus className="size-4" /> Ajouter à Google Agenda
                </a>
                <a
                  href={icsHref(r, roomName)}
                  download={`nova-zen-${r.date}-${r.slot.replace(":", "h")}.ics`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-accent"
                >
                  <Download className="size-4" /> Télécharger .ics
                </a>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4 text-sm">
              <Link to="/reservations" className="font-semibold text-primary">
                Voir mes réservations
              </Link>
              <Link to="/reserver" className="text-muted-foreground">
                Réserver un autre créneau
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${capitalize ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}
