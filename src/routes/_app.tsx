import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { SessionTimeoutModal } from "@/components/SessionTimeoutModal";
import { FloatingNoteWidget } from "@/components/FloatingNoteWidget";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SpariomSidebar } from "@/components/shell/SpariomSidebar";
import { SpariomHeader } from "@/components/shell/SpariomHeader";
import { CommandFinderDialog } from "@/components/shell/CommandFinderDialog";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const COLLAPSED_KEY = "spariom.sidebar.collapsed";
const FALLBACK_COLLAPSED_KEY = "blitzvox.sidebar.collapsed";

function AppLayout() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Restore sidebar state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored =
        localStorage.getItem(COLLAPSED_KEY) ?? localStorage.getItem(FALLBACK_COLLAPSED_KEY);
      const isCol = stored === "1";
      setCollapsed(isCol);
      document.documentElement.classList.toggle("is-rail", isCol);
    }
  }, []);

  // Redirect unauthenticated visitors to /auth
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [user, loading, navigate]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
        localStorage.setItem(FALLBACK_COLLAPSED_KEY, next ? "1" : "0");
      } catch (err) {
        void err;
      }
      document.documentElement.classList.toggle("is-rail", next);
      return next;
    });
  };

  const { isWarning, countdown, resetTimer } = useIdleTimeout({
    timeoutMs: 15 * 60 * 1000, // 15 minutes
    warningMs: 60 * 1000, // 60 seconds warning
    onIdle: () => {
      signOut();
    },
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-sm font-medium text-muted-foreground">Wird geladen…</span>
        </div>
      </div>
    );
  }

  const showTeam = role === "admin" || role === "haupt_vertriebler";
  const showUsers = role === "admin";

  return (
    <div className="min-h-screen relative bg-background text-foreground overflow-x-hidden">
      {/* Ambient background wash layer */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 bg-gradient-to-br from-accent/5 via-transparent to-accent/5"
        aria-hidden="true"
      />

      {/* 1. Desktop Floating Frosted Sidebar (256px expanded ↔ 84px rail) */}
      <SpariomSidebar
        user={user}
        role={role}
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />

      {/* 2. Mobile Drawer Navigation */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 max-w-[85vw] border-r border-line bg-background"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Spariom Navigation</SheetTitle>
          </SheetHeader>
          <SpariomSidebar
            user={user}
            role={role}
            pathname={pathname}
            collapsed={false}
            onToggleCollapse={() => {}}
            onNavigate={() => setMobileOpen(false)}
            isMobile={true}
          />
        </SheetContent>
      </Sheet>

      {/* 3. Main Content Wrapper with Dynamic Padding */}
      <div
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300 ease-out",
          // Mobile padding: 12px (px-3)
          "px-3 md:px-0 md:pr-6",
          // Desktop expanded: 296px left (16px left + 260px sidebar + 20px gap)
          // Desktop rail collapsed: 120px left (16px left + 84px rail + 20px gap)
          collapsed ? "md:pl-[120px]" : "md:pl-[296px]",
        )}
      >
        {/* Session Timeout Warning Modal */}
        <SessionTimeoutModal
          open={isWarning}
          countdown={countdown}
          onStayLoggedIn={resetTimer}
          onLogOut={signOut}
        />

        {/* Floating Sticky Header */}
        <SpariomHeader
          pathname={pathname}
          user={user}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          onOpenMobile={() => setMobileOpen(true)}
          onOpenSearch={() => setCommandOpen(true)}
          onSignOut={signOut}
        />

        {/* Dynamic Route View - Fluid width without artificial center void */}
        <main className="flex-1 w-full pb-12 pt-2 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* 4. Global Command Finder Dialog (⌘K) */}
      <CommandFinderDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        showTeam={showTeam}
        showUsers={showUsers}
      />

      {/* 5. Persistent Quick Phone Call Note Widget */}
      <FloatingNoteWidget />
    </div>
  );
}

export default AppLayout;
