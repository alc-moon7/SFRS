(() => {
  "use strict";

  const DEFAULT_DEPARTMENT = "Computer Science and Engineering";
  const DEFAULT_PROGRAM = "B.Sc. in CSE";
  const DEFAULT_TERM = "Spring 2026";
  const DEMO_CREDENTIALS = { username: "admin", password: "admin" };
  const DEMO_SESSION_KEY = "sfrs_demo_session";
  const DEMO_FEEDBACK_KEY = "sfrs_demo_feedbacks";
  const DEMO_ASSIGNMENT_KEY = "sfrs_demo_assignments";
  const DEMO_TEACHER_KEY = "sfrs_demo_teachers";
  const DEMO_SETTINGS_KEY = "sfrs_demo_settings";
  const FALLBACK_SETUP_MESSAGE =
    "Run `supabase/feedback-review-feature.sql` and `supabase/feedback-review-seed.sql` in Supabase, then reload this page.";
  const DASHBOARD_ROUTES = {
    student: "student-dashboard.html",
    teacher: "teacher-dashboard.html",
    admin: "admin-dashboard.html"
  };
  const REVIEW_CATEGORIES = window.SFRS_REVIEW_CATEGORIES || [
    { key: "teaching_quality", label: "Teaching Quality" },
    { key: "communication", label: "Communication" },
    { key: "course_organization", label: "Course Organization" },
    { key: "supportiveness", label: "Helpfulness / Supportiveness" },
    { key: "punctuality", label: "Punctuality / Regularity" },
    { key: "overall_satisfaction", label: "Overall Satisfaction" }
  ];
  const REVIEW_SEMESTERS = window.SFRS_REVIEW_SEMESTERS || [
    "1st Semester",
    "2nd Semester",
    "3rd Semester",
    "4th Semester",
    "5th Semester",
    "6th Semester",
    "7th Semester",
    "8th Semester",
    "9th Semester"
  ];
  const REVIEW_SECTIONS = window.SFRS_REVIEW_SECTIONS || ["A", "B", "C", "General"];
  const ASSIGNMENT_SEED = window.SFRS_ASSIGNMENT_SEED || [];
  const EXTRA_TEACHER_SEEDS = window.SFRS_EXTRA_TEACHER_SEEDS || [];
  const LEGACY_QUESTIONS = window.SFRS_QUESTIONS || [];
  const LEGACY_RESPONSE_SCORES = { Average: 2, Good: 4, Excellent: 5 };
  const DEFAULT_FEEDBACK_SETTINGS = {
    id: 1,
    allow_anonymous_feedback: true,
    review_window_open: true,
    active_term: DEFAULT_TERM
  };
  const DEMO_PROFILE_DEFINITIONS = {
    student: {
      id: "demo-student-001",
      role: "student",
      full_name: "Demo Student",
      student_id: "223311051",
      email: "admin",
      department: DEFAULT_DEPARTMENT,
      program: DEFAULT_PROGRAM,
      semester: "8th Semester",
      section: "B"
    },
    teacher: {
      id: "demo-teacher-001",
      role: "teacher",
      full_name: "Md. Fatin Ilham",
      teacher_name: "Md. Fatin Ilham",
      designation: "Lecturer",
      email: "admin"
    },
    admin: {
      id: "demo-admin-001",
      role: "admin",
      full_name: "Demo Admin",
      designation: "System Administrator",
      email: "admin"
    }
  };
  const NORMALIZED_TEACHER_ALIASES = Object.entries(window.SFRS_TEACHER_ALIASES || {}).reduce(
    (accumulator, entry) => {
      accumulator[normalizeLookup(entry[0])] = entry[1];
      return accumulator;
    },
    {}
  );

  function normalizeLookup(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeSemesterValue(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    const exact = REVIEW_SEMESTERS.find((item) => normalizeLookup(item) === normalizeLookup(raw));
    if (exact) {
      return exact;
    }
    const numberMatch = raw.match(/(\d+)/);
    if (numberMatch) {
      const match = REVIEW_SEMESTERS.find((item) => item.startsWith(`${Number(numberMatch[1])}`));
      if (match) {
        return match;
      }
    }
    return raw;
  }

  function normalizeSectionValue(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    const exact = REVIEW_SECTIONS.find((item) => normalizeLookup(item) === normalizeLookup(raw));
    if (exact) {
      return exact;
    }
    if (/general/i.test(raw)) {
      return "General";
    }
    const letterMatch = raw.match(/([abc])$/i);
    if (letterMatch) {
      return letterMatch[1].toUpperCase();
    }
    return raw.toUpperCase();
  }

  function normalizeTeacherName(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    return NORMALIZED_TEACHER_ALIASES[normalizeLookup(raw)] || raw;
  }

  function safeNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeComment(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 700);
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/(^\.+|\.+$)/g, "");
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleString();
  }

  function formatAverage(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
  }

  function getInitials(value) {
    const tokens = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!tokens.length) {
      return "T";
    }
    return tokens.map((item) => item[0].toUpperCase()).join("");
  }

  function buildTeacherEmail(name) {
    const slug = slugify(name).replace(/\.+/g, ".");
    return slug ? `${slug}@vu.edu.bd` : "";
  }

  function nextNumericId(records) {
    return records.reduce((highest, record) => Math.max(highest, Number(record.id) || 0), 0) + 1;
  }

  function readStorage(key, fallbackValue) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallbackValue;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallbackValue;
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function buildProfilePayload(session) {
    if (!session || !session.user) {
      return null;
    }
    const metadata = session.user.user_metadata || {};
    const email = normalizeEmail(session.user.email || metadata.email || "");
    const role = String(metadata.role || "").trim().toLowerCase();
    if (!email || !role) {
      return null;
    }
    return {
      id: session.user.id,
      role,
      full_name: String(metadata.full_name || email).trim(),
      email,
      student_id: metadata.student_id || null,
      department: metadata.department || null,
      program: metadata.program || null,
      semester: normalizeSemesterValue(metadata.semester || null) || null,
      section: normalizeSectionValue(metadata.section || null) || null,
      designation: metadata.designation || null,
      teacher_directory_id: safeNumber(metadata.teacher_directory_id)
    };
  }

  async function createProfileFromMetadata(session) {
    const payload = buildProfilePayload(session);
    if (!payload) {
      return null;
    }
    const { data, error } = await supabaseClient.from("profiles").upsert(payload, {
      onConflict: "id"
    }).select("*").single();
    if (error) {
      throw error;
    }
    return data;
  }

  function isEmail(value) {
    return /.+@.+\..+/.test(String(value || "").trim());
  }

  function isDemoCredential(identifier, password) {
    return normalizeLookup(identifier) === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password;
  }

  function createDemoId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeTeacherRecord(record) {
    const id = safeNumber(record.id);
    return {
      id,
      name: String(record.name || "").trim(),
      designation: String(record.designation || "Lecturer").trim() || "Lecturer",
      email: normalizeEmail(record.email || ""),
      short_code: String(record.short_code || record.shortCode || "").trim(),
      department: String(record.department || DEFAULT_DEPARTMENT).trim() || DEFAULT_DEPARTMENT,
      phone: String(record.phone || "").trim(),
      office_room: String(record.office_room || record.officeRoom || "").trim(),
      bio: String(record.bio || "").trim(),
      avatar_url: String(record.avatar_url || record.avatarUrl || "").trim(),
      status: String(record.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
      is_email_public: Boolean(record.is_email_public ?? record.isEmailPublic ?? false),
      created_at: record.created_at || new Date().toISOString(),
      updated_at: record.updated_at || new Date().toISOString()
    };
  }

  function normalizeAssignmentRecord(record) {
    const teacherRelation = Array.isArray(record.teachers_directory)
      ? record.teachers_directory[0]
      : record.teachers_directory;
    return {
      id: safeNumber(record.id),
      teacher_directory_id: safeNumber(record.teacher_directory_id || record.teacherId),
      course_code: String(record.course_code || record.courseCode || "").trim(),
      course_title: String(record.course_title || record.courseTitle || "").trim(),
      semester: normalizeSemesterValue(record.semester || ""),
      section: normalizeSectionValue(record.section || ""),
      academic_term: String(record.academic_term || record.academicTerm || "").trim(),
      is_active: Boolean(record.is_active ?? record.isActive ?? true),
      created_at: record.created_at || new Date().toISOString(),
      updated_at: record.updated_at || new Date().toISOString(),
      teachers_directory: teacherRelation ? normalizeTeacherRecord(teacherRelation) : null
    };
  }

  function normalizeFeedbackRecord(record) {
    const teacherRelation = Array.isArray(record.teachers_directory)
      ? record.teachers_directory[0]
      : record.teachers_directory;
    const normalizedTeacher = teacherRelation ? normalizeTeacherRecord(teacherRelation) : null;
    return {
      id: record.id,
      student_id: record.student_id || null,
      assignment_id: safeNumber(record.assignment_id),
      teacher_directory_id: safeNumber(record.teacher_directory_id),
      course_code: String(record.course_code || "").trim(),
      course_title: String(record.course_title || "").trim(),
      semester: normalizeSemesterValue(record.semester || ""),
      section: normalizeSectionValue(record.section || ""),
      responses: record.responses || {},
      comment: sanitizeComment(record.comment || ""),
      is_anonymous: Boolean(record.is_anonymous ?? true),
      status: String(record.status || "submitted").trim().toLowerCase() || "submitted",
      submitted_at: record.submitted_at || record.created_at || new Date().toISOString(),
      updated_at: record.updated_at || record.submitted_at || new Date().toISOString(),
      academic_term: String(record.academic_term || "").trim(),
      teachers_directory: normalizedTeacher,
      teacher_name: record.teacher_name || (normalizedTeacher ? normalizedTeacher.name : "Teacher")
    };
  }

  function normalizeFeedbackSettings(record) {
    return {
      id: 1,
      allow_anonymous_feedback: Boolean(
        record?.allow_anonymous_feedback ?? DEFAULT_FEEDBACK_SETTINGS.allow_anonymous_feedback
      ),
      review_window_open: Boolean(record?.review_window_open ?? DEFAULT_FEEDBACK_SETTINGS.review_window_open),
      active_term: String(record?.active_term || DEFAULT_FEEDBACK_SETTINGS.active_term).trim() ||
        DEFAULT_FEEDBACK_SETTINGS.active_term
    };
  }

  function buildBaseDemoTeachers() {
    const nameSet = new Set();
    ASSIGNMENT_SEED.forEach((item) => {
      nameSet.add(normalizeTeacherName(item.teacherName));
    });
    EXTRA_TEACHER_SEEDS.forEach((item) => {
      nameSet.add(normalizeTeacherName(item));
    });
    nameSet.add(DEMO_PROFILE_DEFINITIONS.teacher.teacher_name);

    return Array.from(nameSet)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map((name, index) => normalizeTeacherRecord({
        id: index + 1,
        name,
        designation: "Lecturer",
        email: buildTeacherEmail(name),
        short_code: `CSE-T-${String(index + 1).padStart(3, "0")}`,
        department: DEFAULT_DEPARTMENT,
        bio: "",
        phone: "",
        office_room: "",
        avatar_url: "",
        status: "active",
        is_email_public: false
      }));
  }

  function buildBaseDemoAssignments(teachers) {
    const teacherIdMap = new Map(
      teachers.map((teacher) => [normalizeLookup(teacher.name), teacher.id])
    );

    return ASSIGNMENT_SEED.map((item, index) => normalizeAssignmentRecord({
      id: index + 1,
      teacher_directory_id: teacherIdMap.get(normalizeLookup(normalizeTeacherName(item.teacherName))),
      course_code: item.courseCode,
      course_title: item.courseTitle,
      semester: item.semester,
      section: item.section,
      academic_term: DEFAULT_TERM,
      is_active: true
    })).filter((item) => item.teacher_directory_id);
  }

  function ensureDemoState() {
    let teachers = readStorage(DEMO_TEACHER_KEY, null);
    if (!Array.isArray(teachers) || !teachers.length) {
      teachers = buildBaseDemoTeachers();
      writeStorage(DEMO_TEACHER_KEY, teachers);
    }

    let assignments = readStorage(DEMO_ASSIGNMENT_KEY, null);
    if (!Array.isArray(assignments) || !assignments.length) {
      assignments = buildBaseDemoAssignments(teachers);
      writeStorage(DEMO_ASSIGNMENT_KEY, assignments);
    }

    const settings = normalizeFeedbackSettings(readStorage(DEMO_SETTINGS_KEY, null));
    writeStorage(DEMO_SETTINGS_KEY, settings);

    const feedbacks = readStorage(DEMO_FEEDBACK_KEY, []);
    if (!Array.isArray(feedbacks)) {
      writeStorage(DEMO_FEEDBACK_KEY, []);
    }
  }

  function getDemoTeachers() {
    ensureDemoState();
    return readStorage(DEMO_TEACHER_KEY, []).map(normalizeTeacherRecord);
  }

  function setDemoTeachers(records) {
    writeStorage(DEMO_TEACHER_KEY, records.map(normalizeTeacherRecord));
  }

  function getDemoAssignments() {
    ensureDemoState();
    const teachers = getDemoTeachers();
    const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    return readStorage(DEMO_ASSIGNMENT_KEY, []).map((record) => {
      const assignment = normalizeAssignmentRecord(record);
      assignment.teachers_directory = teacherMap.get(assignment.teacher_directory_id) || null;
      return assignment;
    });
  }

  function setDemoAssignments(records) {
    writeStorage(DEMO_ASSIGNMENT_KEY, records.map((record) => ({
      id: record.id,
      teacher_directory_id: record.teacher_directory_id,
      course_code: record.course_code,
      course_title: record.course_title,
      semester: record.semester,
      section: record.section,
      academic_term: record.academic_term,
      is_active: record.is_active,
      created_at: record.created_at,
      updated_at: record.updated_at
    })));
  }

  function getDemoFeedbacks() {
    ensureDemoState();
    const teacherMap = new Map(getDemoTeachers().map((teacher) => [teacher.id, teacher]));
    return readStorage(DEMO_FEEDBACK_KEY, []).map((record) => {
      const feedback = normalizeFeedbackRecord(record);
      feedback.teachers_directory = teacherMap.get(feedback.teacher_directory_id) || null;
      feedback.teacher_name = feedback.teachers_directory?.name || feedback.teacher_name;
      return feedback;
    });
  }

  function setDemoFeedbacks(records) {
    writeStorage(DEMO_FEEDBACK_KEY, records.map((record) => ({
      id: record.id,
      student_id: record.student_id,
      assignment_id: record.assignment_id,
      teacher_directory_id: record.teacher_directory_id,
      course_code: record.course_code,
      course_title: record.course_title,
      semester: record.semester,
      section: record.section,
      responses: record.responses,
      comment: record.comment,
      is_anonymous: record.is_anonymous,
      status: record.status,
      submitted_at: record.submitted_at,
      updated_at: record.updated_at,
      academic_term: record.academic_term
    })));
  }

  function getDemoSettings() {
    ensureDemoState();
    return normalizeFeedbackSettings(readStorage(DEMO_SETTINGS_KEY, DEFAULT_FEEDBACK_SETTINGS));
  }

  function setDemoSettings(settings) {
    writeStorage(DEMO_SETTINGS_KEY, normalizeFeedbackSettings(settings));
  }

  function getDemoSession() {
    return readStorage(DEMO_SESSION_KEY, null);
  }

  function resolveDemoProfile(role) {
    const base = DEMO_PROFILE_DEFINITIONS[role];
    if (!base) {
      return null;
    }
    if (role !== "teacher") {
      return { ...base };
    }
    const teacher = getDemoTeachers().find(
      (item) => normalizeLookup(item.name) === normalizeLookup(base.teacher_name)
    );
    return {
      ...base,
      full_name: teacher?.name || base.full_name,
      designation: teacher?.designation || base.designation,
      email: teacher?.email || base.email,
      department: teacher?.department || DEFAULT_DEPARTMENT,
      teacher_directory_id: teacher?.id || null
    };
  }

  function setDemoSession(role) {
    const profile = resolveDemoProfile(role);
    if (!profile) {
      return;
    }
    writeStorage(DEMO_SESSION_KEY, { role, profile });
  }

  function clearDemoSession() {
    localStorage.removeItem(DEMO_SESSION_KEY);
  }

  const TOAST_TYPE_CLASSES = {
    success: "text-bg-success",
    info: "text-bg-info",
    warning: "text-bg-warning",
    danger: "text-bg-danger"
  };
  const TOAST_DARK_TYPES = new Set(["success", "danger"]);

  function getToastContainer() {
    let container = document.getElementById("toastContainer");
    if (container) {
      return container;
    }
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container position-fixed top-0 end-0 p-3";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
    return container;
  }

  function showToast(type, message) {
    if (!message) {
      return;
    }
    const container = getToastContainer();
    const toast = document.createElement("div");
    const variant = TOAST_TYPE_CLASSES[type] || TOAST_TYPE_CLASSES.info;
    const isDark = TOAST_DARK_TYPES.has(type);

    toast.className = `toast align-items-center ${variant} border-0`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");

    const wrapper = document.createElement("div");
    wrapper.className = "d-flex";

    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = `${isDark ? "btn-close btn-close-white" : "btn-close"} me-2 m-auto`;
    closeButton.setAttribute("data-bs-dismiss", "toast");
    closeButton.setAttribute("aria-label", "Close");

    wrapper.append(body, closeButton);
    toast.appendChild(wrapper);

    while (container.children.length >= 3) {
      container.removeChild(container.firstElementChild);
    }
    container.appendChild(toast);

    if (window.bootstrap?.Toast) {
      const toastInstance = new window.bootstrap.Toast(toast, {
        delay: 4500,
        autohide: true
      });
      toast.addEventListener("hidden.bs.toast", () => toast.remove());
      toastInstance.show();
    } else {
      toast.classList.add("show");
      setTimeout(() => toast.remove(), 4500);
    }
  }

  function showAlert(element, type, message) {
    if (!element) {
      return;
    }
    element.className = `alert alert-${type}`;
    element.textContent = message;
    if (type === "success" || type === "info") {
      showToast(type, message);
    }
  }

  function clearAlert(element) {
    if (!element) {
      return;
    }
    element.className = "";
    element.textContent = "";
  }

  function getSetupMessage(error, fallbackMessage) {
    const baseMessage = error?.message || fallbackMessage || "Unable to load data.";
    if (/does not exist|permission|violates|column/i.test(baseMessage)) {
      return `${baseMessage} ${FALLBACK_SETUP_MESSAGE}`;
    }
    return baseMessage;
  }

  function setButtonLoading(button, isLoading, loadingLabel) {
    if (!button) {
      return;
    }
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent || "";
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingLabel : button.dataset.defaultLabel;
  }

  function setText(target, value, fallback = "") {
    const element = typeof target === "string" ? document.querySelector(target) : target;
    if (!element) {
      return;
    }
    element.textContent = value || fallback;
  }

  function setAvatar(element, name, avatarUrl) {
    if (!element) {
      return;
    }
    const normalizedUrl = String(avatarUrl || "").trim();
    if (normalizedUrl) {
      element.style.backgroundImage = `url("${normalizedUrl}")`;
      element.classList.add("has-image");
      element.textContent = "";
      return;
    }
    element.style.backgroundImage = "";
    element.classList.remove("has-image");
    element.textContent = getInitials(name);
  }

  function populateValueSelect(selectEl, values, placeholder, selectedValue) {
    if (!selectEl) {
      return;
    }
    const currentValue = selectedValue ?? selectEl.value;
    selectEl.innerHTML = "";
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    selectEl.appendChild(placeholderOption);
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      if (String(value) === String(currentValue)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  }

  function populateTeacherSelect(selectEl, teachers, placeholder, selectedValue) {
    if (!selectEl) {
      return;
    }
    const currentValue = selectedValue ?? selectEl.value;
    selectEl.innerHTML = "";
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    selectEl.appendChild(placeholderOption);
    teachers.forEach((teacher) => {
      const option = document.createElement("option");
      option.value = teacher.id;
      option.textContent = `${teacher.name} (${teacher.designation})`;
      if (String(teacher.id) === String(currentValue)) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  }

  function buildAssignmentSignature(record) {
    return [
      record.teacher_directory_id || "",
      normalizeLookup(record.course_code),
      normalizeLookup(record.semester),
      normalizeLookup(record.section)
    ].join("|");
  }

  function buildFeedbackLookup(feedbacks) {
    const map = new Map();
    feedbacks.forEach((feedback) => {
      if (feedback.assignment_id) {
        map.set(`assignment:${feedback.assignment_id}`, feedback);
      }
      map.set(`legacy:${buildAssignmentSignature(feedback)}`, feedback);
    });
    return map;
  }

  function findFeedbackForAssignment(lookup, assignment) {
    return lookup.get(`assignment:${assignment.id}`) || lookup.get(`legacy:${buildAssignmentSignature(assignment)}`) || null;
  }

  function normalizeResponses(responses) {
    if (Array.isArray(responses)) {
      return responses;
    }
    if (responses && typeof responses === "object") {
      return REVIEW_CATEGORIES.map((category) => ({
        question: category.label,
        key: category.key,
        value: Number(responses[category.key]) || 0
      }));
    }
    return [];
  }

  function averageFromResponses(responses) {
    if (Array.isArray(responses)) {
      const scores = responses
        .map((item) => LEGACY_RESPONSE_SCORES[String(item.value || "")] || null)
        .filter((item) => Number.isFinite(item));
      if (!scores.length) {
        return 0;
      }
      return scores.reduce((total, item) => total + item, 0) / scores.length;
    }
    const scores = REVIEW_CATEGORIES
      .map((category) => Number(responses?.[category.key]) || 0)
      .filter((item) => item > 0);
    if (!scores.length) {
      return 0;
    }
    return scores.reduce((total, item) => total + item, 0) / scores.length;
  }

  function overallCategoryValue(responses) {
    if (Array.isArray(responses)) {
      const last = responses[responses.length - 1];
      return LEGACY_RESPONSE_SCORES[String(last?.value || "")] || averageFromResponses(responses);
    }
    return Number(responses?.overall_satisfaction) || averageFromResponses(responses);
  }

  function buildCategoryBreakdown(feedbacks) {
    return REVIEW_CATEGORIES.map((category) => {
      const values = feedbacks
        .map((feedback) => {
          if (Array.isArray(feedback.responses)) {
            return averageFromResponses(feedback.responses);
          }
          return Number(feedback.responses?.[category.key]) || 0;
        })
        .filter((value) => value > 0);
      const average = values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : 0;
      return {
        key: category.key,
        label: category.label,
        average,
        count: values.length
      };
    });
  }

  function buildCourseStats(feedbacks) {
    const map = new Map();
    feedbacks.forEach((feedback) => {
      const key = `${feedback.course_code}||${feedback.course_title}`;
      if (!map.has(key)) {
        map.set(key, {
          course_code: feedback.course_code,
          course_title: feedback.course_title,
          count: 0,
          average: 0
        });
      }
      const entry = map.get(key);
      entry.count += 1;
      entry.average += averageFromResponses(feedback.responses);
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        average: entry.count ? Number((entry.average / entry.count).toFixed(2)) : 0
      }))
      .sort((left, right) => right.count - left.count);
  }

  function buildTeacherStats(feedbacks) {
    const visibleFeedbacks = feedbacks.filter((item) => item.status !== "hidden");
    const categoryBreakdown = buildCategoryBreakdown(visibleFeedbacks);
    const averages = visibleFeedbacks.map((item) => averageFromResponses(item.responses)).filter((item) => item > 0);
    const averageRating = averages.length
      ? averages.reduce((total, value) => total + value, 0) / averages.length
      : 0;
    const visibleComments = visibleFeedbacks.filter((item) => item.comment);
    const recentComments = visibleFeedbacks
      .filter((item) => item.comment)
      .slice()
      .sort((left, right) => new Date(right.submitted_at) - new Date(left.submitted_at))
      .slice(0, 6);

    return {
      totalReviews: visibleFeedbacks.length,
      averageRating,
      visibleCommentCount: visibleComments.length,
      categoryBreakdown,
      categoryBreakdownObject: Object.fromEntries(
        categoryBreakdown.map((item) => [item.key, Number(item.average.toFixed(2))])
      ),
      recentComments,
      courseStats: buildCourseStats(visibleFeedbacks)
    };
  }

  function renderCategoryBreakdown(container, breakdown) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    if (!breakdown.length) {
      container.innerHTML = "<div class=\"text-muted\">No rating data available yet.</div>";
      return;
    }
    breakdown.forEach((item) => {
      const percentage = Math.max(0, Math.min(100, (item.average / 5) * 100));
      const row = document.createElement("div");
      row.className = "rating-breakdown-row";
      row.innerHTML = `
        <div class="d-flex align-items-center justify-content-between gap-3">
          <span>${escapeHtml(item.label)}</span>
          <strong>${formatAverage(item.average)}</strong>
        </div>
        <div class="rating-track mt-2">
          <div class="rating-fill" style="width: ${percentage}%"></div>
        </div>
      `;
      container.appendChild(row);
    });
  }

  function renderCommentStack(container, comments, emptyMessage) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    if (!comments.length) {
      container.innerHTML = `<div class="text-muted">${escapeHtml(emptyMessage)}</div>`;
      return;
    }
    comments.forEach((comment) => {
      const card = document.createElement("article");
      card.className = "comment-card";
      card.innerHTML = `
        <div class="comment-meta">${escapeHtml(comment.course_code)} | ${escapeHtml(comment.semester)} / ${escapeHtml(comment.section)} | ${escapeHtml(formatDate(comment.submitted_at))}</div>
        <p class="mb-0">${escapeHtml(comment.comment)}</p>
      `;
      container.appendChild(card);
    });
  }

  function statusBadgeMarkup(status, label) {
    const normalized = String(status || "").toLowerCase();
    const className = normalized === "hidden"
      ? "status-badge hidden"
      : normalized === "inactive"
        ? "status-badge inactive"
        : normalized === "submitted"
          ? "status-badge submitted"
          : normalized === "closed"
            ? "status-badge inactive"
            : "status-badge active";
    return `<span class="${className}">${escapeHtml(label || normalized || "active")}</span>`;
  }

  function openReviewModal(review, hideStudent) {
    const modal = document.getElementById("reviewModal");
    if (!modal || !review) {
      return;
    }
    const titleEl = modal.querySelector("[data-review-title]");
    const metaEl = modal.querySelector("[data-review-meta]");
    const bodyEl = modal.querySelector("[data-review-body]");

    setText(titleEl, `${review.teacher_name || "Teacher"} | ${review.course_code}`);

    const metaParts = [
      `Course: ${review.course_code}${review.course_title ? ` - ${review.course_title}` : ""}`,
      `Semester: ${review.semester}`,
      `Section: ${review.section}`,
      `Status: ${review.status || "submitted"}`,
      `Submitted: ${formatDate(review.submitted_at)}`
    ];
    if (review.academic_term) {
      metaParts.splice(3, 0, `Term: ${review.academic_term}`);
    }
    if (!hideStudent && review.is_anonymous) {
      metaParts.push("Anonymous review");
    }
    setText(metaEl, metaParts.join(" | "));

    bodyEl.innerHTML = "";
    const list = document.createElement("div");
    list.className = "rating-breakdown-list";

    if (Array.isArray(review.responses)) {
      review.responses.forEach((item) => {
        const row = document.createElement("div");
        row.className = "question-card";
        row.innerHTML = `
          <div class="fw-semibold mb-1">${escapeHtml(item.question || "Question")}</div>
          <div class="text-muted small">${escapeHtml(item.section || "Feedback")}</div>
          <div class="mt-2">${escapeHtml(item.value || "-")}</div>
        `;
        list.appendChild(row);
      });
    } else {
      REVIEW_CATEGORIES.forEach((category) => {
        const row = document.createElement("div");
        row.className = "rating-breakdown-row";
        row.innerHTML = `
          <div class="d-flex align-items-center justify-content-between gap-3">
            <span>${escapeHtml(category.label)}</span>
            <strong>${escapeHtml(String(Number(review.responses?.[category.key]) || 0))}/5</strong>
          </div>
        `;
        list.appendChild(row);
      });
    }

    bodyEl.appendChild(list);
    if (review.comment) {
      const commentCard = document.createElement("div");
      commentCard.className = "comment-card mt-3";
      commentCard.innerHTML = `
        <div class="comment-meta">Comment</div>
        <p class="mb-0">${escapeHtml(review.comment)}</p>
      `;
      bodyEl.appendChild(commentCard);
    }

    window.bootstrap?.Modal.getOrCreateInstance(modal).show();
  }

  async function invokeAiAssistant(payload) {
    const { data, error } = await supabaseClient.functions.invoke("ai-assistant", {
      body: payload
    });
    if (error) {
      throw new Error(error.message || "AI request failed.");
    }
    if (!data) {
      throw new Error("AI request failed.");
    }
    if (data.error) {
      throw new Error(data.error);
    }
    return data.result || "";
  }

  function appendChatMessage(container, role, text) {
    if (!container) {
      return;
    }
    const message = document.createElement("div");
    message.className = `chat-message ${role}`;
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  function clampChatHistory(history, limit) {
    if (history.length <= limit) {
      return history;
    }
    return history.slice(history.length - limit);
  }

  async function getProfile() {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }
    if (!sessionData.session) {
      return null;
    }
    const session = sessionData.session;
    const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      const createdProfile = await createProfileFromMetadata(session);
      return { session, profile: createdProfile };
    }
    return {
      session,
      profile: {
        ...data,
        semester: normalizeSemesterValue(data.semester || ""),
        section: normalizeSectionValue(data.section || "")
      }
    };
  }

  function redirectIfAuthenticated() {
    const demoSession = getDemoSession();
    if (demoSession?.role && DASHBOARD_ROUTES[demoSession.role]) {
      window.location.href = DASHBOARD_ROUTES[demoSession.role];
      return;
    }
    getProfile()
      .then((result) => {
        const role = result?.profile?.role;
        if (role && DASHBOARD_ROUTES[role]) {
          window.location.href = DASHBOARD_ROUTES[role];
        }
      })
      .catch(() => {
        // Ignore unauthenticated state on entry pages.
      });
  }

  async function requireAnyRole(roles, redirectTo) {
    const demoSession = getDemoSession();
    if (demoSession) {
      if (!roles.includes(demoSession.role)) {
        clearDemoSession();
        window.location.href = redirectTo;
        return null;
      }
      return {
        session: { user: { id: demoSession.profile.id } },
        profile: demoSession.profile,
        demo: true
      };
    }

    try {
      const result = await getProfile();
      if (!result?.profile || !roles.includes(result.profile.role)) {
        if (result?.session) {
          await supabaseClient.auth.signOut();
        }
        window.location.href = redirectTo;
        return null;
      }
      return { ...result, demo: false };
    } catch (error) {
      window.location.href = redirectTo;
      return null;
    }
  }

  async function requireRole(role, redirectTo) {
    return requireAnyRole([role], redirectTo);
  }

  function initLogout() {
    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        clearDemoSession();
        try {
          await supabaseClient.auth.signOut();
        } catch (error) {
          // Ignore sign-out errors after clearing local demo state.
        }
        window.location.href = "index.html";
      });
    });
  }

  async function loadTeacherDirectory(options = {}) {
    if (options.useDemo) {
      return getDemoTeachers();
    }
    const { data, error } = await supabaseClient.from("teachers_directory").select("*").order("name", {
      ascending: true
    });
    if (error) {
      throw error;
    }
    return (data || []).map(normalizeTeacherRecord);
  }

  async function loadAssignments(options = {}) {
    if (options.useDemo) {
      let assignments = getDemoAssignments();
      if (options.filters?.semester) {
        assignments = assignments.filter((item) => normalizeLookup(item.semester) === normalizeLookup(options.filters.semester));
      }
      if (options.filters?.section) {
        assignments = assignments.filter((item) => normalizeLookup(item.section) === normalizeLookup(options.filters.section));
      }
      if (options.filters?.teacher_directory_id) {
        assignments = assignments.filter((item) => item.teacher_directory_id === Number(options.filters.teacher_directory_id));
      }
      if (options.filters?.is_active !== undefined) {
        assignments = assignments.filter((item) => item.is_active === Boolean(options.filters.is_active));
      }
      return assignments;
    }

    let query = supabaseClient.from("teacher_assignments").select("*, teachers_directory(*)");
    if (options.filters?.semester) {
      query = query.eq("semester", options.filters.semester);
    }
    if (options.filters?.section) {
      query = query.eq("section", options.filters.section);
    }
    if (options.filters?.teacher_directory_id) {
      query = query.eq("teacher_directory_id", options.filters.teacher_directory_id);
    }
    if (options.filters?.is_active !== undefined) {
      query = query.eq("is_active", options.filters.is_active);
    }
    const { data, error } = await query
      .order("semester", { ascending: true })
      .order("section", { ascending: true })
      .order("course_code", { ascending: true });
    if (error) {
      throw error;
    }
    return (data || []).map(normalizeAssignmentRecord);
  }

  async function loadFeedbackSettings(options = {}) {
    if (options.useDemo) {
      return getDemoSettings();
    }
    const { data, error } = await supabaseClient.from("feedback_settings").select("*").eq("id", 1).maybeSingle();
    if (error) {
      throw error;
    }
    return normalizeFeedbackSettings(data || DEFAULT_FEEDBACK_SETTINGS);
  }

  async function saveFeedbackSettings(options = {}) {
    const payload = normalizeFeedbackSettings(options.payload || DEFAULT_FEEDBACK_SETTINGS);
    if (options.useDemo) {
      setDemoSettings(payload);
      return payload;
    }
    const { data, error } = await supabaseClient.from("feedback_settings").upsert(payload, {
      onConflict: "id"
    }).select("*").single();
    if (error) {
      throw error;
    }
    return normalizeFeedbackSettings(data);
  }

  async function loadFeedbacks(options = {}) {
    if (options.useDemo) {
      let feedbacks = getDemoFeedbacks();
      if (options.filters?.student_id) {
        feedbacks = feedbacks.filter((item) => item.student_id === options.filters.student_id);
      }
      if (options.filters?.teacher_directory_id) {
        feedbacks = feedbacks.filter((item) => item.teacher_directory_id === Number(options.filters.teacher_directory_id));
      }
      if (options.filters?.status) {
        feedbacks = feedbacks.filter((item) => item.status === options.filters.status);
      }
      return feedbacks.sort((left, right) => new Date(right.submitted_at) - new Date(left.submitted_at));
    }

    let query = supabaseClient
      .from("feedbacks")
      .select("id, student_id, assignment_id, teacher_directory_id, course_code, course_title, semester, section, responses, comment, is_anonymous, status, submitted_at, updated_at, academic_term, teachers_directory(*)")
      .order("submitted_at", { ascending: false });

    if (options.filters?.student_id) {
      query = query.eq("student_id", options.filters.student_id);
    }
    if (options.filters?.teacher_directory_id) {
      query = query.eq("teacher_directory_id", options.filters.teacher_directory_id);
    }
    if (options.filters?.status) {
      query = query.eq("status", options.filters.status);
    }
    if (options.filters?.exclude_hidden) {
      query = query.neq("status", "hidden");
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return (data || []).map(normalizeFeedbackRecord);
  }

  async function saveTeacherRecord(options = {}) {
    const payload = normalizeTeacherRecord({
      ...options.payload,
      updated_at: new Date().toISOString()
    });
    if (options.useDemo) {
      const teachers = getDemoTeachers();
      if (payload.id) {
        const nextTeachers = teachers.map((teacher) => (teacher.id === payload.id ? payload : teacher));
        setDemoTeachers(nextTeachers);
        return payload;
      }
      const nextTeacher = {
        ...payload,
        id: nextNumericId(teachers),
        created_at: new Date().toISOString()
      };
      setDemoTeachers([...teachers, nextTeacher]);
      return nextTeacher;
    }

    const dbPayload = {
      name: payload.name,
      designation: payload.designation || null,
      email: payload.email || null,
      short_code: payload.short_code || null,
      department: payload.department || DEFAULT_DEPARTMENT,
      phone: payload.phone || null,
      office_room: payload.office_room || null,
      bio: payload.bio || null,
      avatar_url: payload.avatar_url || null,
      status: payload.status,
      is_email_public: payload.is_email_public
    };

    let query = supabaseClient.from("teachers_directory");
    query = payload.id
      ? query.update(dbPayload).eq("id", payload.id)
      : query.insert(dbPayload);
    const { data, error } = await query.select("*").single();
    if (error) {
      throw error;
    }
    return normalizeTeacherRecord(data);
  }

  async function saveAssignmentRecord(options = {}) {
    const payload = normalizeAssignmentRecord({
      ...options.payload,
      updated_at: new Date().toISOString()
    });
    if (!payload.teacher_directory_id) {
      throw new Error("Teacher is required.");
    }
    if (options.useDemo) {
      const assignments = getDemoAssignments();
      if (payload.id) {
        const nextAssignments = assignments.map((assignment) => (
          assignment.id === payload.id ? { ...payload, teachers_directory: assignment.teachers_directory } : assignment
        ));
        setDemoAssignments(nextAssignments);
        return payload;
      }
      const nextAssignment = {
        ...payload,
        id: nextNumericId(assignments),
        created_at: new Date().toISOString()
      };
      setDemoAssignments([...assignments, nextAssignment]);
      return nextAssignment;
    }

    const dbPayload = {
      teacher_directory_id: payload.teacher_directory_id,
      course_code: payload.course_code,
      course_title: payload.course_title,
      semester: payload.semester,
      section: payload.section,
      academic_term: payload.academic_term || "",
      is_active: payload.is_active
    };

    let query = supabaseClient.from("teacher_assignments");
    query = payload.id
      ? query.update(dbPayload).eq("id", payload.id)
      : query.insert(dbPayload);
    const { data, error } = await query.select("*, teachers_directory(*)").single();
    if (error) {
      throw error;
    }
    return normalizeAssignmentRecord(data);
  }

  async function toggleTeacherStatus(options = {}) {
    const teachers = await loadTeacherDirectory({ useDemo: options.useDemo });
    const teacher = teachers.find((item) => item.id === Number(options.teacherId));
    if (!teacher) {
      throw new Error("Teacher not found.");
    }
    return saveTeacherRecord({
      useDemo: options.useDemo,
      payload: {
        ...teacher,
        status: teacher.status === "active" ? "inactive" : "active"
      }
    });
  }

  async function toggleAssignmentStatus(options = {}) {
    const assignments = await loadAssignments({ useDemo: options.useDemo });
    const assignment = assignments.find((item) => item.id === Number(options.assignmentId));
    if (!assignment) {
      throw new Error("Assignment not found.");
    }
    return saveAssignmentRecord({
      useDemo: options.useDemo,
      payload: {
        ...assignment,
        is_active: !assignment.is_active
      }
    });
  }

  async function saveFeedbackStatus(options = {}) {
    const nextStatus = options.status === "hidden" ? "hidden" : "submitted";
    if (options.useDemo) {
      const feedbacks = getDemoFeedbacks().map((feedback) => (
        String(feedback.id) === String(options.feedbackId)
          ? { ...feedback, status: nextStatus, updated_at: new Date().toISOString() }
          : feedback
      ));
      setDemoFeedbacks(feedbacks);
      return feedbacks.find((item) => String(item.id) === String(options.feedbackId));
    }

    const { data, error } = await supabaseClient
      .from("feedbacks")
      .update({
        status: nextStatus,
        moderated_at: new Date().toISOString(),
        moderated_by: options.profileId || null
      })
      .eq("id", options.feedbackId)
      .select("id, student_id, assignment_id, teacher_directory_id, course_code, course_title, semester, section, responses, comment, is_anonymous, status, submitted_at, updated_at, academic_term, teachers_directory(*)")
      .single();
    if (error) {
      throw error;
    }
    return normalizeFeedbackRecord(data);
  }

  async function submitFeedback(options = {}) {
    const assignment = options.assignment;
    if (!assignment) {
      throw new Error("Assignment is required.");
    }

    const settings = await loadFeedbackSettings({ useDemo: options.useDemo });
    const sanitizedComment = sanitizeComment(options.comment || "");
    const payload = {
      assignment_id: assignment.id,
      teacher_directory_id: assignment.teacher_directory_id,
      student_id: options.profile.id,
      course_code: assignment.course_code,
      course_title: assignment.course_title,
      semester: assignment.semester,
      section: assignment.section,
      academic_term: assignment.academic_term || settings.active_term || "",
      responses: options.responses,
      comment: sanitizedComment,
      is_anonymous: settings.allow_anonymous_feedback ? Boolean(options.is_anonymous) : false,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (options.useDemo) {
      if (!settings.review_window_open) {
        throw new Error("Feedback window is closed.");
      }
      if (
        normalizeLookup(options.profile.semester) !== normalizeLookup(assignment.semester) ||
        normalizeLookup(options.profile.section) !== normalizeLookup(assignment.section)
      ) {
        throw new Error("You cannot review teachers outside your semester and section.");
      }
      const existing = getDemoFeedbacks().find((feedback) => {
        if (feedback.assignment_id) {
          return feedback.student_id === options.profile.id && feedback.assignment_id === assignment.id;
        }
        return feedback.student_id === options.profile.id && buildAssignmentSignature(feedback) === buildAssignmentSignature(assignment);
      });
      if (existing) {
        throw new Error("Feedback already submitted for this teacher assignment.");
      }
      const feedbacks = getDemoFeedbacks();
      const nextRecord = normalizeFeedbackRecord({
        ...payload,
        id: createDemoId("feedback")
      });
      feedbacks.unshift(nextRecord);
      setDemoFeedbacks(feedbacks);
      return nextRecord;
    }

    const { data, error } = await supabaseClient
      .from("feedbacks")
      .insert({
        student_id: payload.student_id,
        assignment_id: payload.assignment_id,
        academic_term: payload.academic_term,
        responses: payload.responses,
        comment: payload.comment || null,
        is_anonymous: payload.is_anonymous
      })
      .select("id, student_id, assignment_id, teacher_directory_id, course_code, course_title, semester, section, responses, comment, is_anonymous, status, submitted_at, updated_at, academic_term, teachers_directory(*)")
      .single();
    if (error) {
      throw error;
    }
    return normalizeFeedbackRecord(data);
  }

  async function loadTeacherProfilePayload(options = {}) {
    const teacherId = Number(options.teacherId);
    if (!teacherId) {
      throw new Error("Teacher id is required.");
    }
    if (options.useDemo) {
      const viewer = options.viewerProfile;
      const teacher = getDemoTeachers().find((item) => item.id === teacherId);
      if (!teacher) {
        throw new Error("Teacher profile not found.");
      }
      const assignments = getDemoAssignments().filter((item) => item.teacher_directory_id === teacherId);
      const allowed = viewer.role === "admin" ||
        (viewer.role === "teacher" && viewer.teacher_directory_id === teacherId) ||
        (viewer.role === "student" && assignments.some((assignment) => (
          assignment.is_active &&
          normalizeLookup(assignment.semester) === normalizeLookup(viewer.semester) &&
          normalizeLookup(assignment.section) === normalizeLookup(viewer.section)
        )));
      if (!allowed) {
        throw new Error("You are not allowed to view this teacher profile.");
      }
      const feedbacks = getDemoFeedbacks().filter((item) => item.teacher_directory_id === teacherId && item.status !== "hidden");
      const stats = buildTeacherStats(feedbacks);
      return {
        teacher,
        assignments: assignments.filter((assignment) => viewer.role === "admin" || assignment.is_active),
        stats: {
          total_reviews: stats.totalReviews,
          average_rating: Number(formatAverage(stats.averageRating)),
          category_breakdown: stats.categoryBreakdownObject
        },
        recent_comments: stats.recentComments
      };
    }

    const { data, error } = await supabaseClient.rpc("get_teacher_profile", {
      p_teacher_id: teacherId
    });
    if (error) {
      throw error;
    }
    return data;
  }

  function renderRatingFields(container, values = {}) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    REVIEW_CATEGORIES.forEach((category) => {
      const wrapper = document.createElement("div");
      wrapper.className = "rating-field";
      wrapper.innerHTML = `
        <label class="form-label fw-semibold" for="rating_${escapeHtml(category.key)}">${escapeHtml(category.label)}</label>
        <select class="form-select" id="rating_${escapeHtml(category.key)}" name="rating_${escapeHtml(category.key)}" required>
          <option value="">Select score</option>
          <option value="1">1 - Very Poor</option>
          <option value="2">2 - Poor</option>
          <option value="3">3 - Fair</option>
          <option value="4">4 - Good</option>
          <option value="5">5 - Excellent</option>
        </select>
        <div class="form-text">Rate this category on a 1 to 5 scale.</div>
      `;
      const select = wrapper.querySelector("select");
      if (values[category.key]) {
        select.value = String(values[category.key]);
      }
      container.appendChild(wrapper);
    });
  }

  function collectRatingValues(form) {
    const ratings = {};
    let missing = false;
    REVIEW_CATEGORIES.forEach((category) => {
      const select = form.querySelector(`[name="rating_${category.key}"]`);
      const value = Number(select?.value || 0);
      select?.classList.remove("is-invalid");
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        missing = true;
        select?.classList.add("is-invalid");
        return;
      }
      ratings[category.key] = value;
    });
    return { ratings, missing };
  }

  function buildFeedbackSummaryCard(assignment) {
    return `
      <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
        <div>
          <h6 class="mb-1">${escapeHtml(assignment.teachers_directory?.name || "Teacher")}</h6>
          <div class="text-muted small">${escapeHtml(assignment.teachers_directory?.designation || "Faculty")} | ${escapeHtml(assignment.course_code)} - ${escapeHtml(assignment.course_title)}</div>
        </div>
        <div class="profile-chip-row">
          <span class="chip">${escapeHtml(assignment.semester)}</span>
          <span class="chip">${escapeHtml(assignment.section)}</span>
          ${assignment.academic_term ? `<span class="chip">${escapeHtml(assignment.academic_term)}</span>` : ""}
        </div>
      </div>
    `;
  }

  function bindStudentAssistant(useDemo) {
    const chatWindow = document.getElementById("aiChatWindow");
    const chatForm = document.getElementById("aiChatForm");
    const chatInput = document.getElementById("aiChatInput");
    const chatSend = document.getElementById("aiChatSend");
    const chatAlert = document.getElementById("aiChatAlert");

    if (!chatWindow || !chatForm || !chatInput) {
      return;
    }

    const chatHistory = [];
    appendChatMessage(chatWindow, "assistant", "Hi! I can help with SFRS rules, feedback steps, and portal questions.");

    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(chatAlert);
      const message = chatInput.value.trim();
      if (!message) {
        return;
      }

      appendChatMessage(chatWindow, "user", message);
      chatHistory.push({ role: "user", content: message });
      chatInput.value = "";
      chatInput.disabled = true;
      if (chatSend) {
        chatSend.disabled = true;
      }

      if (useDemo) {
        appendChatMessage(chatWindow, "assistant", "AI assistant is disabled in demo mode. Log in with a real account to use it.");
      } else {
        try {
          const reply = await invokeAiAssistant({
            type: "chat",
            message,
            history: clampChatHistory(chatHistory.slice(0, -1), 8)
          });
          appendChatMessage(chatWindow, "assistant", reply || "I could not generate a reply.");
          chatHistory.push({ role: "assistant", content: reply || "" });
        } catch (error) {
          showAlert(chatAlert, "danger", error.message || "Unable to reach the AI assistant.");
        }
      }

      chatInput.disabled = false;
      if (chatSend) {
        chatSend.disabled = false;
      }
      chatInput.focus();
    });
  }

  function buildCourseCatalog(assignments) {
    const map = new Map();
    assignments.forEach((assignment) => {
      map.set(assignment.course_code, assignment.course_title);
    });
    ASSIGNMENT_SEED.forEach((assignment) => {
      if (!map.has(assignment.courseCode)) {
        map.set(assignment.courseCode, assignment.courseTitle);
      }
    });
    return Array.from(map.entries())
      .map(([code, title]) => ({ code, title }))
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  function buildStudentTeacherCards(assignments, feedbackLookup, settings) {
    return assignments.map((assignment) => {
      const feedback = findFeedbackForAssignment(feedbackLookup, assignment);
      const submitted = Boolean(feedback);
      const closed = !settings.review_window_open && !submitted;
      const actionLabel = submitted ? "Submitted" : closed ? "Closed" : "Give Feedback";
      return `
        <article class="teacher-assignment-card" data-assignment-id="${assignment.id}">
          <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div class="d-flex align-items-center gap-3">
              <div class="avatar-pill small">${escapeHtml(getInitials(assignment.teachers_directory?.name || "Teacher"))}</div>
              <div>
                <h5 class="mb-1">${escapeHtml(assignment.teachers_directory?.name || "Teacher")}</h5>
                <div class="text-muted small">${escapeHtml(assignment.teachers_directory?.designation || "Faculty")}</div>
              </div>
            </div>
            ${statusBadgeMarkup(submitted ? "submitted" : closed ? "closed" : "active", actionLabel)}
          </div>
          <div class="assignment-code mt-3">${escapeHtml(assignment.course_code)}</div>
          <p class="text-muted small mb-3">${escapeHtml(assignment.course_title)}</p>
          <div class="profile-chip-row mb-3">
            <span class="chip">${escapeHtml(assignment.semester)}</span>
            <span class="chip">${escapeHtml(assignment.section)}</span>
            ${assignment.academic_term ? `<span class="chip">${escapeHtml(assignment.academic_term)}</span>` : ""}
          </div>
          <div class="teacher-card-actions">
            <a class="btn btn-outline-success btn-sm" href="teacher-profile.html?id=${assignment.teacher_directory_id}">View Profile</a>
            <button class="btn ${submitted ? "btn-outline-secondary" : "btn-success"} btn-sm" data-action="feedback" ${submitted || closed ? "disabled" : ""}>
              ${escapeHtml(actionLabel)}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderStudentFeedbackTable(tableBody, feedbacks) {
    if (!tableBody) {
      return;
    }
    tableBody.innerHTML = "";
    if (!feedbacks.length) {
      tableBody.innerHTML = "<tr><td colspan=\"5\" class=\"text-center text-muted\">No feedback submitted yet.</td></tr>";
      return;
    }
    feedbacks.forEach((feedback) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(feedback.teacher_name || "Teacher")}</td>
        <td>${escapeHtml(feedback.course_code)}<div class="small text-muted">${escapeHtml(feedback.course_title)}</div></td>
        <td>${statusBadgeMarkup(feedback.status, feedback.status === "hidden" ? "Hidden" : "Submitted")}</td>
        <td>${escapeHtml(formatDate(feedback.submitted_at))}</td>
        <td><button class="btn btn-sm btn-outline-primary" data-review-id="${escapeHtml(String(feedback.id))}">View</button></td>
      `;
      tableBody.appendChild(row);
    });
  }

  function renderTeacherFeedbackTable(tableBody, feedbacks) {
    if (!tableBody) {
      return;
    }
    tableBody.innerHTML = "";
    if (!feedbacks.length) {
      tableBody.innerHTML = "<tr><td colspan=\"5\" class=\"text-center text-muted\">No feedback received yet.</td></tr>";
      return;
    }
    feedbacks.forEach((feedback) => {
      rowAppend(tableBody, `
        <td>${escapeHtml(feedback.course_code)}<div class="small text-muted">${escapeHtml(feedback.course_title)}</div></td>
        <td>${escapeHtml(feedback.semester)} / ${escapeHtml(feedback.section)}</td>
        <td>${escapeHtml(formatAverage(overallCategoryValue(feedback.responses)))}</td>
        <td>${escapeHtml(formatDate(feedback.submitted_at))}</td>
        <td><button class="btn btn-sm btn-outline-primary" data-review-id="${escapeHtml(String(feedback.id))}">View</button></td>
      `);
    });
  }

  function rowAppend(tableBody, html) {
    const row = document.createElement("tr");
    row.innerHTML = html;
    tableBody.appendChild(row);
  }

  function buildCsvContent(rows) {
    return rows.map((row) => row.map((value) => {
      const normalized = String(value ?? "");
      if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, "\"\"")}"`;
      }
      return normalized;
    }).join(",")).join("\n");
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function wireReviewModal(tableBody, feedbacks, hideStudent) {
    if (!tableBody) {
      return;
    }
    tableBody.onclick = (event) => {
      const button = event.target.closest("[data-review-id]");
      if (!button) {
        return;
      }
      const review = feedbacks.find((item) => String(item.id) === String(button.dataset.reviewId));
      openReviewModal(review, hideStudent);
    };
  }

  async function initRoleLogin(config) {
    const form = document.getElementById(config.formId);
    if (!form) {
      return;
    }
    const alertBox = document.getElementById(config.alertId);
    redirectIfAuthenticated();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(alertBox);
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
      }

      const identifier = normalizeIdentifier(form.querySelector("[name=\"email\"]")?.value || "");
      const password = form.querySelector("[name=\"password\"]")?.value || "";

      if (isDemoCredential(identifier, password)) {
        setDemoSession(config.role);
        window.location.href = config.target;
        return;
      }

      if (!isEmail(identifier)) {
        showAlert(alertBox, "warning", "Enter a valid email address or use the demo credentials.");
        return;
      }

      clearDemoSession();
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: identifier,
        password
      });
      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      try {
        const result = await getProfile();
        if (!result?.profile) {
          await supabaseClient.auth.signOut();
          showAlert(alertBox, "warning", "Profile not found. Please sign up or provision the profile first.");
          return;
        }
        if (result.profile.role !== config.role) {
          await supabaseClient.auth.signOut();
          showAlert(alertBox, "warning", `This account is not registered as ${config.role}.`);
          return;
        }
        window.location.href = config.target;
      } catch (error) {
        showAlert(alertBox, "danger", getSetupMessage(error, "Unable to load profile."));
      }
    });
  }

  function normalizeIdentifier(value) {
    return String(value || "").trim().toLowerCase();
  }

  function initStudentLogin() {
    return initRoleLogin({
      formId: "studentLoginForm",
      alertId: "studentLoginAlert",
      role: "student",
      target: "student-dashboard.html"
    });
  }

  function initTeacherLogin() {
    return initRoleLogin({
      formId: "teacherLoginForm",
      alertId: "teacherLoginAlert",
      role: "teacher",
      target: "teacher-dashboard.html"
    });
  }

  function initAdminLogin() {
    return initRoleLogin({
      formId: "adminLoginForm",
      alertId: "adminLoginAlert",
      role: "admin",
      target: "admin-dashboard.html"
    });
  }

  function initPasswordReset() {
    const requestSection = document.getElementById("resetRequestSection");
    const updateSection = document.getElementById("resetUpdateSection");
    const requestForm = document.getElementById("resetRequestForm");
    const updateForm = document.getElementById("resetUpdateForm");
    const requestAlert = document.getElementById("resetRequestAlert");
    const updateAlert = document.getElementById("resetUpdateAlert");

    if (!requestSection || !updateSection) {
      return;
    }

    const showRequestSection = () => {
      requestSection.classList.remove("d-none");
      updateSection.classList.add("d-none");
    };
    const showUpdateSection = () => {
      requestSection.classList.add("d-none");
      updateSection.classList.remove("d-none");
    };

    if (window.location.hash.includes("type=recovery")) {
      showUpdateSection();
    } else {
      showRequestSection();
    }

    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        showUpdateSection();
      }
    });

    requestForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(requestAlert);
      if (!requestForm.checkValidity()) {
        requestForm.classList.add("was-validated");
        return;
      }
      const email = normalizeEmail(requestForm.email.value);
      if (!isEmail(email)) {
        showAlert(requestAlert, "warning", "Please enter a valid email address.");
        return;
      }
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href.split("#")[0]
      });
      if (error) {
        showAlert(requestAlert, "danger", error.message);
        return;
      }
      requestForm.reset();
      showAlert(requestAlert, "success", "Check your email for the password reset link.");
    });

    updateForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(updateAlert);
      if (!updateForm.checkValidity()) {
        updateForm.classList.add("was-validated");
        return;
      }
      if (updateForm.password.value !== updateForm.confirmPassword.value) {
        showAlert(updateAlert, "warning", "Passwords do not match.");
        return;
      }
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !sessionData.session) {
        showAlert(updateAlert, "warning", "Reset link is invalid or expired. Request a new one.");
        showRequestSection();
        return;
      }
      const { error } = await supabaseClient.auth.updateUser({ password: updateForm.password.value });
      if (error) {
        showAlert(updateAlert, "danger", error.message);
        return;
      }
      showAlert(updateAlert, "success", "Password updated. Please log in.");
      await supabaseClient.auth.signOut().catch(() => {});
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1200);
    });
  }

  function populateStudentSignupOptions(form) {
    populateValueSelect(form.querySelector("[name=\"semester\"]"), REVIEW_SEMESTERS, "Select semester");
    populateValueSelect(form.querySelector("[name=\"section\"]"), REVIEW_SECTIONS, "Select section");
  }

  function extractStudentSectionField(form) {
    const field = form.querySelector("[name=\"section\"]");
    return normalizeSectionValue(field?.value || "");
  }

  function initStudentSignup() {
    const form = document.getElementById("studentSignupForm");
    if (!form) {
      return;
    }
    const alertBox = document.getElementById("studentSignupAlert");
    populateStudentSignupOptions(form);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(alertBox);
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
      }
      if (form.password.value !== form.confirmPassword.value) {
        showAlert(alertBox, "warning", "Passwords do not match.");
        return;
      }

      const email = normalizeEmail(form.email.value);
      const metadata = {
        role: "student",
        full_name: form.fullName.value.trim(),
        student_id: form.studentId.value.trim(),
        email,
        department: form.department.value.trim(),
        program: form.program.value.trim(),
        semester: normalizeSemesterValue(form.semester.value),
        section: extractStudentSectionField(form)
      };

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: form.password.value,
        options: { data: metadata }
      });
      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      if (!data.session) {
        showAlert(alertBox, "info", "Check your email to confirm your account, then log in.");
        setTimeout(() => {
          window.location.href = "student-login.html";
        }, 1400);
        return;
      }

      try {
        await supabaseClient.from("profiles").upsert({
          id: data.user.id,
          role: "student",
          full_name: metadata.full_name,
          student_id: metadata.student_id,
          email,
          department: metadata.department,
          program: metadata.program,
          semester: metadata.semester,
          section: metadata.section
        }, { onConflict: "id" });
      } catch (profileError) {
        showAlert(alertBox, "danger", getSetupMessage(profileError, "Unable to create student profile."));
        return;
      }

      showAlert(alertBox, "success", "Registration complete. Please log in.");
      await supabaseClient.auth.signOut().catch(() => {});
      setTimeout(() => {
        window.location.href = "student-login.html";
      }, 1200);
    });
  }

  async function initTeacherSignup() {
    const form = document.getElementById("teacherSignupForm");
    if (!form) {
      return;
    }
    const alertBox = document.getElementById("teacherSignupAlert");
    const selectEl = document.getElementById("teacherSelect");
    const designationEl = document.getElementById("teacherDesignation");
    const emailEl = document.getElementById("teacherEmail");

    let teachers = [];
    try {
      teachers = await loadTeacherDirectory();
    } catch (error) {
      showAlert(alertBox, "danger", getSetupMessage(error, "Unable to load teacher directory."));
      return;
    }

    populateTeacherSelect(selectEl, teachers, "Select a teacher");

    const updateFields = () => {
      const teacher = teachers.find((item) => String(item.id) === String(selectEl.value));
      if (!teacher) {
        designationEl.value = "";
        emailEl.value = "";
        emailEl.readOnly = false;
        return;
      }
      designationEl.value = teacher.designation || "Lecturer";
      emailEl.value = teacher.email || "";
      emailEl.readOnly = Boolean(teacher.email);
    };

    updateFields();
    selectEl.addEventListener("change", updateFields);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(alertBox);
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
      }
      if (form.password.value !== form.confirmPassword.value) {
        showAlert(alertBox, "warning", "Passwords do not match.");
        return;
      }

      const teacher = teachers.find((item) => String(item.id) === String(selectEl.value));
      if (!teacher) {
        showAlert(alertBox, "warning", "Please select a teacher from the list.");
        return;
      }

      const email = normalizeEmail(emailEl.value);
      if (teacher.email && email !== teacher.email) {
        showAlert(alertBox, "warning", "Use the official email listed for this teacher.");
        return;
      }

      const metadata = {
        role: "teacher",
        full_name: teacher.name,
        email,
        designation: teacher.designation,
        teacher_directory_id: teacher.id
      };

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: form.password.value,
        options: { data: metadata }
      });
      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      if (!data.session) {
        showAlert(alertBox, "info", "Check your email to confirm your account, then log in.");
        setTimeout(() => {
          window.location.href = "teacher-login.html";
        }, 1400);
        return;
      }

      try {
        await supabaseClient.from("profiles").upsert({
          id: data.user.id,
          role: "teacher",
          full_name: teacher.name,
          email,
          designation: teacher.designation,
          teacher_directory_id: teacher.id
        }, { onConflict: "id" });
      } catch (profileError) {
        showAlert(alertBox, "danger", getSetupMessage(profileError, "Unable to create teacher profile."));
        return;
      }

      showAlert(alertBox, "success", "Registration complete. Please log in.");
      await supabaseClient.auth.signOut().catch(() => {});
      setTimeout(() => {
        window.location.href = "teacher-login.html";
      }, 1200);
    });
  }

  async function initStudentDashboard() {
    const authData = await requireRole("student", "student-login.html");
    if (!authData) {
      return;
    }

    const { profile, demo: useDemo } = authData;
    const alertBox = document.getElementById("studentAssignmentsAlert");
    const grid = document.getElementById("studentAssignmentsGrid");
    const emptyState = document.getElementById("studentAssignmentsEmpty");
    const searchInput = document.getElementById("teacherSearchInput");
    const courseFilter = document.getElementById("courseFilterSelect");
    const feedbackModal = document.getElementById("feedbackModal");
    const feedbackForm = document.getElementById("feedbackForm");
    const feedbackFormAlert = document.getElementById("feedbackFormAlert");
    const feedbackSummary = document.querySelector("[data-feedback-assignment-summary]");
    const feedbackAssignmentId = document.getElementById("feedbackAssignmentId");
    const feedbackComment = document.getElementById("feedbackComment");
    const feedbackAnonymous = document.getElementById("feedbackAnonymous");
    const anonymousWrapper = document.querySelector("[data-anonymous-wrapper]");
    const feedbackSubmitBtn = document.getElementById("feedbackSubmitBtn");
    const studentReviewsBody = document.getElementById("studentReviewsBody");

    setText("[data-user-name]", profile.full_name);
    setText("[data-user-id]", profile.student_id);
    setText("[data-user-program]", `${profile.program || DEFAULT_PROGRAM} | ${profile.semester} | ${profile.section}`);
    setText("[data-student-semester-badge]", profile.semester);
    setText("[data-student-section-badge]", `Section ${profile.section}`);

    bindStudentAssistant(useDemo);

    let settings;
    let assignments;
    let feedbacks;
    try {
      [settings, assignments, feedbacks] = await Promise.all([
        loadFeedbackSettings({ useDemo }),
        loadAssignments({
          useDemo,
          filters: {
            semester: normalizeSemesterValue(profile.semester),
            section: normalizeSectionValue(profile.section),
            is_active: true
          }
        }),
        loadFeedbacks({
          useDemo,
          filters: {
            student_id: profile.id
          }
        })
      ]);
    } catch (error) {
      showAlert(alertBox, "danger", getSetupMessage(error, "Unable to load your course teachers."));
      return;
    }

    const feedbackLookup = buildFeedbackLookup(feedbacks);
    const submittedAssignments = assignments.filter((assignment) => Boolean(findFeedbackForAssignment(feedbackLookup, assignment)));
    const submittedCount = submittedAssignments.length;
    const totalAssigned = assignments.length;
    const pendingCount = settings.review_window_open ? Math.max(totalAssigned - submittedCount, 0) : 0;
    const closedCount = settings.review_window_open ? 0 : Math.max(totalAssigned - submittedCount, 0);

    setText("[data-stat-total-assigned]", String(totalAssigned));
    setText("[data-stat-pending]", String(pendingCount));
    setText("[data-stat-submitted]", String(submittedCount));
    setText("[data-stat-closed]", String(closedCount));

    populateValueSelect(
      courseFilter,
      Array.from(new Set(assignments.map((item) => item.course_code))).sort(),
      "All courses"
    );

    const renderCards = () => {
      const searchValue = normalizeLookup(searchInput?.value || "");
      const selectedCourse = courseFilter?.value || "";
      const filteredAssignments = assignments.filter((assignment) => {
        if (selectedCourse && assignment.course_code !== selectedCourse) {
          return false;
        }
        if (!searchValue) {
          return true;
        }
        const teacherName = assignment.teachers_directory?.name || "";
        return [teacherName, assignment.course_code, assignment.course_title]
          .some((value) => normalizeLookup(value).includes(searchValue));
      });

      grid.innerHTML = buildStudentTeacherCards(filteredAssignments, feedbackLookup, settings);
      emptyState.classList.toggle("d-none", Boolean(filteredAssignments.length));

      grid.onclick = (event) => {
        const button = event.target.closest("[data-action=\"feedback\"]");
        const card = event.target.closest("[data-assignment-id]");
        if (!card) {
          return;
        }
        const assignment = assignments.find((item) => String(item.id) === String(card.dataset.assignmentId));
        if (!assignment) {
          return;
        }
        if (!button) {
          return;
        }
        clearAlert(feedbackFormAlert);
        feedbackForm.reset();
        feedbackForm.classList.remove("was-validated");
        feedbackAssignmentId.value = assignment.id;
        feedbackSummary.innerHTML = buildFeedbackSummaryCard(assignment);
        renderRatingFields(document.getElementById("feedbackRatingsContainer"));
        feedbackComment.value = "";
        feedbackAnonymous.checked = true;
        anonymousWrapper?.classList.toggle("d-none", !settings.allow_anonymous_feedback);
        if (!settings.allow_anonymous_feedback) {
          feedbackAnonymous.checked = false;
        }
        window.bootstrap?.Modal.getOrCreateInstance(feedbackModal).show();
      };
    };

    renderCards();

    if (searchInput) {
      searchInput.addEventListener("input", renderCards);
    }
    if (courseFilter) {
      courseFilter.addEventListener("change", renderCards);
    }

    renderStudentFeedbackTable(studentReviewsBody, feedbacks);
    wireReviewModal(studentReviewsBody, feedbacks, true);

    feedbackForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(feedbackFormAlert);
      const assignment = assignments.find((item) => String(item.id) === String(feedbackAssignmentId.value));
      if (!assignment) {
        showAlert(feedbackFormAlert, "warning", "Please select a valid teacher assignment.");
        return;
      }
      const { ratings, missing } = collectRatingValues(feedbackForm);
      if (missing) {
        showAlert(feedbackFormAlert, "warning", "Please rate every category before submitting.");
        return;
      }

      setButtonLoading(feedbackSubmitBtn, true, "Submitting...");
      try {
        const newFeedback = await submitFeedback({
          useDemo,
          profile,
          assignment,
          responses: ratings,
          comment: feedbackComment.value,
          is_anonymous: feedbackAnonymous.checked
        });
        feedbacks = [newFeedback, ...feedbacks];
        const nextLookup = buildFeedbackLookup(feedbacks);
        const nextSubmittedCount = assignments.filter((item) => Boolean(findFeedbackForAssignment(nextLookup, item))).length;
        setText("[data-stat-pending]", settings.review_window_open ? String(Math.max(totalAssigned - nextSubmittedCount, 0)) : "0");
        setText("[data-stat-submitted]", String(nextSubmittedCount));
        feedbackSummary.innerHTML = "";
        renderStudentFeedbackTable(studentReviewsBody, feedbacks);
        wireReviewModal(studentReviewsBody, feedbacks, true);
        window.bootstrap?.Modal.getOrCreateInstance(feedbackModal).hide();
        showToast("success", "Feedback submitted successfully.");
        feedbackLookup.clear();
        nextLookup.forEach((value, key) => feedbackLookup.set(key, value));
        renderCards();
      } catch (error) {
        showAlert(feedbackFormAlert, "danger", getSetupMessage(error, "Unable to submit feedback."));
      } finally {
        setButtonLoading(feedbackSubmitBtn, false, "Submitting...");
      }
    });
  }

  async function initTeacherDashboard() {
    const authData = await requireRole("teacher", "teacher-login.html");
    if (!authData) {
      return;
    }

    const { profile, demo: useDemo } = authData;
    const alertBox = document.getElementById("teacherDashboardAlert");

    if (!profile.teacher_directory_id) {
      showAlert(alertBox, "danger", "Teacher profile is not linked to a directory record yet.");
      return;
    }

    let profilePayload;
    let feedbacks;
    try {
      [profilePayload, feedbacks] = await Promise.all([
        loadTeacherProfilePayload({
          useDemo,
          teacherId: profile.teacher_directory_id,
          viewerProfile: profile
        }),
        loadFeedbacks({
          useDemo,
          filters: {
            teacher_directory_id: profile.teacher_directory_id,
            exclude_hidden: true
          }
        })
      ]);
    } catch (error) {
      showAlert(alertBox, "danger", getSetupMessage(error, "Unable to load teacher dashboard."));
      return;
    }

    const teacher = normalizeTeacherRecord(profilePayload.teacher || {});
    const assignments = (profilePayload.assignments || []).map(normalizeAssignmentRecord);
    const stats = buildTeacherStats(feedbacks);

    setAvatar(document.querySelector("[data-user-avatar]"), teacher.name, teacher.avatar_url);
    setText("[data-user-name]", teacher.name);
    setText("[data-user-role]", teacher.designation || profile.designation || "Faculty");
    setText("[data-user-email]", teacher.email || profile.email || "No email listed");
    setText("[data-user-department]", teacher.department || DEFAULT_DEPARTMENT);
    setText("[data-user-short-code]", teacher.short_code || "Teacher Profile");
    setText("[data-profile-average]", formatAverage(stats.averageRating));
    setText("[data-profile-count]", String(stats.totalReviews));
    setText("[data-assignment-count]", String(assignments.filter((item) => item.is_active).length));
    setText("[data-comment-count]", String(stats.visibleCommentCount));
    setText("[data-user-bio]", teacher.bio || "No teacher bio added yet.");
    setText("[data-contact-email]", teacher.email || "Not shared");
    setText("[data-contact-phone]", teacher.phone || "Not listed");
    setText("[data-contact-office]", teacher.office_room || "Not listed");
    const statusEl = document.querySelector("[data-teacher-status]");
    if (statusEl) {
      statusEl.className = `status-badge ${teacher.status === "inactive" ? "inactive" : "active"}`;
      statusEl.textContent = teacher.status === "inactive" ? "Inactive" : "Active";
    }

    const chipStack = document.querySelector("[data-assignment-chip-stack]");
    if (chipStack) {
      chipStack.innerHTML = assignments.length
        ? assignments.map((assignment) => `
            <span class="chip">
              ${escapeHtml(assignment.course_code)} | ${escapeHtml(assignment.semester)} / ${escapeHtml(assignment.section)}
            </span>
          `).join("")
        : "<span class=\"text-muted\">No active assignments found.</span>";
    }

    renderCategoryBreakdown(document.querySelector("[data-category-breakdown]"), stats.categoryBreakdown);
    renderCommentStack(document.querySelector("[data-comment-list]"), stats.recentComments, "No visible comments yet.");
    setText("#totalReviews", String(stats.totalReviews));
    setText("#averageScore", formatAverage(stats.averageRating));

    const tableBody = document.getElementById("teacherReviewsBody");
    renderTeacherFeedbackTable(tableBody, feedbacks);
    wireReviewModal(tableBody, feedbacks, true);

    const profileLink = document.getElementById("teacherProfileLink");
    if (profileLink) {
      profileLink.href = `teacher-profile.html?id=${teacher.id}`;
    }

    const aiSummaryBtn = document.getElementById("aiSummaryBtn");
    const aiSummaryResult = document.getElementById("aiSummaryResult");
    const aiSummaryAlert = document.getElementById("aiSummaryAlert");
    if (aiSummaryResult && !feedbacks.length) {
      aiSummaryResult.textContent = "No feedback available yet.";
    }
    aiSummaryBtn?.addEventListener("click", async () => {
      clearAlert(aiSummaryAlert);
      if (!feedbacks.length) {
        setText(aiSummaryResult, "No feedback available yet.");
        return;
      }
      if (useDemo) {
        showAlert(aiSummaryAlert, "warning", "AI summary is disabled in demo mode. Please log in with a real account.");
        return;
      }
      setButtonLoading(aiSummaryBtn, true, "Generating...");
      setText(aiSummaryResult, "Generating summary...");
      try {
        const result = await invokeAiAssistant({
          type: "summary",
          payload: {
            teacher_name: teacher.name,
            review_count: stats.totalReviews,
            overall_average: formatAverage(stats.averageRating),
            category_breakdown: stats.categoryBreakdownObject,
            course_stats: stats.courseStats.slice(0, 6),
            recent_comments: stats.recentComments.map((comment) => ({
              course_code: comment.course_code,
              comment: comment.comment
            }))
          }
        });
        setText(aiSummaryResult, result || "No summary returned.");
      } catch (error) {
        showAlert(aiSummaryAlert, "danger", error.message || "Unable to generate AI summary.");
        setText(aiSummaryResult, "Unable to generate summary.");
      } finally {
        setButtonLoading(aiSummaryBtn, false, "Generating...");
      }
    });
  }

  async function initTeacherProfile() {
    const authData = await requireAnyRole(["student", "teacher", "admin"], "index.html");
    if (!authData) {
      return;
    }
    const { profile, demo: useDemo } = authData;
    const alertBox = document.getElementById("teacherProfileAlert");
    const backButton = document.querySelector("[data-teacher-profile-back]");
    const params = new URLSearchParams(window.location.search);
    const teacherId = Number(params.get("id") || profile.teacher_directory_id || "");

    backButton?.addEventListener("click", (event) => {
      event.preventDefault();
      const fallback = DASHBOARD_ROUTES[profile.role] || "index.html";
      if (document.referrer) {
        try {
          const referrer = new URL(document.referrer);
          if (referrer.origin === window.location.origin) {
            window.history.back();
            return;
          }
        } catch (error) {
          // Ignore malformed referrer and use fallback.
        }
      }
      window.location.href = fallback;
    });

    if (!teacherId) {
      showAlert(alertBox, "warning", profile.role === "teacher"
        ? "No teacher directory record is linked to your account."
        : "Open this page from a teacher card to view a profile.");
      return;
    }

    let payload;
    try {
      payload = await loadTeacherProfilePayload({
        useDemo,
        teacherId,
        viewerProfile: profile
      });
    } catch (error) {
      showAlert(alertBox, "danger", getSetupMessage(error, "Unable to load the teacher profile."));
      return;
    }

    const teacher = normalizeTeacherRecord(payload.teacher || {});
    const assignments = (payload.assignments || []).map(normalizeAssignmentRecord);
    const stats = payload.stats || {};
    const breakdown = REVIEW_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      average: Number(stats.category_breakdown?.[category.key]) || 0
    }));

    setAvatar(document.querySelector("[data-profile-avatar]"), teacher.name, teacher.avatar_url);
    setText("[data-profile-name]", teacher.name);
    setText("[data-profile-designation]", teacher.designation || "Faculty");
    setText("[data-profile-department]", teacher.department || DEFAULT_DEPARTMENT);
    setText("[data-profile-short-code]", teacher.short_code || "Teacher Profile");
    const statusEl = document.querySelector("[data-profile-status]");
    if (statusEl) {
      statusEl.className = `chip ${teacher.status === "inactive" ? "chip-muted" : ""}`;
      statusEl.textContent = teacher.status === "inactive" ? "Inactive" : "Active";
    }
    setText("[data-profile-average]", formatAverage(stats.average_rating));
    setText("[data-profile-review-count]", String(Number(stats.total_reviews) || 0));
    setText("[data-profile-bio]", teacher.bio || "No teacher bio added yet.");
    setText("[data-profile-email]", teacher.email || "Not shared");
    setText("[data-profile-phone]", teacher.phone || "Not listed");
    setText("[data-profile-office]", teacher.office_room || "Not listed");

    const assignmentList = document.querySelector("[data-profile-assignment-list]");
    if (assignmentList) {
      assignmentList.innerHTML = assignments.length
        ? assignments.map((assignment) => `
            <span class="chip">
              ${escapeHtml(assignment.course_code)} | ${escapeHtml(assignment.semester)} / ${escapeHtml(assignment.section)}
            </span>
          `).join("")
        : "<span class=\"text-muted\">No assignments available.</span>";
    }

    renderCategoryBreakdown(document.querySelector("[data-profile-rating-breakdown]"), breakdown);
    renderCommentStack(
      document.querySelector("[data-profile-comment-list]"),
      (payload.recent_comments || []).map((item) => ({
        ...item,
        comment: sanitizeComment(item.comment || "")
      })),
      "No visible comments yet."
    );
  }

  async function initAdminDashboard() {
    const authData = await requireRole("admin", "admin-login.html");
    if (!authData) {
      return;
    }

    const { profile, demo: useDemo } = authData;
    const dashboardAlert = document.getElementById("adminDashboardAlert");
    const settingsForm = document.getElementById("feedbackSettingsForm");
    const teacherSearchFilter = document.getElementById("teacherSearchFilter");
    const teacherStatusFilter = document.getElementById("teacherStatusFilter");
    const teacherBody = document.getElementById("adminTeacherBody");
    const teacherForm = document.getElementById("teacherForm");
    const teacherFormAlert = document.getElementById("teacherFormAlert");
    const assignmentBody = document.getElementById("adminAssignmentBody");
    const assignmentForm = document.getElementById("assignmentForm");
    const assignmentFormAlert = document.getElementById("assignmentFormAlert");
    const feedbackBody = document.getElementById("adminFeedbackBody");
    const exportFeedbackBtn = document.getElementById("exportFeedbackBtn");

    const teacherModal = window.bootstrap?.Modal.getOrCreateInstance(document.getElementById("teacherModal"));
    const assignmentModal = window.bootstrap?.Modal.getOrCreateInstance(document.getElementById("assignmentModal"));

    const state = {
      settings: DEFAULT_FEEDBACK_SETTINGS,
      teachers: [],
      assignments: [],
      feedbacks: []
    };
    let lastRenderedAnalyticsFeedbacks = [];
    bindCourseAutoFill(() => buildCourseCatalog(state.assignments));

    function fillStaticOptions() {
      populateValueSelect(document.getElementById("assignmentSemesterFilter"), REVIEW_SEMESTERS, "All semesters");
      populateValueSelect(document.getElementById("assignmentSectionFilter"), REVIEW_SECTIONS, "All sections");
      populateValueSelect(document.getElementById("analyticsSemesterFilter"), REVIEW_SEMESTERS, "All semesters");
      populateValueSelect(document.getElementById("analyticsSectionFilter"), REVIEW_SECTIONS, "All sections");
      populateValueSelect(document.getElementById("assignmentSemesterInput"), REVIEW_SEMESTERS, "Select semester");
      populateValueSelect(document.getElementById("assignmentSectionInput"), REVIEW_SECTIONS, "Select section");
    }

    function populateTeacherDrivenOptions() {
      const teachers = state.teachers.slice().sort((left, right) => left.name.localeCompare(right.name));
      populateTeacherSelect(
        document.getElementById("assignmentTeacherFilter"),
        teachers,
        "All teachers",
        document.getElementById("assignmentTeacherFilter")?.value || ""
      );
      populateTeacherSelect(
        document.getElementById("analyticsTeacherFilter"),
        teachers,
        "All teachers",
        document.getElementById("analyticsTeacherFilter")?.value || ""
      );
      populateTeacherSelect(
        document.getElementById("assignmentTeacherInput"),
        teachers,
        "Select teacher",
        document.getElementById("assignmentTeacherInput")?.value || ""
      );

      const courseList = document.getElementById("courseCodeList");
      if (courseList) {
        courseList.innerHTML = buildCourseCatalog(state.assignments).map((course) => (
          `<option value="${escapeHtml(course.code)}">${escapeHtml(course.code)} - ${escapeHtml(course.title)}</option>`
        )).join("");
      }
    }

    function renderSummaryCards() {
      setText("[data-admin-total-teachers]", String(state.teachers.length));
      setText("[data-admin-total-assignments]", String(state.assignments.filter((item) => item.is_active).length));
      setText("[data-admin-total-feedback]", String(state.feedbacks.length));
      setText("[data-admin-hidden-feedback]", String(state.feedbacks.filter((item) => item.status === "hidden").length));
      setText("[data-admin-active-term]", state.settings.active_term);

      if (settingsForm) {
        settingsForm.activeTerm.value = state.settings.active_term;
        settingsForm.reviewWindow.checked = state.settings.review_window_open;
        settingsForm.anonymous.checked = state.settings.allow_anonymous_feedback;
      }
    }

    function openTeacherEditor(teacher) {
      clearAlert(teacherFormAlert);
      teacherForm.reset();
      teacherForm.classList.remove("was-validated");
      const record = teacher || {};
      document.getElementById("teacherRecordId").value = record.id || "";
      document.getElementById("teacherNameInput").value = record.name || "";
      document.getElementById("teacherCodeInput").value = record.short_code || "";
      document.getElementById("teacherDesignationInput").value = record.designation || "Lecturer";
      document.getElementById("teacherDepartmentInput").value = record.department || DEFAULT_DEPARTMENT;
      document.getElementById("teacherEmailInput").value = record.email || "";
      document.getElementById("teacherPhoneInput").value = record.phone || "";
      document.getElementById("teacherOfficeInput").value = record.office_room || "";
      document.getElementById("teacherAvatarInput").value = record.avatar_url || "";
      document.getElementById("teacherStatusInput").value = record.status || "active";
      document.getElementById("teacherEmailPublicInput").checked = Boolean(record.is_email_public);
      document.getElementById("teacherBioInput").value = record.bio || "";
      teacherModal?.show();
    }

    function openAssignmentEditor(assignment) {
      clearAlert(assignmentFormAlert);
      assignmentForm.reset();
      assignmentForm.classList.remove("was-validated");
      const record = assignment || {};
      document.getElementById("assignmentRecordId").value = record.id || "";
      document.getElementById("assignmentTeacherInput").value = record.teacher_directory_id || "";
      document.getElementById("assignmentCourseCodeInput").value = record.course_code || "";
      document.getElementById("assignmentCourseTitleInput").value = record.course_title || "";
      document.getElementById("assignmentSemesterInput").value = record.semester || "";
      document.getElementById("assignmentSectionInput").value = record.section || "";
      document.getElementById("assignmentTermInput").value = record.academic_term || state.settings.active_term || "";
      document.getElementById("assignmentActiveInput").checked = record.is_active ?? true;
      assignmentModal?.show();
    }

    function renderTeacherTable() {
      const searchValue = normalizeLookup(teacherSearchFilter?.value || "");
      const statusValue = teacherStatusFilter?.value || "";
      const assignmentCounts = state.assignments.reduce((accumulator, assignment) => {
        if (!assignment.is_active) {
          return accumulator;
        }
        accumulator.set(
          assignment.teacher_directory_id,
          (accumulator.get(assignment.teacher_directory_id) || 0) + 1
        );
        return accumulator;
      }, new Map());

      const filteredTeachers = state.teachers.filter((teacher) => {
        if (statusValue && teacher.status !== statusValue) {
          return false;
        }
        if (!searchValue) {
          return true;
        }
        return [teacher.name, teacher.short_code, teacher.email]
          .some((value) => normalizeLookup(value).includes(searchValue));
      });

      teacherBody.innerHTML = "";
      if (!filteredTeachers.length) {
        teacherBody.innerHTML = "<tr><td colspan=\"5\" class=\"text-center text-muted\">No teacher matches the current filters.</td></tr>";
        return;
      }
      filteredTeachers.forEach((teacher) => {
        rowAppend(teacherBody, `
          <td>
            <div class="fw-semibold">${escapeHtml(teacher.name)}</div>
            <div class="small text-muted">${escapeHtml(teacher.designation)}</div>
          </td>
          <td>
            <div>${escapeHtml(teacher.email || "No email")}</div>
            <div class="small text-muted">${escapeHtml(teacher.department)}</div>
          </td>
          <td>${statusBadgeMarkup(teacher.status, teacher.status === "inactive" ? "Inactive" : "Active")}</td>
          <td>${escapeHtml(String(assignmentCounts.get(teacher.id) || 0))}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-outline-primary" data-action="view-profile" data-teacher-id="${teacher.id}">View</button>
            <button class="btn btn-sm btn-outline-success" data-action="edit-teacher" data-teacher-id="${teacher.id}">Edit</button>
            <button class="btn btn-sm btn-outline-secondary" data-action="toggle-teacher" data-teacher-id="${teacher.id}">
              ${teacher.status === "active" ? "Deactivate" : "Activate"}
            </button>
          </td>
        `);
      });
    }

    function renderAssignmentTable() {
      const semesterFilter = document.getElementById("assignmentSemesterFilter")?.value || "";
      const sectionFilter = document.getElementById("assignmentSectionFilter")?.value || "";
      const teacherFilter = document.getElementById("assignmentTeacherFilter")?.value || "";
      const courseFilter = normalizeLookup(document.getElementById("assignmentCourseFilter")?.value || "");

      const filteredAssignments = state.assignments.filter((assignment) => {
        if (semesterFilter && assignment.semester !== semesterFilter) {
          return false;
        }
        if (sectionFilter && assignment.section !== sectionFilter) {
          return false;
        }
        if (teacherFilter && String(assignment.teacher_directory_id) !== String(teacherFilter)) {
          return false;
        }
        if (!courseFilter) {
          return true;
        }
        return [assignment.course_code, assignment.course_title]
          .some((value) => normalizeLookup(value).includes(courseFilter));
      });

      assignmentBody.innerHTML = "";
      if (!filteredAssignments.length) {
        assignmentBody.innerHTML = "<tr><td colspan=\"6\" class=\"text-center text-muted\">No assignment matches the current filters.</td></tr>";
        return;
      }
      filteredAssignments.forEach((assignment) => {
        rowAppend(assignmentBody, `
          <td>${escapeHtml(assignment.teachers_directory?.name || "Teacher")}</td>
          <td>${escapeHtml(assignment.course_code)}<div class="small text-muted">${escapeHtml(assignment.course_title)}</div></td>
          <td>${escapeHtml(assignment.semester)} / ${escapeHtml(assignment.section)}</td>
          <td>${escapeHtml(assignment.academic_term || "-")}</td>
          <td>${statusBadgeMarkup(assignment.is_active ? "active" : "inactive", assignment.is_active ? "Active" : "Inactive")}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-outline-success" data-action="edit-assignment" data-assignment-id="${assignment.id}">Edit</button>
            <button class="btn btn-sm btn-outline-secondary" data-action="toggle-assignment" data-assignment-id="${assignment.id}">
              ${assignment.is_active ? "Deactivate" : "Activate"}
            </button>
          </td>
        `);
      });
    }

    function filteredAnalyticsFeedbacks() {
      const teacherFilter = document.getElementById("analyticsTeacherFilter")?.value || "";
      const semesterFilter = document.getElementById("analyticsSemesterFilter")?.value || "";
      const sectionFilter = document.getElementById("analyticsSectionFilter")?.value || "";
      const statusFilter = document.getElementById("analyticsStatusFilter")?.value || "";
      const courseFilter = normalizeLookup(document.getElementById("analyticsCourseFilter")?.value || "");

      return state.feedbacks.filter((feedback) => {
        if (teacherFilter && String(feedback.teacher_directory_id) !== String(teacherFilter)) {
          return false;
        }
        if (semesterFilter && feedback.semester !== semesterFilter) {
          return false;
        }
        if (sectionFilter && feedback.section !== sectionFilter) {
          return false;
        }
        if (statusFilter && feedback.status !== statusFilter) {
          return false;
        }
        if (!courseFilter) {
          return true;
        }
        return [feedback.course_code, feedback.course_title]
          .some((value) => normalizeLookup(value).includes(courseFilter));
      });
    }

    function renderFeedbackAnalytics() {
      const filteredFeedbacks = filteredAnalyticsFeedbacks();
      lastRenderedAnalyticsFeedbacks = filteredFeedbacks;
      const visibleComments = filteredFeedbacks.filter((item) => item.comment && item.status !== "hidden");
      const overallValues = filteredFeedbacks.map((item) => overallCategoryValue(item.responses)).filter((item) => item > 0);
      const averageOverall = overallValues.length
        ? overallValues.reduce((total, value) => total + value, 0) / overallValues.length
        : 0;

      setText("[data-analytics-total]", String(filteredFeedbacks.length));
      setText("[data-analytics-average]", formatAverage(averageOverall));
      setText("[data-analytics-comments]", String(visibleComments.length));

      feedbackBody.innerHTML = "";
      if (!filteredFeedbacks.length) {
        feedbackBody.innerHTML = "<tr><td colspan=\"8\" class=\"text-center text-muted\">No feedback matches the current filters.</td></tr>";
        return;
      }

      filteredFeedbacks.forEach((feedback) => {
        rowAppend(feedbackBody, `
          <td>${escapeHtml(feedback.teacher_name || "Teacher")}</td>
          <td>${escapeHtml(feedback.course_code)}<div class="small text-muted">${escapeHtml(feedback.course_title)}</div></td>
          <td>${escapeHtml(feedback.semester)} / ${escapeHtml(feedback.section)}</td>
          <td>${escapeHtml(formatAverage(overallCategoryValue(feedback.responses)))}</td>
          <td>${feedback.comment ? escapeHtml(feedback.comment) : "<span class=\"text-muted\">No comment</span>"}</td>
          <td>${escapeHtml(formatDate(feedback.submitted_at))}</td>
          <td>${statusBadgeMarkup(feedback.status, feedback.status === "hidden" ? "Hidden" : "Visible")}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-outline-primary" data-review-id="${escapeHtml(String(feedback.id))}">View</button>
            <button class="btn btn-sm btn-outline-secondary" data-action="toggle-feedback-status" data-feedback-id="${escapeHtml(String(feedback.id))}">
              ${feedback.status === "hidden" ? "Unhide" : "Hide"}
            </button>
          </td>
        `);
      });
    }

    async function refreshDashboard() {
      clearAlert(dashboardAlert);
      try {
        const [settings, teachers, assignments, feedbacks] = await Promise.all([
          loadFeedbackSettings({ useDemo }),
          loadTeacherDirectory({ useDemo }),
          loadAssignments({ useDemo }),
          loadFeedbacks({ useDemo })
        ]);
        state.settings = settings;
        state.teachers = teachers;
        state.assignments = assignments;
        state.feedbacks = feedbacks;
        renderSummaryCards();
        populateTeacherDrivenOptions();
        renderTeacherTable();
        renderAssignmentTable();
        renderFeedbackAnalytics();
      } catch (error) {
        showAlert(dashboardAlert, "danger", getSetupMessage(error, "Unable to load admin dashboard."));
      }
    }

    fillStaticOptions();
    await refreshDashboard();

    document.getElementById("openTeacherModalBtn")?.addEventListener("click", () => {
      openTeacherEditor(null);
    });
    document.getElementById("openAssignmentModalBtn")?.addEventListener("click", () => {
      openAssignmentEditor(null);
    });

    [teacherSearchFilter, teacherStatusFilter].forEach((element) => {
      element?.addEventListener(element.tagName === "INPUT" ? "input" : "change", renderTeacherTable);
    });
    [
      document.getElementById("assignmentSemesterFilter"),
      document.getElementById("assignmentSectionFilter"),
      document.getElementById("assignmentTeacherFilter")
    ].forEach((element) => {
      element?.addEventListener("change", renderAssignmentTable);
    });
    document.getElementById("assignmentCourseFilter")?.addEventListener("input", renderAssignmentTable);

    [
      document.getElementById("analyticsTeacherFilter"),
      document.getElementById("analyticsSemesterFilter"),
      document.getElementById("analyticsSectionFilter"),
      document.getElementById("analyticsStatusFilter")
    ].forEach((element) => {
      element?.addEventListener("change", renderFeedbackAnalytics);
    });
    document.getElementById("analyticsCourseFilter")?.addEventListener("input", renderFeedbackAnalytics);

    settingsForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        state.settings = await saveFeedbackSettings({
          useDemo,
          payload: {
            id: 1,
            active_term: settingsForm.activeTerm.value.trim(),
            review_window_open: settingsForm.reviewWindow.checked,
            allow_anonymous_feedback: settingsForm.anonymous.checked
          }
        });
        renderSummaryCards();
        showToast("success", "Feedback settings updated.");
      } catch (error) {
        showAlert(dashboardAlert, "danger", getSetupMessage(error, "Unable to save settings."));
      }
    });

    teacherBody.onclick = async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const teacherId = Number(button.dataset.teacherId);
      const teacher = state.teachers.find((item) => item.id === teacherId);
      if (!teacher) {
        return;
      }
      if (button.dataset.action === "view-profile") {
        window.location.href = `teacher-profile.html?id=${teacher.id}`;
        return;
      }
      if (button.dataset.action === "edit-teacher") {
        openTeacherEditor(teacher);
        return;
      }
      if (button.dataset.action === "toggle-teacher") {
        try {
          await toggleTeacherStatus({ useDemo, teacherId });
          await refreshDashboard();
          showToast("success", "Teacher status updated.");
        } catch (error) {
          showAlert(dashboardAlert, "danger", getSetupMessage(error, "Unable to update teacher status."));
        }
      }
    };

    teacherForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(teacherFormAlert);
      if (!teacherForm.checkValidity()) {
        teacherForm.classList.add("was-validated");
        return;
      }
      try {
        await saveTeacherRecord({
          useDemo,
          payload: {
            id: safeNumber(document.getElementById("teacherRecordId").value),
            name: document.getElementById("teacherNameInput").value,
            short_code: document.getElementById("teacherCodeInput").value,
            designation: document.getElementById("teacherDesignationInput").value,
            department: document.getElementById("teacherDepartmentInput").value,
            email: document.getElementById("teacherEmailInput").value,
            phone: document.getElementById("teacherPhoneInput").value,
            office_room: document.getElementById("teacherOfficeInput").value,
            avatar_url: document.getElementById("teacherAvatarInput").value,
            status: document.getElementById("teacherStatusInput").value,
            is_email_public: document.getElementById("teacherEmailPublicInput").checked,
            bio: document.getElementById("teacherBioInput").value
          }
        });
        teacherModal?.hide();
        await refreshDashboard();
        showToast("success", "Teacher profile saved.");
      } catch (error) {
        showAlert(teacherFormAlert, "danger", getSetupMessage(error, "Unable to save teacher profile."));
      }
    });

    assignmentBody.onclick = async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      const assignmentId = Number(button.dataset.assignmentId);
      const assignment = state.assignments.find((item) => item.id === assignmentId);
      if (!assignment) {
        return;
      }
      if (button.dataset.action === "edit-assignment") {
        openAssignmentEditor(assignment);
        return;
      }
      if (button.dataset.action === "toggle-assignment") {
        try {
          await toggleAssignmentStatus({ useDemo, assignmentId });
          await refreshDashboard();
          showToast("success", "Assignment status updated.");
        } catch (error) {
          showAlert(dashboardAlert, "danger", getSetupMessage(error, "Unable to update assignment status."));
        }
      }
    };

    assignmentForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(assignmentFormAlert);
      if (!assignmentForm.checkValidity()) {
        assignmentForm.classList.add("was-validated");
        return;
      }
      try {
        await saveAssignmentRecord({
          useDemo,
          payload: {
            id: safeNumber(document.getElementById("assignmentRecordId").value),
            teacher_directory_id: safeNumber(document.getElementById("assignmentTeacherInput").value),
            course_code: document.getElementById("assignmentCourseCodeInput").value.trim(),
            course_title: document.getElementById("assignmentCourseTitleInput").value.trim(),
            semester: document.getElementById("assignmentSemesterInput").value,
            section: document.getElementById("assignmentSectionInput").value,
            academic_term: document.getElementById("assignmentTermInput").value.trim(),
            is_active: document.getElementById("assignmentActiveInput").checked
          }
        });
        assignmentModal?.hide();
        await refreshDashboard();
        showToast("success", "Assignment saved.");
      } catch (error) {
        showAlert(assignmentFormAlert, "danger", getSetupMessage(error, "Unable to save assignment."));
      }
    });

    feedbackBody.onclick = async (event) => {
      const reviewButton = event.target.closest("[data-review-id]");
      if (reviewButton) {
        const review = lastRenderedAnalyticsFeedbacks.find(
          (item) => String(item.id) === String(reviewButton.dataset.reviewId)
        );
        openReviewModal(review, true);
        return;
      }

      const button = event.target.closest("[data-action=\"toggle-feedback-status\"]");
      if (!button) {
        return;
      }
      const feedbackId = button.dataset.feedbackId;
      const current = state.feedbacks.find((item) => String(item.id) === String(feedbackId));
      if (!current) {
        return;
      }
      try {
        await saveFeedbackStatus({
          useDemo,
          feedbackId,
          status: current.status === "hidden" ? "submitted" : "hidden",
          profileId: profile.id
        });
        await refreshDashboard();
        showToast("success", "Feedback visibility updated.");
      } catch (error) {
        showAlert(dashboardAlert, "danger", getSetupMessage(error, "Unable to update feedback visibility."));
      }
    };

    exportFeedbackBtn?.addEventListener("click", () => {
      const rows = [
        ["Teacher", "Course Code", "Course Title", "Semester", "Section", "Overall", "Status", "Comment", "Submitted At"]
      ];
      filteredAnalyticsFeedbacks().forEach((feedback) => {
        rows.push([
          feedback.teacher_name || "Teacher",
          feedback.course_code,
          feedback.course_title,
          feedback.semester,
          feedback.section,
          formatAverage(overallCategoryValue(feedback.responses)),
          feedback.status,
          feedback.comment,
          formatDate(feedback.submitted_at)
        ]);
      });
      downloadTextFile(
        `sfrs-feedback-export-${new Date().toISOString().slice(0, 10)}.csv`,
        buildCsvContent(rows),
        "text/csv;charset=utf-8"
      );
    });
  }

  function populateEntryLinks() {
    // Entry pages already include nav items; this function intentionally stays small.
  }

  function bindCourseAutoFill(getCourses) {
    const codeInput = document.getElementById("assignmentCourseCodeInput");
    const titleInput = document.getElementById("assignmentCourseTitleInput");
    if (!codeInput || !titleInput) {
      return;
    }
    const setTitleFromCode = () => {
      const courseCatalog = typeof getCourses === "function" ? getCourses() : [];
      const match = courseCatalog.find((item) => normalizeLookup(item.code) === normalizeLookup(codeInput.value));
      if (match && !titleInput.value.trim()) {
        titleInput.value = match.title;
      }
    };
    codeInput.addEventListener("change", setTitleFromCode);
    codeInput.addEventListener("blur", setTitleFromCode);
  }

  function initPage() {
    initLogout();
    populateEntryLinks();

    switch (document.body.dataset.page) {
      case "student-login":
        initStudentLogin();
        break;
      case "teacher-login":
        initTeacherLogin();
        break;
      case "admin-login":
        initAdminLogin();
        break;
      case "password-reset":
        initPasswordReset();
        break;
      case "student-signup":
        initStudentSignup();
        break;
      case "teacher-signup":
        initTeacherSignup();
        break;
      case "student-dashboard":
        initStudentDashboard();
        break;
      case "teacher-dashboard":
        initTeacherDashboard();
        break;
      case "teacher-profile":
        initTeacherProfile();
        break;
      case "admin-dashboard":
        initAdminDashboard();
        break;
      default:
        break;
    }
  }

  document.addEventListener("DOMContentLoaded", initPage);
})();
