import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
};

/** Plages occupées d'une salle pour une journée, sans aucune donnée personnelle. */
export const getAvailability = createServerFn({ method: "POST" })
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
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toIsoRange } = await import("@/lib/reservation-time");
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
  .inputValidator((input: unknown) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(input))
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

export const deleteReservation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  };
}
