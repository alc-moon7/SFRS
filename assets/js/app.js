(() => {
  "use strict";

  const QUESTIONS = window.SFRS_QUESTIONS || [];
  const OPTIONS = window.SFRS_OPTIONS || ["Good", "Average", "Excellent"];
  const SCORE_MAP = { Excellent: 3, Good: 2, Average: 1 };
  const DEMO_CREDENTIALS = { username: "admin", password: "admin" };
  const DEMO_SESSION_KEY = "sfrs_demo_session";
  const DEMO_FEEDBACK_KEY = "sfrs_demo_feedbacks";
  const DEMO_PROFILES = {
    student: {
      id: "demo-student-001",
      role: "student",
      full_name: "Demo Student",
      student_id: "223311051",
      email: "admin",
      department: "Computer Science and Engineering",
      program: "B.Sc. in CSE",
      semester: "7th Semester",
      section: "B"
    },
    teacher: {
      id: "demo-teacher-001",
      role: "teacher",
      full_name: "Demo Teacher",
      designation: "Lecturer, CSE",
      email: "admin",
      teacher_directory_id: 1
    }
  };
  const DEMO_TEACHERS = [
    {
      id: 1,
      name: "A.S.M. Delwar Hossain",
      designation: "Lecturer",
      email: "delwar@vu.edu.bd"
    },
    {
      id: 2,
      name: "Sabina Yasmin",
      designation: "Coordinator",
      email: "sabina@vu.edu.bd"
    },
    {
      id: 3,
      name: "Prof. Dr. Bimal Kumar Pramanik",
      designation: "Professor",
      email: ""
    }
  ];

  const normalizeIdentifier = (value) => (value || "").trim().toLowerCase();
  const isEmail = (value) => /.+@.+\..+/.test(value);
  const isDemoCredential = (identifier, password) =>
    normalizeIdentifier(identifier) === DEMO_CREDENTIALS.username &&
    password === DEMO_CREDENTIALS.password;
  const createDemoId = () =>
    `demo_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;

  const getDemoSession = () => {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  };

  const setDemoSession = (role) => {
    const profile = DEMO_PROFILES[role];
    if (!profile) {
      return;
    }
    localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify({ role, profile })
    );
  };

  const clearDemoSession = () => {
    localStorage.removeItem(DEMO_SESSION_KEY);
  };

  const getDemoFeedbacks = () => {
    const raw = localStorage.getItem(DEMO_FEEDBACK_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return [];
    }
  };

  const setDemoFeedbacks = (feedbacks) => {
    localStorage.setItem(DEMO_FEEDBACK_KEY, JSON.stringify(feedbacks));
  };

  const showAlert = (element, type, message) => {
    if (!element) {
      return;
    }
    element.className = `alert alert-${type}`;
    element.textContent = message;
  };

  const clearAlert = (element) => {
    if (!element) {
      return;
    }
    element.className = "";
    element.textContent = "";
  };

  const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleString();
  };

  const getOverallQuestion = () => {
    if (!QUESTIONS.length) {
      return "";
    }
    const lastSection = QUESTIONS[QUESTIONS.length - 1];
    if (!lastSection.items.length) {
      return "";
    }
    return lastSection.items[lastSection.items.length - 1];
  };

  const renderTeacherOptions = (selectEl, teachers) => {
    if (!selectEl) {
      return;
    }
    selectEl.innerHTML = "<option value=\"\">Select a teacher</option>";
    teachers.forEach((teacher) => {
      const option = document.createElement("option");
      option.value = teacher.id;
      option.textContent = `${teacher.name} - ${teacher.designation || "CSE"}`;
      option.dataset.email = teacher.email || "";
      option.dataset.designation = teacher.designation || "";
      selectEl.appendChild(option);
    });
  };

  const updateTeacherInfo = (selectEl, infoEl, teachers) => {
    if (!selectEl || !infoEl) {
      return;
    }
    const selectedId = Number(selectEl.value);
    const teacher = teachers.find((item) => item.id === selectedId);
    if (!teacher) {
      infoEl.innerHTML = "<div class=\"text-muted\">Select a teacher to see details.</div>";
      return;
    }
    const email = teacher.email || "Not listed";
    infoEl.innerHTML = `
      <div class=\"fw-semibold\">${teacher.name}</div>
      <div class=\"text-muted\">${teacher.designation || ""}</div>
      <div class=\"small text-muted\">Email: ${email}</div>
    `;
  };

  const renderQuestions = (container) => {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    QUESTIONS.forEach((section, sectionIndex) => {
      const heading = document.createElement("h6");
      heading.className = "form-section-title mt-3";
      heading.textContent = section.title;
      container.appendChild(heading);

      section.items.forEach((question, questionIndex) => {
        const key = `q-${sectionIndex}-${questionIndex}`;
        const card = document.createElement("div");
        card.className = "question-card";

        const title = document.createElement("div");
        title.className = "question-title";
        title.textContent = question;
        card.appendChild(title);

        const row = document.createElement("div");
        row.className = "d-flex flex-wrap gap-3";

        OPTIONS.forEach((option, optionIndex) => {
          const wrapper = document.createElement("div");
          wrapper.className = "form-check form-check-inline";

          const input = document.createElement("input");
          input.type = "radio";
          input.className = "form-check-input";
          input.name = key;
          input.id = `${key}-${option.toLowerCase()}`;
          input.value = option;
          if (optionIndex === 0) {
            input.required = true;
          }

          const label = document.createElement("label");
          label.className = "form-check-label";
          label.setAttribute("for", input.id);
          label.textContent = option;

          wrapper.appendChild(input);
          wrapper.appendChild(label);
          row.appendChild(wrapper);
        });

        card.appendChild(row);
        container.appendChild(card);
      });
    });
  };

  const collectResponses = (form) => {
    const responses = [];
    let missing = false;

    QUESTIONS.forEach((section, sectionIndex) => {
      section.items.forEach((question, questionIndex) => {
        const key = `q-${sectionIndex}-${questionIndex}`;
        const selected = form.querySelector(`input[name=\"${key}\"]:checked`);
        if (!selected) {
          missing = true;
        }
        responses.push({
          section: section.title,
          question,
          value: selected ? selected.value : ""
        });
      });
    });

    return { responses, missing };
  };

  const openReviewModal = (review, hideStudent) => {
    const modal = document.getElementById("reviewModal");
    if (!modal || !review) {
      return;
    }
    const title = modal.querySelector("[data-review-title]");
    const meta = modal.querySelector("[data-review-meta]");
    const body = modal.querySelector("[data-review-body]");

    if (title) {
      title.textContent = `Review for ${review.teacher_name || "Teacher"}`;
    }

    if (meta) {
      const studentInfo = hideStudent ? "Anonymous" : "You";
      meta.textContent = `Course: ${review.course_code} - ${review.course_title} | Semester: ${review.semester} | Section: ${review.section} | Student: ${studentInfo}`;
    }

    if (body) {
      body.innerHTML = "";
      (review.responses || []).forEach((response) => {
        const row = document.createElement("div");
        row.className = "mb-2";

        const question = document.createElement("div");
        question.className = "fw-semibold";
        question.textContent = response.question;

        const answer = document.createElement("div");
        answer.className = "text-muted";
        answer.textContent = response.value || "Not answered";

        row.appendChild(question);
        row.appendChild(answer);
        body.appendChild(row);
      });
    }

    const bootstrapModal = bootstrap.Modal.getOrCreateInstance(modal);
    bootstrapModal.show();
  };

  const bindReviewModal = (tableBody, reviews, hideStudent) => {
    if (!tableBody) {
      return;
    }
    tableBody.addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-id]");
      if (!button) {
        return;
      }
      const review = reviews.find((item) => String(item.id) === String(button.dataset.reviewId));
      openReviewModal(review, hideStudent);
    });
  };

  const loadTeacherDirectory = async (options = {}) => {
    if (options.useDemo) {
      return [...DEMO_TEACHERS];
    }
    const { data, error } = await supabaseClient
      .from("teachers_directory")
      .select("id, name, designation, email")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  };

  const getProfile = async () => {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }
    if (!sessionData.session) {
      return null;
    }

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", sessionData.session.user.id)
      .single();

    if (error) {
      throw error;
    }

    return { session: sessionData.session, profile: data };
  };

  const requireRole = async (role, redirectTo) => {
    const demoSession = getDemoSession();
    if (demoSession) {
      if (demoSession.role !== role) {
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
      if (!result || !result.profile) {
        window.location.href = redirectTo;
        return null;
      }
      if (result.profile.role !== role) {
        await supabaseClient.auth.signOut();
        window.location.href = redirectTo;
        return null;
      }
      return result;
    } catch (error) {
      window.location.href = redirectTo;
      return null;
    }
  };

  const initLogout = () => {
    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        clearDemoSession();
        try {
          await supabaseClient.auth.signOut();
        } catch (error) {
          // Ignore sign-out errors in demo mode.
        }
        window.location.href = "index.html";
      });
    });
  };

  const initStudentLogin = () => {
    const form = document.getElementById("studentLoginForm");
    if (!form) {
      return;
    }
    const alertBox = document.getElementById("studentLoginAlert");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(alertBox);
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
      }

      const identifier = normalizeIdentifier(form.email.value);
      const password = form.password.value;

      if (isDemoCredential(identifier, password)) {
        setDemoSession("student");
        window.location.href = "student-dashboard.html";
        return;
      }

      if (!isEmail(identifier)) {
        showAlert(alertBox, "warning", "Enter a valid email address or use the demo credentials.");
        return;
      }

      clearDemoSession();

      const { error } = await supabaseClient.auth.signInWithPassword({ email: identifier, password });
      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      try {
        const result = await getProfile();
        if (!result || result.profile.role !== "student") {
          await supabaseClient.auth.signOut();
          showAlert(alertBox, "warning", "This account is not registered as a student.");
          return;
        }
        window.location.href = "student-dashboard.html";
      } catch (profileError) {
        showAlert(alertBox, "danger", "Unable to load student profile.");
      }
    });
  };

  const initTeacherLogin = () => {
    const form = document.getElementById("teacherLoginForm");
    if (!form) {
      return;
    }
    const alertBox = document.getElementById("teacherLoginAlert");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(alertBox);
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
      }

      const identifier = normalizeIdentifier(form.email.value);
      const password = form.password.value;

      if (isDemoCredential(identifier, password)) {
        setDemoSession("teacher");
        window.location.href = "teacher-dashboard.html";
        return;
      }

      if (!isEmail(identifier)) {
        showAlert(alertBox, "warning", "Enter a valid email address or use the demo credentials.");
        return;
      }

      clearDemoSession();

      const { error } = await supabaseClient.auth.signInWithPassword({ email: identifier, password });
      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      try {
        const result = await getProfile();
        if (!result || result.profile.role !== "teacher") {
          await supabaseClient.auth.signOut();
          showAlert(alertBox, "warning", "This account is not registered as a teacher.");
          return;
        }
        window.location.href = "teacher-dashboard.html";
      } catch (profileError) {
        showAlert(alertBox, "danger", "Unable to load teacher profile.");
      }
    });
  };

  const initStudentSignup = () => {
    const form = document.getElementById("studentSignupForm");
    if (!form) {
      return;
    }
    const alertBox = document.getElementById("studentSignupAlert");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(alertBox);
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
      }

      clearDemoSession();

      if (form.password.value !== form.confirmPassword.value) {
        showAlert(alertBox, "warning", "Passwords do not match.");
        return;
      }

      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;

      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      if (!data.session) {
        showAlert(alertBox, "info", "Check your email to confirm your account, then log in.");
        return;
      }

      const { error: profileError } = await supabaseClient.from("profiles").insert({
        id: data.user.id,
        role: "student",
        full_name: form.fullName.value.trim(),
        student_id: form.studentId.value.trim(),
        email,
        department: form.department.value,
        program: form.program.value,
        semester: form.semester.value,
        section: form.section.value.trim()
      });

      if (profileError) {
        showAlert(alertBox, "danger", "Unable to create student profile. Please try again.");
        return;
      }

      window.location.href = "student-dashboard.html";
    });
  };

  const initTeacherSignup = async () => {
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
      showAlert(alertBox, "danger", "Unable to load teacher list from the database.");
      return;
    }

    renderTeacherOptions(selectEl, teachers);

    const updateFields = () => {
      const selectedId = Number(selectEl.value);
      const teacher = teachers.find((item) => item.id === selectedId);
      if (!teacher) {
        designationEl.value = "";
        emailEl.value = "";
        emailEl.readOnly = false;
        return;
      }
      designationEl.value = teacher.designation || "";
      if (teacher.email) {
        emailEl.value = teacher.email;
        emailEl.readOnly = true;
      } else {
        emailEl.value = "";
        emailEl.readOnly = false;
      }
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

      clearDemoSession();

      if (form.password.value !== form.confirmPassword.value) {
        showAlert(alertBox, "warning", "Passwords do not match.");
        return;
      }

      const selectedId = Number(selectEl.value);
      const teacher = teachers.find((item) => item.id === selectedId);
      if (!teacher) {
        showAlert(alertBox, "danger", "Please select a teacher from the list.");
        return;
      }

      const email = emailEl.value.trim().toLowerCase();
      if (teacher.email && email !== teacher.email.toLowerCase()) {
        showAlert(alertBox, "warning", "Use the official email listed for this teacher.");
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: form.password.value
      });

      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      if (!data.session) {
        showAlert(alertBox, "info", "Check your email to confirm your account, then log in.");
        return;
      }

      const { error: profileError } = await supabaseClient.from("profiles").insert({
        id: data.user.id,
        role: "teacher",
        full_name: teacher.name,
        email,
        designation: teacher.designation,
        teacher_directory_id: teacher.id
      });

      if (profileError) {
        showAlert(alertBox, "danger", "Unable to create teacher profile. Please try again.");
        return;
      }

      window.location.href = "teacher-dashboard.html";
    });
  };

  const initStudentDashboard = async () => {
    const authData = await requireRole("student", "student-login.html");
    if (!authData) {
      return;
    }
    const { profile } = authData;
    const useDemo = authData.demo;

    const nameEl = document.querySelector("[data-user-name]");
    const idEl = document.querySelector("[data-user-id]");
    const programEl = document.querySelector("[data-user-program]");

    if (nameEl) {
      nameEl.textContent = profile.full_name;
    }
    if (idEl) {
      idEl.textContent = profile.student_id;
    }
    if (programEl) {
      programEl.textContent = `${profile.program} | ${profile.semester} | ${profile.section}`;
    }

    const form = document.getElementById("reviewForm");
    const alertBox = document.getElementById("reviewAlert");
    const teacherSelectEl = document.getElementById("reviewTeacherSelect");
    const teacherInfoEl = document.getElementById("reviewTeacherInfo");
    const questionContainer = document.getElementById("questionContainer");
    const reviewsTbody = document.getElementById("studentReviewsBody");

    let teachers = [];
    try {
      teachers = await loadTeacherDirectory({ useDemo });
    } catch (error) {
      showAlert(alertBox, "danger", "Unable to load teacher directory.");
    }

    renderTeacherOptions(teacherSelectEl, teachers);
    updateTeacherInfo(teacherSelectEl, teacherInfoEl, teachers);
    renderQuestions(questionContainer);

    teacherSelectEl.addEventListener("change", () => {
      updateTeacherInfo(teacherSelectEl, teacherInfoEl, teachers);
    });

    const loadReviews = async () => {
      if (useDemo) {
        const feedbacks = getDemoFeedbacks().filter(
          (item) => item.student_id === profile.id
        );
        const sorted = [...feedbacks].sort(
          (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)
        );
        const reviews = sorted.map((review) => ({
          ...review,
          teacher_name:
            review.teacher_name ||
            (teachers.find((item) => item.id === review.teacher_directory_id)?.name || "Teacher")
        }));

        reviewsTbody.innerHTML = "";
        if (!reviews.length) {
          const row = document.createElement("tr");
          row.innerHTML = "<td colspan=\"5\" class=\"text-center text-muted\">No feedback submitted yet.</td>";
          reviewsTbody.appendChild(row);
        } else {
          reviews.forEach((review) => {
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${review.teacher_name}</td>
              <td>${review.course_code}</td>
              <td>${review.course_title}</td>
              <td>${formatDate(review.submitted_at)}</td>
              <td><button class=\"btn btn-sm btn-outline-primary\" data-review-id=\"${review.id}\">View</button></td>
            `;
            reviewsTbody.appendChild(row);
          });
        }

        bindReviewModal(reviewsTbody, reviews, false);
        return reviews;
      }

      const { data, error } = await supabaseClient
        .from("feedbacks")
        .select("id, course_code, course_title, semester, section, submitted_at, responses, teachers_directory(name, designation)")
        .eq("student_id", profile.id)
        .order("submitted_at", { ascending: false });

      if (error) {
        showAlert(alertBox, "danger", "Unable to load your submitted feedback.");
        return [];
      }

      const reviews = (data || []).map((review) => ({
        ...review,
        teacher_name: review.teachers_directory?.name || "Teacher"
      }));

      reviewsTbody.innerHTML = "";
      if (!reviews.length) {
        const row = document.createElement("tr");
        row.innerHTML = "<td colspan=\"5\" class=\"text-center text-muted\">No feedback submitted yet.</td>";
        reviewsTbody.appendChild(row);
      } else {
        reviews.forEach((review) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${review.teacher_name}</td>
            <td>${review.course_code}</td>
            <td>${review.course_title}</td>
            <td>${formatDate(review.submitted_at)}</td>
            <td><button class=\"btn btn-sm btn-outline-primary\" data-review-id=\"${review.id}\">View</button></td>
          `;
          reviewsTbody.appendChild(row);
        });
      }

      bindReviewModal(reviewsTbody, reviews, false);
      return reviews;
    };

    await loadReviews();

    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearAlert(alertBox);
      if (!form.checkValidity()) {
        form.classList.add("was-validated");
        showAlert(alertBox, "warning", "Please complete all required fields.");
        return;
      }

      const selectedId = Number(teacherSelectEl.value);
      const teacher = teachers.find((item) => item.id === selectedId);
      if (!teacher) {
        showAlert(alertBox, "warning", "Please select a teacher.");
        return;
      }

      const { responses, missing } = collectResponses(form);
      if (missing) {
        showAlert(alertBox, "warning", "Please answer every feedback question.");
        return;
      }

      const payload = {
        student_id: profile.id,
        teacher_directory_id: teacher.id,
        course_code: form.courseCode.value.trim(),
        course_title: form.courseTitle.value.trim(),
        semester: form.courseSemester.value.trim(),
        section: form.courseSection.value.trim(),
        responses
      };

      if (useDemo) {
        const feedbacks = getDemoFeedbacks();
        feedbacks.unshift({
          ...payload,
          id: createDemoId(),
          submitted_at: new Date().toISOString(),
          teacher_name: teacher.name
        });
        setDemoFeedbacks(feedbacks);
      } else {
        const { error } = await supabaseClient.from("feedbacks").insert(payload);
        if (error) {
          showAlert(alertBox, "danger", "Unable to submit feedback. Please try again.");
          return;
        }
      }

      form.reset();
      updateTeacherInfo(teacherSelectEl, teacherInfoEl, teachers);
      showAlert(alertBox, "success", "Feedback submitted successfully.");
      await loadReviews();
    });
  };

  const initTeacherDashboard = async () => {
    const authData = await requireRole("teacher", "teacher-login.html");
    if (!authData) {
      return;
    }
    const { profile } = authData;
    const useDemo = authData.demo;

    const nameEl = document.querySelector("[data-user-name]");
    const roleEl = document.querySelector("[data-user-role]");
    const emailEl = document.querySelector("[data-user-email]");

    if (nameEl) {
      nameEl.textContent = profile.full_name;
    }
    if (roleEl) {
      roleEl.textContent = profile.designation || "CSE Faculty";
    }
    if (emailEl) {
      emailEl.textContent = profile.email;
    }

    const reviewsTbody = document.getElementById("teacherReviewsBody");
    const totalEl = document.getElementById("totalReviews");
    const averageEl = document.getElementById("averageScore");

    const overallQuestion = getOverallQuestion();

    let reviews = [];

    if (useDemo) {
      const feedbacks = getDemoFeedbacks().filter(
        (item) => item.teacher_directory_id === profile.teacher_directory_id
      );
      const sorted = [...feedbacks].sort(
        (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)
      );
      reviews = sorted.map((review) => ({
        ...review,
        teacher_name: profile.full_name
      }));
    } else {
      const { data, error } = await supabaseClient
        .from("feedbacks")
        .select("id, course_code, course_title, semester, section, submitted_at, responses")
        .eq("teacher_directory_id", profile.teacher_directory_id)
        .order("submitted_at", { ascending: false });

      if (error) {
        if (reviewsTbody) {
          reviewsTbody.innerHTML = "<tr><td colspan=\"5\" class=\"text-center text-muted\">Unable to load feedback.</td></tr>";
        }
        return;
      }

      reviews = (data || []).map((review) => ({
        ...review,
        teacher_name: profile.full_name
      }));
    }

    if (totalEl) {
      totalEl.textContent = reviews.length;
    }

    const counts = { Excellent: 0, Good: 0, Average: 0 };
    let totalScore = 0;

    reviews.forEach((review) => {
      const response = (review.responses || []).find((item) => item.question === overallQuestion);
      if (response && counts[response.value] !== undefined) {
        counts[response.value] += 1;
        totalScore += SCORE_MAP[response.value] || 0;
      }
    });

    const totalReviews = reviews.length || 1;
    const averageScore = reviews.length ? (totalScore / reviews.length).toFixed(2) : "0.00";

    if (averageEl) {
      averageEl.textContent = averageScore;
    }

    ["Excellent", "Good", "Average"].forEach((label) => {
      const percent = Math.round((counts[label] / totalReviews) * 100);
      const bar = document.querySelector(`[data-overall-bar=\"${label}\"]`);
      const count = document.querySelector(`[data-overall-count=\"${label}\"]`);
      if (bar) {
        bar.style.width = `${percent}%`;
        bar.textContent = `${percent}%`;
      }
      if (count) {
        count.textContent = counts[label];
      }
    });

    if (reviewsTbody) {
      reviewsTbody.innerHTML = "";
      if (!reviews.length) {
        const row = document.createElement("tr");
        row.innerHTML = "<td colspan=\"5\" class=\"text-center text-muted\">No feedback received yet.</td>";
        reviewsTbody.appendChild(row);
      } else {
        reviews.forEach((review) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${review.course_code}</td>
            <td>${review.course_title}</td>
            <td>${review.semester} / ${review.section}</td>
            <td>${formatDate(review.submitted_at)}</td>
            <td><button class=\"btn btn-sm btn-outline-primary\" data-review-id=\"${review.id}\">View</button></td>
          `;
          reviewsTbody.appendChild(row);
        });
      }
    }

    bindReviewModal(reviewsTbody, reviews, true);
  };

  const initPage = () => {
    initLogout();
    const page = document.body.dataset.page;
    switch (page) {
      case "student-login":
        initStudentLogin();
        break;
      case "teacher-login":
        initTeacherLogin();
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
      default:
        break;
    }
  };

  document.addEventListener("DOMContentLoaded", initPage);
})();
