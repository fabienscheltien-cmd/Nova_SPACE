import type { SupabaseClient } from "@supabase/supabase-js";

/** Premier jour du mois courant (Europe/Paris), au format YYYY-MM-01. */
export function currentMonth(dateISO?: string) {
  const base =
    dateISO ??
    new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
  return `${base.slice(0, 7)}-01`;
}

export function monthBounds(month: string) {
  const start = new Date(`${month}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export interface QuotaSummary {
  month: string;
  sharePercent: number;
  poolHours: number;
  baseHours: number;
  adjustmentHours: number;
  quotaHours: number;
  usedHours: number;
  remainingHours: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function computeQuota(
  admin: SupabaseClient<any, any, any>,
  company: { id: string; share_percent: number | string },
  month = currentMonth(),
): Promise<QuotaSummary> {
  const { start, end } = monthBounds(month);

  const [{ data: settings }, { data: adjustments }, { data: rows }] = await Promise.all([
    admin.from("app_settings").select("monthly_pool_hours").eq("id", true).maybeSingle(),
    admin.from("quota_adjustments").select("hours").eq("company_id", company.id).eq("month", month),
    admin
      .from("reservations")
      .select("hours")
      .eq("company_id", company.id)
      .gte("date", start)
      .lt("date", end),
  ]);

  const poolHours = Number(settings?.["monthly_pool_hours"] ?? 0);
  const sharePercent = Number(company.share_percent);
  const baseHours = Math.round(((poolHours * sharePercent) / 100) * 100) / 100;
  const adjustmentHours = (adjustments ?? []).reduce(
    (sum: number, a: Record<string, unknown>) => sum + Number(a["hours"]),
    0,
  );
  const usedHours = (rows ?? []).reduce(
    (sum: number, r: Record<string, unknown>) => sum + Number(r["hours"]),
    0,
  );
  const quotaHours = baseHours + adjustmentHours;

  return {
    month,
    sharePercent,
    poolHours,
    baseHours,
    adjustmentHours,
    quotaHours,
    usedHours,
    remainingHours: Math.round((quotaHours - usedHours) * 100) / 100,
  };
}
