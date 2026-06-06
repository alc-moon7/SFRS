import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";
const SFRS_KNOWLEDGE =
  "SFRS routes: / and /feedback open the Student Feedback Review System; /vu opens the VU mirror. " +
  "Student: student-login, student-signup, student-dashboard. Students see only semester/section assigned teachers, search/filter courses, submit one feedback per active assignment, rate teaching quality, communication, organization, supportiveness, punctuality, overall satisfaction, add optional comment, and may submit anonymously when allowed. " +
  "Teacher: teacher-login, teacher-signup, teacher-dashboard, teacher-profile. Teachers see assigned courses, category averages, anonymized comments, and AI summaries. " +
  "Admin: admin-login and admin-dashboard manage teacher profiles, assignments, review window/settings, feedback moderation, analytics, and export. " +
  "Password reset page exists. No grades, private student identities, or external university records are available.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY")?.trim();
  if (!deepseekKey) {
    return jsonResponse(500, { error: "DEEPSEEK_API_KEY is not set." });
  }

  const timeoutMs = Number(Deno.env.get("DEEPSEEK_TIMEOUT_MS") || 15000);
  const type = body.type;

  let temperature = 0.3;
  let maxTokens = 350;
  let messages: ChatMessage[] = [];

  if (type === "summary") {
    maxTokens = 220;
    const payload = (body.payload || {}) as Record<string, unknown>;
    const userPrompt =
      "Summarize the following anonymized feedback statistics for a teacher. " +
      "Return plain text with: Overview, Strengths, Improvement Areas, Next Steps. " +
      "Use short bullets and keep it under 90 words. " +
      "Do not mention student identities or speculate about individuals. Data: " +
      JSON.stringify(payload);

    messages = [
      {
        role: "system",
        content: "You are an academic quality assistant. Respond in English."
      },
      { role: "user", content: userPrompt }
    ];
  } else if (type === "chat") {
    const message = String(body.message || "").trim().slice(0, 700);
    if (!message) {
      return jsonResponse(400, { error: "Message is required." });
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const safeHistory = history
      .filter((item) => item && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({
        role: item.role,
        content: String(item.content || "").slice(0, 500)
      }))
      .slice(-4);

    temperature = 0.35;
    maxTokens = 320;
    const context = String(body.context || "").trim().slice(0, 350);
    const contextText = context ? ` Current page context: ${context}` : "";

    messages = [
      {
        role: "system",
        content:
          "You are the SFRS website assistant. Use this compact site knowledge: " +
          SFRS_KNOWLEDGE +
          " Answer accurately from this knowledge and current page context. " +
          "Keep answers concise and complete: usually 3-4 short bullets, each under 18 words. " +
          "Avoid long intros, tables, and extra explanations unless needed. " +
          "Reply in Bengali when the user writes Bengali; otherwise match the user's language. " +
          "If asked for unavailable personal data, grades, or records, say you cannot access it and suggest contacting the department." +
          contextText
      },
      ...safeHistory,
      { role: "user", content: message }
    ];
  } else {
    return jsonResponse(400, { error: "Invalid request type." });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let deepseekResponse: Response;
  try {
    deepseekResponse = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        thinking: { type: "disabled" },
        stream: false
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeoutId);
    return jsonResponse(500, {
      error: "DeepSeek request failed.",
      details: error instanceof Error ? error.message : "Unknown error."
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!deepseekResponse.ok) {
    const errorText = await deepseekResponse.text();
    return jsonResponse(deepseekResponse.status, {
      error: "DeepSeek request failed.",
      details: errorText.slice(0, 300)
    });
  }

  const data = await deepseekResponse.json();
  const result = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!result) {
    return jsonResponse(500, { error: "No response from AI." });
  }

  return jsonResponse(200, { result });
});
