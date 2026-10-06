import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  question: z.string().trim().min(2).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(12)
    .default([]),
});

const INSTRUCTIONS = `Tu es « Nova Analyste », l'assistant d'analyse des réservations de salles de réunion de NOVA SPACE.
Tu réponds en français, de façon concise et structurée (titres courts, listes, chiffres clés en gras).
Tu t'appuies UNIQUEMENT sur les données JSON fournies (réservations des 90 derniers jours et 30 prochains jours, statistiques agrégées). N'invente aucun chiffre ; si une donnée manque, dis-le.
Il n'y a aucune notion de facturation ni de prix. Les créneaux sont de 30 minutes, de 08:00 à 20:00, du lundi au vendredi.
Quand c'est pertinent, termine par 2 à 4 recommandations concrètes et actionnables (optimisation de l'occupation, lissage des pics, quotas des sociétés, salles sous-utilisées).
Ne révèle jamais l'objet d'une réservation marquée confidentielle. Limite ta réponse à environ 350 mots.`;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès réservé à l'administration et à l'accueil.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Assistant IA non configuré.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildReport } = await import("@/lib/reporting.server");

    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 90);
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() + 30);

    const [report, resv] = await Promise.all([
      buildReport(supabaseAdmin, { from: iso(from), to: iso(to) }),
      supabaseAdmin
        .from("reservations")
        .select("date, slot, hours, room_id, name, subject, confidential, companies(name)")
        .gte("date", iso(from))
        .lte("date", iso(to))
        .order("date")
        .limit(600),
    ]);
    if (resv.error) throw new Error(resv.error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (resv.data ?? []).map((r: any) => ({
      d: r.date,
      h: r.slot,
      dur: Number(r.hours),
      salle: r.room_id,
      par: r.name,
      societe: r.companies?.name ?? null,
      objet: r.confidential ? "(confidentiel)" : r.subject,
    }));

    const contextJson = JSON.stringify({ aujourdhui: iso(today), statistiques: report, reservations: rows });

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system: INSTRUCTIONS,
      messages: [
        { role: "user", content: `Données de réservation (JSON) :\n${contextJson}` },
        { role: "assistant", content: "Données reçues. Quelle est votre question ?" },
        ...data.history,
        { role: "user", content: data.question },
      ],
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    try {
      const text = await result.text;
      if (!text.trim()) throw new Error("Aucune réponse n'a été produite.");
      return { answer: text };
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = e as any;
      const status = err?.statusCode ?? err?.cause?.statusCode;
      if (status === 429) throw new Error("Trop de demandes, réessayez dans un instant.");
      if (status === 402 || status === 403)
        throw new Error("Crédits IA épuisés ou limite atteinte pour l'espace de travail.");
      throw new Error(err?.message ?? "Erreur de l'assistant IA.");
    }
  });
