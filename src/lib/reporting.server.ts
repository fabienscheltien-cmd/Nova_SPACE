import type { SupabaseClient } from "@supabase/supabase-js";
import { ROOMS } from "@/lib/rooms";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Admin = SupabaseClient<any, any, any>;

export interface ReportFilters {
  from: string; // YYYY-MM-DD inclus
  to: string; // YYYY-MM-DD inclus
  companyId?: string;
  roomId?: string;
}

export interface CompanyStat {
  id: string;
  name: string;
  hours: number;
  count: number;
  sharePercent: number;
  quotaHours: number;
  actualSharePercent: number;
  quotaUsePercent: number;
  confidentialCount: number;
  overageRequested: number;
  overageApproved: number;
}

export interface RoomStat {
  id: string;
  name: string;
  hours: number;
  count: number;
  occupancyPercent: number;
}

export interface Report {
  filters: ReportFilters;
  totalHours: number;
  totalCount: number;
  openHoursPerRoom: number;
  globalOccupancyPercent: number;
  avgDuration: number;
  topDuration: number | null;
  confidentialPercent: number;
  companies: CompanyStat[];
  rooms: RoomStat[];
  monthly: { month: string; hours: number }[];
  heatmap: { weekday: number; hour: number; hours: number }[];
}

const OPEN_HOURS_PER_DAY = 12; // 8h – 20h

function workingDays(from: string, to: string) {
  let n = 0;
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function buildReport(admin: Admin, f: ReportFilters): Promise<Report> {
  let q = admin
    .from("reservations")
    .select("room_id, date, slot, hours, confidential, company_id")
    .gte("date", f.from)
    .lte("date", f.to);
  if (f.companyId) q = q.eq("company_id", f.companyId);
  if (f.roomId) q = q.eq("room_id", f.roomId);

  const months = monthsBetween(f.from, f.to);
  const [{ data: rows }, { data: companies }, { data: settings }, { data: adjustments }, { data: overages }] =
    await Promise.all([
      q,
      admin.from("companies").select("id, name, share_percent").order("name"),
      admin.from("app_settings").select("monthly_pool_hours").eq("id", true).maybeSingle(),
      admin
        .from("quota_adjustments")
        .select("company_id, hours, month")
        .in("month", months.map((m) => `${m}-01`)),
      admin
        .from("overage_requests")
        .select("company_id, requested_hours, status, created_at")
        .gte("created_at", `${f.from}T00:00:00Z`)
        .lte("created_at", `${f.to}T23:59:59Z`),
    ]);

  const res = (rows ?? []) as Array<Record<string, any>>;
  const pool = Number(settings?.["monthly_pool_hours"] ?? 0);
  const totalHours = res.reduce((s, r) => s + Number(r["hours"]), 0);
  const days = workingDays(f.from, f.to);
  const openHoursPerRoom = days * OPEN_HOURS_PER_DAY;
  const roomList = f.roomId ? ROOMS.filter((r) => r.id === f.roomId) : ROOMS;

  const companyStats: CompanyStat[] = (companies ?? [])
    .filter((c: any) => !f.companyId || c.id === f.companyId)
    .map((c: any) => {
      const mine = res.filter((r) => r["company_id"] === c.id);
      const hours = mine.reduce((s, r) => s + Number(r["hours"]), 0);
      const share = Number(c.share_percent);
      const adj = (adjustments ?? [])
        .filter((a: any) => a.company_id === c.id)
        .reduce((s: number, a: any) => s + Number(a.hours), 0);
      const quotaHours = r1(((pool * share) / 100) * months.length + adj);
      const ov = (overages ?? []).filter((o: any) => o.company_id === c.id);
      return {
        id: c.id,
        name: c.name,
        hours: r1(hours),
        count: mine.length,
        sharePercent: share,
        quotaHours,
        actualSharePercent: totalHours ? r1((hours / totalHours) * 100) : 0,
        quotaUsePercent: quotaHours ? r1((hours / quotaHours) * 100) : 0,
        confidentialCount: mine.filter((r) => r["confidential"]).length,
        overageRequested: r1(ov.reduce((s: number, o: any) => s + Number(o.requested_hours), 0)),
        overageApproved: r1(
          ov
            .filter((o: any) => o.status === "approved")
            .reduce((s: number, o: any) => s + Number(o.requested_hours), 0),
        ),
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const rooms: RoomStat[] = roomList.map((room) => {
    const mine = res.filter((r) => r["room_id"] === room.id);
    const hours = mine.reduce((s, r) => s + Number(r["hours"]), 0);
    return {
      id: room.id,
      name: room.name,
      hours: r1(hours),
      count: mine.length,
      occupancyPercent: openHoursPerRoom ? r1((hours / openHoursPerRoom) * 100) : 0,
    };
  });

  const monthly = months.map((m) => ({
    month: m,
    hours: r1(
      res.filter((r) => String(r["date"]).startsWith(m)).reduce((s, r) => s + Number(r["hours"]), 0),
    ),
  }));

  const heat = new Map<string, number>();
  for (const r of res) {
    const weekday = new Date(`${r["date"]}T12:00:00Z`).getUTCDay();
    const [h = "0", m = "0"] = String(r["slot"]).split(":");
    let start = parseInt(h, 10) * 60 + parseInt(m, 10);
    const end = start + Number(r["hours"]) * 60;
    while (start < end) {
      const hour = Math.floor(start / 60);
      const key = `${weekday}-${hour}`;
      heat.set(key, (heat.get(key) ?? 0) + 0.5);
      start += 30;
    }
  }
  const heatmap = [...heat.entries()].map(([k, hours]) => {
    const [weekday, hour] = k.split("-").map(Number);
    return { weekday: weekday!, hour: hour!, hours };
  });

  const durations = new Map<number, number>();
  for (const r of res) durations.set(Number(r["hours"]), (durations.get(Number(r["hours"])) ?? 0) + 1);
  const topDuration = [...durations.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    filters: f,
    totalHours: r1(totalHours),
    totalCount: res.length,
    openHoursPerRoom,
    globalOccupancyPercent:
      openHoursPerRoom && roomList.length
        ? r1((totalHours / (openHoursPerRoom * roomList.length)) * 100)
        : 0,
    avgDuration: res.length ? r1(totalHours / res.length) : 0,
    topDuration,
    confidentialPercent: res.length
      ? r1((res.filter((r) => r["confidential"]).length / res.length) * 100)
      : 0,
    companies: companyStats,
    rooms,
    monthly,
    heatmap,
  };
}
