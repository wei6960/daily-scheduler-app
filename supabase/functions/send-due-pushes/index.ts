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
    const now = new Date();
    const { data: scheduleRows, error } = await supabase
      .from("app_records")
      .select("id,group_code,data")
      .eq("collection", "schedules");
    if (error) throw error;

    let sent = 0;
    for (const row of scheduleRows || []) {
      const schedule = row.data;
      const scheduleDate = schedule.type === "fixed" ? now.toISOString().slice(0, 10) : schedule.date;
      const scheduleAt = new Date(`${scheduleDate}T${schedule.time}:00`);
      const diff = scheduleAt.getTime() - now.getTime();
      const phase = diff <= 0 && diff > -60_000 ? "due" : diff > 0 && diff <= 10 * 60_000 ? "upcoming" : null;
      if (!phase) continue;

      const eventKey = `${phase}:${row.id}:${scheduleDate}`;
      const { data: existing } = await supabase.from("push_events").select("event_key").eq("event_key", eventKey).maybeSingle();
      if (existing) continue;
      await supabase.from("push_events").insert({ event_key: eventKey });

      const title = `${phase === "due" ? "到點" : "即將開始"}：${schedule.title}`;
      sent += await sendToGroup(row.group_code, schedule.audience || "all", {
        title,
        body: `${schedule.time}｜${schedule.detail || ""}`,
        tag: eventKey,
        requireInteraction: phase === "due",
        url: "/daily-scheduler-app/",
      });
    }

    return json({ sent });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
});

async function sendToGroup(groupCode: string, audience: string, payload: unknown) {
  let query = supabase.from("push_subscriptions").select("endpoint,subscription").eq("group_code", groupCode);
  if (audience !== "all") query = query.eq("user_id", audience);
  const { data, error } = await query;
  if (error) throw error;
  const message = JSON.stringify(payload);
  const results = await Promise.allSettled((data || []).map((row) => send(row.endpoint, row.subscription, message)));
  return results.filter((item) => item.status === "fulfilled").length;
}

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
