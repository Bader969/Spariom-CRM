import React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Plus,
  Moon,
  Sun,
  Menu,
  PanelLeftOpen,
  PanelLeftClose,
  Sparkles,
  Users,
  KanbanSquare,
  ListTodo,
  AlertCircle,
  LogOut,
  User,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/lib/theme";
import { getAvatarUrl } from "@/lib/crm-types";
import { SpariomLogo } from "@/components/SpariomLogo";

function truncateBreadcrumb(segments: string[], maxVisible = 3): string[] {
  if (segments.length <= maxVisible) return segments;
  return [segments[0], "...", segments[segments.length - 1]];
}

export interface HeaderUser {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export interface SpariomHeaderProps {
  pathname: string;
  user: HeaderUser | null | undefined;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  onSignOut: () => void;
}

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  interessenten: "Interessenten",
  kunden: "Kunden",
  vertraege: "Verträge",
  vertragsablauf: "Vertragsablauf",
  aufgaben: "Aufgaben",
  klaerfaelle: "Klärfälle",
  team: "Team-Verwaltung",
  benutzer: "Benutzerverwaltung",
  profil: "Mein Profil",
};

export function SpariomHeader({
  pathname,
  user,
  collapsed,
  onToggleCollapse,
  onOpenMobile,
  onOpenSearch,
  onSignOut,
}: SpariomHeaderProps) {
  const navigate = useNavigate();
  const { theme, toggle } = ThemeToggle();

  // Generate breadcrumb segments
  const pathParts = pathname.split("/").filter(Boolean);
  const rawSegments = ["Home"];
  for (const part of pathParts) {
    rawSegments.push(routeLabels[part] || decodeURIComponent(part));
  }
  const displayCrumbs = truncateBreadcrumb(rawSegments);

  return (
    <header className="sticky top-0 z-25 w-full pt-4 pb-3 px-3 sm:px-4 md:px-0 pointer-events-none">
      <div
        className="top__in frosted-glass h-16 w-full flex items-center justify-between px-3 sm:px-5 gap-2 sm:gap-4 pointer-events-auto transition-all"
        style={{
          maxWidth: "calc(1480px - 28px)",
        }}
      >
        {/* Left Side: Collapse/Menu Trigger + Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Sheet Trigger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 rounded-xl hover:bg-glass-2 shrink-0"
            onClick={onOpenMobile}
            aria-label="Menü öffnen"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Desktop Rail Collapse Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex h-9 w-9 rounded-xl hover:bg-glass-2 text-muted-foreground hover:text-foreground shrink-0"
            onClick={onToggleCollapse}
            title={collapsed ? "Seitenleiste ausklappen ( [ )" : "Seitenleiste einklappen ( [ )"}
            aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>

          {/* Mobile Logo Brand */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <SpariomLogo variant="emblem" size={26} />
          </div>

          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="crumbs hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate"
          >
            {displayCrumbs.map((crumb, idx) => {
              const isLast = idx === displayCrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  )}
                  <span
                    className={
                      isLast
                        ? "text-foreground font-semibold truncate max-w-[160px]"
                        : "text-muted-foreground/75 truncate max-w-[120px]"
                    }
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Global Search + Quick Action + Notifications + Theme + Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Search Pill (data-testid="searchpill_cmd_k") */}
          <button
            type="button"
            data-testid="searchpill_cmd_k"
            onClick={onOpenSearch}
            className="searchpill flex items-center gap-2 h-9 px-3 rounded-xl bg-glass-2 hover:bg-glass-hi border border-line text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="hidden md:inline font-medium">Schnellsuche…</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-background/60 text-muted-foreground border border-line">
              ⌘K
            </kbd>
          </button>

          {/* Quick Action Button (data-testid="quick_new_btn") */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="quick_new_btn"
                className="btn--primary h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Neu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl frosted-glass p-1 z-50">
              <DropdownMenuItem
                onClick={() =>
                  navigate({
                    to: "/interessenten",
                    search: { action: "new" } as Record<string, string> as never,
                  })
                }
                className="cursor-pointer text-xs rounded-lg py-2"
              >
                <Sparkles className="h-4 w-4 mr-2 text-accent" /> Neuer Interessent
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate({
                    to: "/kunden",
                    search: { action: "new" } as Record<string, string> as never,
                  })
                }
                className="cursor-pointer text-xs rounded-lg py-2"
              >
                <Users className="h-4 w-4 mr-2 text-accent" /> Neuer Kunde
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate({
                    to: "/vertraege",
                    search: { action: "new" } as Record<string, string> as never,
                  })
                }
                className="cursor-pointer text-xs rounded-lg py-2"
              >
                <KanbanSquare className="h-4 w-4 mr-2 text-accent" /> Neuer Vertrag
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate({
                    to: "/aufgaben",
                    search: { action: "new" } as Record<string, string> as never,
                  })
                }
                className="cursor-pointer text-xs rounded-lg py-2"
              >
                <ListTodo className="h-4 w-4 mr-2 text-accent" /> Neue Aufgabe
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate({
                    to: "/klaerfaelle",
                    search: { action: "new" } as Record<string, string> as never,
                  })
                }
                className="cursor-pointer text-xs rounded-lg py-2"
              >
                <AlertCircle className="h-4 w-4 mr-2 text-accent" /> Neuer Klärfall
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification Bell (data-testid="notification_bell") */}
          <div data-testid="notification_bell" className="flex items-center">
            <NotificationBell />
          </div>

          {/* Theme Toggle (data-testid="theme_toggle") */}
          <Button
            variant="ghost"
            size="icon"
            data-testid="theme_toggle"
            onClick={(e) => toggle(e)}
            className="h-9 w-9 rounded-xl hover:bg-glass-2 text-muted-foreground hover:text-foreground"
            title={theme === "dark" ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren"}
            aria-label="Theme umschalten"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* User Profile Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full p-0 overflow-hidden ring-1 ring-border hover:ring-accent transition-all"
              >
                <img
                  src={
                    user?.user_metadata?.avatar_url ||
                    getAvatarUrl(null, user?.user_metadata?.full_name, user?.email)
                  }
                  alt=""
                  className="h-full w-full object-cover"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl frosted-glass p-1.5 z-50">
              <div className="px-2 py-1.5 text-xs">
                <div className="font-semibold text-foreground truncate">
                  {user?.user_metadata?.full_name || "Angemeldeter Benutzer"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate({ to: "/profil" })}
                className="cursor-pointer text-xs rounded-lg py-2"
              >
                <User className="h-4 w-4 mr-2 text-accent" /> Mein Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                className="cursor-pointer text-xs rounded-lg py-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" /> Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default SpariomHeader;
