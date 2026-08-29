import { Link } from "@tanstack/react-router";
import { CalendarDays, LayoutList } from "lucide-react";
import logoSerenity from "@/assets/nova-serenity.png.asset.json";
import logoZenSpace from "@/assets/nova-zen-space.png.asset.json";

export function Header() {
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
          className="flex min-w-0 items-center justify-center gap-2"
          aria-label="Nova Zen Space — accueil"
        >
          <img
            src={logoZenSpace.url}
            alt="Logo Nova Zen"
            width={2861}
            height={672}
            decoding="async"
            className="h-7 w-auto max-w-full object-contain sm:h-9 lg:h-10"
          />
          <span className="font-heading text-lg font-extrabold uppercase leading-none tracking-[0.04em] text-[#7eb8a2] sm:text-[1.45rem] lg:text-[1.7rem]">
            Space
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
            to="/reservations"
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
            activeProps={{ className: "text-foreground bg-accent" }}
          >
            <LayoutList className="size-4 shrink-0" />
            <span className="hidden sm:inline">Réservations</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
