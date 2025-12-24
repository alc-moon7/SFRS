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
      "id": 1,
      "name": "Shamim Ahmad",
      "designation": "Head",
      "email": "head.cse@vu.edu.bd"
    },
    {
      "id": 2,
      "name": "Sabina Yasmin",
      "designation": "Coordinator",
      "email": "sabina@vu.edu.bd"
    },
    {
      "id": 3,
      "name": "Prof. A.H.M. Rahmatullah Imon, Ph.D.",
      "designation": "Professor",
      "email": "cc@vu.edu.bd"
    },
    {
      "id": 4,
      "name": "Dr. Ahammad Hossain",
      "designation": "Associate Professor",
      "email": "ahammad@vu.edu.bd"
    },
    {
      "id": 5,
      "name": "Md. Mizanur Rahman",
      "designation": "Assistant Professor",
      "email": "mizanur@vu.edu.bd"
    },
    {
      "id": 6,
      "name": "Umme Rumman",
      "designation": "Assistant Professor",
      "email": "chaiti@vu.edu.bd"
    },
    {
      "id": 7,
      "name": "Mst. Jannatul Ferdous",
      "designation": "Assistant Professor",
      "email": "jannat@vu.edu.bd"
    },
    {
      "id": 8,
      "name": "Monika Kabir",
      "designation": "Assistant Professor",
      "email": "monika@vu.edu.bd"
    },
    {
      "id": 9,
      "name": "Mohammad Kasedullah",
      "designation": "Lecturer",
      "email": "kasedullah@vu.edu.bd"
    },
    {
      "id": 10,
      "name": "Sumaia Rahman",
      "designation": "Assistant Professor",
      "email": "sumaia@vu.edu.bd"
    },
    {
      "id": 11,
      "name": "A.S.M. Delwar Hossain",
      "designation": "Lecturer",
      "email": "delwar@vu.edu.bd"
    },
    {
      "id": 12,
      "name": "Md. Toufikul Islam",
      "designation": "Lecturer",
      "email": "toufikul@vu.edu.bd"
    },
    {
      "id": 13,
      "name": "Md. Nour Noby",
      "designation": "Lecturer",
      "email": "nournoby@vu.edu.bd"
    },
    {
      "id": 14,
      "name": "Ayesha Akter Lima",
      "designation": "Lecturer",
      "email": "lima@vu.edu.bd"
    },
    {
      "id": 15,
      "name": "Salma Akter Lima",
      "designation": "Lecturer",
      "email": "salma.cse@vu.edu.bd"
    },
    {
      "id": 16,
      "name": "Ipshita Tasnim Raha",
      "designation": "Lecturer",
      "email": "ipshita@vu.edu.bd"
    },
    {
      "id": 17,
      "name": "Sumaiya Tasnim",
      "designation": "Lecturer",
      "email": "sumaiya@vu.edu.bd"
    },
    {
      "id": 18,
      "name": "Shamim Reza",
      "designation": "Lecturer",
      "email": "s.reza@vu.edu.bd"
    },
    {
      "id": 19,
      "name": "Samira Tareque",
      "designation": "Lecturer",
      "email": "samira@vu.edu.bd"
    },
    {
      "id": 20,
      "name": "Al Muktadir Munam",
      "designation": "Lecturer",
      "email": "munam@vu.edu.bd"
    },
    {
      "id": 21,
      "name": "Akib Ikbal",
      "designation": "Lecturer",
      "email": "akib@vu.edu.bd"
    },
    {
      "id": 22,
      "name": "Mohammad Faisal Al-Naser",
      "designation": "Lecturer",
      "email": "faisal@vu.edu.bd"
    },
    {
      "id": 23,
      "name": "Md. Muktar Hossain",
      "designation": "Lecturer",
      "email": "muktar@vu.edu.bd"
    },
    {
      "id": 24,
      "name": "Ahmed-Al-Azmain",
      "designation": "Lecturer",
      "email": "azmain@vu.edu.bd"
    },
    {
      "id": 25,
      "name": "Tanver Ahmed",
      "designation": "Lecturer",
      "email": "tanver@vu.edu.bd"
    },
    {
      "id": 26,
      "name": "Md. Musfiqur Rahman Mridha",
      "designation": "Lecturer",
      "email": "mridha@vu.edu.bd"
    },
    {
      "id": 27,
      "name": "Md. Jamil Chaudhary",
      "designation": "Lecturer",
      "email": "jamil@vu.edu.bd"
    },
    {
      "id": 28,
      "name": "Md. Shahid Ahammed Shakil",
      "designation": "Lecturer",
      "email": "shakil@vu.edu.bd"
    },
    {
      "id": 29,
      "name": "Md. Fatin Ilham",
      "designation": "Lecturer",
      "email": "ilham@vu.edu.bd"
    },
    {
      "id": 30,
      "name": "Zannatul Mifta",
      "designation": "Lecturer",
      "email": "mifta@vu.edu.bd"
    },
    {
      "id": 31,
      "name": "Arun Kumar Sikder",
      "designation": "Lecturer",
      "email": "arun@vu.edu.bd"
    },
    {
      "id": 32,
      "name": "Sushmit Jahan Rose",
      "designation": "Lecturer",
      "email": "sushmit@vu.edu.bd"
    },
    {
      "id": 33,
      "name": "Md. Ruhul Amin",
      "designation": "Lecturer",
      "email": "ruhul@vu.edu.bd"
    },
    {
      "id": 34,
      "name": "Md. Mahfujur Rahman",
      "designation": "Lecturer",
      "email": "mahfujur@vu.edu.bd"
    },
    {
      "id": 35,
      "name": "D.M. Asadujjaman",
      "designation": "Lecturer",
      "email": "asadujjaman@vu.edu.bd"
    },
    {
      "id": 36,
      "name": "Israt Jahan Rinky",
      "designation": "Lecturer",
      "email": "rinky@vu.edu.bd"
    },
    {
      "id": 37,
      "name": "Protik Chakroborty",
      "designation": "Lecturer",
      "email": "protik@vu.edu.bd"
    },
    {
      "id": 38,
      "name": "Tanzim Nawshin Reza",
      "designation": "Lecturer",
      "email": "tanzim@vu.edu.bd"
    },
    {
      "id": 39,
      "name": "Md. Taufiq Khan",
      "designation": "Lecturer",
      "email": "taufiq@vu.edu.bd"
    },
    {
      "id": 40,
      "name": "Arshad Wasif",
      "designation": "Lecturer",
      "email": "arshad@vu.edu.bd"
    },
    {
      "id": 41,
      "name": "Shorav Paul",
      "designation": "Lecturer",
      "email": "shorav@vu.edu.bd"
    },
    {
      "id": 42,
      "name": "Mst. Nafia Islam Shishir",
      "designation": "Lecturer",
      "email": "nafia@vu.edu.bd"
    },
    {
      "id": 43,
      "name": "Sumaya Hannan Shova",
      "designation": "Lecturer",
      "email": "shova@vu.edu.bd"
    },
    {
      "id": 44,
      "name": "Iffat Farhana",
      "designation": "Lecturer",
      "email": "iffat@vu.edu.bd"
    },
    {
      "id": 45,
      "name": "Md. Fayzul Islam",
      "designation": "Lecturer",
      "email": "fayzul@vu.edu.bd"
    },
    {
      "id": 46,
      "name": "Mst. Mazeda Noor Tasnim",
      "designation": "Lecturer",
      "email": "mazeda@vu.edu.bd"
    },
    {
      "id": 47,
      "name": "Md. Adnan Sami",
      "designation": "Lecturer",
      "email": "adnan@vu.edu.bd"
    },
    {
      "id": 48,
      "name": "Md. Rakibul Islam",
      "designation": "Lecturer",
      "email": "rakibul@vu.edu.bd"
    },
    {
      "id": 49,
      "name": "Adrita Alam",
      "designation": "Lecturer",
      "email": "adrita@vu.edu.bd"
    },
    {
      "id": 50,
      "name": "Rokaiya Tasnim",
      "designation": "Lecturer",
      "email": "rokaiya@vu.edu.bd"
    },
    {
      "id": 51,
      "name": "Shahara Laila",
      "designation": "Lecturer (Contractual)",
      "email": "shahara@vu.edu.bd"
    },
    {
      "id": 52,
      "name": "Afroza Islam",
      "designation": "Lecturer",
      "email": "afroza.islam@vu.edu.bd"
    },
    {
      "id": 53,
      "name": "Md. Farhan Tanvir Nasim",
      "designation": "Lecturer (Contractual)",
      "email": "farhan@vu.edu.bd"
    },
    {
      "id": 54,
      "name": "Humayra Tasnim",
      "designation": "Lecturer",
      "email": "humayra@vu.edu.bd"
    },
    {
      "id": 55,
      "name": "Asim Moin Saad",
      "designation": "Lecturer",
      "email": "asim@vu.edu.bd"
    },
    {
      "id": 56,
      "name": "Zuairia Raisa Bintay Makin",
      "designation": "Lecturer",
      "email": "makin@vu.edu.bd"
    },
    {
      "id": 57,
      "name": "Afifa Tasneem Quanita",
      "designation": "Lecturer (Contractual)",
      "email": "quanita@vu.edu.bd"
    },
    {
      "id": 58,
      "name": "Md. Khalid Sakib",
      "designation": "Lecturer (Contractual)",
      "email": "khalid@vu.edu.bd"
    },
    {
      "id": 59,
      "name": "Md. Alamin Hossain Pappu",
      "designation": "Lecturer (Contractual)",
      "email": "alamin@vu.edu.bd"
    },
    {
      "id": 60,
      "name": "Anupoma Barman Shetu",
      "designation": "Lecturer (Contractual)",
      "email": "anupoma@vu.edu.bd"
    },
    {
      "id": 61,
      "name": "Mohsiul Mumit Alik",
      "designation": "Lecturer (Contractual)",
      "email": "alik@vu.edu.bd"
    },
    {
      "id": 62,
      "name": "Md. Arifour Rahman",
      "designation": "Associate Professor",
      "email": ""
    },
    {
      "id": 63,
      "name": "Prof. Dr. Md. Ali Hossain",
      "designation": "Professor",
      "email": ""
    },
    {
      "id": 64,
      "name": "Dr.Md. Ekramul Hamid",
      "designation": "Professor",
      "email": ""
    },
    {
      "id": 65,
      "name": "Dr.Md. Johirul Islam",
      "designation": "Assistant Professor",
      "email": ""
    },
    {
      "id": 66,
      "name": "Sanjoy Kumar Chakravarty",
      "designation": "Associate Professor",
      "email": ""
    },
    {
      "id": 67,
      "name": "Md. Omar Faruqe",
      "designation": "Associate Professor",
      "email": ""
    },
    {
      "id": 68,
      "name": "Prof. Dr. Bimal Kumar Pramanik",
      "designation": "Professor",
      "email": ""
    },
    {
      "id": 69,
      "name": "Md. Akramul Alim",
      "designation": "Assistant Professor",
      "email": ""
    },
    {
      "id": 70,
      "name": "Dr. Md. Nazrul Islam Mondal",
      "designation": "Professor",
      "email": ""
    },
    {
      "id": 71,
      "name": "Prof.Dr. Boshir Ahmed",
      "designation": "Professor",
      "email": ""
    },
    {
      "id": 72,
      "name": "Nafia Islam",
      "designation": "",
      "email": ""
    },
    {
      "id": 73,
      "name": "Susmita Paul",
      "designation": "",
      "email": ""
    },
    {
      "id": 74,
      "name": "Md. Faruk Hossain, Ph.D.",
      "designation": "",
      "email": ""
    },
    {
      "id": 75,
      "name": "Md. Faisal Rahman Badal",
      "designation": "",
      "email": ""
    },
    {
      "id": 76,
      "name": "Dr.Md. Mayeedul Islam",
      "designation": "",
      "email": ""
    },
    {
      "id": 77,
      "name": "Dr.Jewel Hossen",
      "designation": "",
      "email": ""
    },
    {
      "id": 78,
      "name": "Dr.Md. Iqbal Aziz Khan",
      "designation": "",
      "email": ""
    },
    {
      "id": 79,
      "name": "Dr.Jaker Hossain",
      "designation": "",
      "email": ""
    },
    {
      "id": 80,
      "name": "Dr.Md. Ariful Islam Nahid",
      "designation": "",
      "email": ""
    },
    {
      "id": 81,
      "name": "Dr.Md. Golam Rashed",
      "designation": "",
      "email": ""
    },
    {
      "id": 82,
      "name": "Dr.Md. Hamidul Islam",
      "designation": "",
      "email": ""
    },
    {
      "id": 83,
      "name": "Dr.Md. Abu Bakar PK.",
      "designation": "",
      "email": ""
    },
    {
      "id": 84,
      "name": "Dr.Md. Sherezzaman",
      "designation": "",
      "email": ""
    },
    {
      "id": 85,
      "name": "Md. Sanaul Haque",
      "designation": "",
      "email": ""
    },
    {
      "id": 86,
      "name": "Mst. Somapti Akter",
      "designation": "",
      "email": ""
    },
    {
      "id": 87,
      "name": "Sanjida Sultana Rika",
      "designation": "",
      "email": ""
    },
    {
      "id": 88,
      "name": "Emamul Haque",
      "designation": "",
      "email": ""
    }
  ];

  const COURSE_CATALOG = [
    { code: "CSE 1101", title: "Structured Programming Language" },
    { code: "CSE 1102", title: "Structured Programming Language Lab" },
    { code: "EEE 1131", title: "Basic Electrical Circuits" },
    { code: "EEE 1132", title: "Basic Electrical Circuits Lab" },
    { code: "MAT 1141", title: "Differential and Integral Calculus" },
    { code: "PHY 1151", title: "Basic Physics" },
    { code: "PHY 1152", title: "Basic Physics Lab" },
    { code: "ENG 0002", title: "English Fundamentals" },
    { code: "CSE 1201", title: "Object Oriented Programming" },
    { code: "CSE 1202", title: "Object Oriented Programming Lab" },
    { code: "CSE 1203", title: "Discrete Mathematics" },
    { code: "EEE 1231", title: "Electronic Devices and Circuits" },
    { code: "EEE 1232", title: "Electronic Devices and Circuits Lab" },
    { code: "MAT 1241", title: "Coordinate Geometry and Vector Analysis" },
    { code: "CHE 1261", title: "Chemistry" },
    { code: "CHE 1262", title: "Chemistry Lab" },
    { code: "CSE 2101", title: "Object Oriented Design and Design Patterns" },
    { code: "CSE 2102", title: "Object Oriented Design and Design Patterns Lab" },
    { code: "CSE 2103", title: "Data Structures" },
    { code: "CSE 2104", title: "Data Structures Lab" },
    { code: "CSE 2105", title: "Digital System Design" },
    { code: "CSE 2106", title: "Digital System Design Lab" },
    { code: "MAT 2141", title: "Differential Equations" },
    { code: "BAN 0001", title: "History of the Emergence of Bangladesh" },
    { code: "CSE 2201", title: "Software Engineering and System Analysis" },
    { code: "CSE 2203", title: "Computer Algorithms" },
    { code: "CSE 2204", title: "Computer Algorithms Lab" },
    { code: "CSE 2205", title: "Numerical Methods" },
    { code: "CSE 2206", title: "Numerical Methods Lab" },
    { code: "CSE 2207", title: "Computer Networks" },
    { code: "CSE 2208", title: "Computer Networks Lab" },
    { code: "MAT 2241", title: "Linear Algebra and Complex Variables" },
    { code: "CSE 3101", title: "Computer Graphics" },
    { code: "CSE 3102", title: "Computer Graphics Lab" },
    { code: "CSE 3103", title: "Database Management System" },
    { code: "CSE 3104", title: "Database Management System Lab" },
    { code: "CSE 3105", title: "Computer Architecture" },
    { code: "CSE 3106", title: "Computer Architecture Lab" },
    { code: "CSE 3107", title: "Communication Engineering" },
    { code: "MAT 3141", title: "Applied Statistics and Probability" },
    { code: "CSE 3201", title: "Theory of Computation and Compiler Design" },
    { code: "CSE 3203", title: "Operating System and System Programming" },
    { code: "CSE 3204", title: "Operating System and System Programming Lab" },
    { code: "CSE 3205", title: "Microprocessor and Assembly Language" },
    { code: "CSE 3206", title: "Microprocessor and Assembly Language Lab" },
    { code: "CSE 3207", title: "Digital Signal Processing" },
    { code: "CSE 3208", title: "Digital Signal Processing Lab" },
    { code: "CSE 3209", title: "E-commerce and Web Programming" },
    { code: "CSE 3210", title: "E-commerce and Web Programming Project Lab" },
    { code: "ECO 3271", title: "Engineering Economics" },
    { code: "CSE 4101", title: "Artificial Intelligence" },
    { code: "CSE 4102", title: "Artificial Intelligence Lab" },
    { code: "CSE 4103", title: "Digital Image Processing" },
    { code: "CSE 4104", title: "Digital Image Processing Lab" },
    { code: "CSE 4105", title: "Engineering Ethics and Environmental Protection" },
    { code: "CSE 4107", title: "Microcontroller, Computer Peripherals and Interfacing" },
    { code: "CSE 4108", title: "Microcontroller, Computer Peripherals and Interfacing Lab" },
    { code: "ACC 4171", title: "Industrial Management and Accountancy" },
    { code: "CSE 4100", title: "Project or Thesis with Seminar Part I" },
    { code: "CSE 4120", title: "Industrial Attachment" },
    { code: "CSE 4122", title: "Technical Report Writing" },
    { code: "CSE 4201", title: "Parallel Processing and Distributed System" },
    { code: "CSE 4202", title: "Parallel Processing and Distributed System Lab" },
    { code: "CSE 4203", title: "Cryptography and Network Security" },
    { code: "CSE 4204", title: "Cryptography and Network Security Lab" },
    { code: "CSE 4205", title: "Robotics and Automation" },
    { code: "CSE 4206", title: "Robotics and Automation Lab" },
    { code: "CSE 4207", title: "Big Data Analysis" },
    { code: "CSE 4208", title: "Big Data Analysis Lab" },
    { code: "CSE 4209", title: "Cloud Computing and IOT" },
    { code: "CSE 4210", title: "Cloud Computing and IOT Lab" },
    { code: "CSE 4211", title: "Machine Learning" },
    { code: "CSE 4212", title: "Machine Learning Lab" },
    { code: "CSE 4200", title: "Project or Thesis with Seminar Part II" }
  ];

  const normalizeIdentifier = (value) => (value || "").trim().toLowerCase();
  const normalizeDesignation = (designation) => {
    const cleaned = (designation || "").trim();
    if (!cleaned || cleaned.toLowerCase() === "cse") {
      return "Lecturer";
    }
    return cleaned;
  };
  const normalizeEmail = (value) => (value || "").trim().toLowerCase();
  const safeNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };
  const buildProfilePayload = (session) => {
    if (!session || !session.user) {
      return null;
    }
    const metadata = session.user.user_metadata || {};
    const role = metadata.role;
    if (!role) {
      return null;
    }
    const email = normalizeEmail(session.user.email || metadata.email || "");
    if (!email) {
      return null;
    }
    const payload = {
      id: session.user.id,
      role,
      full_name: (metadata.full_name || email).trim(),
      email,
      student_id: metadata.student_id || null,
      department: metadata.department || null,
      program: metadata.program || null,
      semester: metadata.semester || null,
      section: metadata.section || null,
      designation: metadata.designation || null,
      teacher_directory_id: safeNumber(metadata.teacher_directory_id)
    };
    return payload;
  };
  const createProfileFromMetadata = async (session) => {
    const payload = buildProfilePayload(session);
    if (!payload) {
      return null;
    }
    const { data, error } = await supabaseClient
      .from("profiles")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        const { data: existing, error: fetchError } = await supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (fetchError) {
          throw fetchError;
        }
        return existing;
      }
      throw error;
    }
    return data;
  };
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
      const designation = normalizeDesignation(teacher.designation);
      option.value = teacher.id;
      option.textContent = `${teacher.name} - ${designation}`;
      option.dataset.email = teacher.email || "";
      option.dataset.designation = designation;
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
    const designation = normalizeDesignation(teacher.designation);
    const email = teacher.email || "Not listed";
    infoEl.innerHTML = `
      <div class=\"fw-semibold\">${teacher.name}</div>
      <div class=\"text-muted\">${designation}</div>
      <div class=\"small text-muted\">Email: ${email}</div>
    `;
  };

  const renderCourseOptions = (selectEl, courses) => {
    if (!selectEl) {
      return;
    }
    selectEl.innerHTML = "<option value=\"\">Select a course</option>";
    courses.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.code;
      option.textContent = `${course.code} - ${course.title}`;
      option.dataset.title = course.title;
      selectEl.appendChild(option);
    });
  };

  const getCourseTitle = (option) => {
    if (!option) {
      return "";
    }
    if (option.dataset && option.dataset.title) {
      return option.dataset.title;
    }
    const text = option.textContent || "";
    const splitIndex = text.indexOf(" - ");
    if (splitIndex === -1) {
      return "";
    }
    return text.slice(splitIndex + 3).trim();
  };

  const getSelectedCourse = (selectEl) => {
    if (!selectEl) {
      return null;
    }
    const option = selectEl.options[selectEl.selectedIndex];
    if (!option || !option.value) {
      return null;
    }
    return {
      code: option.value,
      title: getCourseTitle(option)
    };
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

  const buildQuestionStats = (reviews) => {
    const statsMap = new Map();
    QUESTIONS.forEach((section) => {
      section.items.forEach((question) => {
        statsMap.set(question, {
          section: section.title,
          question,
          counts: { Excellent: 0, Good: 0, Average: 0 }
        });
      });
    });

    reviews.forEach((review) => {
      (review.responses || []).forEach((response) => {
        const entry = statsMap.get(response.question);
        if (!entry) {
          return;
        }
        if (entry.counts[response.value] !== undefined) {
          entry.counts[response.value] += 1;
        }
      });
    });

    return Array.from(statsMap.values()).map((entry) => {
      const total =
        entry.counts.Excellent + entry.counts.Good + entry.counts.Average;
      const average = total
        ? (
          (entry.counts.Excellent * 3 + entry.counts.Good * 2 + entry.counts.Average) /
            total
        ).toFixed(2)
        : "0.00";
      return { ...entry, total, average };
    });
  };

  const buildCourseStats = (reviews) => {
    const map = new Map();
    reviews.forEach((review) => {
      if (!review.course_code || !review.course_title) {
        return;
      }
      const key = `${review.course_code} - ${review.course_title}`;
      if (!map.has(key)) {
        map.set(key, {
          course_code: review.course_code,
          course_title: review.course_title,
          count: 0
        });
      }
      map.get(key).count += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const setButtonLoading = (button, isLoading, loadingLabel) => {
    if (!button) {
      return;
    }
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent || "";
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingLabel : button.dataset.defaultLabel;
  };

  const invokeAiAssistant = async (payload) => {
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
  };

  const appendChatMessage = (container, role, text) => {
    if (!container) {
      return;
    }
    const message = document.createElement("div");
    message.className = `chat-message ${role}`;
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  };

  const clampChatHistory = (history, limit) => {
    if (history.length <= limit) {
      return history;
    }
    return history.slice(history.length - limit);
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

    const session = sessionData.session;
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      const createdProfile = await createProfileFromMetadata(session);
      return { session, profile: createdProfile };
    }

    return { session, profile: data };
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
        if (!result || !result.profile) {
          await supabaseClient.auth.signOut();
          showAlert(alertBox, "warning", "Profile not found. Please sign up again.");
          return;
        }
        if (result.profile.role !== "student") {
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
        if (!result || !result.profile) {
          await supabaseClient.auth.signOut();
          showAlert(alertBox, "warning", "Profile not found. Please sign up again.");
          return;
        }
        if (result.profile.role !== "teacher") {
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

  const initPasswordReset = () => {
    const requestSection = document.getElementById("resetRequestSection");
    const updateSection = document.getElementById("resetUpdateSection");
    const requestForm = document.getElementById("resetRequestForm");
    const updateForm = document.getElementById("resetUpdateForm");
    const requestAlert = document.getElementById("resetRequestAlert");
    const updateAlert = document.getElementById("resetUpdateAlert");

    if (!requestSection && !updateSection) {
      return;
    }

    const showRequestSection = () => {
      if (requestSection) {
        requestSection.classList.remove("d-none");
      }
      if (updateSection) {
        updateSection.classList.add("d-none");
      }
    };

    const showUpdateSection = () => {
      if (requestSection) {
        requestSection.classList.add("d-none");
      }
      if (updateSection) {
        updateSection.classList.remove("d-none");
      }
    };

    const isRecovery = window.location.hash.includes("type=recovery");
    if (isRecovery) {
      showUpdateSection();
    } else {
      showRequestSection();
    }

    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        showUpdateSection();
      }
    });

    if (requestForm) {
      requestForm.addEventListener("submit", async (event) => {
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

        clearDemoSession();

        const redirectTo = window.location.href.split("#")[0];
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
          showAlert(requestAlert, "danger", error.message);
          return;
        }

        requestForm.reset();
        showAlert(requestAlert, "success", "Check your email for the password reset link.");
      });
    }

    if (updateForm) {
      updateForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearAlert(updateAlert);
        if (!updateForm.checkValidity()) {
          updateForm.classList.add("was-validated");
          return;
        }

        const password = updateForm.password.value;
        const confirm = updateForm.confirmPassword.value;
        if (password !== confirm) {
          showAlert(updateAlert, "warning", "Passwords do not match.");
          return;
        }

        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
          showAlert(updateAlert, "warning", "Reset link is invalid or expired. Request a new one.");
          showRequestSection();
          return;
        }

        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) {
          showAlert(updateAlert, "danger", error.message);
          return;
        }

        showAlert(updateAlert, "success", "Password updated. Please log in.");
        try {
          await supabaseClient.auth.signOut();
        } catch (error) {
          // Ignore sign-out errors after reset.
        }
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1200);
      });
    }
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

      const email = normalizeEmail(form.email.value);
      const password = form.password.value;
      const metadata = {
        role: "student",
        full_name: form.fullName.value.trim(),
        student_id: form.studentId.value.trim(),
        email,
        department: form.department.value,
        program: form.program.value,
        semester: form.semester.value,
        section: form.section.value.trim()
      };

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });
      if (error) {
        showAlert(alertBox, "danger", error.message);
        return;
      }

      if (!data.session) {
        showAlert(alertBox, "info", "Check your email to confirm your account, then log in.");
        return;
      }

      const { error: profileError } = await supabaseClient
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            role: "student",
            full_name: metadata.full_name,
            student_id: metadata.student_id,
            email,
            department: metadata.department,
            program: metadata.program,
            semester: metadata.semester,
            section: metadata.section
          },
          { onConflict: "id" }
        );

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
      designationEl.value = normalizeDesignation(teacher.designation);
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

      const email = normalizeEmail(emailEl.value);
      if (teacher.email && email !== teacher.email.toLowerCase()) {
        showAlert(alertBox, "warning", "Use the official email listed for this teacher.");
        return;
      }

      const metadata = {
        role: "teacher",
        full_name: teacher.name,
        email,
        designation: normalizeDesignation(teacher.designation),
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
        return;
      }

      const { error: profileError } = await supabaseClient
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            role: "teacher",
            full_name: metadata.full_name,
            email,
            designation: metadata.designation,
            teacher_directory_id: metadata.teacher_directory_id
          },
          { onConflict: "id" }
        );

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
    const courseSelectEl = document.getElementById("courseSelect");
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
    renderCourseOptions(courseSelectEl, COURSE_CATALOG);
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

    const chatWindow = document.getElementById("aiChatWindow");
    const chatForm = document.getElementById("aiChatForm");
    const chatInput = document.getElementById("aiChatInput");
    const chatSend = document.getElementById("aiChatSend");
    const chatAlert = document.getElementById("aiChatAlert");
    const chatHistory = [];

    if (chatWindow && chatForm && chatInput) {
      appendChatMessage(chatWindow, "assistant", "Hi! I can help you with SFRS portal questions.");
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
        if (chatSend) {
          chatSend.disabled = true;
        }
        chatInput.disabled = true;

        if (useDemo) {
          appendChatMessage(
            chatWindow,
            "assistant",
            "AI assistant is disabled in demo mode. Please log in with a real account."
          );
        } else {
          try {
            const historyForAi = clampChatHistory(chatHistory.slice(0, -1), 8);
            const reply = await invokeAiAssistant({
              type: "chat",
              message,
              history: historyForAi
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
      const selectedCourse = getSelectedCourse(courseSelectEl);
      if (!selectedCourse) {
        showAlert(alertBox, "warning", "Please select a course.");
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
        course_code: selectedCourse.code,
        course_title: selectedCourse.title,
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

    const aiSummaryBtn = document.getElementById("aiSummaryBtn");
    const aiSummaryResult = document.getElementById("aiSummaryResult");
    const aiSummaryAlert = document.getElementById("aiSummaryAlert");
    const questionStats = buildQuestionStats(reviews);
    const courseStats = buildCourseStats(reviews);

    if (aiSummaryResult && !reviews.length) {
      aiSummaryResult.textContent = "No feedback available yet.";
    }

    if (aiSummaryBtn) {
      if (!reviews.length) {
        aiSummaryBtn.disabled = true;
      }
      aiSummaryBtn.addEventListener("click", async () => {
        clearAlert(aiSummaryAlert);
        if (!reviews.length) {
          if (aiSummaryResult) {
            aiSummaryResult.textContent = "No feedback available yet.";
          }
          return;
        }
        if (useDemo) {
          showAlert(aiSummaryAlert, "warning", "AI summary is disabled in demo mode. Please log in.");
          return;
        }

        setButtonLoading(aiSummaryBtn, true, "Generating...");
        if (aiSummaryResult) {
          aiSummaryResult.textContent = "Generating summary...";
        }

        try {
          const result = await invokeAiAssistant({
            type: "summary",
            payload: {
              teacher_name: profile.full_name,
              review_count: reviews.length,
              overall_question: overallQuestion,
              overall_counts: counts,
              overall_average: averageScore,
              question_stats: questionStats,
              course_stats: courseStats,
              scale: { Excellent: 3, Good: 2, Average: 1 }
            }
          });
          if (aiSummaryResult) {
            aiSummaryResult.textContent = result || "No summary returned.";
          }
        } catch (error) {
          showAlert(aiSummaryAlert, "danger", error.message || "Unable to generate AI summary.");
          if (aiSummaryResult) {
            aiSummaryResult.textContent = "Unable to generate summary.";
          }
        } finally {
          setButtonLoading(aiSummaryBtn, false, "Generating...");
        }
      });
    }
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
      default:
        break;
    }
  };

  document.addEventListener("DOMContentLoaded", initPage);
})();
