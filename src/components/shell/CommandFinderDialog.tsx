import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
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
  PlusCircle,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/lib/theme";

interface CommandFinderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTeam?: boolean;
  showUsers?: boolean;
}

export function CommandFinderDialog({
  open,
  onOpenChange,
  showTeam = true,
  showUsers = true,
}: CommandFinderDialogProps) {
  const navigate = useNavigate();
  const { theme, toggle } = ThemeToggle();

  // Listen for global Cmd+K or Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Suche nach Seiten, Aktionen oder Befehlen… (⌘K)" />
      <CommandList className="max-h-[360px] custom-scrollbar">
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

        <CommandGroup heading="Seiten & Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/dashboard" }))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-accent" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/interessenten" }))}>
            <Sparkles className="mr-2 h-4 w-4 text-accent" />
            <span>Interessenten (Leads)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/kunden" }))}>
            <Users className="mr-2 h-4 w-4 text-accent" />
            <span>Kunden (Customer 360°)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/vertraege" }))}>
            <KanbanSquare className="mr-2 h-4 w-4 text-accent" />
            <span>Verträge (Kanban)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/vertragsablauf" }))}>
            <AlarmClock className="mr-2 h-4 w-4 text-accent" />
            <span>Vertragsablauf & Verlängerungen</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/aufgaben" }))}>
            <ListTodo className="mr-2 h-4 w-4 text-accent" />
            <span>Aufgaben</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/klaerfaelle" }))}>
            <AlertCircle className="mr-2 h-4 w-4 text-accent" />
            <span>Klärfälle</span>
          </CommandItem>
          {showTeam && (
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/team" }))}>
              <UsersRound className="mr-2 h-4 w-4 text-accent" />
              <span>Team-Verwaltung</span>
            </CommandItem>
          )}
          {showUsers && (
            <CommandItem onSelect={() => runCommand(() => navigate({ to: "/benutzer" }))}>
              <Shield className="mr-2 h-4 w-4 text-accent" />
              <span>Benutzerverwaltung</span>
            </CommandItem>
          )}
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/profil" }))}>
            <User className="mr-2 h-4 w-4 text-accent" />
            <span>Mein Profil</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Schnellaktionen">
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                navigate({
                  to: "/interessenten",
                  search: { action: "new" } as Record<string, string> as never,
                }),
              )
            }
          >
            <PlusCircle className="mr-2 h-4 w-4 text-accent" />
            <span>Neuer Interessent erfassen</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                navigate({
                  to: "/kunden",
                  search: { action: "new" } as Record<string, string> as never,
                }),
              )
            }
          >
            <PlusCircle className="mr-2 h-4 w-4 text-accent" />
            <span>Neuer Kunde anlegen</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                navigate({
                  to: "/vertraege",
                  search: { action: "new" } as Record<string, string> as never,
                }),
              )
            }
          >
            <PlusCircle className="mr-2 h-4 w-4 text-accent" />
            <span>Neuer Vertrag erstellen</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                navigate({
                  to: "/aufgaben",
                  search: { action: "new" } as Record<string, string> as never,
                }),
              )
            }
          >
            <PlusCircle className="mr-2 h-4 w-4 text-accent" />
            <span>Neue Aufgabe erstellen</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Design & Einstellungen">
          <CommandItem onSelect={() => runCommand(() => toggle())}>
            {theme === "dark" ? (
              <>
                <Sun className="mr-2 h-4 w-4 text-amber-400" />
                <span>Hellmodus aktivieren</span>
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4 text-accent" />
                <span>Dunkelmodus aktivieren</span>
              </>
            )}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default CommandFinderDialog;
