import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTRACT_TYPES,
  TASK_PRIORITIES,
  TASK_TRIGGER_EVENTS,
  TASK_ASSIGNEE_MODES,
  contractTypeIcon,
  contractTypeLabel,
  taskPriorityMeta,
  type ContractType,
  type TaskPriority,
  type TaskTriggerEvent,
  type TaskAssigneeMode,
} from "@/lib/crm-types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Clock,
  UserCheck,
  Check,
  X,
  Sparkles,
  Info,
} from "lucide-react";

interface TaskAutomationManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDERS = [
  { tag: "{kunde}", label: "Kundenname", example: "Max Mustermann" },
  { tag: "{anbieter}", label: "Anbieter", example: "Vattenfall" },
  { tag: "{sparte}", label: "Vertragstyp", example: "Energie – Strom" },
  { tag: "{referenz}", label: "Vertrags-Ref", example: "VT-2026-0042" },
];

export function TaskAutomationManagerDialog({
  open,
  onOpenChange,
}: TaskAutomationManagerDialogProps) {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "haupt_vertriebler";

  const [selectedContractType, setSelectedContractType] = useState<string>("alle");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [formContractType, setFormContractType] = useState<ContractType>("energie_strom");
  const [formTrigger, setFormTrigger] = useState<TaskTriggerEvent>("contract_created");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDueDays, setFormDueDays] = useState("2");
  const [formPriority, setFormPriority] = useState<TaskPriority>("mittel");
  const [formAssigneeMode, setFormAssigneeMode] = useState<TaskAssigneeMode>("contract_creator");
  const [formSpecificUser, setFormSpecificUser] = useState<string>("__none");
  const [saving, setSaving] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["task_automation_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_automation_rules")
        .select("*")
        .order("contract_type")
        .order("sort_order")
        .order("due_days_offset");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      return data ?? [];
    },
    enabled: open,
  });

  const filteredRules = useMemo(() => {
    if (selectedContractType === "alle") return rules;
    return rules.filter((r: any) => r.contract_type === selectedContractType);
  }, [rules, selectedContractType]);

  const countsByType = useMemo(() => {
    const map: Record<string, { total: number; active: number }> = {};
    for (const ct of CONTRACT_TYPES) {
      map[ct.value] = { total: 0, active: 0 };
    }
    for (const r of rules as any[]) {
      if (!map[r.contract_type]) map[r.contract_type] = { total: 0, active: 0 };
      map[r.contract_type].total += 1;
      if (r.active) map[r.contract_type].active += 1;
    }
    return map;
  }, [rules]);

  const resetForm = (defaultType?: ContractType) => {
    setEditingRuleId(null);
    setFormContractType(
      defaultType ??
        (selectedContractType !== "alle"
          ? (selectedContractType as ContractType)
          : "energie_strom")
    );
    setFormTrigger("contract_created");
    setFormTitle("");
    setFormDesc("");
    setFormDueDays("2");
    setFormPriority("mittel");
    setFormAssigneeMode("contract_creator");
    setFormSpecificUser("__none");
  };

  const handleStartCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleStartEdit = (rule: any) => {
    setEditingRuleId(rule.id);
    setFormContractType(rule.contract_type);
    setFormTrigger(rule.trigger_event);
    setFormTitle(rule.title_template || "");
    setFormDesc(rule.description_template || "");
    setFormDueDays(String(rule.due_days_offset ?? 0));
    setFormPriority(rule.priority || "mittel");
    setFormAssigneeMode(rule.assignee_mode || "contract_creator");
    setFormSpecificUser(rule.specific_user_id || "__none");
    setShowForm(true);
  };

  const handleSaveRule = async () => {
    if (!formTitle.trim()) {
      toast.error("Bitte geben Sie eine Titel-Vorlage ein.");
      return;
    }
    setSaving(true);
    const payload = {
      contract_type: formContractType,
      trigger_event: formTrigger,
      title_template: formTitle.trim(),
      description_template: formDesc.trim() || null,
      due_days_offset: Math.max(0, parseInt(formDueDays || "0", 10) || 0),
      priority: formPriority,
      assignee_mode: formAssigneeMode,
      specific_user_id:
        formAssigneeMode === "specific_user" && formSpecificUser !== "__none"
          ? formSpecificUser
          : null,
    };

    try {
      if (editingRuleId) {
        const { error } = await supabase
          .from("task_automation_rules")
          .update(payload)
          .eq("id", editingRuleId);
        if (error) throw error;
        toast.success("Automations-Regel aktualisiert");
      } else {
        const { error } = await supabase.from("task_automation_rules").insert({
          ...payload,
          active: true,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success("Neue Automations-Regel angelegt");
      }
      qc.invalidateQueries({ queryKey: ["task_automation_rules"] });
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Speichern der Regel");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: any, checked: boolean) => {
    const { error } = await supabase
      .from("task_automation_rules")
      .update({ active: checked })
      .eq("id", rule.id);
    if (error) {
      toast.error(error.message);
    } else {
      qc.invalidateQueries({ queryKey: ["task_automation_rules"] });
      toast.success(checked ? "Regel aktiviert" : "Regel pausiert");
    }
  };

  const handleDeleteRule = async (rule: any) => {
    const { error } = await supabase
      .from("task_automation_rules")
      .delete()
      .eq("id", rule.id);
    if (error) {
      toast.error(error.message);
    } else {
      qc.invalidateQueries({ queryKey: ["task_automation_rules"] });
      toast.success("Automations-Regel gelöscht");
      if (editingRuleId === rule.id) {
        setShowForm(false);
        resetForm();
      }
    }
  };

  const insertPlaceholder = (tag: string, target: "title" | "desc") => {
    if (target === "title") {
      setFormTitle((prev) => (prev ? `${prev} ${tag}` : tag));
    } else {
      setFormDesc((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-gradient-to-r from-primary/10 via-card to-card shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4 pr-6">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
                  Automatische Aufgabenverwaltung je Vertragstyp
                  <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-xs">
                    {rules.filter((r: any) => r.active).length} aktiv
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm mt-0.5">
                  Definieren Sie Vorlagen, die beim Eintragen, Aktivieren oder Kündigen eines Vertrags vollautomatisch als Aufgaben angelegt werden.
                </DialogDescription>
              </div>
            </div>

            {isAdmin && !showForm && (
              <Button onClick={handleStartCreate} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                Neue Regel anlegen
              </Button>
            )}
          </div>

          {/* Contract Type Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-4 pb-1 no-scrollbar">
            <Button
              variant={selectedContractType === "alle" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedContractType("alle")}
              className="h-8 text-xs font-semibold shrink-0"
            >
              Alle Sparten ({rules.length})
            </Button>
            {CONTRACT_TYPES.map((ct) => {
              const stat = countsByType[ct.value] ?? { total: 0, active: 0 };
              const isSelected = selectedContractType === ct.value;
              return (
                <Button
                  key={ct.value}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedContractType(ct.value)}
                  className="h-8 text-xs font-medium shrink-0 gap-1.5"
                >
                  <span>{ct.icon}</span>
                  <span>{ct.label.split(" (")[0]}</span>
                  <Badge
                    variant="secondary"
                    className={`ml-0.5 px-1.5 py-0 text-[11px] ${
                      isSelected ? "bg-background/20 text-primary-foreground" : ""
                    }`}
                  >
                    {stat.active}/{stat.total}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Create / Edit Rule Form */}
          {showForm && (
            <div className="rounded-2xl border-2 border-primary/30 bg-accent/20 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2 font-bold text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {editingRuleId
                    ? "Automations-Regel bearbeiten"
                    : "Neue Automations-Regel erstellen"}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Abbrechen
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    1. Vertragstyp (Sparte)
                  </Label>
                  <Select
                    value={formContractType}
                    onValueChange={(v) => setFormContractType(v as ContractType)}
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value}>
                          {ct.icon} {ct.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    2. Auslöser (Trigger-Event)
                  </Label>
                  <Select
                    value={formTrigger}
                    onValueChange={(v) => setFormTrigger(v as TaskTriggerEvent)}
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_TRIGGER_EVENTS.map((ev) => (
                        <SelectItem key={ev.value} value={ev.value}>
                          {ev.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Fällig in (+Tage)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={formDueDays}
                      onChange={(e) => setFormDueDays(e.target.value)}
                      className="bg-card"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Priorität
                    </Label>
                    <Select
                      value={formPriority}
                      onValueChange={(v) => setFormPriority(v as TaskPriority)}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Title & Placeholders */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    3. Aufgaben-Titel (mit dynamischen Platzhaltern)
                  </Label>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-1">
                      Platzhalter einfügen:
                    </span>
                    {PLACEHOLDERS.map((ph) => (
                      <button
                        key={ph.tag}
                        type="button"
                        onClick={() => insertPlaceholder(ph.tag, "title")}
                        className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/25 font-mono transition-colors"
                        title={`Beispiel: ${ph.example}`}
                      >
                        + {ph.tag}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  placeholder="z.B. Zählerstand & MaLo-ID prüfen – {kunde} ({anbieter})"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="bg-card font-medium"
                />
              </div>

              {/* Description & Assignee */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      4. Beschreibung / Checkliste (optional)
                    </Label>
                    <div className="flex items-center gap-1">
                      {PLACEHOLDERS.map((ph) => (
                        <button
                          key={ph.tag}
                          type="button"
                          onClick={() => insertPlaceholder(ph.tag, "desc")}
                          className="text-[11px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground font-mono"
                        >
                          {ph.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="Optionale Arbeitsanweisung für den Mitarbeiter..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="bg-card resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      5. Zuständigkeit (Zuweisung)
                    </Label>
                    <Select
                      value={formAssigneeMode}
                      onValueChange={(v) => setFormAssigneeMode(v as TaskAssigneeMode)}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_ASSIGNEE_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formAssigneeMode === "specific_user" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Mitarbeiter auswählen
                      </Label>
                      <Select
                        value={formSpecificUser}
                        onValueChange={setFormSpecificUser}
                      >
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="Mitarbeiter wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Bitte wählen…</SelectItem>
                          {profiles.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name || p.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Abbrechen
                </Button>
                <Button onClick={handleSaveRule} disabled={saving || !formTitle.trim()}>
                  <Check className="h-4 w-4 mr-1.5" />
                  {editingRuleId ? "Änderungen speichern" : "Regel aktivieren & speichern"}
                </Button>
              </div>
            </div>
          )}

          {/* Rules List */}
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              Lade Automations-Regeln…
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-2xl text-muted-foreground space-y-3">
              <Zap className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p>Keine Automations-Regeln für diese Auswahl vorhanden.</p>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={handleStartCreate}>
                  <Plus className="h-4 w-4 mr-1.5" /> Erste Regel anlegen
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRules.map((rule: any) => {
                const prioMeta = taskPriorityMeta(rule.priority);
                const triggerMeta =
                  TASK_TRIGGER_EVENTS.find((e) => e.value === rule.trigger_event) ??
                  TASK_TRIGGER_EVENTS[0];
                const assigneeMeta =
                  TASK_ASSIGNEE_MODES.find((m) => m.value === rule.assignee_mode) ??
                  TASK_ASSIGNEE_MODES[0];

                return (
                  <div
                    key={rule.id}
                    className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      rule.active
                        ? "bg-card border-border/70 shadow-xs"
                        : "bg-muted/30 border-border/40 opacity-65"
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-semibold text-xs gap-1 bg-accent/40">
                          <span>{contractTypeIcon(rule.contract_type)}</span>
                          <span>{contractTypeLabel(rule.contract_type)}</span>
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-medium">
                          ⚡ {triggerMeta.label}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${prioMeta.badgeClass}`}>
                          Prio: {prioMeta.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          +{rule.due_days_offset} {rule.due_days_offset === 1 ? "Tag" : "Tage"}
                        </Badge>
                        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                          <UserCheck className="h-3 w-3" />
                          {assigneeMeta.label}
                        </Badge>
                      </div>

                      <div className="font-semibold text-base text-foreground">
                        {rule.title_template}
                      </div>

                      {rule.description_template && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {rule.description_template}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="flex items-center gap-2 pr-2 border-r border-border/50">
                        <Switch
                          checked={Boolean(rule.active)}
                          onCheckedChange={(checked) => handleToggleActive(rule, checked)}
                          disabled={!isAdmin}
                        />
                        <span className="text-xs font-medium text-muted-foreground w-12">
                          {rule.active ? "Aktiv" : "Pausiert"}
                        </span>
                      </div>

                      {isAdmin && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleStartEdit(rule)}
                            title="Regel bearbeiten"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteRule(rule)}
                            title="Regel löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3.5 border-t border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>Datenbank-Trigger aktiv:</strong> Beim Anlegen oder Statuswechsel eines Vertrags werden alle passenden Regeln automatisch als Aufgaben erstellt.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
