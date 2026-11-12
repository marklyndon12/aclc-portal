import { Router, type Request } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { verifyQr } from "../lib/qr";
import { env } from "../config/env";

const router = Router();

router.use(requireAuth, requireRole(["teacher"]));

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const STUDENT_STATUSES = ["Present", "Late", "Absent", "Excused"] as const;

interface TeacherRow {
  teacher_id: number;
  full_name: string;
  department_id: number | null;
  specialization: string;
}

interface ClassRow {
  class_id: number;
  subject_id: number;
  section_id: number;
  teacher_id: number | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
}

interface RosterStudent {
  student_id: number;
  user_id: string | null;
  full_name: string;
  student_number: string;
}

function dbFailure(error: unknown, message: string, code: string): never {
  console.error(message, error);
  throw new ApiError(500, message, code);
}

const hm = (value: string | null): string | null => (value ? value.slice(0, 5) : null);

async function getTeacher(req: Request): Promise<TeacherRow> {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("teacher_id, full_name, department_id, specialization")
    .eq("user_id", req.user!.user_id)
    .maybeSingle();
  if (error) dbFailure(error, "Could not read teacher profile", "TEACHER_READ_FAILED");
  if (!data) {
    throw new ApiError(404, "No teacher profile is linked to this account", "TEACHER_PROFILE_MISSING");
  }
  return data as TeacherRow;
}

// Teachers can only touch classes assigned to them.
async function getOwnedClass(teacherId: number, classId: number) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("class_id, subject_id, section_id, teacher_id, day, start_time, end_time, room")
    .eq("class_id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (error) dbFailure(error, "Could not read class", "CLASS_READ_FAILED");
  if (!data) throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  const row = data as ClassRow;

  const [subjectResult, sectionResult] = await Promise.all([
    supabaseAdmin
      .from("subjects")
      .select("subject_code, subject_name, units")
      .eq("subject_id", row.subject_id)
      .maybeSingle(),
    supabaseAdmin
      .from("sections")
      .select("section_name, year_level, course_id")
      .eq("section_id", row.section_id)
      .maybeSingle(),
  ]);
  if (subjectResult.error) dbFailure(subjectResult.error, "Could not read subject", "SUBJECT_READ_FAILED");
  if (sectionResult.error) dbFailure(sectionResult.error, "Could not read section", "SECTION_READ_FAILED");
  const subject = subjectResult.data;
  const section = sectionResult.data;
  if (!subject || !section) throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");

  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("course_code")
    .eq("course_id", section.course_id)
    .maybeSingle();

  return {
    row,
    subject: subject as { subject_code: string; subject_name: string; units: string },
    section: section as { section_name: string; year_level: string | null; course_id: number },
    courseCode: (course?.course_code as string | undefined) ?? "",
  };
}

async function loadRoster(sectionName: string): Promise<RosterStudent[]> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("student_id, user_id, full_name, student_number")
    .eq("section", sectionName)
    .order("full_name");
  if (error) dbFailure(error, "Could not load students", "ROSTER_FAILED");
  return (data ?? []) as RosterStudent[];
}

function describeClass(owned: Awaited<ReturnType<typeof getOwnedClass>>, enrolled: number) {
  return {
    class_id: owned.row.class_id,
    subject_code: owned.subject.subject_code,
    subject_name: owned.subject.subject_name,
    units: Number(owned.subject.units) || 0,
    section_id: owned.row.section_id,
    section_name: owned.section.section_name,
    course_code: owned.courseCode,
    year_level: owned.section.year_level ?? "",
    day: owned.row.day,
    start_time: hm(owned.row.start_time),
    end_time: hm(owned.row.end_time),
    room: owned.row.room,
    enrolled,
  };
}

function gpaFor(average: number): number {
  if (average >= 97) return 1;
  if (average >= 94) return 1.25;
  if (average >= 91) return 1.5;
  if (average >= 88) return 1.75;
  if (average >= 85) return 2;
  if (average >= 82) return 2.25;
  if (average >= 79) return 2.5;
  if (average >= 76) return 2.75;
  if (average >= 75) return 3;
  return 5;
}

// ───────────────────────── Overview: my profile, my classes, recent scans ─────────────────────────

