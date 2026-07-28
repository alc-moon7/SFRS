// SFRS AI Chat Widget — simple, reliable, role-aware
(function () {
  const SUPABASE_URL = "https://mstotzwqfbcvpcdgrnxy.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdG90endxZmJjdnBjZGdybnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODEzNTAsImV4cCI6MjA4MjA1NzM1MH0.JbIf3inEy0Ks5JPVGQfFycBXenIGDGtqUBjYB1JeAcw";
  const EDGE = `${SUPABASE_URL}/functions/v1/ai-assistant`;

  let isOpen = false, history = [], role = "guest";
  let sup = null;

  // ── Detect Supabase client from page ──
  try {
    if (window.supabase?.createClient) sup = window.supabase.createClient(SUPABASE_URL, KEY);
  } catch (e) {}

  // ── CSS ──
  if (!document.getElementById("ai-widget-css")) {
    const s = document.createElement("style");
    s.id = "ai-widget-css";
    s.textContent = `
      .aiw-fab{position:fixed;bottom:28px;right:28px;z-index:9999;width:56px;height:56px;border-radius:50%;background:#c9462c;color:#fff;border:none;cursor:pointer;font-size:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(201,70,44,.35);transition:.2s}
      .aiw-fab.adm{background:linear-gradient(135deg,#0c2a42,#163a56)}
      .aiw-fab.tch{background:linear-gradient(135deg,#0f8b5f,#059669)}
      .aiw-fab:hover{transform:scale(1.08)}
      .aiw-pnl{position:fixed;bottom:100px;right:28px;z-index:9998;width:380px;max-width:92vw;height:500px;max-height:70vh;background:#fff;border:1px solid #e5dece;border-radius:20px;box-shadow:0 20px 60px rgba(12,42,66,.18);display:none;flex-direction:column;overflow:hidden}
      .aiw-pnl.on{display:flex}
      .aiw-hd{background:#0c2a42;color:#fff;padding:10px 14px;font-weight:700;display:flex;justify-content:space-between;align-items:center;font-size:13px}
      .aiw-hd.adm{background:#163a56}.aiw-hd.tch{background:#0f8b5f}
      .aiw-badge{font-size:9px;background:rgba(255,255,255,.2);padding:1px 7px;border-radius:100px;text-transform:uppercase}
      .aiw-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}
      .aiw-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
      .aiw-msg{max-width:85%;padding:9px 12px;border-radius:12px;font-size:12.5px;line-height:1.5;word-wrap:break-word}
      .aiw-msg.u{align-self:flex-end;background:#faf5ed;color:#16232c;border:1px solid #e5dece}
      .aiw-msg.b{align-self:flex-start;background:#f0f4f8;color:#16232c}
      .aiw-msg.s{align-self:center;background:#fef2f2;color:#b91c1c;font-size:11px;padding:5px 9px}
      .aiw-type{align-self:flex-start;color:#a89b86;font-size:11px;padding:3px 6px;display:none}
      .aiw-input-row{display:flex;border-top:1px solid #e5dece;padding:8px;gap:6px}
      .aiw-input{flex:1;border:1px solid #e5dece;border-radius:8px;padding:9px 10px;font-size:13px;font-family:inherit;outline:none}
      .aiw-input:focus{border-color:#c9462c}
      .aiw-send{background:#c9462c;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer}
      .aiw-send:disabled{opacity:.5;cursor:default}
      @media(max-width:480px){.aiw-pnl{width:100%;right:0;bottom:80px;border-radius:20px 20px 0 0}}
    `;
    document.head.appendChild(s);
  }

  // ── DOM ──
  const fab = document.createElement("button");
  fab.className = "aiw-fab";
  fab.innerHTML = "&#x1F4AC;";
  fab.title = "SFRS AI Assistant";
  document.body.appendChild(fab);

  const pnl = document.createElement("div");
  pnl.className = "aiw-pnl";
  pnl.innerHTML = `
    <div class="aiw-hd" id="aiwh"><span>SFRS AI Assistant</span><span class="aiw-badge" id="aiwbadge">guest</span><button class="aiw-close" id="aiwcl">&times;</button></div>
    <div class="aiw-body" id="aiwb"><div class="aiw-msg b">👋 Hello! Ask me about SFRS, courses, or feedback.</div></div>
    <div class="aiw-type" id="aiwt">Typing…</div>
    <div class="aiw-input-row"><input class="aiw-input" id="aiwin" placeholder="Type your question…" maxlength="400"><button class="aiw-send" id="aiws">Send</button></div>
  `;
  document.body.appendChild(pnl);

  const body = document.getElementById("aiwb");
  const input = document.getElementById("aiwin");
  const sendBtn = document.getElementById("aiws");
  const typing = document.getElementById("aiwt");

  function add(msg, cls) {
    const d = document.createElement("div");
    d.className = `aiw-msg ${cls}`;
    d.textContent = msg;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    if (cls === "u" || cls === "b") {
      history.push({ role: cls === "u" ? "user" : "assistant", content: msg });
      if (history.length > 8) history.splice(0, 2);
    }
  }

  // ── Role detect ──
  (async () => {
    if (!sup) return;
    try {
      const { data } = await sup.auth.getSession();
      if (data?.session) {
        const { data: p } = await sup.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
        if (p?.role) {
          role = p.role;
          document.getElementById("aiwbadge").textContent = p.role;
          if (p.role === "admin") { fab.classList.add("adm"); document.getElementById("aiwh").classList.add("adm"); }
          if (p.role === "teacher") { fab.classList.add("tch"); document.getElementById("aiwh").classList.add("tch"); }
        }
      }
    } catch (e) {}
  })();

  // ── Send message ──
  async function send() {
    const msg = input.value.trim();
    if (!msg) return;
    add(msg, "u");
    input.value = "";
    typing.style.display = "block";
    sendBtn.disabled = true;

    // Guard: students can only ask about their own courses/feedback
    if (role === "student") {
      const blocked = /rating|score|analytics|summary|summery|breakdown|average|performance|teacher|sir\b|mam\b|maam\b|madam\b|prof/i;
      if (blocked.test(msg)) {
        add("🔒 I can only help with your own course feedback and general SFRS guidance. Teacher analytics are not available to students.", "s");
        typing.style.display = "none";
        sendBtn.disabled = false;
        return;
      }
    }

    try {
      // Use actual user session token so edge function knows the role
      let authToken = KEY;
      if (sup) {
        try {
          const { data: { session } } = await sup.auth.getSession();
          if (session?.access_token) authToken = session.access_token;
        } catch (e) {}
      }
      const hdrs = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${authToken}` };
      const resp = await fetch(EDGE, { method: "POST", headers: hdrs, body: JSON.stringify({ type: "chat", message: msg, history: history.slice(-6), context: location.pathname }) });
      if (!resp.ok) throw new Error("Status " + resp.status);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      add(data.result || "No response.", "b");
    } catch (e) {
      add("⚠️ AI assistant unavailable. Error: " + (e.message || "network"), "s");
    }
    typing.style.display = "none";
    sendBtn.disabled = false;
  }

  fab.addEventListener("click", () => { isOpen = !isOpen; pnl.classList.toggle("on", isOpen); fab.style.display = isOpen ? "none" : "flex"; if (isOpen) setTimeout(() => input.focus(), 200); });
  document.getElementById("aiwcl").addEventListener("click", () => { isOpen = false; pnl.classList.remove("on"); fab.style.display = "flex"; });
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });

  // Summary API for teacher dashboard
  window.SFRS_AI = {
    getSummary: async function (fd) {
      const r = await fetch(EDGE, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ type: "summary", payload: fd }) });
      const d = await r.json();
      return d.result || "No summary generated.";
    },
  };
})();