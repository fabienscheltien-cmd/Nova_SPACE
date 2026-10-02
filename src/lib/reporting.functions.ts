import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Report } from "@/lib/reporting.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Accès réservé à l'administration et à l'accueil.");
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filters = z.object({
  from: dateStr,
  to: dateStr,
  companyId: z.string().uuid().optional(),
  roomId: z.string().min(1).max(40).optional(),
});

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => filters.parse(i))
  .handler(async ({ data, context }): Promise<Report> => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildReport } = await import("@/lib/reporting.server");
    return buildReport(supabaseAdmin, data);
  });

export const getReportDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => filters.parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildReport } = await import("@/lib/reporting.server");
    const { buildReportDoc } = await import("@/lib/documents.server");
    const report = await buildReport(supabaseAdmin, data);
    return { base64: await buildReportDoc(report, "Reporting d'occupation des salles") };
  });

export const getDailySheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ date: dateStr }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildDailySheet } = await import("@/lib/documents.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reservations")
      .select("room_id, slot, hours, name, subject, confidential, companies(name)")
      .eq("date", data.date);
    if (error) throw new Error(error.message);
    const base64 = await buildDailySheet(
      data.date,
      (rows ?? []).map((r: any) => ({
        roomId: r.room_id,
        slot: r.slot,
        hours: Number(r.hours),
        name: r.name,
        subject: r.subject,
        confidential: Boolean(r.confidential),
        companyName: r.companies?.name ?? null,
      })),
    );
    return { base64 };
  });
