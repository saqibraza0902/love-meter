import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import ReactNativeBlobUtil from "react-native-blob-util";
import { decode } from "base64-arraybuffer";
import Config from "react-native-config";

const supabaseUrl = Config.SUPABASE_URL;
const supabaseAnonKey = Config.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Set SUPABASE_URL and SUPABASE_ANON_KEY to connect to Supabase.");
}

export const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "missing-anon-key", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

if (Platform.OS !== "web") {
  if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
  AppState.addEventListener("change", state => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Profile = {
  id: string;
  email: string;
  name: string;
  bio: string;
  photo_path: string | null;
  verified: boolean;
  paid: boolean;
  score: number;
  time_zone?: string;
};

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  return data as Profile;
}

export async function getActiveCouple(userId: string) {
  const { data: ownMembership, error: ownError } = await supabase.from("couple_members").select("couple_id").eq("user_id", userId).is("left_at", null).maybeSingle();
  if (ownError) throw ownError;
  if (!ownMembership) return null;
  const { data: members, error: memberError } = await supabase.from("couple_members").select("user_id").eq("couple_id", ownMembership.couple_id).is("left_at", null);
  if (memberError) throw memberError;
  const partnerId = members?.find(member => member.user_id !== userId)?.user_id;
  if (!partnerId) return null;
  const { data: partner, error: partnerError } = await supabase.from("profiles").select("*").eq("id", partnerId).single();
  if (partnerError) throw partnerError;
  return { id: ownMembership.couple_id, partner: partner as Profile };
}

export async function loadPendingRequests() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase.from("pairing_requests").select("id,from_user_id,from_user_email,created_at").eq("to_user_id", user.id).eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    fromUserId: row.from_user_id,
    fromUserEmail: row.from_user_email,
    timestamp: row.created_at,
  }));
}

export async function sendPairingRequest(email: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in first.");
  const { data: matches, error: findError } = await supabase.rpc("find_profile_by_email", { target_email: email.trim() });
  if (findError) throw findError;
  const recipient = matches?.[0];
  if (!recipient) throw new Error("No user found with this email.");
  const { error } = await supabase.from("pairing_requests").insert({
    from_user_id: user.id,
    from_user_email: user.email,
    to_user_id: recipient.id,
  });
  if (error?.code === "23505") throw new Error("Request already sent to this user.");
  if (error) throw error;
}

export async function acceptPairingRequest(requestId: string) {
  const { error } = await supabase.rpc("accept_pairing_request", {
    request_id: requestId,
  });
  if (error) throw error;
}

export async function rejectPairingRequest(requestId: string) {
  const { error } = await supabase.from("pairing_requests").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", requestId).eq("status", "pending");
  if (error) throw error;
}

export async function unpairUsers() {
  const { error } = await supabase.rpc("end_active_couple");
  if (error) throw error;
}

export async function uploadImage(uri: string, path: string, bucket = "private-media", onProgress?: (percent: number) => void) {
  let body: ArrayBuffer | ArrayBufferView;
  let contentType = "image/jpeg";

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Could not read the selected image (${response.status}).`);
    body = await response.arrayBuffer();
    contentType = response.headers.get("content-type") || contentType;
  } else {
    const filePath = uri.startsWith("file://") ? uri.slice(7) : uri;
    const base64 = await ReactNativeBlobUtil.fs.readFile(filePath, "base64");
    if (!base64) throw new Error("The selected image is empty. Please choose another image.");
    body = decode(base64);
  }

  const { data, error } = await supabase.storage.from(bucket).upload(path, body, {
    upsert: false,
    contentType,
  });
  if (error) throw error;
  onProgress?.(100);
  return data.path;
}

export async function getMediaUrl(path: string, expiresInSeconds = 60 * 60) {
  const { data, error } = await supabase.storage.from("private-media").createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export function getPublicMediaUrl(path: string) {
  return supabase.storage.from("public-content").getPublicUrl(path).data.publicUrl;
}

export async function listMessages(coupleId: string, before?: { created_at: string; id: string }, pageSize = 50) {
  let request = supabase.from("messages").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize);
  if (before) request = request.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  const { data, error } = await request;
  if (error) throw error;
  return (data || []).reverse();
}

export async function sendMessage(coupleId: string, senderId: string, body: string, replyToId?: string | null) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      couple_id: coupleId,
      sender_id: senderId,
      body: body.trim(),
      reply_to_id: replyToId || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function editMessage(messageId: string, body: string) {
  const { data, error } = await supabase.from("messages").update({ body: body.trim(), edited_at: new Date().toISOString() }).eq("id", messageId).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from("messages")
    .update({
      body: "This message was deleted",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", messageId);
  if (error) throw error;
}
