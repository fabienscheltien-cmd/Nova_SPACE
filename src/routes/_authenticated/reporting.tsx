import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, ShieldAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Header } from "@/components/Header";
import { getMe } from "@/lib/account.functions";
import { getDailySheet, getReport, getReportDocx } from "@/lib/reporting.functions";
import { ROOMS } from "@/lib/rooms";

export const Route = createFileRoute("/_authenticated/reporting")({
  head: () => ({
    meta: [
      { title: "Reporting — Nova Space" },
      { name: "description", content: "Heures réservées et occupation des salles par société." },
      { property: "og:title", content: "Reporting — Nova Space" },
      { property: "og:description", content: "Heures réservées et occupation des salles par société." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportingPage,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const field =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function download(base64: string, name: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportingPage() {
  const meFn = useServerFn(getMe);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  if (me.isLoading)
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-6xl px-6 pt-32 text-muted-foreground">Chargement…</main>
      </div>
    );
  if (me.data?.role !== "admin")
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-md px-6 pt-32">
          <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <ShieldAlert className="size-4" /> Page réservée à l'administration et à l'accueil.
          </p>
        </main>
      </div>
    );
  return <Reporting />;
}

function Reporting() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1, 12)));
  const [to, setTo] = useState(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0, 12)));
  const [companyId, setCompanyId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [sheetDate, setSheetDate] = useState(iso(now));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reportFn = useServerFn(getReport);
  const docxFn = useServerFn(getReportDocx);
  const sheetFn = useServerFn(getDailySheet);

  const filters = {
    from,
    to,
    ...(companyId ? { companyId } : {}),
    ...(roomId ? { roomId } : {}),
  };
  const report = useQuery({
    queryKey: ["report", filters],
    queryFn: () => reportFn({ data: filters }),
  });
  // Liste complète des sociétés (sans filtre société) pour le sélecteur
  const all = useQuery({
    queryKey: ["report-companies", from, to],
    queryFn: () => reportFn({ data: { from, to } }),
  });
  const r = report.data;

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    if (!r) return;
    const lines = [
      "Société;Heures;Réservations;Quote-part %;Quota h;Quota utilisé %",
      ...r.companies.map((c) =>
        [c.name, c.hours, c.count, c.sharePercent, c.quotaHours, c.quotaUsePercent].join(";"),
      ),
    ];
    const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporting_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const heatMax = Math.max(1, ...(r?.heatmap.map((h) => h.hours) ?? [1]));

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Reporting</h1>
        <p className="mt-2 text-muted-foreground">Heures réservées et occupation des salles.</p>

        {/* Fiche du jour */}
        <section className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <p className="font-semibold">Fiche du jour (Word A3 paysage)</p>
            <p className="text-sm text-muted-foreground">Une page par salle, créneaux réservés et réservants.</p>
          </div>
          <input type="date" className={field} value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} />
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={busy !== null}
            onClick={() =>
              act("sheet", async () => {
                const { base64 } = await sheetFn({ data: { date: sheetDate } });
                download(base64, `fiche-du-jour_${sheetDate}.docx`);
              })
            }
          >
            <FileText className="size-4" /> {busy === "sheet" ? "Génération…" : "Télécharger la fiche"}
          </button>
        </section>

        {/* Filtres */}
        <section className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">Du<input type="date" className={`${field} mt-1 w-full`} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm">Au<input type="date" className={`${field} mt-1 w-full`} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="text-sm">Société
            <select className={`${field} mt-1 w-full`} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Site complet (toutes)</option>
              {all.data?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Salle
            <select className={`${field} mt-1 w-full`} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Toutes les salles</option>
              {ROOMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" onClick={exportCsv}>
              <Download className="size-4" /> CSV
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              disabled={busy !== null}
              onClick={() =>
                act("docx", async () => {
                  const { base64 } = await docxFn({ data: filters });
                  download(base64, `reporting_${from}_${to}.docx`);
                })
              }
            >
              <Download className="size-4" /> Word
            </button>
          </div>
        </section>
        {err && <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
        {report.isError && <p className="mt-4 text-sm text-destructive">{(report.error as Error).message}</p>}

        {r && (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Heures réservées", `${r.totalHours} h`],
                ["Réservations", r.totalCount],
                ["Occupation globale", `${r.globalOccupancyPercent} %`],
                ["Durée moyenne", `${r.avgDuration} h`],
                ["Confidentielles", `${r.confidentialPercent} %`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="mt-1 text-2xl font-semibold">{v}</p>
                </div>
              ))}
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 font-semibold">Heures par société</h2>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={r.companies}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                      <Bar dataKey="hours" name="Heures" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 font-semibold">Occupation par salle (%)</h2>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={r.rooms}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis unit="%" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                      <Bar dataKey="occupancyPercent" name="Occupation %" fill="var(--brand-orange, var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 font-semibold">Évolution mensuelle</h2>
                <div className="h-64">
                  <ResponsiveContainer>
                    <LineChart data={r.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                      <Line dataKey="hours" name="Heures" stroke="var(--primary)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 font-semibold">Affluence jour × heure</h2>
                <div className="overflow-x-auto">
                  <table className="text-[10px]">
                    <thead>
                      <tr><th />{Array.from({ length: 12 }, (_, i) => <th key={i} className="px-1 font-normal text-muted-foreground">{8 + i}h</th>)}</tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5].map((w) => (
                        <tr key={w}>
                          <td className="pr-2 text-muted-foreground">{DAYS[w]}</td>
                          {Array.from({ length: 12 }, (_, i) => {
                            const v = r.heatmap.find((h) => h.weekday === w && h.hour === 8 + i)?.hours ?? 0;
                            return (
                              <td key={i} className="p-0.5">
                                <div title={`${v} h`} className="size-6 rounded bg-primary" style={{ opacity: 0.08 + (v / heatMax) * 0.92 }} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-semibold">Détail par société</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2">Société</th><th>Heures</th><th>Réservations</th><th>Part du site</th><th>Quota</th><th>Quota utilisé</th></tr>
                </thead>
                <tbody>
                  {r.companies.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-2 font-medium">{c.name}</td>
                      <td>{c.hours} h</td>
                      <td>{c.count}</td>
                      <td>{c.actualSharePercent} %</td>
                      <td>{c.quotaHours} h</td>
                      <td className={c.quotaUsePercent >= 80 ? "font-semibold text-destructive" : ""}>{c.quotaUsePercent} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
