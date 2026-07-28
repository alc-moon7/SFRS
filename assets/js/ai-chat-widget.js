// SFRS AI Chat Widget — role-aware floating bot
// Students/Teachers get limited responses; Admins get full analytics

(function () {
  const SUPABASE_URL = "https://mstotzwqfbcvpcdgrnxy.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdG90endxZmJjdnBjZGdybnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODEzNTAsImV4cCI6MjA4MjA1NzM1MH0.JbIf3inEy0Ks5JPVGQfFycBXenIGDGtqUBjYB1JeAcw";

  let isOpen = false, chatHistory = [];
  let userRole = "guest";  // guest/student/teacher/admin

  // ── CSS ──
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
      .ai-widget-fab.admin { background: linear-gradient(135deg,#0c2a42,#163a56); }
      .ai-widget-fab.teacher { background: linear-gradient(135deg,#0f8b5f,#059669); }
      .ai-widget-fab:hover { transform: scale(1.08); }
      .ai-widget-panel {
        position: fixed; bottom: 100px; right: 28px; z-index: 9998;
        width: 380px; max-width: 92vw; height: 500px; max-height: 70vh;
        background: #fff; border: 1px solid #e5dece; border-radius: 20px;
        box-shadow: 0 20px 60px rgba(12,42,66,0.18); display: none;
        flex-direction: column; overflow: hidden;
      }
      .ai-widget-panel.open { display: flex; }
      .ai-widget-header {
        background: #0c2a42; color: #fff; padding: 12px 16px;
        font-weight: 700; display: flex; justify-content: space-between;
        align-items: center; font-size: 14px;
      }
      .ai-widget-header.admin { background: #163a56; }
      .ai-widget-header.teacher { background: #0f8b5f; }
      .ai-widget-role-badge {
        font-size: 10px; background: rgba(255,255,255,0.2); padding: 2px 8px;
        border-radius: 100px; text-transform: uppercase; letter-spacing: .5px;
      }
      .ai-widget-close { background: none; border: none; color: #fff; font-size: 22px; cursor: pointer; line-height: 1; }
      .ai-widget-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .ai-widget-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }
      .ai-widget-msg.user { align-self: flex-end; background: #faf5ed; color: #16232c; border: 1px solid #e5dece; }
      .ai-widget-msg.bot { align-self: flex-start; background: #f0f4f8; color: #16232c; }
      .ai-widget-msg.system { align-self: center; background: #fef2f2; color: #b91c1c; font-size: 11px; padding: 6px 10px; }
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
    <div class="ai-widget-header" id="aiWidgetHeader">
      <span>SFRS AI Assistant</span>
      <span class="ai-widget-role-badge" id="aiWidgetRoleBadge">guest</span>
      <button class="ai-widget-close" id="aiWidgetClose">&times;</button>
    </div>
    <div class="ai-widget-body" id="aiWidgetBody">
      <div class="ai-widget-msg bot">👋 Hello! I'm SFRS assistant. Ask me anything about feedback, courses, or the platform.</div>
    </div>
    <div class="ai-widget-typing" id="aiWidgetTyping">Assistant is typing…</div>
    <div class="ai-widget-input-row">
      <input class="ai-widget-input" id="aiWidgetInput" placeholder="Type your question…" maxlength="400">
      <button class="ai-widget-send" id="aiWidgetSend">Send</button>
    </div>
  `;
  document.body.appendChild(panel);

  const body = document.getElementById("aiWidgetBody");
  const input = document.getElementById("aiWidgetInput");
  const sendBtn = document.getElementById("aiWidgetSend");
  const closeBtn = document.getElementById("aiWidgetClose");
  const typing = document.getElementById("aiWidgetTyping");
  const header = document.getElementById("aiWidgetHeader");
  const roleBadge = document.getElementById("aiWidgetRoleBadge");

  function addMsg(text, role) {
    const div = document.createElement("div");
    div.className = `ai-widget-msg ${role}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    if (role === "user" || role === "bot") {
      chatHistory.push({ role: role === "user" ? "user" : "assistant", content: text });
      if (chatHistory.length > 8) chatHistory.splice(0, 2);
    }
  }

  // ── Role detection ──
  (async function detectRole() {
    try {
      const sup = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY) ||
        (await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2")).createClient(SUPABASE_URL, SUPABASE_KEY);
      const { data } = await sup.auth.getSession();
      if (data?.session) {
        const { data: profile } = await sup.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
        if (profile?.role) {
          userRole = profile.role;
          roleBadge.textContent = profile.role;
          switch (profile.role) {
            case "admin":
              fab.classList.add("admin");
              header.classList.add("admin");
              input.placeholder = "Ask about any teacher, rating, or analytics…";
              break;
            case "teacher":
              fab.classList.add("teacher");
              header.classList.add("teacher");
              input.placeholder = "Ask about your feedback, ratings, comments…";
              break;
            default:
              input.placeholder = "Ask about your courses, teachers, or feedback…";
          }
        }
      }
      if (!userRole || userRole === "guest") {
        roleBadge.textContent = "guest";
        input.placeholder = "Sign in to see your feedback…";
      }
    } catch (e) { /* guest mode */ }
  })();

  // ── Role-filtered system prompt ──
  function getSystemNote() {
    if (userRole === "admin") return "";
    return userRole === "teacher"
      ? "You are talking to a teacher. Only show their own feedback data."
      : "You are talking to a student. Do NOT share other students' data or admin analytics.";
  }

  async function askAI(question) {
    const userMsg = question.trim();
    if (!userMsg) return;
    addMsg(userMsg, "user");
    input.value = "";
    typing.style.display = "block";
    sendBtn.disabled = true;

    // Admin-only topics guard
    const adminTopics = /rating|score|analytics|summary|breakdown|average|performance|department|all teacher/i;
    if (userRole !== "admin" && userRole !== "teacher" && adminTopics.test(userMsg)) {
      addMsg("I can only show your own course feedback. For detailed analytics, please contact your teacher or administrator.", "system");
      typing.style.display = "none";
      sendBtn.disabled = false;
      return;
    }

    try {
      const systemNote = getSystemNote();
      const payload = {
        type: "chat",
        message: userMsg,
        history: chatHistory.slice(-6),
        context: window.location.pathname,
        role: userRole,
      };
      const headers = {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      };
      // Always send the anon key as Authorization header
      headers["Authorization"] = `Bearer ${SUPABASE_KEY}`;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("Service unavailable");
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      addMsg(data.result || "I couldn't generate a response.", "bot");
    } catch (e) {
      addMsg("⚠️ AI assistant is currently unavailable. Please try again later.", "system");
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

  // Summary function for teacher dashboard
  window.SFRS_AI = {
    getSummary: async function (feedbackData) {
      const payload = { type: "summary", payload: feedbackData };
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("Summary generation failed");
      const data = await resp.json();
      return data.result || "No summary generated.";
    },
  };
})();