import { Link } from "@tanstack/react-router";
import { CalendarDays, LayoutList } from "lucide-react";

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            Z
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            ZEN<span className="text-primary">ROOMS</span>
          </span>
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
