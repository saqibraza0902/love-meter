import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("authorization");
    if (!url || !anonKey || !serviceKey) return json({ error: "Snap cleanup is not configured." }, 503);
    if (!authorization) return json({ error: "Sign in to clean expired snaps." }, 401);
    const isScheduledInvocation = authorization === `Bearer ${serviceKey}`;
    if (!isScheduledInvocation) {
      const authClient = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authError } = await authClient.auth.getUser();
      if (authError || !authData.user) return json({ error: "Sign in to clean expired snaps." }, 401);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: expired, error: readError } = await admin.from("shared_daily_snaps")
      .select("id,image_path").lte("expires_at", new Date().toISOString()).limit(500);
    if (readError) throw readError;
    if (!expired?.length) return json({ deleted: 0 });

    const paths = expired.map(row => row.image_path);
    const { error: storageError } = await admin.storage.from("private-media").remove(paths);
    if (storageError) throw storageError;

    const { error: deleteError } = await admin.from("shared_daily_snaps").delete().in("id", expired.map(row => row.id));
    if (deleteError) throw deleteError;
    return json({ deleted: expired.length });
  } catch (error) {
    console.error("Expired daily snap cleanup failed", error);
    return json({ error: "Expired snaps could not be deleted yet." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
