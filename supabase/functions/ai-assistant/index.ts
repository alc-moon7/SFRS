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

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return jsonResponse(500, { error: "GEMINI_API_KEY is not set." });
  }

  const baseUrl =
    (Deno.env.get("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta")
      .replace(/\/+$/, "");
  const defaultModel = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";
  const summaryModel = Deno.env.get("GEMINI_SUMMARY_MODEL") || defaultModel;
  const chatModel = Deno.env.get("GEMINI_CHAT_MODEL") || defaultModel;
  const timeoutMs = Number(Deno.env.get("GEMINI_TIMEOUT_MS") || 15000);
  const type = body.type;

  let temperature = 0.3;
  let maxTokens = 350;
  let messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  let model = defaultModel;

  if (type === "summary") {
    model = summaryModel;
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

    model = chatModel;
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const systemMessage = messages.find((item) => item.role === "system");
  const contents = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    }));
  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens
    }
  };
  if (systemMessage?.content) {
    requestBody.systemInstruction = {
      role: "system",
      parts: [{ text: systemMessage.content }]
    };
  }

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...requestBody
      }),
      signal: controller.signal
    }
    );
  } catch (error) {
    clearTimeout(timeoutId);
    return jsonResponse(500, {
      error: "Gemini request failed.",
      details: error instanceof Error ? error.message : "Unknown error."
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    return jsonResponse(geminiResponse.status, {
      error: "Gemini request failed.",
      details: errorText.slice(0, 300)
    });
  }

  const data = await geminiResponse.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const result = parts
    .map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();
  if (!result) {
    return jsonResponse(500, { error: "No response from AI." });
  }

  return jsonResponse(200, { result });
});
