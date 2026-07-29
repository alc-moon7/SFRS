// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.headers || {})
    }
  });
}

async function verifyMasterPassword(password: string) {
  const response = await supabaseFetch("/rest/v1/rpc/verify_master_password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_password: password })
  });
  if (!response.ok) {
    throw new Error("Master password verification failed.");
  }
  return (await readJson(response)) === true;
}

async function emailForUsername(username: string) {
  const response = await supabaseFetch("/rest/v1/rpc/email_for_username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_username: username })
  });
  if (!response.ok) {
    return "";
  }
  return normalizeText(await readJson(response)).toLowerCase();
}

async function loadProfile(target: string) {
  let email = target.toLowerCase();
  if (!target.includes("@")) {
    email = await emailForUsername(target);
  }
  if (!email) {
    return null;
  }

  const query = new URLSearchParams({
    select: "id,role,email",
    email: `eq.${email}`
  });
  const response = await supabaseFetch(`/rest/v1/profiles?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Could not load target profile.");
  }
  const rows = await readJson(response);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createMagicLink(email: string, redirectTo: string) {
  const response = await supabaseFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "magiclink",
      email,
      redirect_to: redirectTo
    })
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = typeof data === "object" && data && "msg" in data
      ? String(data.msg)
      : "Could not create master login link.";
    throw new Error(message);
  }
  const actionLink = typeof data === "object" && data && "action_link" in data
    ? String(data.action_link || "")
    : "";
  if (!actionLink) {
    throw new Error("Magic link response did not include an action link.");
  }
  return actionLink;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const target = normalizeText(body.target);
  const password = normalizeText(body.password);
  const origin = req.headers.get("origin") || normalizeText(body.origin);
  const redirectBase = normalizeText(body.redirect_base) || `${origin}/`;

  if (!target || !password) {
    return jsonResponse(400, { error: "Target and master password are required." });
  }
  if (!origin) {
    return jsonResponse(400, { error: "Request origin is required." });
  }

  try {
    const valid = await verifyMasterPassword(password);
    if (!valid) {
      return jsonResponse(401, { error: "Invalid master password." });
    }

    const profile = await loadProfile(target);
    if (!profile) {
      return jsonResponse(404, { error: `User not found: ${target}` });
    }
    if (profile.role === "admin") {
      return jsonResponse(403, { error: "Admin accounts cannot be accessed." });
    }
    if (profile.role !== "student" && profile.role !== "teacher") {
      return jsonResponse(403, { error: "Only student or teacher accounts can be accessed." });
    }

    const dashboard = profile.role === "teacher" ? "teacher-dashboard.html" : "student-dashboard.html";
    const baseUrl = new URL(redirectBase, origin);
    if (baseUrl.origin !== origin) {
      return jsonResponse(400, { error: "Redirect origin is not allowed." });
    }
    const actionLink = await createMagicLink(profile.email, new URL(dashboard, baseUrl.href).toString());
    return jsonResponse(200, { action_link: actionLink });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Master login failed."
    });
  }
});
