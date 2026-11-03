import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, Lock, Loader2, ShieldCheck, Sun, Moon } from "lucide-react";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/auth-rate-limit.functions";
import { SpariomLogo } from "@/components/SpariomLogo";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Spariom CRM – Anmeldung" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "description", content: "Interner Login für Spariom CRM" },
    ],
  }),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = ThemeToggle();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Ambient golden glow behind auth card */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full blur-[120px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(210, 149, 60, 0.22) 0%, rgba(210, 149, 60, 0.05) 60%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      {/* Floating Theme Toggle in top-right corner */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          data-testid="theme_toggle"
          onClick={(e) => toggle(e)}
          className="h-10 w-10 rounded-full bg-glass-2 hover:bg-glass-hi border border-line text-muted-foreground hover:text-foreground"
          title={theme === "dark" ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren"}
          aria-label="Theme umschalten"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="w-full max-w-[420px] z-10 flex flex-col items-center">
        {/* Auth Hero Pedestal with Spariom Emblem & Glow */}
        <div className="mb-6">
          <SpariomLogo variant="auth-hero" />
        </div>

        {/* Sorvo Centered Frosted Sign-in Card */}
        <div className="signin__card w-full p-7 sm:p-9 shadow-xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Willkommen zurück
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Geben Sie Ihre Zugangsdaten ein, um fortzufahren.
            </p>
          </div>

          <LoginForm />

          {/* Security & RBAC Trust Badge */}
          <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/80 text-center">
            <ShieldCheck className="h-3.5 w-3.5 text-accent shrink-0" />
            <span>End-to-End geschützt · RBAC Zugriffskontrolle</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const checkLimit = useServerFn(checkLoginRateLimit);
  const recordAttempt = useServerFn(recordLoginAttempt);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. IP rate limit pre-check
      const limit = await (checkLimit as unknown as () => Promise<{ blocked?: boolean }>)().catch(
        () => ({ blocked: false }),
      );
      if (limit?.blocked) {
        toast.error("Zu viele Versuche", {
          description: "Bitte später erneut versuchen.",
        });
        return;
      }

      // 2. Supabase password authentication
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      // 3. Record outcome asynchronously
      recordAttempt({ data: { email, success: !error } }).catch(() => {});

      if (error) {
        // Generic enumeration-resistant error toast
        toast.error("Anmeldung fehlgeschlagen", {
          description: "E-Mail oder Passwort ist falsch.",
        });
      } else {
        toast.success("Willkommen zurück!");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="login-email" className="text-xs font-semibold text-foreground/90">
          E-Mail-Adresse
        </Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="name@spariom.de"
            className="pl-10 h-11 rounded-xl bg-background/50 border-line hover:border-line-2 focus-visible:ring-2 focus-visible:ring-accent transition-all text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password" className="text-xs font-semibold text-foreground/90">
          Passwort
        </Label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="pl-10 h-11 rounded-xl bg-background/50 border-line hover:border-line-2 focus-visible:ring-2 focus-visible:ring-accent transition-all text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn--primary w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-md mt-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-ink)]" />
            <span>Anmelden…</span>
          </>
        ) : (
          <span>Anmelden</span>
        )}
      </button>
    </form>
  );
}

export default AuthPage;
