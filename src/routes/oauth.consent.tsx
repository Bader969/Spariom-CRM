import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { getAvatarUrl } from "@/lib/crm-types";
import { SpariomLogo } from "@/components/SpariomLogo";

interface ConsentSearchParams {
  authorization_id?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
}

export const Route = createFileRoute("/oauth/consent")({
  validateSearch: (search: Record<string, unknown>): ConsentSearchParams => ({
    authorization_id: (search.authorization_id as string) || undefined,
    client_id: (search.client_id as string) || undefined,
    redirect_uri: (search.redirect_uri as string) || undefined,
    scope: (search.scope as string) || undefined,
    state: (search.state as string) || undefined,
  }),
  component: OAuthConsentPage,
});

interface OAuthClient {
  name?: string;
}

interface OAuthDetails {
  client?: OAuthClient;
  app_name?: string;
}

function OAuthConsentPage() {
  const search = useSearch({ from: "/oauth/consent" });
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const authorizationId = search.authorization_id;

  const [authDetails, setAuthDetails] = useState<OAuthDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect to Auth login if user is not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      const returnUrl = encodeURIComponent(window.location.href);
      navigate({
        to: "/auth",
        search: { redirect: returnUrl } as Record<string, string> as never,
      });
    }
  }, [user, authLoading, navigate]);

  // Fetch Authorization details from Supabase
  useEffect(() => {
    async function fetchDetails() {
      if (!authorizationId) {
        setLoadingDetails(false);
        return;
      }
      try {
        setLoadingDetails(true);
        setErrorMsg(null);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey =
          import.meta.env.VITE_SUPABASE_ANON_KEY ||
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          "";
        if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL ist nicht konfiguriert.");

        // Call Supabase Auth API endpoint for OAuth authorization details
        const { data, error } = await fetch(
          `${supabaseUrl}/auth/v1/oauth/authorize?authorization_id=${authorizationId}`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
            },
          },
        ).then(async (res) => {
          if (!res.ok) throw new Error("Autorisierungsdetails konnten nicht geladen werden.");
          return { data: await res.json(), error: null };
        });

        if (error) throw error;
        setAuthDetails(data as OAuthDetails);
      } catch (err: unknown) {
        console.error("OAuth Details Error:", err);
        setErrorMsg(
          err instanceof Error ? err.message : "Die Anforderung ist ungültig oder abgelaufen.",
        );
      } finally {
        setLoadingDetails(false);
      }
    }

    if (user) {
      fetchDetails();
    }
  }, [authorizationId, user]);

  // Approve Authorization
  const handleApprove = async () => {
    if (!authorizationId) return;
    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey =
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        "";
      if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL ist nicht konfiguriert.");
      const res = await fetch(`${supabaseUrl}/auth/v1/oauth/consent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          authorization_id: authorizationId,
          action: "approve",
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error_description || data.msg || "Freigabe fehlgeschlagen.");

      toast.success("Zugriff erfolgreich gewährt!");
      if (data.redirect_uri) {
        window.location.href = data.redirect_uri;
      } else if (search.redirect_uri) {
        window.location.href = search.redirect_uri;
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      console.error("Approve error:", err);
      const msg = err instanceof Error ? err.message : "Fehler bei der Autorisierung.";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  // Deny Authorization
  const handleDeny = async () => {
    if (!authorizationId) {
      navigate({ to: "/dashboard" });
      return;
    }
    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey =
        import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        "";
      if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL ist nicht konfiguriert.");
      await fetch(`${supabaseUrl}/auth/v1/oauth/consent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          authorization_id: authorizationId,
          action: "deny",
        }),
      });
    } catch (e) {
      console.error("Deny error:", e);
    } finally {
      if (search.redirect_uri) {
        window.location.href = `${search.redirect_uri}?error=access_denied`;
      } else {
        navigate({ to: "/dashboard" });
      }
    }
  };

  if (authLoading || (user && loadingDetails)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center p-8 space-y-4 border-border/60">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
          <p className="text-base text-muted-foreground font-medium">
            Autorisierungsanfrage wird geladen…
          </p>
        </Card>
      </div>
    );
  }

  const clientName =
    authDetails?.client?.name ||
    authDetails?.app_name ||
    search.client_id ||
    "Drittanbieter-Anwendung";
  const userAvatar = getAvatarUrl(
    user?.user_metadata?.avatar_url,
    user?.user_metadata?.full_name,
    user?.email,
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-lg border-border/60 shadow-2xl relative z-10 overflow-hidden">
        <CardHeader className="text-center pb-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-center gap-3 mb-2">
            {/* Spariom Logo */}
            <div className="h-12 w-12 rounded-2xl frosted-glass border border-accent/30 flex items-center justify-center p-1.5 shadow-sm">
              <SpariomLogo variant="emblem" size={32} />
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            {/* App Icon placeholder */}
            <div className="h-12 w-12 rounded-2xl bg-secondary border border-border flex items-center justify-center text-foreground font-bold text-lg shadow-sm">
              {clientName.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Anwendungs-Zugriff anfragen
          </CardTitle>
          <CardDescription className="text-base font-medium">
            <span className="text-foreground font-semibold">{clientName}</span> möchte auf Ihr
            Spariom CRM Konto zugreifen.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Logged in User Card */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-accent/30 border border-border/50">
            <img
              src={userAvatar}
              alt=""
              className="h-12 w-12 rounded-full object-cover border-2 border-primary/30 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Angemeldet als
              </div>
              <div className="text-base font-bold truncate text-foreground">
                {user?.user_metadata?.full_name || user?.email}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verifiziert
            </Badge>
          </div>

          {errorMsg ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Autorisierungsfehler</div>
                <div>{errorMsg}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> Diese Anwendung erhält folgenden Zugriff:
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Profil-Informationen (Name, E-Mail-Adresse und Avatar) lesen</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Berechtigung als authentifizierter CRM-Benutzer</span>
                </li>
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-6 border-t border-border/40 bg-muted/10 flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="w-full sm:w-1/2 h-11 text-base font-medium"
            onClick={handleDeny}
            disabled={submitting}
          >
            <XCircle className="h-5 w-5 mr-2 text-muted-foreground" /> Ablehnen
          </Button>
          <Button
            className="w-full sm:w-1/2 h-11 text-base font-semibold"
            onClick={handleApprove}
            disabled={submitting || !!errorMsg}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Wird autorisiert…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" /> Zugriff erlauben
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
