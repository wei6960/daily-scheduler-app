import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);
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
