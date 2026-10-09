import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Accès réservé au super administrateur.");
}

export const listStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const [sites, rooms, domains, companies] = await Promise.all([
      sb.from("sites").select("*").order("name"),
      sb.from("rooms").select("*").order("name"),
      sb.from("allowed_domains").select("*").order("domain"),
      sb.from("companies").select("id, name").order("name"),
    ]);
    return {
      sites: (sites.data ?? []) as {
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        active: boolean;
      }[],
      rooms: (rooms.data ?? []) as {
        id: string;
        site_id: string;
        name: string;
        capacity: number;
        location: string;
        description: string;
        equipements: string[];
        active: boolean;
      }[],
      domains: (domains.data ?? []) as {
        domain: string;
        company_id: string | null;
        site_id: string | null;
        role: "admin" | "locataire" | "accueil";
      }[],
      companies: (companies.data ?? []) as { id: string; name: string }[],
    };
  });

export const saveSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(100),
        address: z.string().trim().max(200).optional(),
        city: z.string().trim().max(100).optional(),
        active: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...row } = data;
    const sb = context.supabase as any;
    const { error } = id
      ? await sb.from("sites").update(row).eq("id", id)
      : await sb.from("sites").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9-]+$/, "Identifiant : minuscules, chiffres et tirets"),
        isNew: z.boolean(),
        site_id: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        capacity: z.number().int().min(1).max(1000),
        location: z.string().trim().max(150),
        description: z.string().trim().max(1000),
        equipements: z.array(z.string().trim().min(1).max(60)).max(30),
        active: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { isNew, id, ...row } = data;
    const sb = context.supabase as any;
    const { error } = isNew
      ? await sb.from("rooms").insert({ id, ...row })
      : await sb.from("rooms").update(row).eq("id", id);
    if (error) throw new Error(error.code === "23505" ? "Cet identifiant existe déjà." : error.message);
    return { ok: true };
  });

export const saveDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        domain: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Nom de domaine invalide"),
        site_id: z.string().uuid().nullable(),
        company_id: z.string().uuid().nullable(),
        role: z.enum(["locataire", "accueil", "admin"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("allowed_domains")
      .upsert(data, { onConflict: "domain" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ domain: z.string().min(1).max(253) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("allowed_domains").delete().eq("domain", data.domain);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
