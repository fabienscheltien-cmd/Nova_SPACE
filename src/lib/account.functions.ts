import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuotaSummary } from "@/lib/quota.server";

export interface MeCompany {
  id: string;
  name: string;
  sharePercent: number;
}

export interface Me {
  allowed: boolean;
  email: string;
  role: "admin" | "locataire" | null;
  company: MeCompany | null;
  quota: QuotaSummary | null;
}

/** Profil de l'utilisateur connecté : rôle, entreprise et quota du mois. */
export const getMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Me> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeQuota } = await import("@/lib/quota.server");

    const email = String(context.claims["email"] ?? "").toLowerCase();
    const domain = email.split("@")[1] ?? "";

    const { data: allowed } = await supabaseAdmin
      .from("allowed_domains")
      .select("domain, company_id, role")
      .eq("domain", domain)
      .maybeSingle();

    if (!allowed) {
      return { allowed: false, email, role: null, company: null, quota: null };
    }

    const role = allowed.role as "admin" | "locataire";

    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: context.userId, email, company_id: allowed.company_id },
        { onConflict: "id" },
      );
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role }, { onConflict: "user_id,role" });

    let company: MeCompany | null = null;
    let quota: QuotaSummary | null = null;

    if (allowed.company_id) {
      const { data: row } = await supabaseAdmin
        .from("companies")
        .select("id, name, share_percent")
        .eq("id", allowed.company_id)
        .maybeSingle();
      if (row) {
        company = { id: row.id, name: row.name, sharePercent: Number(row.share_percent) };
        quota = await computeQuota(supabaseAdmin, row);
      }
    }

    return { allowed: true, email, role, company, quota };
  });

export const requestOverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ hours: z.number().min(0.5).max(40), message: z.string().max(500).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = String(context.claims["email"] ?? "").toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Aucune entreprise rattachée à ce compte.");

    const { error } = await supabaseAdmin.from("overage_requests").insert({
      company_id: profile.company_id,
      user_id: context.userId,
      requester_email: email,
      requested_hours: data.hours,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getMyOverageRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("overage_requests")
      .select("id, requested_hours, message, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((r) => ({
      id: r.id,
      hours: Number(r.requested_hours),
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
    }));
  });
