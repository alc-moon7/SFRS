// SFRS AI Chat Widget — floating bot that works on every page
// Calls the ai-assistant Supabase Edge Function

(function () {
  // ── Config ──
  const SUPABASE_URL = "https://mstotzwqfbcvpcdgrnxy.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdG90endxZmJjdnBjZGdybnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODEzNTAsImV4cCI6MjA4MjA1NzM1MH0.JbIf3inEy0Ks5JPVGQfFycBXenIGDGtqUBjYB1JeAcw";
  const AUTH_TOKEN = SUPABASE_KEY;

  // ── State ──
  let isOpen = false;
  let messages = [];
  let chatHistory = []; // last 4 exchanges for context

  // ── CSS injected once ──
  if (!document.getElementById("ai-widget-css")) {
    const style = document.createElement("style");
    style.id = "ai-widget-css";
    style.textContent = `
      .ai-widget-fab {
        position: fixed; bottom: 28px; right: 28px; z-index: 9999;
        width: 56px; height: 56px; border-radius: 50%; background: #c9462c;
        color: #fff; border: none; cursor: pointer; font-size: 24px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 28px rgba(201,70,44,0.35); transition: all .2s;
      }
      .ai-widget-fab:hover { transform: scale(1.08); }
      .ai-widget-panel {
        position: fixed; bottom: 100px; right: 28px; z-index: 9998;
        width: 360px; max-width: 92vw; height: 480px; max-height: 70vh;
        background: #fff; border: 1px solid #e5dece; border-radius: 20px;
        box-shadow: 0 20px 60px rgba(12,42,66,0.18); display: none;
        flex-direction: column; overflow: hidden;
      }
      .ai-widget-panel.open { display: flex; }
      .ai-widget-header {
        background: #0c2a42; color: #fff; padding: 14px 18px;
        font-weight: 700; display: flex; justify-content: space-between;
        align-items: center; font-size: 15px;
      }
      .ai-widget-close { background: none; border: none; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; }
      .ai-widget-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .ai-widget-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }
      .ai-widget-msg.user { align-self: flex-end; background: #faf5ed; color: #16232c; border: 1px solid #e5dece; }
      .ai-widget-msg.bot { align-self: flex-start; background: #f0f4f8; color: #16232c; }
      .ai-widget-typing { align-self: flex-start; color: #a89b86; font-size: 12px; padding: 4px 8px; display: none; }
      .ai-widget-input-row { display: flex; border-top: 1px solid #e5dece; padding: 10px; gap: 8px; }
      .ai-widget-input { flex: 1; border: 1px solid #e5dece; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-family: inherit; outline: none; }
      .ai-widget-input:focus { border-color: #c9462c; }
      .ai-widget-send { background: #c9462c; color: #fff; border: none; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .ai-widget-send:disabled { opacity: .5; cursor: default; }
      @media (max-width: 480px) { .ai-widget-panel { width: 100%; right: 0; bottom: 80px; border-radius: 20px 20px 0 0; } }
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ──
  const fab = document.createElement("button");
  fab.className = "ai-widget-fab";
  fab.innerHTML = "&#x1F4AC;";
  fab.title = "SFRS AI Assistant";
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.className = "ai-widget-panel";
  panel.innerHTML = `
    <div class="ai-widget-header">
      <span>SFRS AI Assistant</span>
      <button class="ai-widget-close" id="aiWidgetClose">&times;</button>
    </div>
    <div class="ai-widget-body" id="aiWidgetBody">
      <div class="ai-widget-msg bot">👋 Hello! I'm the SFRS assistant. Ask me about feedback, ratings, courses, or teacher profiles.</div>
    </div>
    <div class="ai-widget-typing" id="aiWidgetTyping">Assistant is typing…</div>
    <div class="ai-widget-input-row">
      <input class="ai-widget-input" id="aiWidgetInput" placeholder="Type your question…" maxlength="400">
      <button class="ai-widget-send" id="aiWidgetSend">Send</button>
    </div>
  `;
  document.body.appendChild(panel);

  // ── Events ──
  const body = document.getElementById("aiWidgetBody");
  const input = document.getElementById("aiWidgetInput");
  const sendBtn = document.getElementById("aiWidgetSend");
  const closeBtn = document.getElementById("aiWidgetClose");
  const typing = document.getElementById("aiWidgetTyping");

  function addMsg(text, role) {
    const div = document.createElement("div");
    div.className = `ai-widget-msg ${role}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    if (role === "user" || role === "bot") {
      chatHistory.push({ role, content: text });
      if (chatHistory.length > 8) chatHistory.splice(0, 2);
    }
  }

  async function askAI(question) {
    const userMsg = question.trim();
    if (!userMsg) return;
    addMsg(userMsg, "user");
    input.value = "";
    typing.style.display = "block";
    sendBtn.disabled = true;

    try {
      const payload = { type: "chat", message: userMsg, history: chatHistory.slice(-6), context: window.location.pathname };
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("Service unavailable");
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      addMsg(data.result || "I couldn't generate a response. Please try again.", "bot");
    } catch (e) {
      addMsg("⚠️ AI assistant is currently unavailable. Please try again later.", "bot");
    }
    typing.style.display = "none";
    sendBtn.disabled = false;
  }

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    fab.style.display = isOpen ? "none" : "flex";
    if (isOpen) setTimeout(() => input.focus(), 200);
  }

  fab.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", togglePanel);
  sendBtn.addEventListener("click", () => askAI(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") askAI(input.value);
  });

  // ── Summary-only function (for teacher admin dashboard) ──
  window.SFRS_AI = {
    getSummary: async function (feedbackData) {
      const payload = { type: "summary", payload: feedbackData };
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("Summary generation failed");
      const data = await resp.json();
      return data.result || "No summary generated.";
    },
  };
})();