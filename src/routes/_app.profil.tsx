import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  User, KeyRound, Mail, ShieldCheck, CheckCircle2, AlertCircle, 
  Eye, EyeOff, Loader2, UserCheck, Calendar, LockKeyhole, Sparkles, Camera, Check
} from "lucide-react";
import { formatDate, AVATAR_PRESETS, getAvatarUrl } from "@/lib/crm-types";

export const Route = createFileRoute("/_app/profil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();

  // Load user profile record
  const { data: profile } = useQuery({
    queryKey: ["user_profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error && error.code !== "PGRST116") {
        console.error("Profile fetch error:", error);
      }
      return data ?? null;
    },
  });

  // Name Form State
  const [fullName, setFullName] = useState("");
  const [namePassword, setNamePassword] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Email Form State
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Password visibility toggles
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Avatar Selection State
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>("");
  const [customAvatarInput, setCustomAvatarInput] = useState<string>("");
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // Initialize form fields when profile loads
  const currentFullName = profile?.full_name ?? user?.user_metadata?.full_name ?? "";
  const currentEmail = user?.email ?? profile?.email ?? "";
  const activeAvatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? getAvatarUrl(null, currentFullName, currentEmail);

  // Handle Avatar Update
  const handleUpdateAvatar = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setIsUpdatingAvatar(true);
    try {
      // 1. Update profiles table
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({ 
          id: user!.id, 
          avatar_url: targetUrl.trim(),
          full_name: currentFullName,
          email: currentEmail 
        });

      if (profErr) throw profErr;

      // 2. Update auth user metadata
      await supabase.auth.updateUser({
        data: { avatar_url: targetUrl.trim() },
      });

      toast.success("Dein Profil-Avatar wurde erfolgreich geändert!");
      setSelectedAvatarUrl("");
      setCustomAvatarInput("");
      qc.invalidateQueries({ queryKey: ["user_profile", user?.id] });
    } catch (err: any) {
      console.error("Avatar update error:", err);
      toast.error(err.message || "Fehler beim Aktualisieren des Avatars.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  // Helper: Validate current password with Supabase Auth
  const verifyCurrentPassword = async (pwd: string): Promise<boolean> => {
    if (!pwd || !currentEmail) return false;
    const { error } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: pwd,
    });
    return !error;
  };

  // Handle Name Update
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Bitte gib einen gültigen Namen ein.");
      return;
    }
    if (!namePassword) {
      toast.error("Bitte gib dein aktuelles Passwort zur Bestätigung ein.");
      return;
    }

    setIsUpdatingName(true);
    try {
      // 1. Verify current password
      const isValidPassword = await verifyCurrentPassword(namePassword);
      if (!isValidPassword) {
        toast.error("Das eingegebene Passwort ist falsch. Name wurde nicht geändert.");
        setIsUpdatingName(false);
        return;
      }

      // 2. Update profile table
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, full_name: fullName.trim(), email: currentEmail });

      if (profErr) throw profErr;

      // 3. Update auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      toast.success("Dein Name wurde erfolgreich geändert!");
      setNamePassword("");
      setFullName("");
      qc.invalidateQueries({ queryKey: ["user_profile", user?.id] });
    } catch (err: any) {
      console.error("Name update error:", err);
      toast.error(err.message || "Fehler beim Aktualisieren des Namens.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  // Handle Email Update
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = newEmail.trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      toast.error("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (targetEmail === currentEmail) {
      toast.info("Diese E-Mail-Adresse ist bereits aktiv.");
      return;
    }
    if (!emailPassword) {
      toast.error("Bitte gib dein aktuelles Passwort zur Bestätigung ein.");
      return;
    }

    setIsUpdatingEmail(true);
    try {
      // 1. Verify current password
      const isValidPassword = await verifyCurrentPassword(emailPassword);
      if (!isValidPassword) {
        toast.error("Das eingegebene Passwort ist falsch. E-Mail wurde nicht geändert.");
        setIsUpdatingEmail(false);
        return;
      }

      // 2. Update Supabase Auth Email
      const { error: authErr } = await supabase.auth.updateUser({ email: targetEmail });
      if (authErr) throw authErr;

      // 3. Update profiles table
      await supabase
        .from("profiles")
        .update({ email: targetEmail })
        .eq("id", user!.id);

      toast.success("E-Mail-Adresse aktualisiert! Prüfe ggf. dein Postfach zur Bestätigung.");
      setEmailPassword("");
      setNewEmail("");
      qc.invalidateQueries({ queryKey: ["user_profile", user?.id] });
    } catch (err: any) {
      console.error("Email update error:", err);
      toast.error(err.message || "Fehler beim Ändern der E-Mail-Adresse.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Handle Password Change
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Bitte gib dein altes Passwort ein.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("Das neue Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Die neuen Passwörter stimmen nicht überein.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // 1. Verify old password
      const isValidPassword = await verifyCurrentPassword(currentPassword);
      if (!isValidPassword) {
        toast.error("Das alte Passwort ist falsch. Bitte überprüfe deine Eingabe.");
        setIsUpdatingPassword(false);
        return;
      }

      // 2. Update Auth Password
      const { error: passErr } = await supabase.auth.updateUser({ password: newPassword });
      if (passErr) throw passErr;

      toast.success("Passwort erfolgreich geändert!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password change error:", err);
      toast.error(err.message || "Fehler beim Ändern des Passworts.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const roleLabel = role === "admin" ? "Administrator" : role === "haupt_vertriebler" ? "Haupt-Vertriebler" : "Mitarbeiter";
  const userInitials = (currentFullName || currentEmail || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="container max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Profile Summary Card */}
      <Card className="border-border/60 bg-glass/60 shadow-lg relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar Circle / Image */}
            <div className="relative group shrink-0">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 border-2 border-primary/30 overflow-hidden flex items-center justify-center text-primary font-bold text-2xl shadow-md transition-all duration-300 group-hover:border-primary group-hover:shadow-primary/20">
                {activeAvatarUrl ? (
                  <img src={activeAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
            </div>

            <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
                  {currentFullName || "Profil-Benutzer"}
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-medium">
                  {roleLabel}
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-normal">
                  <UserCheck className="h-3 w-3 mr-1" /> Angemeldet
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{currentEmail}</p>
              <div className="flex items-center justify-center sm:justify-start gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Registriert: {user?.created_at ? formatDate(user.created_at) : "—"}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Konto aktiv
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs Container */}
      <Tabs defaultValue="avatar" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="avatar" className="gap-2 text-xs sm:text-sm font-semibold">
            <Camera className="h-4 w-4 text-primary" /> Avatar
          </TabsTrigger>
          <TabsTrigger value="name" className="gap-2 text-xs sm:text-sm">
            <User className="h-4 w-4" /> Name
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2 text-xs sm:text-sm">
            <Mail className="h-4 w-4" /> E-Mail
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2 text-xs sm:text-sm">
            <KeyRound className="h-4 w-4" /> Passwort
          </TabsTrigger>
          <TabsTrigger value="info" className="hidden sm:flex gap-2 text-xs sm:text-sm">
            <LockKeyhole className="h-4 w-4" /> Account-Info
          </TabsTrigger>
        </TabsList>

        {/* Tab 0: Avatar Selection */}
        <TabsContent value="avatar">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Profil-Avatar auswählen
              </CardTitle>
              <CardDescription>
                Wähle einen stilvollen Avatar aus unserer Vorlagen-Galerie oder verwende einen eigenen Bild-Link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Presets Grid */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">Avatar-Galerie (Klicken zum Übernehmen)</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = (selectedAvatarUrl || activeAvatarUrl) === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedAvatarUrl(preset.url);
                          handleUpdateAvatar(preset.url);
                        }}
                        className={`relative p-2 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-1.5 group cursor-pointer ${
                          isSelected 
                            ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-105" 
                            : "border-border/60 hover:border-primary/50 hover:bg-accent/40"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1 right-1 h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <img src={preset.url} alt={preset.label} className="h-14 w-14 rounded-xl object-cover" />
                        <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground truncate w-full text-center">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Image URL Option */}
              <div className="pt-4 border-t border-border/40 space-y-3 max-w-lg">
                <Label htmlFor="custom_avatar">Oder eigenen Bild-Link (URL) nutzen</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom_avatar"
                    placeholder="https://beispiel.de/mein-avatar.png"
                    value={customAvatarInput}
                    onChange={(e) => setCustomAvatarInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={!customAvatarInput.trim() || isUpdatingAvatar}
                    onClick={() => handleUpdateAvatar(customAvatarInput.trim())}
                  >
                    {isUpdatingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Speichern
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 1: Name Change */}
        <TabsContent value="name">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Name ändern
              </CardTitle>
              <CardDescription>
                Aktualisiere deinen angezeigten vollständigen Namen im CRM. Aus Sicherheitsgründen ist die Eingabe deines aktuellen Passworts erforderlich.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Neuer Vollständiger Name</Label>
                  <Input
                    id="full_name"
                    placeholder={currentFullName || "z. B. Max Mustermann"}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label htmlFor="name_password">Aktuelles Passwort zur Bestätigung</Label>
                  <Input
                    id="name_password"
                    type="password"
                    placeholder="••••••••"
                    value={namePassword}
                    onChange={(e) => setNamePassword(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={isUpdatingName} className="w-full sm:w-auto">
                  {isUpdatingName ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird gespeichert…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Namen speichern
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Email Change */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" /> E-Mail-Adresse ändern
              </CardTitle>
              <CardDescription>
                Ändere deine Login-E-Mail-Adresse. Aus Sicherheitsgründen musst du dein aktuelles Passwort eingeben.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateEmail} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Aktuelle E-Mail-Adresse</Label>
                  <Input value={currentEmail} disabled className="bg-muted/40 font-mono text-xs" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_email">Neue E-Mail-Adresse</Label>
                  <Input
                    id="new_email"
                    type="email"
                    placeholder="neue.email@beispiel.de"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label htmlFor="email_password">Aktuelles Passwort zur Bestätigung</Label>
                  <Input
                    id="email_password"
                    type="password"
                    placeholder="••••••••"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={isUpdatingEmail} className="w-full sm:w-auto">
                  {isUpdatingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> E-Mail ändern…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" /> E-Mail-Adresse aktualisieren
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Password Change */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Passwort ändern
              </CardTitle>
              <CardDescription>
                Gib zuerst dein <strong>altes (aktuelles) Passwort</strong> ein. Erst wenn dieses mit dem System übereinstimmt, wird das neue Passwort gesetzt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="current_password">Altes (Aktuelles) Passwort</Label>
                  <div className="relative">
                    <Input
                      id="current_password"
                      type={showCurrentPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                    >
                      {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label htmlFor="new_password">Neues Passwort</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showNewPass ? "text" : "password"}
                      placeholder="Mindestens 6 Zeichen"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNewPass(!showNewPass)}
                    >
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Neues Passwort wiederholen</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    placeholder="Neues Passwort bestätigen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" /> Passwörter stimmen nicht überein!
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isUpdatingPassword} className="w-full sm:w-auto">
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Passwort ändern…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 mr-2" /> Neues Passwort speichern
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Info */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-primary" /> Kontoinformationen &amp; Sicherheit
              </CardTitle>
              <CardDescription>Details zu deiner aktuellen Sitzung und deinen Benutzerrechten im Spariom CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Systemrolle</div>
                  <div className="text-sm font-semibold text-foreground">{roleLabel}</div>
                </div>

                <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Automatische Abmeldung</div>
                  <div className="text-sm text-foreground">Nach 15 Minuten Inaktivität</div>
                </div>

                <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</div>
                  <div className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Aktiv &amp; verifiziert
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
