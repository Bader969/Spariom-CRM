import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { formatDate, daysUntil, getRenewalState } from "@/lib/crm-types";
import { useEffect, useState, useMemo } from "react";

function storageKey(userId?: string) {
  return `notif-dismissed:${userId ?? "anon"}`;
}

function loadDismissed(userId?: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(userId: string | undefined, set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed(user?.id));

  useEffect(() => {
    setDismissed(loadDismissed(user?.id));
  }, [user?.id]);

  const dismiss = (key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(user?.id, next);
      return next;
    });
  };

  const clearAll = (visibleKeys: string[]) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      visibleKeys.forEach((k) => next.add(k));
      saveDismissed(user?.id, next);
      return next;
    });
  };

  const { data } = useQuery({
    queryKey: ["notifications-summary"],
    enabled: !!user,
    queryFn: async () => {
      const in370 = new Date();
      in370.setDate(in370.getDate() + 370);
      const today = new Date().toISOString().slice(0, 10);
      const [expiring, openTasks, openClar] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, type, status, end_date, customer_id, customers(first_name,last_name)")
          .gte("end_date", today)
          .lte("end_date", in370.toISOString().slice(0, 10))
          .neq("status", "storniert")
          .neq("status", "abgelaufen")
          .order("end_date", { ascending: true })
          .limit(100),
        supabase
          .from("tasks")
          .select("id, title, due_date, customer_id, customers(first_name,last_name)")
          .eq("status", "offen")
          .lte("due_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
          .order("due_date", { ascending: true })
          .limit(20),
        supabase
          .from("clarifications")
          .select("id, title, due_date, status, customer_id, customers(first_name,last_name)")
          .neq("status", "erledigt")
          .lte("due_date", new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10))
          .order("due_date", { ascending: true })
          .limit(20),
      ]);
      const expiringFiltered = (expiring.data ?? []).filter((c: any) =>
        getRenewalState({ type: c.type, end_date: c.end_date, status: c.status }).due
      ).slice(0, 20);
      return {
        expiring: expiringFiltered,
        tasks: openTasks.data ?? [],
        clarifications: openClar.data ?? [],
      };
    },
    refetchInterval: 60_000,
  });

  const visible = useMemo(() => {
    const expiring = (data?.expiring ?? []).filter((c: any) => !dismissed.has("c-" + c.id));
    const tasks = (data?.tasks ?? []).filter((t: any) => !dismissed.has("t-" + t.id));
    const clarifications = (data?.clarifications ?? []).filter((c: any) => !dismissed.has("cl-" + c.id));
    return { expiring, tasks, clarifications };
  }, [data, dismissed]);

  const total = visible.expiring.length + visible.tasks.length + visible.clarifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Benachrichtigungen">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">Benachrichtigungen</div>
            <div className="text-xs text-muted-foreground">Verträge im Verlängerungsfenster & offene Aufgaben</div>
          </div>
          {total > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                const keys = [
                  ...visible.expiring.map((c: any) => "c-" + c.id),
                  ...visible.tasks.map((t: any) => "t-" + t.id),
                  ...visible.clarifications.map((c: any) => "cl-" + c.id),
                ];
                clearAll(keys);
              }}
            >
              Alle gelesen
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-auto divide-y">
          {total === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Keine offenen Punkte</div>
          )}
          {visible.expiring.map((c: any) => {
            const days = daysUntil(c.end_date);
            return (
              <Link
                to="/kunden/$id"
                params={{ id: c.customer_id }}
                key={"c-" + c.id}
                onClick={() => dismiss("c-" + c.id)}
                className="block p-3 hover:bg-accent/50"
              >
                <div className="text-sm font-medium">Vertrag läuft ab</div>
                <div className="text-xs text-muted-foreground">
                  {c.customers?.first_name} {c.customers?.last_name} – {formatDate(c.end_date)}
                  {days !== null && ` (in ${days} Tagen)`}
                </div>
              </Link>
            );
          })}
          {visible.tasks.map((t: any) => (
            <Link
              to={t.customer_id ? "/kunden/$id" : "/aufgaben"}
              params={t.customer_id ? { id: t.customer_id } : undefined as any}
              key={"t-" + t.id}
              onClick={() => dismiss("t-" + t.id)}
              className="block p-3 hover:bg-accent/50"
            >
              <div className="text-sm font-medium">Aufgabe: {t.title}</div>
              <div className="text-xs text-muted-foreground">
                {t.customers ? `${t.customers.first_name} ${t.customers.last_name} – ` : ""}
                fällig {formatDate(t.due_date)}
              </div>
            </Link>
          ))}
          {visible.clarifications.map((c: any) => (
            <Link
              to={c.customer_id ? "/kunden/$id" : "/klaerfaelle"}
              params={c.customer_id ? { id: c.customer_id } : undefined as any}
              key={"cl-" + c.id}
              onClick={() => dismiss("cl-" + c.id)}
              className="block p-3 hover:bg-accent/50"
            >
              <div className="text-sm font-medium">Klärfall: {c.title}</div>
              <div className="text-xs text-muted-foreground">
                {c.customers ? `${c.customers.first_name} ${c.customers.last_name} – ` : ""}
                fällig {formatDate(c.due_date)}
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
