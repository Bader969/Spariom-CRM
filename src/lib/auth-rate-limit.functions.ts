import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const WINDOW_MINUTES = 15;
const MAX_FAILED = 10;

function clientIp(): string {
  // Try TanStack helper, fallback to header parsing
  let ip = getRequestIP({ xForwardedFor: true }) ?? "";
  if (!ip) {
    const xff = getRequestHeader("x-forwarded-for") ?? "";
    ip = xff.split(",")[0]?.trim() ?? "";
  }
  if (!ip) ip = getRequestHeader("cf-connecting-ip") ?? "unknown";
  return ip || "unknown";
}

/** Returns { blocked: boolean, retryInSeconds?: number } */
export const checkLoginRateLimit = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const ip = clientIp();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count, error } = await supabaseAdmin
        .from("auth_login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip", ip)
        .eq("success", false)
        .gte("attempted_at", since);

      if (error) return { blocked: false };
      if ((count ?? 0) >= MAX_FAILED) {
        return { blocked: true, retryInSeconds: WINDOW_MINUTES * 60 };
      }
      return { blocked: false };
    } catch {
      return { blocked: false };
    }
  });

export const recordLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      email: z.string().email().optional(),
      success: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const ip = clientIp();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("auth_login_attempts").insert({
        ip,
        email: data.email ?? null,
        success: data.success,
      });
    } catch {
      // Ignore if SUPABASE_SERVICE_ROLE_KEY is not configured in serverless environment
    }
    return { ok: true };
  });
