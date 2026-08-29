import { Link } from "@tanstack/react-router";
import { CalendarDays, LayoutList } from "lucide-react";
import logoSerenity from "@/assets/logo-nova-serenity.png";
import logoZen from "@/assets/logo-nova-zen.png";

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <a
          href="https://www.nova-serenity.fr"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Nova Serenity — www.nova-serenity.fr"
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          <img
            src={logoSerenity}
            alt="Logo Nova Serenity"
            width={992}
            height={672}
            className="h-10 w-auto"
          />
        </a>

        <Link to="/" className="shrink-0" aria-label="Nova Zen — accueil">
          <img
            src={logoZen}
            alt="Logo Nova Zen"
            width={1536}
            height={512}
            className="h-7 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            to="/reserver"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <CalendarDays className="size-4" />
            Réserver
          </Link>
          <Link
            to="/reservations"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <LayoutList className="size-4" />
            Réservations
          </Link>
        </nav>
      </div>
    </header>
  );
}
