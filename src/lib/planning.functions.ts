import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type PlanningEntry = {
  id: string;
  roomId: string;
  slot: string;
  hours: number;
  label: string;
  mine: boolean;
};

/** Occupation de toutes les salles pour une journée (libellés masqués hors entreprise). */
export const getDayPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }): Promise<PlanningEntry[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: rows, error } = await supabaseAdmin
      .from("reservations")
      .select("id, room_id, slot, hours, subject, name, confidential, company_id, user_id")
      .eq("date", data.date)
      .order("slot", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => {
      const mine =
        Boolean(isAdmin) ||
        r.user_id === context.userId ||
        (r.company_id != null && r.company_id === profile?.company_id);
      const visible = mine && !r.confidential;
      return {
        id: String(r.id),
        roomId: String(r.room_id),
        slot: String(r.slot),
        hours: Number(r.hours),
        label: visible ? `${r.subject} — ${r.name}` : "Occupé",
        mine,
      };
    });
  });
