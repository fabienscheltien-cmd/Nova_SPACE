import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  LayoutList,
  LogIn,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import logoSerenity from "@/assets/nova-serenity.png.asset.json";
import logoNova from "@/assets/nova-only.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getMe } from "@/lib/account.functions";

export function Header() {
  const { session, ready } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchMe = useServerFn(getMe);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    enabled: Boolean(session),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
        <a
          href="https://www.nova-serenity.fr"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Nova Serenity — www.nova-serenity.fr"
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          <img
            src={logoSerenity.url}
            alt="Logo Nova Serenity"
            width={648}
            height={392}
            className="h-8 w-auto sm:h-11"
          />
        </a>

        <Link
          to="/"
          className="flex min-w-0 items-center justify-center gap-1.5 sm:gap-2"
          aria-label="Nova Space — accueil"
        >
          <img
            src={logoNova.url}
            alt="Nova"
            width={2424}
            height={816}
            decoding="async"
            className="h-[1.5rem] w-auto sm:h-[1.9rem] lg:h-[2.2rem]"
          />
          <span className="font-display text-[1.15rem] font-extrabold uppercase leading-none tracking-[0.04em] text-brand-orange sm:text-[1.45rem] lg:text-[1.7rem]">
            SPACE
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 text-sm font-medium">
          <Link
            to="/reserver"
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <CalendarDays className="size-4 shrink-0" />
            <span className="hidden sm:inline">Réserver</span>
          </Link>
          <Link
            to="/planning"
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <CalendarClock className="size-4 shrink-0" />
            <span className="hidden sm:inline">Planning</span>
          </Link>
          <Link
            to="/reservations"
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <LayoutList className="size-4 shrink-0" />
            <span className="hidden sm:inline">Réservations</span>
          </Link>
          {me.data?.role === "admin" && (
            <Link
              to="/assistant"
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
              activeProps={{ className: "text-foreground bg-accent" }}
            >
              <BarChart3 className="size-4 shrink-0" />
              <span className="hidden sm:inline">Analyste IA</span>
            </Link>
          )}
          {me.data?.role === "admin" && (
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
              activeProps={{ className: "text-foreground bg-accent" }}
            >
              <ShieldCheck className="size-4 shrink-0" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          {ready &&
            (session ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
              >
                <LogOut className="size-4 shrink-0" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
                activeProps={{ className: "text-foreground bg-accent" }}
              >
                <LogIn className="size-4 shrink-0" />
                <span className="hidden sm:inline">Connexion</span>
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
