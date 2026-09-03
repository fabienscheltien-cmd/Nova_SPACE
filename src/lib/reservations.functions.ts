import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const availabilityInput = z.object({
  roomId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createInput = z.object({
  roomId: z.string().min(1),
  location: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.string().regex(/^\d{2}:\d{2}$/),
  hours: z.number().min(0.5).max(8),
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  subject: z.string().min(1).max(200),
  confidential: z.boolean(),
});

export type ReservationRow = {
  id: string;
  roomId: string;
  location: string;
  date: string;
  slot: string;
  hours: number;
  name: string;
  email: string;
  subject: string;
  confidential: boolean;
  createdAt: string;
  companyId: string | null;
  userId: string | null;
};

/** Plages occupées d'une salle pour une journée, sans aucune donnée personnelle. */
export const getAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => availabilityInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reservations")
      .select("slot, hours")
      .eq("room_id", data.roomId)
      .eq("date", data.date);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ slot: r.slot as string, hours: Number(r.hours) }));
  });

export const createReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toIsoRange } = await import("@/lib/reservation-time");
    const { computeQuota } = await import("@/lib/quota.server");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();

    const companyId = profile?.company_id ?? null;

    if (!isAdmin) {
      if (!companyId) throw new Error("Aucune entreprise rattachée à ce compte.");
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id, share_percent")
        .eq("id", companyId)
        .maybeSingle();
      if (!company) throw new Error("Entreprise introuvable.");
      const quota = await computeQuota(supabaseAdmin, company);
      if (quota.remainingHours < data.hours) {
        return { ok: false as const, reason: "quota" as const, remaining: quota.remainingHours };
      }
    }

    const { startsAt, endsAt } = toIsoRange(data.date, data.slot, data.hours);

    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .insert({
        room_id: data.roomId,
        location: data.location,
        date: data.date,
        slot: data.slot,
        hours: data.hours,
        starts_at: startsAt,
        ends_at: endsAt,
        name: data.name,
        email: data.email,
        subject: data.subject,
        confidential: data.confidential,
        company_id: companyId,
        user_id: context.userId,
      })
      .select("*")
      .single();

    if (error) {
      // 23P01 = exclusion constraint : le créneau vient d'être pris.
      if (error.code === "23P01") {
        return { ok: false as const, reason: "conflict" as const };
      }
      throw new Error(error.message);
    }

    return { ok: true as const, reservation: mapRow(row) };
  });

export const getReservationsByIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return [] as ReservationRow[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .in("id", data.ids)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

/** Réservations de l'entreprise de l'utilisateur connecté. */
export const getMyReservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReservationRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();

    const query = supabaseAdmin.from("reservations").select("*").order("starts_at", {
      ascending: false,
    });
    const { data: rows, error } = profile?.company_id
      ? await query.eq("company_id", profile.company_id)
      : await query.eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

export const deleteReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { data: row } = await supabaseAdmin
      .from("reservations")
      .select("id, user_id, company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true as const };

    if (!isAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", context.userId)
        .maybeSingle();
      const sameCompany =
        row.company_id != null && profile?.company_id === row.company_id;
      if (row.user_id !== context.userId && !sameCompany) {
        throw new Error("Suppression non autorisée.");
      }
    }

    const { error } = await supabaseAdmin.from("reservations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

type DbRow = Record<string, unknown>;

function mapRow(row: DbRow): ReservationRow {
  return {
    id: String(row["id"]),
    roomId: String(row["room_id"]),
    location: String(row["location"]),
    date: String(row["date"]),
    slot: String(row["slot"]),
    hours: Number(row["hours"]),
    name: String(row["name"]),
    email: String(row["email"]),
    subject: String(row["subject"]),
    confidential: Boolean(row["confidential"]),
    createdAt: String(row["created_at"]),
    companyId: row["company_id"] ? String(row["company_id"]) : null,
    userId: row["user_id"] ? String(row["user_id"]) : null,
  };
}
