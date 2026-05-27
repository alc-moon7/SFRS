import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

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

  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  if (!groqKey) {
    return jsonResponse(500, { error: "GROQ_API_KEY is not set." });
  }

  const groqModel = DEFAULT_GROQ_MODEL;
  const timeoutMs = Number(Deno.env.get("GROQ_TIMEOUT_MS") || 15000);
  const type = body.type;

  let temperature = 0.3;
  let maxTokens = 350;
  let messages: ChatMessage[] = [];

  if (type === "summary") {
    const payload = (body.payload || {}) as Record<string, unknown>;
    const userPrompt =
      "Summarize the following anonymized feedback statistics for a teacher. " +
      "Return plain text with these sections: Overview, Strengths, Improvement Areas, Next Steps. " +
      "Use short bullet points under each section and keep it under 120 words. " +
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
    const message = String(body.message || "").trim();
    if (!message) {
      return jsonResponse(400, { error: "Message is required." });
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const safeHistory = history
      .filter((item) => item && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({
        role: item.role,
        content: String(item.content || "")
      }))
      .slice(-8);

    temperature = 0.5;
    maxTokens = 400;
    const context = String(body.context || "").trim().slice(0, 1000);
    const contextText = context ? ` Current page context: ${context}` : "";

    messages = [
      {
        role: "system",
        content:
          "You are the SFRS support assistant for students, teachers, and admins. " +
          "Help with portal navigation, feedback submission, teacher dashboards, " +
          "admin workflow, and general guidance. If asked for grades, personal data, " +
          "or anything outside the portal, say you cannot access it and suggest " +
          "contacting the department. Reply in Bengali when the user writes Bengali; " +
          "otherwise match the user's language. Keep replies concise." +
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

  let groqResponse: Response;
  try {
    groqResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: groqModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeoutId);
    return jsonResponse(500, {
      error: "Groq request failed.",
      details: error instanceof Error ? error.message : "Unknown error."
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    return jsonResponse(groqResponse.status, {
      error: "Groq request failed.",
      details: errorText.slice(0, 300)
    });
  }

  const data = await groqResponse.json();
  const result = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!result) {
    return jsonResponse(500, { error: "No response from AI." });
  }

  return jsonResponse(200, { result });
});
