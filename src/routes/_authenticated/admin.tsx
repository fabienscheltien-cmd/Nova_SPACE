import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Minus, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { StructureAdmin } from "@/components/StructureAdmin";
import { ROOMS, TIME_SLOTS, DURATIONS, formatDuration, formatDateFR } from "@/lib/rooms";
import { getMe } from "@/lib/account.functions";
import {
  adminOverview,
  adminSetPool,
  adminSaveCompany,
  adminAdjustQuota,
  adminReservations,
  adminDeleteReservation,
  adminCreateReservation,
  adminOverageRequests,
  adminResolveOverage,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Nova Zen Space" },
      {
        name: "description",
        content: "Quotas, entreprises, planning global et arbitrage des réservations.",
      },
      { property: "og:title", content: "Administration — Nova Zen Space" },
      {
        property: "og:description",
        content: "Quotas, entreprises, planning global et arbitrage des réservations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AdminPage() {
  const fetchMe = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  if (me.isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-6xl px-6 pt-32 text-muted-foreground">Chargement…</main>
      </div>
    );
  }

  if (me.data?.role !== "admin") {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-md px-6 pt-32">
          <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <ShieldAlert className="size-4" /> Cette page est réservée à l'administrateur.
          </p>
        </main>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const overviewFn = useServerFn(adminOverview);
  const setPoolFn = useServerFn(adminSetPool);
  const saveCompanyFn = useServerFn(adminSaveCompany);
  const adjustFn = useServerFn(adminAdjustQuota);
  const reservationsFn = useServerFn(adminReservations);
  const deleteFn = useServerFn(adminDeleteReservation);
  const createFn = useServerFn(adminCreateReservation);
  const requestsFn = useServerFn(adminOverageRequests);
  const resolveFn = useServerFn(adminResolveOverage);

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => overviewFn() });
  const planning = useQuery({
    queryKey: ["admin-reservations"],
    queryFn: () => reservationsFn({ data: {} }),
  });
  const requests = useQuery({ queryKey: ["admin-requests"], queryFn: () => requestsFn() });

  const [pool, setPool] = useState<string>("");
  const [newCompany, setNewCompany] = useState({ name: "", domain: "", sharePercent: "" });
  const [message, setMessage] = useState<string | null>(null);

  async function refreshAll() {
    await Promise.all([overview.refetch(), planning.refetch(), requests.refetch()]);
  }

  async function handleAdjust(companyId: string, hours: number) {
    await adjustFn({ data: { companyId, hours } });
    await refreshAll();
  }

  const companies = overview.data?.companies ?? [];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Administration</h1>
        <p className="mt-3 text-muted-foreground">
          Quotas du mois {overview.data ? overview.data.month.slice(0, 7) : "…"}, planning global et
          arbitrage.
        </p>
        {message && (
          <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">{message}</p>
        )}

        {/* Pool mensuel */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold">Pool d'heures mensuel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Réparti entre les entreprises selon leur quote-part.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={0}
              step={1}
              placeholder={String(overview.data?.poolHours ?? 0)}
              value={pool}
              onChange={(e) => setPool(e.target.value)}
              className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              heures / mois (actuel : {overview.data?.poolHours ?? 0} h)
            </span>
            <button
              type="button"
              onClick={async () => {
                if (!pool) return;
                await setPoolFn({ data: { poolHours: Number(pool) } });
                setPool("");
                await refreshAll();
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Enregistrer
            </button>
          </div>
        </section>

        {/* Entreprises */}
        <section className="mt-10">
          <h2 className="text-lg font-bold">Entreprises & quotas</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Entreprise</th>
                  <th className="px-4 py-3">Domaine</th>
                  <th className="px-4 py-3">Quote-part</th>
                  <th className="px-4 py-3">Quota du mois</th>
                  <th className="px-4 py-3">Consommé</th>
                  <th className="px-4 py-3">Restant</th>
                  <th className="px-4 py-3">Ajuster</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">@{c.domain}</td>
                    <td className="px-4 py-3">{c.quota.sharePercent} %</td>
                    <td className="px-4 py-3">
                      {formatDuration(c.quota.quotaHours)}
                      {c.quota.adjustmentHours !== 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({c.quota.adjustmentHours > 0 ? "+" : ""}
                          {c.quota.adjustmentHours} h)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDuration(c.quota.usedHours)}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        c.quota.remainingHours <= 0 ? "text-destructive" : "text-brand-green"
                      }`}
                    >
                      {formatDuration(Math.max(c.quota.remainingHours, 0))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Retirer 1 heure à ${c.name}`}
                          onClick={() => handleAdjust(c.id, -1)}
                          className="rounded-md border border-border p-1.5 transition-colors hover:bg-accent"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Ajouter 1 heure à ${c.name}`}
                          onClick={() => handleAdjust(c.id, 1)}
                          className="rounded-md border border-border p-1.5 transition-colors hover:bg-accent"
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjust(c.id, 5)}
                          className="rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
                        >
                          +5 h
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nouvelle entreprise */}
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-border p-4">
            <input
              placeholder="Nom de l'entreprise"
              value={newCompany.name}
              onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
            <input
              placeholder="domaine.fr"
              value={newCompany.domain}
              onChange={(e) => setNewCompany({ ...newCompany, domain: e.target.value })}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Quote-part %"
              value={newCompany.sharePercent}
              onChange={(e) => setNewCompany({ ...newCompany, sharePercent: e.target.value })}
              className="w-32 rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                if (!newCompany.name || !newCompany.domain) return;
                await saveCompanyFn({
                  data: {
                    name: newCompany.name,
                    domain: newCompany.domain,
                    sharePercent: Number(newCompany.sharePercent || 0),
                  },
                });
                setNewCompany({ name: "", domain: "", sharePercent: "" });
                setMessage("Entreprise ajoutée : son domaine e-mail est désormais autorisé.");
                await refreshAll();
              }}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Ajouter une entreprise
            </button>
          </div>
        </section>

        {/* Demandes de dépassement */}
        <section className="mt-12">
          <h2 className="text-lg font-bold">Demandes de dépassement</h2>
          {(requests.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucune demande.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(requests.data ?? []).map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {r.companyName ?? "—"} · +{formatDuration(r.hours)}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                    {r.message && <p className="mt-1 text-muted-foreground">{r.message}</p>}
                  </div>
                  {r.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveFn({ data: { id: r.id, approve: true } });
                          await refreshAll();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                      >
                        <Check className="size-3.5" /> Accorder
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await resolveFn({ data: { id: r.id, approve: false } });
                          await refreshAll();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                      >
                        <X className="size-3.5" /> Refuser
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {r.status === "approved" ? "Accordée" : "Refusée"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Réservation prioritaire */}
        <PriorityBooking
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          onCreate={async (payload) => {
            const res = await createFn({ data: payload });
            if (!res.ok) {
              setMessage("Créneau déjà occupé pour cette salle.");
              return false;
            }
            setMessage("Réservation prioritaire enregistrée.");
            await refreshAll();
            return true;
          }}
        />

        {/* Planning global */}
        <section className="mt-12">
          <h2 className="text-lg font-bold">Planning global</h2>
          <div className="mt-4 space-y-6">
            {groupByDate(planning.data ?? []).map(([date, rows]) => (
              <div key={date}>
                <h3 className="text-sm font-semibold capitalize text-muted-foreground">
                  {formatDateFR(date)}
                </h3>
                <ul className="mt-2 space-y-2">
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm"
                    >
                      <span className="w-24 font-semibold">
                        {r.slot} · {formatDuration(r.hours)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">
                          {ROOMS.find((x) => x.id === r.roomId)?.name ?? r.roomId}
                        </span>{" "}
                        — {r.companyName ?? "—"}
                        <span className="block text-xs text-muted-foreground">
                          {r.confidential ? "Réservé (confidentiel)" : r.subject} · {r.name}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Annuler cette réservation"
                        onClick={async () => {
                          await deleteFn({ data: { id: r.id } });
                          setMessage("Réservation annulée : les heures ont été re-créditées.");
                          await refreshAll();
                        }}
                        className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {(planning.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune réservation enregistrée.</p>
            )}
          </div>
        </section>
        <StructureAdmin />
      </main>
    </div>
  );
}

function groupByDate<T extends { date: string }>(rows: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.date) ?? [];
    list.push(r);
    map.set(r.date, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

interface PriorityPayload {
  companyId: string;
  roomId: string;
  location: string;
  date: string;
  slot: string;
  hours: number;
  name: string;
  email: string;
  subject: string;
  confidential: boolean;
}

function PriorityBooking({
  companies,
  onCreate,
}: {
  companies: { id: string; name: string }[];
  onCreate: (payload: PriorityPayload) => Promise<boolean>;
}) {
  const [companyId, setCompanyId] = useState("");
  const [roomId, setRoomId] = useState(ROOMS[0]!.id);
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState(TIME_SLOTS[0]!);
  const [hours, setHours] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [confidential, setConfidential] = useState(false);

  const room = ROOMS.find((r) => r.id === roomId) ?? ROOMS[0]!;
  const selected = companyId || companies[0]?.id || "";

  return (
    <section className="mt-12 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold">Réservation prioritaire</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Créez une réservation pour n'importe quelle entreprise, même si son quota est épuisé.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select
          value={selected}
          onChange={(e) => setCompanyId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {ROOMS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm [color-scheme:dark]"
        />
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {TIME_SLOTS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {DURATIONS.map((h) => (
            <option key={h} value={h}>
              {formatDuration(h)}
            </option>
          ))}
        </select>
        <input
          placeholder="Nom du réservataire"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          placeholder="Objet de la réunion"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confidential}
          onChange={(e) => setConfidential(e.target.checked)}
          className="size-4 accent-primary"
        />
        Réunion confidentielle
      </label>
      <button
        type="button"
        disabled={!selected || !name || !email || !subject}
        onClick={async () => {
          const ok = await onCreate({
            companyId: selected,
            roomId,
            location: room.location,
            date,
            slot,
            hours,
            name,
            email,
            subject,
            confidential,
          });
          if (ok) {
            setName("");
            setEmail("");
            setSubject("");
          }
        }}
        className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        Créer la réservation
      </button>
    </section>
  );
}
