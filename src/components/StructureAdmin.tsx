import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, DoorOpen, Globe, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteDomain,
  listStructure,
  saveDomain,
  saveRoom,
  saveSite,
} from "@/lib/structure.functions";

const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50";
const ghost =
  "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted";

type Data = Awaited<ReturnType<typeof listStructure>>;
type SiteForm = { id?: string; name: string; address: string; city: string; active: boolean };
type RoomForm = {
  isNew: boolean;
  id: string;
  site_id: string;
  name: string;
  capacity: string;
  location: string;
  description: string;
  equipements: string;
  active: boolean;
};

export function StructureAdmin() {
  const listFn = useServerFn(listStructure);
  const saveSiteFn = useServerFn(saveSite);
  const saveRoomFn = useServerFn(saveRoom);
  const saveDomainFn = useServerFn(saveDomain);
  const deleteDomainFn = useServerFn(deleteDomain);
  const q = useQuery({ queryKey: ["structure"], queryFn: () => listFn() });
  const [msg, setMsg] = useState<string | null>(null);
  const [site, setSite] = useState<SiteForm | null>(null);
  const [room, setRoom] = useState<RoomForm | null>(null);
  const [dom, setDom] = useState({ domain: "", site_id: "", company_id: "", role: "locataire" });

  const d: Data | undefined = q.data;
  const siteName = (id: string | null) => d?.sites.find((s) => s.id === id)?.name ?? "—";

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      await q.refetch();
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
      return false;
    }
  }

  return (
    <section className="mt-12 space-y-10">
      <div>
        <h2 className="text-2xl font-semibold">Arborescence : sites, salles et domaines</h2>
        {msg && <p className="mt-3 rounded-lg border border-border bg-card p-3 text-sm">{msg}</p>}
      </div>

      {/* Sites */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <Building2 className="size-4" /> Sites
          </h3>
          <button className={btn} onClick={() => setSite({ name: "", address: "", city: "", active: true })}>
            <Plus className="size-4" /> Nouveau site
          </button>
        </div>
        {site && (
          <form
            className="mb-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                () =>
                  saveSiteFn({
                    data: {
                      ...(site.id ? { id: site.id } : {}),
                      name: site.name,
                      address: site.address,
                      city: site.city,
                      active: site.active,
                    },
                  }),
                "Site enregistré.",
              );
              if (ok) setSite(null);
            }}
          >
            <input className={input} placeholder="Nom du site" required value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} />
            <input className={input} placeholder="Adresse" value={site.address} onChange={(e) => setSite({ ...site, address: e.target.value })} />
            <input className={input} placeholder="Ville" value={site.city} onChange={(e) => setSite({ ...site, city: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={site.active} onChange={(e) => setSite({ ...site, active: e.target.checked })} /> Actif
            </label>
            <div className="flex gap-2 sm:col-span-4">
              <button className={btn} type="submit">Enregistrer</button>
              <button className={ghost} type="button" onClick={() => setSite(null)}>Annuler</button>
            </div>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2">Nom</th><th>Adresse</th><th>Salles</th><th>Statut</th><th /></tr>
            </thead>
            <tbody>
              {d?.sites.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td>{[s.address, s.city].filter(Boolean).join(", ") || "—"}</td>
                  <td>{d.rooms.filter((r) => r.site_id === s.id).length}</td>
                  <td>{s.active ? "Actif" : "Inactif"}</td>
                  <td className="text-right">
                    <button className={ghost} onClick={() => setSite({ id: s.id, name: s.name, address: s.address ?? "", city: s.city ?? "", active: s.active })}>
                      <Pencil className="size-3" /> Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salles */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <DoorOpen className="size-4" /> Salles
          </h3>
          <button
            className={btn}
            disabled={!d?.sites.length}
            onClick={() =>
              setRoom({ isNew: true, id: "", site_id: d?.sites[0]?.id ?? "", name: "", capacity: "6", location: "", description: "", equipements: "", active: true })
            }
          >
            <Plus className="size-4" /> Nouvelle salle
          </button>
        </div>
        {room && (
          <form
            className="mb-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                () =>
                  saveRoomFn({
                    data: {
                      isNew: room.isNew,
                      id: room.id,
                      site_id: room.site_id,
                      name: room.name,
                      capacity: Number(room.capacity),
                      location: room.location,
                      description: room.description,
                      equipements: room.equipements.split(",").map((x) => x.trim()).filter(Boolean),
                      active: room.active,
                    },
                  }),
                "Salle enregistrée.",
              );
              if (ok) setRoom(null);
            }}
          >
            <input className={input} placeholder="Identifiant (ex. salle-102)" required disabled={!room.isNew} value={room.id} onChange={(e) => setRoom({ ...room, id: e.target.value })} />
            <input className={input} placeholder="Nom de la salle" required value={room.name} onChange={(e) => setRoom({ ...room, name: e.target.value })} />
            <select className={input} value={room.site_id} onChange={(e) => setRoom({ ...room, site_id: e.target.value })}>
              {d?.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className={input} type="number" min={1} placeholder="Capacité" value={room.capacity} onChange={(e) => setRoom({ ...room, capacity: e.target.value })} />
            <input className={input} placeholder="Localisation (ex. 8ᵉ étage — Salle 102)" value={room.location} onChange={(e) => setRoom({ ...room, location: e.target.value })} />
            <input className={input} placeholder="Équipements (séparés par des virgules)" value={room.equipements} onChange={(e) => setRoom({ ...room, equipements: e.target.value })} />
            <textarea className={`${input} sm:col-span-3`} rows={2} placeholder="Description" value={room.description} onChange={(e) => setRoom({ ...room, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={room.active} onChange={(e) => setRoom({ ...room, active: e.target.checked })} /> Réservable
            </label>
            <div className="flex gap-2 sm:col-span-3">
              <button className={btn} type="submit">Enregistrer</button>
              <button className={ghost} type="button" onClick={() => setRoom(null)}>Annuler</button>
            </div>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2">Salle</th><th>Site</th><th>Localisation</th><th>Capacité</th><th>Statut</th><th /></tr>
            </thead>
            <tbody>
              {d?.rooms.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td>{siteName(r.site_id)}</td>
                  <td>{r.location || "—"}</td>
                  <td>{r.capacity}</td>
                  <td>{r.active ? "Réservable" : "Fermée"}</td>
                  <td className="text-right">
                    <button
                      className={ghost}
                      onClick={() =>
                        setRoom({ isNew: false, id: r.id, site_id: r.site_id, name: r.name, capacity: String(r.capacity), location: r.location, description: r.description, equipements: r.equipements.join(", "), active: r.active })
                      }
                    >
                      <Pencil className="size-3" /> Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Domaines */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Globe className="size-4" /> Domaines autorisés
        </h3>
        <form
          className="mb-4 grid gap-3 sm:grid-cols-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(
              () =>
                saveDomainFn({
                  data: {
                    domain: dom.domain,
                    site_id: dom.site_id || null,
                    company_id: dom.company_id || null,
                    role: dom.role as "locataire",
                  },
                }),
              "Domaine enregistré.",
            );
            if (ok) setDom({ domain: "", site_id: "", company_id: "", role: "locataire" });
          }}
        >
          <input className={input} placeholder="exemple.fr" required value={dom.domain} onChange={(e) => setDom({ ...dom, domain: e.target.value })} />
          <select className={input} value={dom.site_id} onChange={(e) => setDom({ ...dom, site_id: e.target.value })}>
            <option value="">— Site —</option>
            {d?.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={input} value={dom.company_id} onChange={(e) => setDom({ ...dom, company_id: e.target.value })}>
            <option value="">— Entreprise —</option>
            {d?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={input} value={dom.role} onChange={(e) => setDom({ ...dom, role: e.target.value })}>
            <option value="locataire">Locataire</option>
            <option value="accueil">Accueil</option>
            <option value="admin">Super admin</option>
          </select>
          <button className={btn} type="submit"><Plus className="size-4" /> Ajouter / mettre à jour</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2">Domaine</th><th>Site</th><th>Entreprise</th><th>Rôle</th><th /></tr>
            </thead>
            <tbody>
              {d?.domains.map((x) => (
                <tr key={x.domain} className="border-t border-border">
                  <td className="py-2 font-medium">@{x.domain}</td>
                  <td>{siteName(x.site_id)}</td>
                  <td>{d.companies.find((c) => c.id === x.company_id)?.name ?? "—"}</td>
                  <td>{x.role === "admin" ? "Super admin" : x.role === "accueil" ? "Accueil" : "Locataire"}</td>
                  <td className="flex justify-end gap-1 py-2">
                    <button className={ghost} onClick={() => setDom({ domain: x.domain, site_id: x.site_id ?? "", company_id: x.company_id ?? "", role: x.role })}>
                      <Pencil className="size-3" /> Modifier
                    </button>
                    <button
                      className={ghost}
                      onClick={() => {
                        if (confirm(`Retirer l'accès @${x.domain} ?`))
                          void run(() => deleteDomainFn({ data: { domain: x.domain } }), "Domaine retiré.");
                      }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
