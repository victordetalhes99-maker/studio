import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  action?: string;
  hostname?: string;
  challenge_ts?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ success: false, error: "missing_secret" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as { token?: string; action?: string } | null;
    const token = body?.token;
    if (!token || typeof token !== "string" || token.length > 4096) {
      return new Response(JSON.stringify({ success: false, error: "invalid_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cloudflare recommends including remoteip
    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";

    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = (await res.json()) as TurnstileResponse;

    if (!data.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "verification_failed",
          codes: data["error-codes"] ?? [],
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, action: data.action ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: "server_error", message: String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
