import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    return jsonResponse(500, { error: "OPENAI_API_KEY is not set." });
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const type = body.type;

  let temperature = 0.3;
  let maxTokens = 350;
  let messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (type === "summary") {
    const payload = (body.payload || {}) as Record<string, unknown>;
    const userPrompt =
      "Summarize the following anonymized feedback statistics for a teacher. " +
      "Provide: (1) overall summary, (2) strengths, (3) improvement opportunities, " +
      "and (4) 2-3 actionable next steps. Use short bullet points. Keep it under 120 words. " +
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

    messages = [
      {
        role: "system",
        content:
          "You are the SFRS student support assistant. Help with portal usage, " +
          "feedback submission steps, and general guidance. If asked for grades, " +
          "personal data, or anything outside the portal, say you cannot access it " +
          "and suggest contacting the department. Reply in Bengali and keep it concise."
      },
      ...safeHistory,
      { role: "user", content: message }
    ];
  } else {
    return jsonResponse(400, { error: "Invalid request type." });
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    return jsonResponse(openaiResponse.status, {
      error: "OpenAI request failed.",
      details: errorText.slice(0, 300)
    });
  }

  const data = await openaiResponse.json();
  const result = data?.choices?.[0]?.message?.content?.trim();
  if (!result) {
    return jsonResponse(500, { error: "No response from AI." });
  }

  return jsonResponse(200, { result });
});
