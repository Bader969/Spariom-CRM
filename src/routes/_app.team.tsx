import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/team")({
  component: TeamPage,
});

function TeamPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState<string>("");
  const [memberAdd, setMemberAdd] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && role && role !== "admin" && role !== "haupt_vertriebler") {
      navigate({ to: "/dashboard" });
    }
  }, [role, loading, navigate]);

  const { data: teams } = useQuery({
    queryKey: ["teams", "full"],
    queryFn: async () => {
      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("id, name, leader_id, created_at")
        .order("created_at", { ascending: true });
      if (error) { console.error("teams fetch", error); return []; }
      const list = teamsData ?? [];
      const { data: members } = await supabase
        .from("team_members")
        .select("team_id, user_id");
      const memberList = members ?? [];
      const ids = Array.from(new Set([
        ...list.map((t: any) => t.leader_id).filter(Boolean),
        ...memberList.map((m: any) => m.user_id),
      ]));
      const profileMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        (profs ?? []).forEach((p: any) => profileMap.set(p.id, p.full_name));
      }
      return list.map((t: any) => ({
        ...t,
        leader_name: t.leader_id ? profileMap.get(t.leader_id) ?? null : null,
        team_members: memberList
          .filter((m: any) => m.team_id === t.id)
          .map((m: any) => ({ user_id: m.user_id, full_name: profileMap.get(m.user_id) ?? null })),
      }));
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["staff", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("active", true);
      return data ?? [];
    },
  });

  const createTeam = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("teams").insert({ name: name.trim(), leader_id: leaderId || null });
    if (error) toast.error(error.message);
    else { setName(""); setLeaderId(""); qc.invalidateQueries({ queryKey: ["teams"] }); toast.success("Team erstellt"); }
  };

  const deleteTeam = async (id: string) => {
    if (!confirm("Team wirklich löschen?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["teams"] }); toast.success("Team gelöscht"); }
  };

  const addMember = async (teamId: string) => {
    const uid = memberAdd[teamId];
    if (!uid) return;
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: uid });
    if (error) toast.error(error.message);
    else { setMemberAdd((m) => ({ ...m, [teamId]: "" })); qc.invalidateQueries({ queryKey: ["teams"] }); toast.success("Mitglied hinzugefügt"); }
  };

  const removeMember = async (teamId: string, userId: string) => {
    const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["teams"] });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team-Verwaltung</h1>
        <p className="text-sm text-muted-foreground">Teams und Mitglieder organisieren</p>
      </div>

      {role === "admin" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Neues Team</CardTitle></CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-2">
            <Input placeholder="Teamname" value={name} onChange={(e) => setName(e.target.value)} className="md:flex-1" />
            <Select value={leaderId} onValueChange={setLeaderId}>
              <SelectTrigger className="md:w-64"><SelectValue placeholder="Teamleiter wählen…" /></SelectTrigger>
              <SelectContent>
                {(staff ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={createTeam} disabled={!name.trim()}><Plus className="h-4 w-4 mr-1" />Erstellen</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(teams ?? []).length === 0 && <p className="text-muted-foreground">Keine Teams.</p>}
        {teams?.map((t: any) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{t.name}</CardTitle>
                <p className="text-xs text-muted-foreground">Leitung: {t.leader_name ?? "—"}</p>
              </div>
              {role === "admin" && (
                <Button variant="ghost" size="icon" onClick={() => deleteTeam(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Mitglieder</div>
                <div className="flex flex-wrap gap-2">
                  {t.team_members?.length === 0 && <span className="text-sm text-muted-foreground">Keine Mitglieder</span>}
                  {t.team_members?.map((m: any) => (
                    <span key={m.user_id} className="inline-flex items-center gap-2 text-xs bg-muted rounded-full px-2 py-1">
                      {m.full_name ?? m.user_id.slice(0, 8)}
                      <button onClick={() => removeMember(t.id, m.user_id)} className="hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={memberAdd[t.id] ?? ""} onValueChange={(v) => setMemberAdd((m) => ({ ...m, [t.id]: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Mitarbeiter hinzufügen…" /></SelectTrigger>
                  <SelectContent>
                    {(staff ?? [])
                      .filter((s: any) => !t.team_members?.some((m: any) => m.user_id === s.id) && s.id !== t.leader_id)
                      .map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.email}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => addMember(t.id)} disabled={!memberAdd[t.id]}>Hinzufügen</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
