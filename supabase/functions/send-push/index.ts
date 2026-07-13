import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json();
    const groupCode = String(payload.groupCode || "");
    const audience = payload.audience || "all";
    if (!groupCode || !payload.title) {
      return json({ error: "Missing groupCode or title" }, 400);
    }

    let query = supabase.from("push_subscriptions").select("endpoint,subscription").eq("group_code", groupCode);
    if (audience !== "all") query = query.eq("user_id", audience);
    const { data, error } = await query;
    if (error) throw error;

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body || "",
      tag: payload.tag || "daily-scheduler",
      requireInteraction: Boolean(payload.requireInteraction),
      url: payload.url || "/daily-scheduler-app/",
    });

    const results = await Promise.allSettled((data || []).map((row) => send(row.endpoint, row.subscription, message)));
    return json({ sent: results.filter((item) => item.status === "fulfilled").length, total: results.length });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
});

async function send(endpoint: string, subscription: unknown, message: string) {
  try {
    await webpush.sendNotification(subscription as webpush.PushSubscription, message);
  } catch (error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      return;
    }
    throw error;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
