import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { MailCheck, ShieldAlert } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/account.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — Nova Zen Space" },
      {
        name: "description",
        content:
          "Connectez-vous avec votre e-mail professionnel pour réserver une salle Nova Zen Space.",
      },
      { property: "og:title", content: "Connexion — Nova Zen Space" },
      {
        property: "og:description",
        content: "Recevez un lien d'accès sur votre e-mail professionnel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [mode, setMode] = useState<"password" | "link">("password");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMe);

  useEffect(() => {
    let cancelled = false;
    async function route() {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      const me = await fetchMe();
      if (cancelled) return;
      if (!me.allowed) {
        setDenied(true);
        return;
      }
      await navigate({ to: me.role === "admin" ? "/admin" : "/reserver" });
    }
    void route();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void route();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [fetchMe, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    if (mode === "password") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      setBusy(false);
      if (err) setError("Identifiants incorrects.");
      return;
    }
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setBusy(false);
    if (err) {
      setError("L'envoi du lien a échoué. Vérifiez votre adresse et réessayez.");
      return;
    }
    setSent(true);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setDenied(false);
    setSent(false);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto flex max-w-md flex-col px-6 pb-24 pt-32">
        <h1 className="text-3xl font-bold tracking-tight">Accès locataires</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Saisissez votre e-mail professionnel : vous recevrez un lien d'activation pour accéder au
          site et réserver une salle. Seuls les domaines autorisés sont acceptés.
        </p>

        {denied ? (
          <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-6">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <ShieldAlert className="size-4" /> Domaine non autorisé
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre adresse n'appartient à aucune entreprise locataire. Contactez
              l'administrateur pour obtenir un accès.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Utiliser une autre adresse
            </button>
          </div>
        ) : sent ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="flex items-center gap-2 font-semibold">
              <MailCheck className="size-4 text-brand-green" /> Lien envoyé
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ouvrez le message reçu sur <span className="font-medium">{email}</span> et cliquez
              sur le lien d'activation pour accéder à votre espace.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 text-sm">
              {(["password", "link"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-2 font-medium transition-colors ${
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m === "password" ? "Mot de passe" : "Lien par e-mail"}
                </button>
              ))}
            </div>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="prenom.nom@entreprise.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {mode === "password" && (
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform enabled:hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? "Connexion…" : mode === "password" ? "Se connecter" : "Recevoir mon lien d'accès"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
