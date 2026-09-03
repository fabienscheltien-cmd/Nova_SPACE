import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuotaSummary } from "@/lib/quota.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Accès réservé à l'administrateur.");
}

export interface AdminCompany {
  id: string;
  name: string;
  domain: string;
  quota: QuotaSummary;
}

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeQuota, currentMonth } = await import("@/lib/quota.server");

    const month = currentMonth();
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("monthly_pool_hours")
      .eq("id", true)
      .maybeSingle();
    const { data: rows } = await supabaseAdmin
      .from("companies")
      .select("id, name, domain, share_percent")
      .order("share_percent", { ascending: false });

    const companies: AdminCompany[] = [];
    for (const c of rows ?? []) {
      companies.push({
        id: c.id,
        name: c.name,
        domain: c.domain,
        quota: await computeQuota(supabaseAdmin, c, month),
      });
    }

    return {
      month,
      poolHours: Number(settings?.["monthly_pool_hours"] ?? 0),
      companies,
    };
  });

export const adminSetPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ poolHours: z.number().min(0).max(10000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ monthly_pool_hours: data.poolHours })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSaveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        domain: z
          .string()
          .min(3)
          .max(120)
          .transform((v) => v.trim().toLowerCase()),
        sharePercent: z.number().min(0).max(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("companies")
        .update({ name: data.name, domain: data.domain, share_percent: data.sharePercent })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await supabaseAdmin
        .from("allowed_domains")
        .upsert({ domain: data.domain, company_id: data.id, role: "locataire" });
      return { ok: true as const, id: data.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .insert({ name: data.name, domain: data.domain, share_percent: data.sharePercent })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("allowed_domains")
      .upsert({ domain: data.domain, company_id: row.id, role: "locataire" });
    return { ok: true as const, id: row.id as string };
  });

/** Ajout / retrait manuel d'heures sur le mois courant. */
export const adminAdjustQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        hours: z.number().min(-1000).max(1000),
        note: z.string().max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { currentMonth } = await import("@/lib/quota.server");
    const { error } = await supabaseAdmin.from("quota_adjustments").insert({
      company_id: data.companyId,
      month: currentMonth(),
      hours: data.hours,
      note: data.note ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export interface AdminReservation {
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
  companyName: string | null;
}

export const adminReservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ from: z.string().optional(), to: z.string().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminReservation[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("reservations")
      .select("*, companies(name)")
      .order("starts_at", { ascending: true });
    if (data.from) query = query.gte("date", data.from);
    if (data.to) query = query.lte("date", data.to);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: Record<string, any>) => ({
      id: String(r["id"]),
      roomId: String(r["room_id"]),
      location: String(r["location"]),
      date: String(r["date"]),
      slot: String(r["slot"]),
      hours: Number(r["hours"]),
      name: String(r["name"]),
      email: String(r["email"]),
      subject: String(r["subject"]),
      confidential: Boolean(r["confidential"]),
      companyName: r["companies"]?.name ?? null,
    }));
  });

export const adminDeleteReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // La suppression re-crédite automatiquement le quota : les heures consommées
    // sont recalculées à partir des réservations existantes.
    const { error } = await supabaseAdmin.from("reservations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Réservation prioritaire : ignore le quota de l'entreprise. */
export const adminCreateReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        roomId: z.string().min(1),
        location: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slot: z.string().regex(/^\d{2}:\d{2}$/),
        hours: z.number().min(0.5).max(8),
        name: z.string().min(1).max(120),
        email: z.string().email().max(160),
        subject: z.string().min(1).max(200),
        confidential: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toIsoRange } = await import("@/lib/reservation-time");
    const { startsAt, endsAt } = toIsoRange(data.date, data.slot, data.hours);

    const { error } = await supabaseAdmin.from("reservations").insert({
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
      company_id: data.companyId,
      user_id: context.userId,
    });
    if (error) {
      if (error.code === "23P01") return { ok: false as const, reason: "conflict" as const };
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const adminOverageRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("overage_requests")
      .select("*, companies(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((r: Record<string, any>) => ({
      id: String(r["id"]),
      companyId: String(r["company_id"]),
      companyName: r["companies"]?.name ?? null,
      email: String(r["requester_email"]),
      hours: Number(r["requested_hours"]),
      message: r["message"] as string | null,
      status: String(r["status"]),
      createdAt: String(r["created_at"]),
    }));
  });

export const adminResolveOverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { currentMonth } = await import("@/lib/quota.server");

    const { data: req } = await supabaseAdmin
      .from("overage_requests")
      .select("id, company_id, requested_hours, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!req || req.status !== "pending") return { ok: false as const };

    if (data.approve) {
      await supabaseAdmin.from("quota_adjustments").insert({
        company_id: req.company_id,
        month: currentMonth(),
        hours: Number(req.requested_hours),
        note: "Dépassement accordé",
        created_by: context.userId,
      });
    }

    await supabaseAdmin
      .from("overage_requests")
      .update({ status: data.approve ? "approved" : "rejected" })
      .eq("id", data.id);
    return { ok: true as const };
  });
