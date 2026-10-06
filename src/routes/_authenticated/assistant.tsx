import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { BarChart3, Loader2, Send } from "lucide-react";
import { Header } from "@/components/Header";
import { askAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Analyste IA des réservations — Nova Space" },
      { name: "description", content: "Posez vos questions sur les réservations et obtenez analyses et recommandations." },
      { property: "og:title", content: "Analyste IA des réservations — Nova Space" },
      { property: "og:description", content: "Analyses et recommandations sur l'occupation des salles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Quelles salles sont les plus et les moins demandées ?",
  "Quels sont les créneaux de pointe et les heures creuses ?",
  "Quelles sociétés approchent de leur quota ce mois-ci ?",
  "Recommandations pour lisser l'occupation des salles",
];

function AssistantPage() {
  const ask = useServerFn(askAssistant);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    setError(null);
    const history = msgs.slice(-10);
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setQ("");
    setLoading(true);
    try {
      const res = await ask({ data: { question, history } });
      setMsgs((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col px-4 pb-8 pt-24 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BarChart3 className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Nova Analyste</h1>
            <p className="text-sm text-muted-foreground">
              Questions, analyses et recommandations sur les réservations (90 derniers jours et 30 prochains).
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-5 rounded-2xl border border-border bg-card/50 p-4 sm:p-6">
          {msgs.length === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-background/60 p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="prose prose-sm prose-invert max-w-none text-foreground [&_li]:my-0.5 [&_h3]:mt-3 [&_strong]:text-foreground">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ),
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Analyse des réservations en cours…
            </div>
          )}
          {error && <p className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(q);
          }}
          className="mt-4 flex items-end gap-2 rounded-2xl border border-border bg-card p-2"
        >
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(q);
              }
            }}
            rows={2}
            placeholder="Posez une question sur les réservations…"
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading || !q.trim()}
            aria-label="Envoyer"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
      </main>
    </div>
  );
}
