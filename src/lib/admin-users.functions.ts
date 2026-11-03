import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["admin", "haupt_vertriebler", "mitarbeiter"]);

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(10),
        full_name: z.string().min(1),
        role: RoleEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Rollenprüfung fehlgeschlagen");
    if (!isAdmin) throw new Error("Forbidden: Admin-Rolle erforderlich");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const emailLower = data.email.toLowerCase();
    await supabaseAdmin
      .from("auth_email_allowlist")
      .upsert(
        { email: emailLower, added_by: userId, note: "Auto: via Admin-Anlage" },
        { onConflict: "email", ignoreDuplicates: true },
      );

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "Benutzer konnte nicht erstellt werden");
    }

    const newUserId = created.user.id;

    if (data.role !== "mitarbeiter") {
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", newUserId);
      if (delErr) throw new Error(delErr.message);

      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: data.role });
      if (insErr) throw new Error(insErr.message);
    }

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("id", newUserId);

    return { id: newUserId, email: data.email };
  });

export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Rollenprüfung fehlgeschlagen");
    if (!isAdmin) throw new Error("Forbidden: Admin-Rolle erforderlich");

    if (data.user_id === userId) {
      throw new Error("Eigenes Konto kann nicht deaktiviert werden.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ban / unban the auth user — invalidates existing tokens when deactivating.
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.active ? "none" : "876000h", // ~100 years
    });
    if (banErr) throw new Error(banErr.message);

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.user_id);
    if (profErr) throw new Error(profErr.message);

    return { ok: true };
  });

export const adminRemoveAllowlistEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Rollenprüfung fehlgeschlagen");
    if (!isAdmin) throw new Error("Forbidden: Admin-Rolle erforderlich");

    const emailLower = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find matching profile (if any)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", emailLower)
      .maybeSingle();

    let deactivatedUserId: string | null = null;
    if (profile?.id) {
      if (profile.id === userId) {
        throw new Error("Eigenes Konto kann nicht deaktiviert werden.");
      }
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        ban_duration: "876000h",
      });
      if (banErr) throw new Error(banErr.message);
      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update({ active: false })
        .eq("id", profile.id);
      if (profErr) throw new Error(profErr.message);
      deactivatedUserId = profile.id;
    }

    const { error: delErr } = await supabaseAdmin
      .from("auth_email_allowlist")
      .delete()
      .eq("email", emailLower);
    if (delErr) throw new Error(delErr.message);

    return { ok: true, deactivated_user_id: deactivatedUserId };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Rollenprüfung fehlgeschlagen");
    if (!isAdmin) throw new Error("Forbidden: Admin-Rolle erforderlich");
    if (data.user_id === userId) throw new Error("Eigenes Konto kann nicht gelöscht werden.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Block if user still owns/created any customers
    const { count: ownedCount } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .or(`assigned_to.eq.${data.user_id},created_by.eq.${data.user_id}`);
    if ((ownedCount ?? 0) > 0) {
      throw new Error(
        `Diesem Account sind noch ${ownedCount} Kunden zugewiesen. Bitte zuerst übertragen.`,
      );
    }

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
