import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  AlarmClock,
  ListTodo,
  AlertCircle,
  UsersRound,
  Shield,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/crm-types";
import { SpariomLogo } from "@/components/SpariomLogo";
import { supabase } from "@/lib/supabase/client";

export interface SidebarUser {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export interface SpariomSidebarProps {
  user: SidebarUser | null | undefined;
  role: string | null | undefined;
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  isMobile?: boolean;
}

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ElementType;
  countKey?: "expiring" | "tasks" | "clarifications";
}

const mainNavItems: NavItemDef[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/interessenten", label: "Interessenten", icon: Sparkles },
  { to: "/kunden", label: "Kunden", icon: Users },
  { to: "/vertraege", label: "Verträge", icon: KanbanSquare },
  { to: "/vertragsablauf", label: "Vertragsablauf", icon: AlarmClock, countKey: "expiring" },
  { to: "/aufgaben", label: "Aufgaben", icon: ListTodo, countKey: "tasks" },
  { to: "/klaerfaelle", label: "Klärfälle", icon: AlertCircle, countKey: "clarifications" },
];

export function SpariomSidebar({
  user,
  role,
  pathname,
  collapsed,
  onToggleCollapse,
  onNavigate,
  isMobile = false,
}: SpariomSidebarProps) {
  const [counts, setCounts] = useState<{
    expiring: number;
    tasks: number;
    clarifications: number;
  }>({
    expiring: 0,
    tasks: 0,
    clarifications: 0,
  });

  // Fetch counts safely from Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadCounters() {
      try {
        const [tasksRes, clarRes] = await Promise.all([
          supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "offen"),
          supabase
            .from("clarifications")
            .select("id", { count: "exact", head: true })
            .in("status", ["offen", "wartend"]),
        ]);

        if (isMounted) {
          setCounts((prev) => ({
            ...prev,
            tasks: tasksRes.count ?? 0,
            clarifications: clarRes.count ?? 0,
          }));
        }
      } catch {
        // Silently preserve 0 counts on network or auth isolation
      }
    }

    if (user) {
      loadCounters();
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Global keyboard shortcut '[' to toggle sidebar rail collapse
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "[" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select" ||
          target?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        onToggleCollapse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, onToggleCollapse]);

  const showTeam = role === "admin" || role === "haupt_vertriebler";
  const showUsers = role === "admin";

  const renderNavLink = (item: NavItemDef) => {
    const Icon = item.icon;
    const active = pathname === item.to || pathname.startsWith(item.to + "/");
    const count = item.countKey ? counts[item.countKey] : 0;

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        title={collapsed && !isMobile ? item.label : undefined}
        className={cn(
          "relative z-10 flex items-center rounded-[14px] text-sm font-medium transition-colors duration-200 select-none group",
          collapsed && !isMobile ? "justify-center h-11 w-11 mx-auto px-0" : "px-3.5 py-2.5 gap-3",
          active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {active && (
          <motion.div
            layoutId={isMobile ? "snav__pill_mobile" : "snav__pill"}
            className="snav__pill absolute inset-0 rounded-[14px] bg-gradient-to-r from-accent/25 via-accent/15 to-accent/10 border border-accent/30 shadow-sm -z-10"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}

        <div className="relative shrink-0 flex items-center justify-center">
          <Icon className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105" />
          {/* Rail mode badge morphing: 8px glowing indicator dot pinned to icon corner */}
          {collapsed && !isMobile && count > 0 && (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-background"
              style={{ boxShadow: "0 0 8px var(--accent)" }}
            />
          )}
        </div>

        {/* Expanded mode: show label and count badge */}
        {(!collapsed || isMobile) && (
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="truncate">{item.label}</span>
            {count > 0 && (
              <span className="snav__count ml-auto px-2 py-0.5 text-[11px] font-bold rounded-full bg-accent/15 text-accent border border-accent/20 shrink-0">
                {count}
              </span>
            )}
          </div>
        )}
      </Link>
    );
  };

  const content = (
    <div className="flex h-full flex-col text-sidebar-foreground justify-between overflow-hidden">
      {/* Brand Header */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border shrink-0 transition-all duration-200",
          collapsed && !isMobile ? "flex-col gap-2.5 py-4 px-2 justify-center items-center" : "px-4 py-4 justify-between",
        )}
      >
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
        >
          <SpariomLogo
            variant={collapsed && !isMobile ? "emblem" : "full"}
            size={collapsed && !isMobile ? 32 : "md"}
            isRail={collapsed && !isMobile}
            showSubtitle={!collapsed}
          />
        </Link>

        {/* Rail Collapse / Expand Toggle button (always accessible) */}
        {!isMobile && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-glass-2 transition-all cursor-pointer",
              collapsed ? "mt-1 text-primary hover:text-primary hover:bg-accent-soft" : "",
            )}
            title={collapsed ? "Seitenleiste ausklappen ( [ )" : "Seitenleiste einklappen ( [ )"}
            aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav Link Items */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-3 px-2 space-y-1">
        {mainNavItems.map(renderNavLink)}

        {/* Administration / Team Section */}
        {(showTeam || showUsers) && (
          <div className="pt-3 mt-3 border-t border-sidebar-border/60">
            {(!collapsed || isMobile) && (
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Administration
              </div>
            )}
            {showTeam &&
              renderNavLink({
                to: "/team",
                label: "Team-Verwaltung",
                icon: UsersRound,
              })}
            {showUsers &&
              renderNavLink({
                to: "/benutzer",
                label: "Benutzerverwaltung",
                icon: Shield,
              })}
          </div>
        )}
      </div>

      {/* Bottom User Profile Section (.side__me) */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <Link
          to="/profil"
          onClick={onNavigate}
          title={user?.email ?? undefined}
          className={cn(
            "side__me flex items-center rounded-xl p-2 transition-all duration-200 hover:bg-glass-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            collapsed && !isMobile ? "justify-center" : "gap-3",
          )}
        >
          <img
            src={
              user?.user_metadata?.avatar_url ||
              getAvatarUrl(null, user?.user_metadata?.full_name, user?.email)
            }
            alt=""
            className="h-9 w-9 rounded-full object-cover border border-accent/40 shrink-0 shadow-sm"
          />

          {(!collapsed || isMobile) && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Benutzer"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate font-medium">
                {role === "admin"
                  ? "Administrator"
                  : role === "haupt_vertriebler"
                    ? "Haupt-Vertriebler"
                    : "Mitarbeiter"}
              </span>
            </div>
          )}
        </Link>
      </div>
    </div>
  );

  // If in mobile sheet drawer, render static container
  if (isMobile) {
    return <div className="h-full flex flex-col bg-background/95 backdrop-blur-md">{content}</div>;
  }

  // Floating frosted desktop sidebar
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 84 : 260 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "side frosted-glass hidden md:flex flex-col overflow-hidden",
        collapsed ? "side--collapsed" : "side--expanded",
      )}
    >
      {content}
    </motion.aside>
  );
}

export default SpariomSidebar;
