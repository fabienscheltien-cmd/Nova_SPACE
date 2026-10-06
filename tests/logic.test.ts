import { describe, expect, test } from "bun:test";
import { toIsoRange } from "../src/lib/reservation-time";
import { computeQuota, currentMonth, monthBounds } from "../src/lib/quota.server";
import { buildICS, computeBlockedSlots, formatDuration, TIME_SLOTS } from "../src/lib/rooms";

describe("toIsoRange (Europe/Paris -> UTC)", () => {
  test("heure d'hiver : UTC+1", () => {
    expect(toIsoRange("2026-01-15", "09:00", 1.5)).toEqual({
      startsAt: "2026-01-15T08:00:00.000Z",
      endsAt: "2026-01-15T09:30:00.000Z",
    });
  });

  test("heure d'été : UTC+2", () => {
    expect(toIsoRange("2026-07-15", "09:00", 1)).toEqual({
      startsAt: "2026-07-15T07:00:00.000Z",
      endsAt: "2026-07-15T08:00:00.000Z",
    });
  });

  test("jours de bascule (29 mars et 25 octobre 2026)", () => {
    expect(toIsoRange("2026-03-29", "08:00", 1).startsAt).toBe("2026-03-29T06:00:00.000Z");
    expect(toIsoRange("2026-10-25", "08:00", 1).startsAt).toBe("2026-10-25T07:00:00.000Z");
  });
});

describe("mois de quota", () => {
  test("monthBounds gère le changement d'année", () => {
    expect(monthBounds("2026-12-01")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  test("currentMonth tronque au premier du mois", () => {
    expect(currentMonth("2026-10-06")).toBe("2026-10-01");
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

/** Faux client Supabase : chaque table renvoie ses lignes filtrées par eq/gte/lt. */
function fakeAdmin(tables: Record<string, Record<string, unknown>[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => ((rows = rows.filter((r) => r[k] === v)), q),
        gte: (k: string, v: string) => ((rows = rows.filter((r) => String(r[k]) >= v)), q),
        lt: (k: string, v: string) => ((rows = rows.filter((r) => String(r[k]) < v)), q),
        maybeSingle: async () => ({ data: rows[0] ?? null }),
        then: (res: (v: { data: unknown[] }) => unknown) => res({ data: rows }),
      };
      return q;
    },
  } as never;
}

describe("computeQuota", () => {
  const admin = fakeAdmin({
    app_settings: [{ id: true, monthly_pool_hours: 200 }],
    quota_adjustments: [
      { company_id: "A", month: "2026-10-01", hours: 5 },
      { company_id: "A", month: "2026-09-01", hours: 100 },
    ],
    reservations: [
      { company_id: "A", date: "2026-10-02", hours: 3 },
      { company_id: "A", date: "2026-10-31", hours: 1.5 },
      { company_id: "A", date: "2026-11-01", hours: 50 },
      { company_id: "B", date: "2026-10-02", hours: 8 },
    ],
  });

  test("part du pool + ajustements du mois - heures consommées du mois", async () => {
    const q = await computeQuota(admin, { id: "A", share_percent: "30" }, "2026-10-01");
    expect(q.baseHours).toBe(60);
    expect(q.adjustmentHours).toBe(5);
    expect(q.usedHours).toBe(4.5);
    expect(q.remainingHours).toBe(60.5);
  });

  test("les réservations du mois suivant ne sont pas décomptées du mois courant", async () => {
    // Conséquence : createReservation, qui contrôle toujours currentMonth(),
    // laisse réserver sans limite le mois suivant (voir rapport d'analyse).
    const q = await computeQuota(admin, { id: "A", share_percent: 30 }, "2026-10-01");
    expect(q.usedHours).not.toBeGreaterThan(4.5);
  });
});

describe("créneaux", () => {
  test("24 créneaux de 08:00 à 19:30", () => {
    expect(TIME_SLOTS.length).toBe(24);
    expect(TIME_SLOTS[0]).toBe("08:00");
    expect(TIME_SLOTS.at(-1)).toBe("19:30");
  });

  test("bloque les chevauchements et le débordement après 20:00", () => {
    const blocked = computeBlockedSlots([{ slot: "10:00", hours: 1 }], 1);
    expect(blocked.has("09:00")).toBe(false); // finit pile à 10:00
    expect(blocked.has("09:30")).toBe(true);
    expect(blocked.has("10:30")).toBe(true);
    expect(blocked.has("11:00")).toBe(false);
    expect(blocked.has("19:00")).toBe(false);
    expect(blocked.has("19:30")).toBe(true);
  });

  test("formatDuration", () => {
    expect(formatDuration(0.5)).toBe("30 min");
    expect(formatDuration(2)).toBe("2h");
    expect(formatDuration(1.5)).toBe("1h30");
  });
});

describe("ICS", () => {
  const base = {
    id: "x",
    roomId: "conseil",
    date: "2026-10-06",
    slot: "09:00",
    hours: 1,
    name: "Jean",
    email: "j@alpha.fr",
    subject: "Comité; secret",
    location: "8e",
    confidential: true,
    createdAt: "",
  };

  test("une réservation confidentielle ne divulgue pas l'objet", () => {
    const ics = buildICS(base, "Salle du Conseil");
    expect(ics).not.toContain("secret");
    expect(ics).toContain("CLASS:PRIVATE");
  });

  test("échappe les caractères spéciaux", () => {
    expect(buildICS({ ...base, confidential: false }, "S")).toContain("Comité\\; secret");
  });
});
