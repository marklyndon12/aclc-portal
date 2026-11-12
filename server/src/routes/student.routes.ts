import { Router, type Request } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { signQr } from "../lib/qr";

const router = Router();

router.use(requireAuth, requireRole(["student"]));

interface StudentRow {
  student_id: number;
  user_id: string | null;
  full_name: string;
  student_number: string;
  section: string;
  year_level: string;
  course_year: string | null;
}

interface MyClass {
  class_id: number;
  subject_code: string;
  subject_name: string;
  units: number;
  teacher_name: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
}

function dbFailure(error: unknown, message: string, code: string): never {
  console.error(message, error);
  throw new ApiError(500, message, code);
}

const hm = (value: string | null): string | null => (value ? value.slice(0, 5) : null);

async function getStudent(req: Request): Promise<StudentRow> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("student_id, user_id, full_name, student_number, section, year_level, course_year")
    .eq("user_id", req.user!.user_id)
    .maybeSingle();
  if (error) dbFailure(error, "Could not read student profile", "STUDENT_READ_FAILED");
  if (!data) {
    throw new ApiError(404, "No student profile is linked to this account", "STUDENT_PROFILE_MISSING");
  }
  return data as StudentRow;
}

// Classes are given to a section, so a student's classes are their section's classes.
async function loadMyClasses(student: StudentRow): Promise<MyClass[]> {
  if (!student.section || student.section === "Unassigned") return [];

  const { data: section, error: sectionError } = await supabaseAdmin
    .from("sections")
    .select("section_id")
    .eq("section_name", student.section)
    .maybeSingle();
  if (sectionError) dbFailure(sectionError, "Could not read section", "SECTION_READ_FAILED");
  if (!section) return [];

  const { data: classes, error } = await supabaseAdmin
    .from("classes")
    .select("class_id, subject_id, teacher_id, day, start_time, end_time, room")
    .eq("section_id", section.section_id);
  if (error) dbFailure(error, "Could not load classes", "CLASSES_FAILED");
  const rows = classes ?? [];
  if (rows.length === 0) return [];

  const subjectIds = [...new Set(rows.map((row) => row.subject_id as number))];
  const teacherIds = [...new Set(rows.map((row) => row.teacher_id as number | null).filter((id): id is number => id !== null))];

  const [subjects, teachers] = await Promise.all([
    supabaseAdmin.from("subjects").select("subject_id, subject_code, subject_name, units").in("subject_id", subjectIds),
    teacherIds.length
      ? supabaseAdmin.from("teachers").select("teacher_id, full_name").in("teacher_id", teacherIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (subjects.error || teachers.error) {
    dbFailure(subjects.error ?? teachers.error, "Could not load classes", "CLASSES_FAILED");
  }
  const subjectById = new Map((subjects.data ?? []).map((row) => [row.subject_id as number, row]));
  const teacherById = new Map((teachers.data ?? []).map((row) => [row.teacher_id as number, row.full_name as string]));

  return rows.map((row) => {
    const subject = subjectById.get(row.subject_id as number);
    return {
      class_id: row.class_id as number,
      subject_code: (subject?.subject_code as string) ?? "",
      subject_name: (subject?.subject_name as string) ?? "",
      units: Number(subject?.units) || 0,
      teacher_name: row.teacher_id ? (teacherById.get(row.teacher_id as number) ?? null) : null,
      day: row.day as string | null,
      start_time: hm(row.start_time as string | null),
      end_time: hm(row.end_time as string | null),
      room: row.room as string | null,
    };
  });
}

// ───────────────────────── Overview: profile, classes, latest grades ─────────────────────────

router.get("/overview", async (req, res, next) => {
  try {
    const student = await getStudent(req);
    const classes = await loadMyClasses(student);

    const { data: grades, error } = await supabaseAdmin
      .from("grades")
      .select("grade_id, subject_code, subject_name, grade_value, gpa, remarks")
      .eq("student_id", student.student_id)
      .not("grade_value", "is", null)
      .order("grade_id", { ascending: false })
      .limit(4);
    if (error) dbFailure(error, "Could not load grades", "GRADES_FAILED");

    res.json({
      profile: {
        student_id: student.student_id,
        full_name: student.full_name,
        student_number: student.student_number,
        section: student.section,
        year_level: student.year_level,
        course_code: student.course_year && student.course_year !== "N/A" ? student.course_year : null,
      },
      classes,
      recent_grades: (grades ?? []).map((row) => ({
        id: row.grade_id as number,
        subject_code: (row.subject_code as string | null) ?? "",
        subject_name: row.subject_name as string,
        grade_value: row.grade_value === null ? null : Number(row.grade_value),
        gpa: row.gpa === null ? null : Number(row.gpa),
        remarks: (row.remarks as string | null) ?? "N/A",
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Grades ─────────────────────────

router.get("/grades", async (req, res, next) => {
  try {
    const student = await getStudent(req);
    const classes = await loadMyClasses(student);

    const { data, error } = await supabaseAdmin
      .from("grades")
      .select("class_id, prelim, midterm, prefinal, final, grade_value, gpa, remarks")
      .eq("student_id", student.student_id);
    if (error) dbFailure(error, "Could not load grades", "GRADES_FAILED");
    const gradeByClass = new Map((data ?? []).map((row) => [row.class_id as number, row]));

    const num = (value: unknown): number | null =>
      value === null || value === undefined ? null : Number(value);

    const rows = classes.map((item) => {
      const grade = gradeByClass.get(item.class_id);
      return {
        class_id: item.class_id,
        subject_code: item.subject_code,
        subject_name: item.subject_name,
        units: item.units,
        teacher_name: item.teacher_name,
        prelim: num(grade?.prelim),
        midterm: num(grade?.midterm),
        prefinal: num(grade?.prefinal),
        final: num(grade?.final),
        grade_value: num(grade?.grade_value),
        gpa: num(grade?.gpa),
        remarks: (grade?.remarks as string | null) ?? "N/A",
      };
    });

    // units-weighted GPA over the subjects that already have a grade
    const graded = rows.filter((row) => row.gpa !== null && row.units > 0);
    const units = graded.reduce((sum, row) => sum + row.units, 0);
    const gwa =
      units > 0
        ? Math.round((graded.reduce((sum, row) => sum + (row.gpa as number) * row.units, 0) / units) * 100) / 100
        : null;

    res.json({ grades: rows, gwa });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Attendance ─────────────────────────

router.get("/attendance", async (req, res, next) => {
  try {
    const student = await getStudent(req);
    const classes = await loadMyClasses(student);

    const { data, error } = await supabaseAdmin
      .from("attendance")
      .select("attendance_id, class_id, status, attendance_date")
      .eq("student_id", student.student_id)
      .order("attendance_date", { ascending: false })
      .limit(1000);
    if (error) dbFailure(error, "Could not load attendance", "ATTENDANCE_FAILED");
    const records = data ?? [];

    const label = new Map(classes.map((item) => [item.class_id, item]));
    const summary = classes.map((item) => {
      const own = records.filter((row) => row.class_id === item.class_id);
      const count = (status: string) => own.filter((row) => row.status === status).length;
      const present = count("Present");
      const late = count("Late");
      const absent = count("Absent");
      const excused = count("Excused");
      const total = own.length;
      return {
        class_id: item.class_id,
        subject_code: item.subject_code,
        subject_name: item.subject_name,
        present,
        late,
        absent,
        excused,
        total,
        rate: total > 0 ? Math.round(((present + late) / total) * 100) : null,
      };
    });

    res.json({
      summary,
      records: records.slice(0, 60).map((row) => ({
        id: row.attendance_id as number,
        date: row.attendance_date as string,
        status: row.status as string,
        subject_code: label.get(row.class_id as number)?.subject_code ?? "",
        subject_name: label.get(row.class_id as number)?.subject_name ?? "",
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Announcements ─────────────────────────

router.get("/announcements", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, content, audience, created_at, author_name")
      .in("audience", ["Everyone", "Students"])
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

// ───────────────────────── Live QR (signed by the server) ─────────────────────────

router.get("/live-qr", async (req, res, next) => {
  try {
    const student = await getStudent(req);
    const issuedAt = Math.floor(Date.now() / 1000);
    res.json({ payload: signQr(student.student_id, issuedAt), issued_at: issuedAt });
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Quizzes ─────────────────────────

interface QuizRow {
  quiz_id: string;
  class_id: number | null;
  title: string;
  instructions: string | null;
  deadline: string | null;
  created_at: string;
}

interface QuestionRow {
  question_id: string;
  quiz_id: string;
  question_type: string | null;
  question_text: string;
  options: unknown;
  correct_answer: string | null;
  points: number | string | null;
}

async function loadMyQuiz(student: StudentRow, quizId: string, classes: MyClass[]) {
  const { data, error } = await supabaseAdmin
    .from("quizzes")
    .select("quiz_id, class_id, title, instructions, deadline, created_at")
    .eq("quiz_id", quizId)
    .maybeSingle();
  if (error) dbFailure(error, "Could not read quiz", "QUIZ_READ_FAILED");
  const quiz = data as QuizRow | null;
  const mine = classes.find((item) => item.class_id === quiz?.class_id);
  if (!quiz || !mine) throw new ApiError(404, "Quiz not found", "QUIZ_NOT_FOUND");
  return { quiz, mine, studentUserId: student.user_id };
}

const isPastDeadline = (deadline: string | null) =>
  deadline !== null && new Date(deadline).getTime() < Date.now();

router.get("/quizzes", async (req, res, next) => {
  try {
    const student = await getStudent(req);
    const classes = await loadMyClasses(student);
    if (classes.length === 0) {
      res.json({ quizzes: [] });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .select("quiz_id, class_id, title, instructions, deadline, created_at")
      .in("class_id", classes.map((item) => item.class_id))
      .order("created_at", { ascending: false });
    if (error) dbFailure(error, "Could not load quizzes", "QUIZZES_FAILED");
    const quizzes = (data ?? []) as QuizRow[];
    const ids = quizzes.map((quiz) => quiz.quiz_id);

    const [questions, submissions] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("quiz_questions").select("quiz_id, points").in("quiz_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length && student.user_id
        ? supabaseAdmin
            .from("student_quiz_submissions")
            .select("quiz_id, total_score, status, submitted_at")
            .eq("student_id", student.user_id)
            .in("quiz_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (questions.error || submissions.error) {
      dbFailure(questions.error ?? submissions.error, "Could not load quizzes", "QUIZZES_FAILED");
    }

    const classById = new Map(classes.map((item) => [item.class_id, item]));
    const submissionByQuiz = new Map((submissions.data ?? []).map((row) => [row.quiz_id as string, row]));

    res.json({
      quizzes: quizzes.map((quiz) => {
        const own = (questions.data ?? []).filter((row) => row.quiz_id === quiz.quiz_id);
        const submission = submissionByQuiz.get(quiz.quiz_id);
        const klass = classById.get(quiz.class_id as number);
        const status = submission
          ? submission.status === "Graded"
            ? "Graded"
            : "Submitted"
          : isPastDeadline(quiz.deadline)
            ? "Closed"
            : "Open";
        return {
          quiz_id: quiz.quiz_id,
          title: quiz.title,
          instructions: quiz.instructions,
          deadline: quiz.deadline,
          subject_code: klass?.subject_code ?? "",
          subject_name: klass?.subject_name ?? "",
          question_count: own.length,
          max_score: own.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
          status,
          score: submission ? Number(submission.total_score) || 0 : null,
          submitted_at: (submission?.submitted_at as string | undefined) ?? null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

// Questions are sent WITHOUT the correct answers.
router.get("/quizzes/:id", async (req, res, next) => {
  try {
    const quizId = z.string().uuid().parse(req.params.id);
    const student = await getStudent(req);
    const classes = await loadMyClasses(student);
    const { quiz, mine } = await loadMyQuiz(student, quizId, classes);

    const { data: submission } = student.user_id
      ? await supabaseAdmin
          .from("student_quiz_submissions")
          .select("submission_id, total_score, status, submitted_at")
          .eq("quiz_id", quizId)
          .eq("student_id", student.user_id)
          .maybeSingle()
      : { data: null };

    const { data: questions, error } = await supabaseAdmin
      .from("quiz_questions")
      .select("question_id, quiz_id, question_type, question_text, options, correct_answer, points")
      .eq("quiz_id", quizId);
    if (error) dbFailure(error, "Could not load questions", "QUESTIONS_FAILED");
    const rows = (questions ?? []) as QuestionRow[];
    const maxScore = rows.reduce((sum, row) => sum + (Number(row.points) || 0), 0);

    const closed = !submission && isPastDeadline(quiz.deadline);
    res.json({
      quiz: {
        quiz_id: quiz.quiz_id,
        title: quiz.title,
        instructions: quiz.instructions,
        deadline: quiz.deadline,
        subject_code: mine.subject_code,
        subject_name: mine.subject_name,
        max_score: maxScore,
      },
      submission: submission
        ? {
            total_score: Number(submission.total_score) || 0,
            status: submission.status as string,
            submitted_at: submission.submitted_at as string,
          }
        : null,
      closed,
      // nothing to answer once submitted or closed
      questions:
        submission || closed
          ? []
          : rows.map((row) => ({
              question_id: row.question_id,
              type: row.question_type ?? "short_answer",
              text: row.question_text,
              options: Array.isArray(row.options) ? (row.options as string[]) : [],
              points: Number(row.points) || 0,
            })),
    });
  } catch (error) {
    next(error);
  }
});

const submitBody = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        answer: z.string().max(2000),
      })
    )
    .max(200),
});

router.post("/quizzes/:id/submit", async (req, res, next) => {
  try {
    const quizId = z.string().uuid().parse(req.params.id);
    const body = submitBody.parse(req.body);
    const student = await getStudent(req);
    if (!student.user_id) {
      throw new ApiError(400, "Your account is not fully set up", "STUDENT_NO_USER");
    }
    const classes = await loadMyClasses(student);
    const { quiz } = await loadMyQuiz(student, quizId, classes);

    if (isPastDeadline(quiz.deadline)) {
      throw new ApiError(403, "This quiz is closed", "QUIZ_CLOSED");
    }

    const { data: existing } = await supabaseAdmin
      .from("student_quiz_submissions")
      .select("submission_id")
      .eq("quiz_id", quizId)
      .eq("student_id", student.user_id)
      .maybeSingle();
    if (existing) throw new ApiError(409, "You already submitted this quiz", "ALREADY_SUBMITTED");

    const { data: questions, error } = await supabaseAdmin
      .from("quiz_questions")
      .select("question_id, quiz_id, question_type, question_text, options, correct_answer, points")
      .eq("quiz_id", quizId);
    if (error) dbFailure(error, "Could not load questions", "QUESTIONS_FAILED");
    const rows = (questions ?? []) as QuestionRow[];

    const given = new Map(body.answers.map((item) => [item.question_id, item.answer.trim()]));
    let total = 0;
    let needsGrading = false;
    const answerRows = rows.map((question) => {
      const answer = given.get(question.question_id) ?? "";
      const points = Number(question.points) || 0;
      const type = question.question_type ?? "short_answer";
      if (type === "short_answer") {
        needsGrading = true;
        return { question_id: question.question_id, student_answer: answer, is_correct: null, points_awarded: 0 };
      }
      const correct = answer !== "" && answer === (question.correct_answer ?? "").trim();
      if (correct) total += points;
      return {
        question_id: question.question_id,
        student_answer: answer,
        is_correct: correct,
        points_awarded: correct ? points : 0,
      };
    });

    const status = needsGrading ? "Pending Grading" : "Graded";
    const { data: submission, error: submitError } = await supabaseAdmin
      .from("student_quiz_submissions")
      .insert({ quiz_id: quizId, student_id: student.user_id, total_score: total, status })
      .select("submission_id")
      .single();
    if (submitError || !submission) {
      if (submitError?.code === "23505") {
        throw new ApiError(409, "You already submitted this quiz", "ALREADY_SUBMITTED");
      }
      dbFailure(submitError, "Could not submit quiz", "SUBMIT_FAILED");
    }

    if (answerRows.length > 0) {
      const { error: answersError } = await supabaseAdmin
        .from("student_answers")
        .insert(answerRows.map((row) => ({ ...row, submission_id: submission.submission_id })));
      if (answersError) {
        await supabaseAdmin
          .from("student_quiz_submissions")
          .delete()
          .eq("submission_id", submission.submission_id);
        dbFailure(answersError, "Could not save answers", "ANSWERS_FAILED");
      }
    }

    res.status(201).json({
      total_score: total,
      max_score: rows.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
      status,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
