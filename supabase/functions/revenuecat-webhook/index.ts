import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await request.json();
    const event = payload?.event;
    const userId = event?.app_user_id;
    if (!userId || typeof userId !== "string") return json({ error: "Missing app user id" }, 400);

    const eventType = String(event.type || "").toUpperCase();
    const expirationMs = Number(event.expiration_at_ms || 0);
    const endedTypes = new Set(["EXPIRATION", "REFUND", "REFUND_REVERSED"]);
    const active = !endedTypes.has(eventType) && (!expirationMs || expirationMs > Date.now());
    const productId = String(event.product_id || "");
    const normalizedProduct = productId.toLowerCase();
    const plan = normalizedProduct.includes("annual") || normalizedProduct.includes("yearly") || normalizedProduct.includes("year")
      ? "yearly"
      : "monthly";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin.from("entitlements").upsert({
      user_id: userId,
      plan: active ? plan : "free",
      active,
      provider: "revenuecat",
      provider_customer_id: userId,
      provider_subscription_id: event.original_transaction_id || event.transaction_id || null,
      current_period_end: expirationMs ? new Date(expirationMs).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    return json({ received: true });
  } catch (error) {
    console.error("RevenueCat webhook failed", error);
    return json({ error: "Webhook processing failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
