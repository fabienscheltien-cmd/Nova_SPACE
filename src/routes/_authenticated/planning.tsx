import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Lock, MapPin, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { ROOMS, TIME_SLOTS, formatDateFR, formatDuration, toMinutes } from "@/lib/rooms";
import { getDayPlanning, type PlanningEntry } from "@/lib/planning.functions";

export const Route = createFileRoute("/_authenticated/planning")({
  head: () => ({
    meta: [
      { title: "Planning des salles — Nova Zen Space" },
      {
        name: "description",
        content:
          "Disponibilités en temps réel de chaque salle de réunion, créneau par créneau.",
      },
      { property: "og:title", content: "Planning des salles — Nova Zen Space" },
      {
        property: "og:description",
        content: "Disponibilités en temps réel de chaque salle de réunion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanningPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Cell = { state: "free" | "start" | "busy"; entry?: PlanningEntry; span?: number };

function buildColumn(entries: PlanningEntry[]): Cell[] {
  const cells: Cell[] = TIME_SLOTS.map(() => ({ state: "free" }));
  for (const e of entries) {
    const startIndex = TIME_SLOTS.indexOf(e.slot);
    if (startIndex < 0) continue;
    const span = Math.max(1, Math.round((e.hours * 60) / 30));
    for (let i = startIndex; i < Math.min(startIndex + span, cells.length); i++) {
      cells[i] = i === startIndex ? { state: "start", entry: e, span } : { state: "busy" };
    }
  }
  return cells;
}

function PlanningPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const fetchPlanning = useServerFn(getDayPlanning);

  const query = useQuery({
    queryKey: ["planning", date],
    queryFn: () => fetchPlanning({ data: { date } }),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { refetch } = query;

  // Mise à jour instantanée dès qu'une réservation change côté base.
  useEffect(() => {
    const channel = supabase
      .channel("planning-reservations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch]);

  const columns = useMemo(() => {
    const entries = query.data ?? [];
    return ROOMS.map((room) => buildColumn(entries.filter((e) => e.roomId === room.id)));
  }, [query.data]);

  const isPast = date < todayISO();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Planning des salles</h1>
            <p className="mt-3 capitalize text-muted-foreground">{formatDateFR(date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Jour précédent"
              onClick={() => setDate((d) => shiftDate(d, -1))}
              className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-accent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              aria-label="Jour suivant"
              onClick={() => setDate((d) => shiftDate(d, 1))}
              className="rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-accent"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setDate(todayISO())}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded border border-border bg-card" /> Libre
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded border border-destructive/40 bg-destructive/20" />{" "}
            Occupé
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded border border-primary bg-primary/30" /> Votre entreprise
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className={`size-3 ${query.isFetching ? "animate-spin" : ""}`} /> Mise à jour
            en temps réel
          </span>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
          <div className="min-w-[640px]">
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `72px repeat(${ROOMS.length}, minmax(0, 1fr))` }}
            >
              <div className="px-3 py-3 text-xs font-semibold text-muted-foreground">Heure</div>
              {ROOMS.map((room) => (
                <div key={room.id} className="border-l border-border px-3 py-3">
                  <p className="truncate text-sm font-bold">{room.name}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-brand-green">
                    <MapPin className="size-3 shrink-0" /> {room.location}
                  </p>
                </div>
              ))}
            </div>

            {TIME_SLOTS.map((time, rowIndex) => (
              <div
                key={time}
                className="grid border-b border-border/60 last:border-b-0"
                style={{ gridTemplateColumns: `72px repeat(${ROOMS.length}, minmax(0, 1fr))` }}
              >
                <div
                  className={`px-3 py-2 text-xs ${
                    toMinutes(time) % 60 === 0
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {time}
                </div>
                {ROOMS.map((room, colIndex) => {
                  const cell = columns[colIndex]?.[rowIndex] ?? { state: "free" as const };
                  if (cell.state === "busy") {
                    return (
                      <div
                        key={room.id}
                        className="border-l border-border bg-destructive/10"
                        aria-hidden="true"
                      />
                    );
                  }
                  if (cell.state === "start" && cell.entry) {
                    const e = cell.entry;
                    return (
                      <div
                        key={room.id}
                        className={`border-l border-border p-1.5 ${
                          e.mine ? "bg-primary/20" : "bg-destructive/15"
                        }`}
                      >
                        <p className="flex items-center gap-1 truncate text-xs font-semibold">
                          {e.label === "Occupé" && <Lock className="size-3 shrink-0" />}
                          {e.label}
                        </p>
                        <p className="truncate text-[0.7rem] text-muted-foreground">
                          {e.slot} · {formatDuration(e.hours)}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={room.id}
                      type="button"
                      disabled={isPast}
                      onClick={() =>
                        void navigate({ to: "/reserver", search: { room: room.id } })
                      }
                      aria-label={`Réserver ${room.name} à ${time}`}
                      className="border-l border-border transition-colors enabled:hover:bg-primary/15 disabled:cursor-not-allowed"
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-4" />
          Cliquez sur un créneau libre pour lancer une réservation dans cette salle.
        </p>
      </main>
    </div>
  );
}
