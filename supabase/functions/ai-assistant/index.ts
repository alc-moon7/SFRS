// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProfileRecord = {
  role?: string | null;
  semester?: string | null;
  section?: string | null;
  program?: string | null;
  department?: string | null;
  designation?: string | null;
  teacher_directory_id?: number | null;
};

type TeacherRecord = {
  id: number;
  name: string;
  designation?: string | null;
  short_code?: string | null;
  department?: string | null;
  status?: string | null;
  is_email_public?: boolean | null;
};

type SupabaseContextClient = {
  auth: {
    getUser: () => Promise<{ data?: { user?: { id: string } | null } }>;
  };
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

const DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";
const REVIEW_CATEGORIES = [
  ["teaching_quality", "Teaching Quality"],
  ["communication", "Communication"],
  ["course_organization", "Course Organization"],
  ["supportiveness", "Helpfulness / Supportiveness"],
  ["punctuality", "Punctuality / Regularity"],
  ["overall_satisfaction", "Overall Satisfaction"]
];
const SFRS_KNOWLEDGE =
  "SFRS routes: / and /feedback open the Student Feedback Review System; /vu opens the VU mirror. " +
  "Student: student-login, student-signup, student-dashboard. Students see only semester/section assigned teachers, search/filter courses, submit one feedback per active assignment, rate teaching quality, communication, organization, supportiveness, punctuality, overall satisfaction, add optional comment, and may submit anonymously when allowed. " +
  "Teacher: teacher-login, teacher-signup, teacher-dashboard, teacher-profile. Teachers see assigned courses, category averages, anonymized comments, and AI summaries. " +
  "Admin: admin-login and admin-dashboard manage teacher profiles, assignments, review window/settings, feedback moderation, analytics, and export. " +
  "Password reset page exists. No grades, private student identities, raw passwords, OTPs, session tokens, or external university records are available.";

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

function normalizeLookup(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function compactText(value: unknown, limit = 240) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function formatValue(value: unknown, fallback = "unknown") {
  const text = compactText(value, 90);
  return text || fallback;
}

function createSupabaseContextClient(req: Request): SupabaseContextClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const authorization = req.headers.get("Authorization") || "";
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {}
    }
  }) as unknown as SupabaseContextClient;
}

function createSupabaseDataClient(): SupabaseContextClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }) as unknown as SupabaseContextClient;
}

async function loadViewerProfile(supabase: SupabaseContextClient | null) {
  if (!supabase) {
    return { profile: null, text: "Database context is unavailable." };
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return {
      profile: null,
      text: "Viewer is not signed in. Personal dashboard actions require login, but aggregate teacher ratings from server-side context are allowed when provided."
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role, semester, section, program, department, designation, teacher_directory_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      profile: null,
      text: "Viewer is signed in, but profile details could not be loaded."
    };
  }

  const profile = data as ProfileRecord;
  const details = [
    `role=${formatValue(profile.role)}`,
    profile.semester ? `semester=${formatValue(profile.semester)}` : "",
    profile.section ? `section=${formatValue(profile.section)}` : "",
    profile.program ? `program=${formatValue(profile.program)}` : "",
    profile.designation ? `designation=${formatValue(profile.designation)}` : "",
    profile.teacher_directory_id ? `linked_teacher_id=${profile.teacher_directory_id}` : ""
  ].filter(Boolean);

  return {
    profile,
    text: `Signed-in viewer context: ${details.join("; ")}.`
  };
}

async function countTableRows(
  supabase: SupabaseContextClient,
  table: string,
  label: string
) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error || typeof count !== "number") {
    return "";
  }
  return `${label}=${count}`;
}

async function loadSiteSnapshot(supabase: SupabaseContextClient | null) {
  if (!supabase) {
    return "";
  }

  const [teacherCount, assignmentCount, feedbackCount, settingsResult] = await Promise.all([
    countTableRows(supabase, "teachers_directory", "visible_teachers"),
    countTableRows(supabase, "teacher_assignments", "visible_assignments"),
    countTableRows(supabase, "feedbacks", "visible_feedbacks"),
    supabase
      .from("feedback_settings")
      .select("review_window_open, allow_anonymous_feedback, active_term")
      .eq("id", 1)
      .maybeSingle()
  ]);

  const settings = settingsResult.error || !settingsResult.data
    ? ""
    : `settings: term=${formatValue(settingsResult.data.active_term)}; review_window=${settingsResult.data.review_window_open ? "open" : "closed"}; anonymous_feedback=${settingsResult.data.allow_anonymous_feedback ? "allowed" : "disabled"}`;

  const counts = [teacherCount, assignmentCount, feedbackCount].filter(Boolean).join("; ");
  return [counts ? `Live visible data counts: ${counts}.` : "", settings].filter(Boolean).join("\n");
}

