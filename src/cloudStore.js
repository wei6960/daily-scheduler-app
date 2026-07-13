import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const cloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);
export const pushEnabled = Boolean(cloudEnabled && vapidPublicKey);
export const supabase = cloudEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;

const COLLECTIONS = [
  "employees",
  "directors",
  "schedules",
  "attendance",
  "scheduleResponses",
  "messages",
  "boardPosts",
];

export async function loadCloudState(fallbackState) {
  if (!cloudEnabled) return fallbackState;

  const [{ data: groups, error: groupsError }, { data: records, error: recordsError }] = await Promise.all([
    supabase.from("app_groups").select("code,data"),
    supabase.from("app_records").select("collection,id,data"),
  ]);

  if (groupsError || recordsError) {
    throw groupsError || recordsError;
  }

  const next = { ...fallbackState, groups: (groups || []).map((row) => row.data) };
  COLLECTIONS.forEach((collection) => {
    next[collection] = (records || []).filter((row) => row.collection === collection).map((row) => row.data);
  });
  return next;
}

export async function saveCloudState(state) {
  if (!cloudEnabled) return;

  const groupRows = state.groups.map((group) => ({ code: group.code, data: group }));
  const recordRows = COLLECTIONS.flatMap((collection) =>
    (state[collection] || []).map((item) => ({
      collection,
      id: item.id,
      group_code: item.groupCode || null,
      username: item.username || null,
      data: item,
    }))
  );

  await supabase.from("app_groups").upsert(groupRows, { onConflict: "code" });
  if (recordRows.length) {
    await supabase.from("app_records").upsert(recordRows, { onConflict: "collection,id" });
  }

  await removeMissingGroups(state.groups.map((group) => group.code));
  await Promise.all(COLLECTIONS.map((collection) => removeMissingRecords(collection, (state[collection] || []).map((item) => item.id))));
}

async function removeMissingGroups(codes) {
  let query = supabase.from("app_groups").delete();
  if (codes.length) query = query.not("code", "in", `(${codes.map(quote).join(",")})`);
  await query;
}

async function removeMissingRecords(collection, ids) {
  let query = supabase.from("app_records").delete().eq("collection", collection);
  if (ids.length) query = query.not("id", "in", `(${ids.map(quote).join(",")})`);
  await query;
}

function quote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

export async function groupCodeExists(code) {
  if (!cloudEnabled) return null;
  const { data, error } = await supabase.from("app_groups").select("code").eq("code", code).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function subscribeToWebPush(session) {
  if (!pushEnabled || !session?.user) {
    throw new Error("Web Push 尚未設定。");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("這個手機瀏覽器不支援 Web Push。");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("通知權限尚未開啟。");
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: subscription.endpoint,
    user_id: session.user.id,
    role: session.role,
    group_code: session.user.groupCode,
    subscription: subscription.toJSON(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return subscription;
}

export async function sendPushNotification({ groupCode, audience = "all", title, body, tag, requireInteraction = false }) {
  if (!cloudEnabled) return;
  const { error } = await supabase.functions.invoke("send-push", {
    body: { groupCode, audience, title, body, tag, requireInteraction },
  });
  if (error) throw error;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