router.get("/classes", async (req, res, next) => {
  try {
    const date = DATE.optional().parse(req.query.date);
    const teacher = await getTeacher(req);

    const { data: classes, error } = await supabaseAdmin
      .from("classes")
      .select("class_id, subject_id, section_id, teacher_id, day, start_time, end_time, room")
      .eq("teacher_id", teacher.teacher_id);
    if (error) dbFailure(error, "Could not load classes", "CLASSES_FAILED");
    const rows = (classes ?? []) as ClassRow[];

    const subjectIds = [...new Set(rows.map((row) => row.subject_id))];
    const sectionIds = [...new Set(rows.map((row) => row.section_id))];

    const [subjects, sections, departmentResult] = await Promise.all([
      subjectIds.length
        ? supabaseAdmin
            .from("subjects")
            .select("subject_id, subject_code, subject_name, units")
            .in("subject_id", subjectIds)
        : Promise.resolve({ data: [], error: null }),
      sectionIds.length
        ? supabaseAdmin
            .from("sections")
            .select("section_id, section_name, year_level, course_id")
            .in("section_id", sectionIds)
        : Promise.resolve({ data: [], error: null }),
      teacher.department_id
        ? supabaseAdmin
            .from("departments")
            .select("department_name")
            .eq("department_id", teacher.department_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (subjects.error || sections.error) {
      dbFailure(subjects.error ?? sections.error, "Could not load classes", "CLASSES_FAILED");
    }

    const courseIds = [...new Set((sections.data ?? []).map((row) => row.course_id as number))];
    const { data: courses } = courseIds.length
      ? await supabaseAdmin.from("courses").select("course_id, course_code").in("course_id", courseIds)
      : { data: [] };

    const sectionNames = (sections.data ?? []).map((row) => row.section_name as string);
    const { data: students } = sectionNames.length
      ? await supabaseAdmin.from("students").select("section").in("section", sectionNames)
      : { data: [] };
    const enrolledBySection = new Map<string, number>();
    for (const student of students ?? []) {
      const name = student.section as string;
      enrolledBySection.set(name, (enrolledBySection.get(name) ?? 0) + 1);
    }

    const subjectById = new Map((subjects.data ?? []).map((row) => [row.subject_id as number, row]));
    const sectionById = new Map((sections.data ?? []).map((row) => [row.section_id as number, row]));
    const courseCode = new Map((courses ?? []).map((row) => [row.course_id as number, row.course_code as string]));

    const result = rows.map((row) => {
      const subject = subjectById.get(row.subject_id);
      const section = sectionById.get(row.section_id);
      return {
        class_id: row.class_id,
        subject_code: (subject?.subject_code as string) ?? "",
        subject_name: (subject?.subject_name as string) ?? "",
        units: Number(subject?.units) || 0,
        section_id: row.section_id,
        section_name: (section?.section_name as string) ?? "",
        course_code: section ? (courseCode.get(section.course_id as number) ?? "") : "",
        year_level: (section?.year_level as string | null) ?? "",
        day: row.day,
        start_time: hm(row.start_time),
        end_time: hm(row.end_time),
        room: row.room,
        enrolled: enrolledBySection.get((section?.section_name as string) ?? "") ?? 0,
      };
    });

    // Latest attendance recorded today in my classes (feeds the "Recent scans" box)
    let recent: { id: number; student_name: string; status: string; class_label: string }[] = [];
    if (date && rows.length > 0) {
      const { data: attendance } = await supabaseAdmin
        .from("attendance")
        .select("attendance_id, student_id, status, class_id")
        .in("class_id", rows.map((row) => row.class_id))
        .eq("attendance_date", date)
        .order("attendance_id", { ascending: false })
        .limit(8);
      const studentIds = [...new Set((attendance ?? []).map((row) => row.student_id as number))];
      const { data: names } = studentIds.length
        ? await supabaseAdmin.from("students").select("student_id, full_name").in("student_id", studentIds)
        : { data: [] };
      const nameById = new Map((names ?? []).map((row) => [row.student_id as number, row.full_name as string]));
      const labelByClass = new Map(result.map((item) => [item.class_id, item.subject_code]));
      recent = (attendance ?? []).map((row) => ({
        id: row.attendance_id as number,
        student_name: nameById.get(row.student_id as number) ?? "Student",
        status: row.status as string,
        class_label: labelByClass.get(row.class_id as number) ?? "",
      }));
    }

    res.json({
      profile: {
        teacher_id: teacher.teacher_id,
        full_name: teacher.full_name,
        department: (departmentResult.data?.department_name as string | undefined) ?? null,
        specialization: teacher.specialization,
      },
      classes: result,
      recent,
    });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── One class: roster ─────────────────────────

router.get("/classes/:id/students", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const teacher = await getTeacher(req);
    const owned = await getOwnedClass(teacher.teacher_id, id);
    const roster = await loadRoster(owned.section.section_name);
    res.json({
      class: describeClass(owned, roster.length),
      students: roster.map((student) => ({
        student_id: student.student_id,
        student_number: student.student_number,
        full_name: student.full_name,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Student attendance ─────────────────────────

router.get("/classes/:id/attendance", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const date = DATE.parse(req.query.date);
    const teacher = await getTeacher(req);
    const owned = await getOwnedClass(teacher.teacher_id, id);
    const roster = await loadRoster(owned.section.section_name);

    const { data, error } = await supabaseAdmin
      .from("attendance")
      .select("student_id, status")
      .eq("class_id", id)
      .eq("attendance_date", date);
    if (error) dbFailure(error, "Could not load attendance", "ATTENDANCE_READ_FAILED");
    const statusByStudent = new Map((data ?? []).map((row) => [row.student_id as number, row.status as string]));

    res.json({
      class: describeClass(owned, roster.length),
      date,
      students: roster.map((student) => ({
        student_id: student.student_id,
        student_number: student.student_number,
        full_name: student.full_name,
        status: statusByStudent.get(student.student_id) ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

async function saveAttendance(
  classId: number,
  date: string,
  records: { student_id: number; status: string }[]
) {
  const { data: existing, error } = await supabaseAdmin
    .from("attendance")
    .select("attendance_id, student_id")
    .eq("class_id", classId)
    .eq("attendance_date", date);
  if (error) dbFailure(error, "Could not read attendance", "ATTENDANCE_READ_FAILED");
  const idByStudent = new Map((existing ?? []).map((row) => [row.student_id as number, row.attendance_id as number]));

  const inserts: Record<string, unknown>[] = [];
  for (const record of records) {
    const existingId = idByStudent.get(record.student_id);
    if (existingId) {
      const { error: updateError } = await supabaseAdmin
        .from("attendance")
        .update({ status: record.status })
        .eq("attendance_id", existingId);
      if (updateError) dbFailure(updateError, "Could not update attendance", "ATTENDANCE_UPDATE_FAILED");
    } else {
      inserts.push({
        class_id: classId,
        student_id: record.student_id,
        attendance_date: date,
        status: record.status,
      });
    }
  }
  if (inserts.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("attendance").insert(inserts);
    if (insertError) dbFailure(insertError, "Could not save attendance", "ATTENDANCE_CREATE_FAILED");
  }
}

const attendanceBody = z.object({
  date: DATE,
  records: z
    .array(
      z.object({
        student_id: z.coerce.number().int().positive(),
        status: z.enum(STUDENT_STATUSES),
      })
    )
    .min(1)
    .max(300),
});

router.put("/classes/:id/attendance", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = attendanceBody.parse(req.body);
    const teacher = await getTeacher(req);
    const owned = await getOwnedClass(teacher.teacher_id, id);
    const roster = await loadRoster(owned.section.section_name);

    const allowed = new Set(roster.map((student) => student.student_id));
    if (body.records.some((record) => !allowed.has(record.student_id))) {
      throw new ApiError(400, "One or more students are not in this class", "STUDENT_NOT_IN_CLASS");
    }

    await saveAttendance(id, body.date, body.records);
    res.json({ saved: body.records.length });
  } catch (error) {
    next(error);
  }
});

// QR scan: the student's live ID looks like "<student_id>|<issued-at-seconds>".
router.post("/attendance/scan", async (req, res, next) => {
  try {
    const body = z
      .object({
        class_id: z.coerce.number().int().positive(),
        payload: z.string().trim().min(3).max(100),
        date: DATE,
      })
      .parse(req.body);

    const teacher = await getTeacher(req);
    const owned = await getOwnedClass(teacher.teacher_id, body.class_id);

    // The code must carry a signature only this server can produce, so it can't be forged.
    const claims = verifyQr(body.payload);
    if (!claims) {
      throw new ApiError(400, "That is not a valid student QR code", "QR_INVALID");
    }
    const studentId = claims.studentId;
    const ageSeconds = Date.now() / 1000 - claims.issuedAt;
    if (ageSeconds > env.QR_MAX_AGE_SECONDS || ageSeconds < -env.QR_MAX_FUTURE_SECONDS) {
      throw new ApiError(400, "That QR code has expired", "QR_EXPIRED");
    }

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("student_id, full_name, section")
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) dbFailure(error, "Could not read student", "STUDENT_READ_FAILED");
    if (!student) throw new ApiError(404, "Student not found", "STUDENT_NOT_FOUND");
    if (student.section !== owned.section.section_name) {
      throw new ApiError(
        403,
        `${student.full_name} is not in ${owned.section.section_name}`,
        "STUDENT_NOT_IN_CLASS"
      );
    }

    await saveAttendance(body.class_id, body.date, [{ student_id: studentId, status: "Present" }]);
    res.json({
      student_name: student.full_name,
      status: "Present",
      time: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Grades ─────────────────────────

router.get("/classes/:id/grades", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const teacher = await getTeacher(req);
    const owned = await getOwnedClass(teacher.teacher_id, id);
    const roster = await loadRoster(owned.section.section_name);

    const { data, error } = await supabaseAdmin
      .from("grades")
      .select("student_id, prelim, midterm, prefinal, final, gpa, remarks")
      .eq("class_id", id);
    if (error) dbFailure(error, "Could not load grades", "GRADES_READ_FAILED");
    const gradeByStudent = new Map((data ?? []).map((row) => [row.student_id as number, row]));

    res.json({
      class: describeClass(owned, roster.length),
      students: roster.map((student) => {
        const grade = gradeByStudent.get(student.student_id);
        return {
          student_id: student.student_id,
          student_number: student.student_number,
          full_name: student.full_name,
          prelim: grade ? (grade.prelim as number | null) : null,
          midterm: grade ? (grade.midterm as number | null) : null,
          prefinal: grade ? (grade.prefinal as number | null) : null,
          final: grade ? (grade.final as number | null) : null,
          gpa: grade ? (grade.gpa as number | null) : null,
          remarks: grade ? (grade.remarks as string | null) : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

const gradeBody = z.object({
  student_id: z.coerce.number().int().positive(),
  prelim: z.number().min(0).max(100).nullable(),
  midterm: z.number().min(0).max(100).nullable(),
  prefinal: z.number().min(0).max(100).nullable(),
  final: z.number().min(0).max(100).nullable(),
});

router.put("/classes/:id/grades", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = gradeBody.parse(req.body);
    const teacher = await getTeacher(req);
    const owned = await getOwnedClass(teacher.teacher_id, id);
    const roster = await loadRoster(owned.section.section_name);

    const student = roster.find((item) => item.student_id === body.student_id);
    if (!student) throw new ApiError(400, "That student is not in this class", "STUDENT_NOT_IN_CLASS");

    const terms = [body.prelim, body.midterm, body.prefinal, body.final].filter(
      (value): value is number => typeof value === "number"
    );
    const average =
      terms.length > 0 ? terms.reduce((sum, value) => sum + value, 0) / terms.length : null;

    const payload = {
      student_id: body.student_id,
      class_id: id,
      user_id: student.user_id,
      subject_name: owned.subject.subject_name,
      subject_code: owned.subject.subject_code,
      prelim: body.prelim,
      midterm: body.midterm,
      prefinal: body.prefinal,
      final: body.final,
      grade_value: average === null ? null : Math.round(average * 100) / 100,
      gpa: average === null ? null : gpaFor(average),
      remarks: average === null ? "N/A" : average >= 75 ? "Passed" : "Failed",
      status: average === null ? "Pending" : average >= 75 ? "Passed" : "Failed",
    };

    const { data: existing, error: readError } = await supabaseAdmin
      .from("grades")
      .select("grade_id")
      .eq("student_id", body.student_id)
      .eq("class_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read grade", "GRADE_READ_FAILED");

    if (existing) {
      const { error } = await supabaseAdmin.from("grades").update(payload).eq("grade_id", existing.grade_id);
      if (error) dbFailure(error, "Could not update grade", "GRADE_UPDATE_FAILED");
    } else {
      const { error } = await supabaseAdmin.from("grades").insert(payload);
      if (error) dbFailure(error, "Could not save grade", "GRADE_CREATE_FAILED");
    }

    res.json({ student_id: body.student_id, gpa: payload.gpa, remarks: payload.remarks });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── My own attendance (recorded by the admin) ─────────────────────────

router.get("/my-attendance", async (req, res, next) => {
  try {
    const teacher = await getTeacher(req);
    const { data, error } = await supabaseAdmin
      .from("attendance_teachers")
      .select("att_teacher_id, date, status, time_in, time_out")
      .eq("teacher_id", teacher.teacher_id)
      .order("date", { ascending: false })
      .limit(200);
    if (error) dbFailure(error, "Could not load attendance", "MY_ATTENDANCE_FAILED");
    res.json({
      records: (data ?? []).map((row) => ({
        id: row.att_teacher_id as number,
        date: row.date as string,
        status: row.status as string,
        time_in: (row.time_in as string | null) ?? null,
        time_out: (row.time_out as string | null) ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Announcements for teachers ─────────────────────────

router.get("/announcements", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, content, audience, created_at, author_name")
      .in("audience", ["Everyone", "Teachers"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) dbFailure(error, "Could not load announcements", "ANNOUNCEMENTS_FAILED");
    res.json({
      announcements: (data ?? []).map((row) => ({
        announcement_id: row.id as number,
        title: row.title as string,
        body: row.content as string,
        audience: row.audience as string,
        created_at: row.created_at as string,
        author_name: (row.author_name as string | null) ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Quizzes ─────────────────────────

const questionSchema = z
  .object({
    type: z.enum(["multiple_choice", "true_false", "short_answer"]),
    text: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1).max(300)).max(6).optional(),
    correct_answer: z.string().trim().max(300).nullable().optional(),
    points: z.number().min(0.5).max(100),
  })
  .superRefine((question, ctx) => {
    if (question.type === "multiple_choice") {
      const options = question.options ?? [];
      if (options.length < 2) {
        ctx.addIssue({ code: "custom", message: "Multiple choice needs at least 2 options", path: ["options"] });
      }
      if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
        ctx.addIssue({ code: "custom", message: "Options must be different from each other", path: ["options"] });
      }
      if (!question.correct_answer || !options.includes(question.correct_answer)) {
        ctx.addIssue({ code: "custom", message: "Choose which option is correct", path: ["correct_answer"] });
      }
    }
    if (
      question.type === "true_false" &&
      question.correct_answer !== "True" &&
      question.correct_answer !== "False"
    ) {
      ctx.addIssue({ code: "custom", message: "Choose True or False as the answer", path: ["correct_answer"] });
    }
  });

const quizCreateSchema = z.object({
  class_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(2000).nullable().optional(),
  deadline: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid deadline")
    .nullable()
    .optional(),
  questions: z.array(questionSchema).min(1).max(100),
});

async function getOwnedQuiz(req: Request, quizId: string) {
  const { data, error } = await supabaseAdmin
    .from("quizzes")
    .select("quiz_id, class_id, teacher_id, title, instructions, deadline, created_at")
    .eq("quiz_id", quizId)
    .eq("teacher_id", req.user!.user_id)
    .maybeSingle();
  if (error) dbFailure(error, "Could not read quiz", "QUIZ_READ_FAILED");
  if (!data) throw new ApiError(404, "Quiz not found", "QUIZ_NOT_FOUND");
  return data as {
    quiz_id: string;
    class_id: number | null;
    title: string;
    instructions: string | null;
    deadline: string | null;
    created_at: string;
  };
}

router.get("/quizzes", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .select("quiz_id, class_id, title, instructions, deadline, created_at")
      .eq("teacher_id", req.user!.user_id)
      .order("created_at", { ascending: false });
    if (error) dbFailure(error, "Could not load quizzes", "QUIZZES_FAILED");
    const quizzes = data ?? [];
    const ids = quizzes.map((quiz) => quiz.quiz_id as string);
    const classIds = [...new Set(quizzes.map((quiz) => quiz.class_id as number | null).filter((id): id is number => id !== null))];

    const [questions, submissions, classes] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("quiz_questions").select("quiz_id, points").in("quiz_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabaseAdmin.from("student_quiz_submissions").select("quiz_id, status").in("quiz_id", ids)
        : Promise.resolve({ data: [], error: null }),
      classIds.length
        ? supabaseAdmin.from("classes").select("class_id, subject_id, section_id").in("class_id", classIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (questions.error || submissions.error || classes.error) {
      dbFailure(questions.error ?? submissions.error ?? classes.error, "Could not load quizzes", "QUIZZES_FAILED");
    }

    const subjectIds = [...new Set((classes.data ?? []).map((row) => row.subject_id as number))];
    const sectionIds = [...new Set((classes.data ?? []).map((row) => row.section_id as number))];
    const [subjects, sections] = await Promise.all([
      subjectIds.length
        ? supabaseAdmin.from("subjects").select("subject_id, subject_code").in("subject_id", subjectIds)
        : Promise.resolve({ data: [] }),
      sectionIds.length
        ? supabaseAdmin.from("sections").select("section_id, section_name").in("section_id", sectionIds)
        : Promise.resolve({ data: [] }),
    ]);
    const subjectCode = new Map((subjects.data ?? []).map((row) => [row.subject_id as number, row.subject_code as string]));
    const sectionName = new Map((sections.data ?? []).map((row) => [row.section_id as number, row.section_name as string]));
    const classLabel = new Map(
      (classes.data ?? []).map((row) => [
        row.class_id as number,
        {
          subject_code: subjectCode.get(row.subject_id as number) ?? "",
          section_name: sectionName.get(row.section_id as number) ?? "",
        },
      ])
    );

    res.json({
      quizzes: quizzes.map((quiz) => {
        const own = (questions.data ?? []).filter((row) => row.quiz_id === quiz.quiz_id);
        const subs = (submissions.data ?? []).filter((row) => row.quiz_id === quiz.quiz_id);
        const label = classLabel.get(quiz.class_id as number);
        return {
          quiz_id: quiz.quiz_id as string,
          title: quiz.title as string,
          deadline: (quiz.deadline as string | null) ?? null,
          created_at: quiz.created_at as string,
          class_id: quiz.class_id as number | null,
          subject_code: label?.subject_code ?? "",
          section_name: label?.section_name ?? "",
          question_count: own.length,
          max_score: own.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
          submission_count: subs.length,
          pending_count: subs.filter((row) => row.status !== "Graded").length,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/quizzes", async (req, res, next) => {
  try {
    const body = quizCreateSchema.parse(req.body);
    const teacher = await getTeacher(req);
    await getOwnedClass(teacher.teacher_id, body.class_id);

    const { data: quiz, error } = await supabaseAdmin
      .from("quizzes")
      .insert({
        class_id: body.class_id,
        teacher_id: req.user!.user_id,
        title: body.title,
        instructions: body.instructions || null,
        deadline: body.deadline ? new Date(body.deadline).toISOString() : null,
      })
      .select("quiz_id")
      .single();
    if (error || !quiz) dbFailure(error, "Could not create quiz", "QUIZ_CREATE_FAILED");

    const { error: questionsError } = await supabaseAdmin.from("quiz_questions").insert(
      body.questions.map((question) => ({
        quiz_id: quiz.quiz_id,
        question_type: question.type,
        question_text: question.text,
        options: question.type === "multiple_choice" ? (question.options ?? []) : null,
        correct_answer: question.type === "short_answer" ? null : (question.correct_answer ?? null),
        points: question.points,
      }))
    );
    if (questionsError) {
      await supabaseAdmin.from("quizzes").delete().eq("quiz_id", quiz.quiz_id);
      dbFailure(questionsError, "Could not save the questions", "QUESTIONS_CREATE_FAILED");
    }

    res.status(201).json({ quiz_id: quiz.quiz_id as string });
  } catch (error) {
    next(error);
  }
});

router.get("/quizzes/:id", async (req, res, next) => {
  try {
    const quizId = z.string().uuid().parse(req.params.id);
    const quiz = await getOwnedQuiz(req, quizId);

    const [questions, submissions] = await Promise.all([
      supabaseAdmin
        .from("quiz_questions")
        .select("question_id, question_type, question_text, options, correct_answer, points")
        .eq("quiz_id", quizId),
      supabaseAdmin
        .from("student_quiz_submissions")
        .select("submission_id, student_id, submitted_at, total_score, status")
        .eq("quiz_id", quizId)
        .order("submitted_at", { ascending: false }),
    ]);
    if (questions.error || submissions.error) {
      dbFailure(questions.error ?? submissions.error, "Could not load quiz", "QUIZ_READ_FAILED");
    }

    const userIds = (submissions.data ?? []).map((row) => row.student_id as string);
    const { data: students } = userIds.length
      ? await supabaseAdmin.from("students").select("user_id, full_name, student_number").in("user_id", userIds)
      : { data: [] };
    const studentByUser = new Map((students ?? []).map((row) => [row.user_id as string, row]));

    res.json({
      quiz,
      questions: (questions.data ?? []).map((row) => ({
        question_id: row.question_id as string,
        type: (row.question_type as string | null) ?? "short_answer",
        text: row.question_text as string,
        options: Array.isArray(row.options) ? (row.options as string[]) : [],
        correct_answer: (row.correct_answer as string | null) ?? null,
        points: Number(row.points) || 0,
      })),
      submissions: (submissions.data ?? []).map((row) => {
        const student = studentByUser.get(row.student_id as string);
        return {
          submission_id: row.submission_id as string,
          student_name: (student?.full_name as string | undefined) ?? "Student",
          student_number: (student?.student_number as string | undefined) ?? "",
          submitted_at: row.submitted_at as string,
          total_score: Number(row.total_score) || 0,
          status: row.status as string,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/quizzes/:id/submissions/:sid", async (req, res, next) => {
  try {
    const quizId = z.string().uuid().parse(req.params.id);
    const submissionId = z.string().uuid().parse(req.params.sid);
    await getOwnedQuiz(req, quizId);

    const { data: submission, error } = await supabaseAdmin
      .from("student_quiz_submissions")
      .select("submission_id, total_score, status")
      .eq("submission_id", submissionId)
      .eq("quiz_id", quizId)
      .maybeSingle();
    if (error) dbFailure(error, "Could not read submission", "SUBMISSION_READ_FAILED");
    if (!submission) throw new ApiError(404, "Submission not found", "SUBMISSION_NOT_FOUND");

    const [answers, questions] = await Promise.all([
      supabaseAdmin
        .from("student_answers")
        .select("answer_id, question_id, student_answer, is_correct, points_awarded")
        .eq("submission_id", submissionId),
      supabaseAdmin
        .from("quiz_questions")
        .select("question_id, question_type, question_text, correct_answer, points")
        .eq("quiz_id", quizId),
    ]);
    if (answers.error || questions.error) {
      dbFailure(answers.error ?? questions.error, "Could not read submission", "SUBMISSION_READ_FAILED");
    }
    const questionById = new Map((questions.data ?? []).map((row) => [row.question_id as string, row]));

    res.json({
      submission: {
        submission_id: submission.submission_id as string,
        total_score: Number(submission.total_score) || 0,
        status: submission.status as string,
      },
      answers: (answers.data ?? []).map((row) => {
        const question = questionById.get(row.question_id as string);
        return {
          answer_id: row.answer_id as string,
          question_text: (question?.question_text as string | undefined) ?? "",
          type: ((question?.question_type as string | null | undefined) ?? "short_answer"),
          correct_answer: (question?.correct_answer as string | null | undefined) ?? null,
          max_points: Number(question?.points) || 0,
          student_answer: (row.student_answer as string | null) ?? "",
          is_correct: (row.is_correct as boolean | null) ?? null,
          points_awarded: Number(row.points_awarded) || 0,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

const gradeQuizBody = z.object({
  grades: z
    .array(z.object({ answer_id: z.string().uuid(), points_awarded: z.number().min(0).max(100) }))
    .min(1)
    .max(200),
});

router.put("/quizzes/:id/submissions/:sid/grade", async (req, res, next) => {
  try {
    const quizId = z.string().uuid().parse(req.params.id);
    const submissionId = z.string().uuid().parse(req.params.sid);
    const body = gradeQuizBody.parse(req.body);
    await getOwnedQuiz(req, quizId);

    const { data: submission } = await supabaseAdmin
      .from("student_quiz_submissions")
      .select("submission_id")
      .eq("submission_id", submissionId)
      .eq("quiz_id", quizId)
      .maybeSingle();
    if (!submission) throw new ApiError(404, "Submission not found", "SUBMISSION_NOT_FOUND");

    const [answers, questions] = await Promise.all([
      supabaseAdmin
        .from("student_answers")
        .select("answer_id, question_id, points_awarded")
        .eq("submission_id", submissionId),
      supabaseAdmin.from("quiz_questions").select("question_id, points").eq("quiz_id", quizId),
    ]);
    if (answers.error || questions.error) {
      dbFailure(answers.error ?? questions.error, "Could not read answers", "ANSWERS_READ_FAILED");
    }
    const maxByQuestion = new Map((questions.data ?? []).map((row) => [row.question_id as string, Number(row.points) || 0]));
    const questionByAnswer = new Map((answers.data ?? []).map((row) => [row.answer_id as string, row.question_id as string]));
    const awarded = new Map((answers.data ?? []).map((row) => [row.answer_id as string, Number(row.points_awarded) || 0]));

    for (const grade of body.grades) {
      const questionId = questionByAnswer.get(grade.answer_id);
      if (!questionId) throw new ApiError(400, "That answer is not part of this submission", "ANSWER_NOT_FOUND");
      const max = maxByQuestion.get(questionId) ?? 0;
      const points = Math.min(grade.points_awarded, max);
      const { error } = await supabaseAdmin
        .from("student_answers")
        .update({ points_awarded: points, is_correct: points >= max && max > 0 })
        .eq("answer_id", grade.answer_id);
      if (error) dbFailure(error, "Could not save grade", "GRADE_SAVE_FAILED");
      awarded.set(grade.answer_id, points);
    }

    const total = [...awarded.values()].reduce((sum, value) => sum + value, 0);
    const { error } = await supabaseAdmin
      .from("student_quiz_submissions")
      .update({ total_score: total, status: "Graded" })
      .eq("submission_id", submissionId);
    if (error) dbFailure(error, "Could not update the score", "SCORE_UPDATE_FAILED");

    res.json({ total_score: total, status: "Graded" });
  } catch (error) {
    next(error);
  }
});

router.delete("/quizzes/:id", async (req, res, next) => {
  try {
    const quizId = z.string().uuid().parse(req.params.id);
    await getOwnedQuiz(req, quizId);

    const { data: submissions } = await supabaseAdmin
      .from("student_quiz_submissions")
      .select("submission_id")
      .eq("quiz_id", quizId);
    const submissionIds = (submissions ?? []).map((row) => row.submission_id as string);
    if (submissionIds.length > 0) {
      const { error } = await supabaseAdmin.from("student_answers").delete().in("submission_id", submissionIds);
      if (error) dbFailure(error, "Could not delete answers", "QUIZ_DELETE_FAILED");
      const { error: subError } = await supabaseAdmin.from("student_quiz_submissions").delete().eq("quiz_id", quizId);
      if (subError) dbFailure(subError, "Could not delete submissions", "QUIZ_DELETE_FAILED");
    }
    const { error: questionError } = await supabaseAdmin.from("quiz_questions").delete().eq("quiz_id", quizId);
    if (questionError) dbFailure(questionError, "Could not delete questions", "QUIZ_DELETE_FAILED");
    const { error } = await supabaseAdmin.from("quizzes").delete().eq("quiz_id", quizId);
    if (error) dbFailure(error, "Could not delete quiz", "QUIZ_DELETE_FAILED");

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