function scoreTeacherMatch(message: string, teacher: TeacherRecord) {
  const text = normalizeLookup(message);
  const fullName = normalizeLookup(teacher.name);
  const shortCode = normalizeLookup(teacher.short_code);

  if (fullName && text.includes(fullName)) {
    return 1000 + fullName.length;
  }
  if (shortCode && text.includes(shortCode)) {
    return 900 + shortCode.length;
  }

  const stopWords = new Set([
    "sir",
    "mam",
    "maam",
    "madam",
    "teacher",
    "rating",
    "review",
    "reviews",
    "score",
    "profile",
    "dr",
    "md",
    "mst",
    "most",
    "mr",
    "mrs",
    "ms",
    "prof",
    "phd",
    "ph",
    "d"
  ]);
  const nameTokens = String(teacher.name || "")
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeLookup)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  const queryTokens = String(message || "")
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeLookup)
    .filter((token) => token.length >= 3 && !stopWords.has(token));

  let score = 0;
  let strongMatch = false;

  for (const token of nameTokens) {
    if (text.includes(token)) {
      score += token.length >= 5 ? 30 : 16;
      strongMatch = strongMatch || token.length >= 4;
    }
  }

  for (const token of queryTokens) {
    if (fullName.includes(token)) {
      score += token.length >= 5 ? 22 : 10;
      strongMatch = strongMatch || token.length >= 4;
    }
  }

  return strongMatch && score >= 20 ? score : 0;
}

function summarizeTeacherCandidate(teacher: TeacherRecord) {
  return [
    teacher.name,
    teacher.designation ? `designation=${teacher.designation}` : "",
    teacher.short_code ? `code=${teacher.short_code}` : "",
    teacher.department ? `department=${teacher.department}` : "",
    teacher.status ? `status=${teacher.status}` : ""
  ].filter(Boolean).join("; ");
}

function summarizeTeacherProfile(payload: Record<string, unknown>) {
  const teacher = (payload.teacher || {}) as Record<string, unknown>;
  const stats = (payload.stats || {}) as Record<string, unknown>;
  const assignments = Array.isArray(payload.assignments) ? payload.assignments : [];
  const comments = Array.isArray(payload.recent_comments) ? payload.recent_comments : [];
  const breakdown = (stats.category_breakdown || {}) as Record<string, unknown>;

  const categoryText = REVIEW_CATEGORIES
    .map(([key, label]) => `${label}: ${Number(breakdown[key] || 0).toFixed(2)}/5`)
    .join("; ");

  const assignmentText = assignments.slice(0, 10).map((item) => {
    const record = item as Record<string, unknown>;
    const semester = [record.semester, record.section].filter(Boolean).join(" ");
    return `${formatValue(record.course_code)} ${formatValue(record.course_title)} (${formatValue(semester)})`;
  }).join(" | ");

  const commentText = comments.slice(0, 4).map((item) => {
    const record = item as Record<string, unknown>;
    return `${formatValue(record.course_code)}: "${compactText(record.comment, 140)}"`;
  }).join(" | ");

  return [
    `Matched teacher profile: name=${formatValue(teacher.name)}; designation=${formatValue(teacher.designation, "not listed")}; department=${formatValue(teacher.department, "not listed")}; status=${formatValue(teacher.status, "not listed")}.`,
    teacher.email ? `Visible official email: ${formatValue(teacher.email)}.` : "",
    `Ratings: average=${Number(stats.average_rating || 0).toFixed(2)}/5; total_reviews=${Number(stats.total_reviews || 0)}; ${categoryText}.`,
    assignmentText ? `Assignments: ${assignmentText}.` : "Assignments: none visible for this viewer.",
    commentText ? `Recent anonymized comments: ${commentText}.` : "Recent anonymized comments: none visible."
  ].filter(Boolean).join("\n");
}

function averageResponseValue(responses: Record<string, unknown>) {
  const values = REVIEW_CATEGORIES
    .map(([key]) => Number(responses?.[key]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildTeacherStats(feedbacks: Record<string, unknown>[]) {
  const visibleFeedbacks = feedbacks.filter((feedback) => feedback.status !== "hidden");
  const categoryBreakdown = REVIEW_CATEGORIES.reduce((accumulator, [key]) => {
    const values = visibleFeedbacks
      .map((feedback) => Number((feedback.responses as Record<string, unknown>)?.[key]))
      .filter((value) => Number.isFinite(value) && value > 0);
    accumulator[key] = values.length
      ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
      : 0;
    return accumulator;
  }, {} as Record<string, number>);

  const averages = visibleFeedbacks
    .map((feedback) => averageResponseValue((feedback.responses || {}) as Record<string, unknown>))
    .filter((value) => value > 0);

  return {
    total_reviews: visibleFeedbacks.length,
    average_rating: averages.length
      ? Number((averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(2))
      : 0,
    category_breakdown: categoryBreakdown
  };
}

async function loadTeacherAggregateProfile(
  supabase: SupabaseContextClient,
  teacher: TeacherRecord
) {
  const [assignmentResult, feedbackResult] = await Promise.all([
    supabase
      .from("teacher_assignments")
      .select("id, course_code, course_title, semester, section, academic_term, is_active")
      .eq("teacher_directory_id", teacher.id)
      .order("semester", { ascending: true })
      .order("section", { ascending: true })
      .order("course_code", { ascending: true })
      .limit(30),
    supabase
      .from("feedbacks")
      .select("course_code, course_title, semester, section, responses, comment, status, submitted_at")
      .eq("teacher_directory_id", teacher.id)
      .neq("status", "hidden")
      .order("submitted_at", { ascending: false })
      .limit(200)
  ]);

  if (assignmentResult.error || feedbackResult.error) {
    return [
      `Matched teacher: ${summarizeTeacherCandidate(teacher)}.`,
      "Teacher aggregate tables could not be read by the server-side data reader."
    ].join("\n");
  }

  const assignments = Array.isArray(assignmentResult.data) ? assignmentResult.data : [];
  const feedbacks = Array.isArray(feedbackResult.data) ? feedbackResult.data : [];
  const recentComments = feedbacks
    .filter((feedback) => compactText(feedback.comment, 140))
    .slice(0, 6)
    .map((feedback) => ({
      comment: compactText(feedback.comment, 140),
      course_code: feedback.course_code,
      course_title: feedback.course_title,
      semester: feedback.semester,
      section: feedback.section,
      submitted_at: feedback.submitted_at
    }));

  return summarizeTeacherProfile({
    teacher,
    assignments,
    stats: buildTeacherStats(feedbacks),
    recent_comments: recentComments
  });
}

async function loadTeacherContext(
  supabase: SupabaseContextClient | null,
  message: string
) {
  if (!supabase) {
    return "Server-side teacher rating reader is not configured. Set SUPABASE_SERVICE_ROLE_KEY for the ai-assistant Edge Function.";
  }

  const { data, error } = await supabase
    .from("teachers_directory")
    .select("id, name, designation, short_code, department, status, is_email_public")
    .order("name", { ascending: true })
    .limit(500);

  if (error || !Array.isArray(data)) {
    return "Teacher directory could not be loaded for AI context.";
  }

  const teachers = data as TeacherRecord[];
  const matches = teachers
    .map((teacher) => ({ teacher, score: scoreTeacherMatch(message, teacher) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  if (!matches.length) {
    const sampleNames = teachers.slice(0, 10).map((teacher) => teacher.name).join(", ");
    return `Teacher directory visible: ${teachers.length} teacher profile(s). Sample names: ${sampleNames}. If the user names a sir/mam, use the matched teacher context when available.`;
  }

  const [best, second] = matches;
  if (second && best.score < 900 && best.score - second.score < 18) {
    return `Teacher name is ambiguous. Candidate matches: ${matches.map((item) => summarizeTeacherCandidate(item.teacher)).join(" | ")}. Ask the user which teacher they mean before giving ratings.`;
  }

  const aggregateProfile = await loadTeacherAggregateProfile(supabase, best.teacher);

  if (!aggregateProfile) {
    return [
      `Matched teacher: ${summarizeTeacherCandidate(best.teacher)}.`,
      "Teacher ratings are unavailable because the server-side data reader is not configured."
    ].join("\n");
  }

  return aggregateProfile;
}

async function buildLiveContext(req: Request, body: Record<string, unknown>, message: string) {
  const viewerClient = createSupabaseContextClient(req);
  const dataClient = createSupabaseDataClient();
  const [viewer, snapshot, teacherContext] = await Promise.all([
    loadViewerProfile(viewerClient),
    loadSiteSnapshot(dataClient),
    loadTeacherContext(dataClient, message)
  ]);
  const pageContext = compactText(body.context, 1200);

  return [
    viewer.text,
    snapshot,
    teacherContext,
    pageContext ? `Current page context from browser: ${pageContext}` : ""
  ].filter(Boolean).join("\n");
}

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

    temperature = 0.55;
    maxTokens = 520;
    const liveContext = await buildLiveContext(req, body, message);

    messages = [
      {
        role: "system",
        content:
          "You are the SFRS website assistant: an all-in-one support AI for this Student Feedback Review System. Use this compact site knowledge: " +
          SFRS_KNOWLEDGE +
          " Live allowed context for this request: " +
          liveContext +
          " Behavior rules: Answer only from site knowledge plus live allowed context. Never invent ratings, teacher details, comments, policies, or records. " +
          "Match the user's language, script, tone, and rough style; Bengali/Banglish users should get Bengali/Banglish replies. " +
          "Read emotion: if frustrated or confused, be calm and direct; if playful, be lightly funny. Keep jokes respectful and never mock teachers, students, or private feedback. " +
          "Keep replies concise: usually 3-5 short bullets or a short paragraph. " +
          "Do not ask for, store, repeat, or process passwords, OTPs, API keys, or session tokens. If users offer credentials, tell them to use the correct login page and continue after login. " +
          "You can guide users to pages and explain actions, but do not claim you personally logged in, submitted feedback, changed admin settings, or moderated data. " +
          "For teacher rating questions, use the matched teacher context if present, even when the viewer is not signed in. If ambiguous, ask which teacher they mean. Refuse only when no matched rating context is provided."
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
