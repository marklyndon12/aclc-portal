import { Router, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { hashPassword, normalizeRole, type Role } from "../lib/auth";

const router = Router();

router.use(requireAuth, requireRole(["admin"]));

type AttendanceStatus = "Present" | "Late" | "Absent" | "Excused";
type AnnouncementAudience = "Everyone" | "Students" | "Teachers";

interface DbUser {
  user_id: string;
  username: string;
  roles: string;
}

interface DbStudent {
  student_id: number;
  user_id: string | null;
  full_name: string;
  student_number: string;
  year_level: string;
  section: string;
  username: string;
  course_year: string | null;
}

interface DbTeacher {
  teacher_id: number;
  user_id: string | null;
  full_name: string;
  department: string;
  specialization: string;
  username: string;
}

interface DbSection {
  section_id: number;
  section_name: string;
  program: string | null;
  year_level: string | null;
}

interface DbSubject {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  units: string;
}

interface DbCourse {
  course_id: number;
  course_code: string;
  course_name: string;
  credits: number | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  year_level: string | null;
  section_name: string | null;
  teacher_name: string | null;
  teacher_id: string | null;
  subject_code: string | null;
  room: string | null;
}

interface DbAttendance {
  attendance_id: number;
  student_id: number | null;
  status: string;
  attendance_date: string;
  course_id: number | null;
}

interface DbGrade {
  grade_id: number;
  student_id: number | null;
  course_id: number | null;
  prelim: number | null;
  midterm: number | null;
  prefinal: number | null;
  final: number | null;
}

interface DbAnnouncement {
  id: number;
  title: string;
  content: string;
  audience: string;
  created_at: string;
  author_name: string | null;
}

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username contains invalid characters");
const passwordSchema = z.string().min(8).max(200);
const optionalText = z.string().trim().max(200).nullable().optional();
const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format");

const userCreateSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "teacher", "student"]),
  full_name: z.string().trim().min(2).max(150),
});

const userUpdateSchema = z.object({
  username: usernameSchema.optional(),
  password: passwordSchema.optional(),
  role: z.enum(["admin", "teacher", "student"]).optional(),
  full_name: z.string().trim().min(2).max(150).optional(),
});

const studentCreateSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(2).max(150),
  student_number: z.string().trim().min(1).max(100),
  year_level: z.string().trim().min(1).max(50),
  section: z.string().trim().min(1).max(100),
  course_year: z.string().trim().max(100).optional().default(""),
});

const studentUpdateSchema = studentCreateSchema.partial({ password: true });

const teacherCreateSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(2).max(150),
  department: z.string().trim().max(150).optional().default(""),
  specialization: z.string().trim().max(150).optional().default(""),
});

const teacherUpdateSchema = teacherCreateSchema.partial({ password: true });

const sectionCreateSchema = z.object({
  section_name: z.string().trim().min(1).max(100),
  year_level: z.string().trim().max(50).optional().default(""),
  program: z.string().trim().max(100).optional().default(""),
});

const sectionUpdateSchema = sectionCreateSchema.partial();

const subjectCreateSchema = z.object({
  subject_code: z.string().trim().min(1).max(50),
  subject_name: z.string().trim().min(1).max(200),
  units: z.coerce.number().positive().max(12),
});

const subjectUpdateSchema = subjectCreateSchema.partial();

const courseSchema = z.object({
  course_code: z.string().trim().min(1).max(50),
  course_name: z.string().trim().min(1).max(200),
  credits: z.coerce.number().int().min(0).max(12).optional().default(3),
  subject_code: optionalText,
  year_level: optionalText,
  section_name: optionalText,
  teacher_name: optionalText,
  day: z.string().trim().min(1).max(20),
  start_time: timeSchema,
  end_time: timeSchema,
  room: optionalText,
});

const attendanceSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  student_id: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["Present", "Late", "Absent", "Excused"]),
});

const bulkAttendanceSchema = z.object({
  records: z.array(attendanceSchema).min(1).max(500),
});

const gradeSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  student_id: z.coerce.number().int().positive(),
  prelim: z.number().min(0).max(100).nullable(),
  midterm: z.number().min(0).max(100).nullable(),
  prefinal: z.number().min(0).max(100).nullable(),
  final: z.number().min(0).max(100).nullable(),
});

const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  audience: z.enum(["Everyone", "Students", "Teachers"]),
});

const announcementUpdateSchema = announcementCreateSchema.partial();

function dbFailure(error: unknown, message: string, code: string): never {
  console.error(message, error);
  throw new ApiError(500, message, code);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusOf(value: string): AttendanceStatus {
  return value === "Present" || value === "Late" || value === "Excused"
    ? value
    : "Absent";
}

function audienceOf(value: string): AnnouncementAudience {
  return value === "Students" || value === "Teachers" ? value : "Everyone";
}

async function countRows(
  table: string,
  column: string,
  value: string | number
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) dbFailure(error, `Could not read ${table}`, "COUNT_FAILED");
  return count ?? 0;
}

async function buildAdminData() {
  const [usersResult, studentsResult, teachersResult, sectionsResult, subjectsResult, coursesResult, attendanceResult, gradesResult, announcementsResult] =
    await Promise.all([
      supabaseAdmin.from("users").select("user_id, username, roles"),
      supabaseAdmin
        .from("students")
        .select(
          "student_id, user_id, full_name, student_number, year_level, section, username, course_year"
        ),
      supabaseAdmin
        .from("teachers")
        .select(
          "teacher_id, user_id, full_name, department, specialization, username"
        ),
      supabaseAdmin.from("sections").select("section_id, section_name, program, year_level"),
      supabaseAdmin.from("subjects").select("subject_id, subject_code, subject_name, units"),
      supabaseAdmin
        .from("courses")
        .select(
          "course_id, course_code, course_name, credits, day, start_time, end_time, year_level, section_name, teacher_name, teacher_id, subject_code, room"
        ),
      supabaseAdmin
        .from("attendance")
        .select("attendance_id, student_id, status, attendance_date, course_id"),
      supabaseAdmin
        .from("grades")
        .select("grade_id, student_id, course_id, prelim, midterm, prefinal, final"),
      supabaseAdmin
        .from("announcements")
        .select("id, title, content, audience, created_at, author_name"),
    ]);

  for (const result of [
    usersResult,
    studentsResult,
    teachersResult,
    sectionsResult,
    subjectsResult,
    coursesResult,
    attendanceResult,
    gradesResult,
    announcementsResult,
  ]) {
    if (result.error) dbFailure(result.error, "Could not load admin data", "ADMIN_DATA_FAILED");
  }

  const users = (usersResult.data ?? []) as DbUser[];
  const students = (studentsResult.data ?? []) as DbStudent[];
  const teachers = (teachersResult.data ?? []) as DbTeacher[];
  const sections = (sectionsResult.data ?? []) as DbSection[];
  const subjects = (subjectsResult.data ?? []) as DbSubject[];
  const courses = (coursesResult.data ?? []) as DbCourse[];
  const attendance = (attendanceResult.data ?? []) as DbAttendance[];
  const grades = (gradesResult.data ?? []) as DbGrade[];
  const announcements = (announcementsResult.data ?? []) as DbAnnouncement[];

  const studentByUser = new Map(
    students.filter((row) => row.user_id).map((row) => [row.user_id as string, row])
  );
  const teacherByUser = new Map(
    teachers.filter((row) => row.user_id).map((row) => [row.user_id as string, row])
  );
  const studentCountBySection = new Map<string, number>();
  for (const student of students) {
    studentCountBySection.set(
      student.section,
      (studentCountBySection.get(student.section) ?? 0) + 1
    );
  }
  const adviserBySection = new Map<string, string>();
  for (const course of courses) {
    if (course.section_name && course.teacher_name && !adviserBySection.has(course.section_name)) {
      adviserBySection.set(course.section_name, course.teacher_name);
    }
  }

  return {
    users: users.map((row) => {
      const role = (normalizeRole(row.roles) ?? "admin") as Role;
      const profile =
        role === "student"
          ? studentByUser.get(row.user_id)
          : role === "teacher"
            ? teacherByUser.get(row.user_id)
            : null;
      return {
        user_id: row.user_id,
        username: row.username,
        full_name: profile?.full_name ?? row.username,
        role,
        status: "Active" as const,
      };
    }),
    students: students.map((row) => ({
      student_id: row.student_id,
      user_id: row.user_id ?? "",
      username: row.username,
      full_name: row.full_name,
      student_number: row.student_number,
      year_level: row.year_level,
      section: row.section,
      course_year: row.course_year ?? "",
      status: "Active" as const,
    })),
    teachers: teachers.map((row) => ({
      teacher_id: row.teacher_id,
      user_id: row.user_id ?? "",
      username: row.username,
      full_name: row.full_name,
      department: row.department,
      specialization: row.specialization,
      status: "Active" as const,
    })),
    sections: sections.map((row) => ({
      section_id: row.section_id,
      section_name: row.section_name,
      year_level: row.year_level ?? "",
      student_count: studentCountBySection.get(row.section_name) ?? 0,
      adviser: adviserBySection.get(row.section_name) ?? "",
    })),
    subjects: subjects.map((row) => ({
      subject_id: row.subject_id,
      subject_code: row.subject_code,
      subject_name: row.subject_name,
      units: Number(row.units) || 0,
      year_level: "",
    })),
    courses: courses.map((row) => ({
      course_id: row.course_id,
      course_code: row.course_code,
      course_name: row.course_name,
      credits: row.credits ?? 0,
      day: row.day,
      start_time: row.start_time,
      end_time: row.end_time,
      year_level: row.year_level,
      section_name: row.section_name,
      teacher_name: row.teacher_name,
      subject_code: row.subject_code,
      room: row.room,
      enrolled: row.section_name
        ? studentCountBySection.get(row.section_name) ?? 0
        : 0,
    })),
    attendance: attendance
      .filter((row) => row.course_id !== null && row.student_id !== null)
      .map((row) => ({
        id: row.attendance_id,
        course_id: row.course_id as number,
        student_id: row.student_id as number,
        date: row.attendance_date,
        status: statusOf(row.status),
      })),
    grades: grades
      .filter((row) => row.course_id !== null && row.student_id !== null)
      .map((row) => ({
        id: row.grade_id,
        course_id: row.course_id as number,
        student_id: row.student_id as number,
        prelim: numberOrNull(row.prelim),
        midterm: numberOrNull(row.midterm),
        prefinal: numberOrNull(row.prefinal),
        final: numberOrNull(row.final),
      })),
    announcements: announcements.map((row) => ({
      announcement_id: row.id,
      title: row.title,
      body: row.content,
      audience: audienceOf(row.audience),
      created_at: row.created_at,
    })),
  };
}

async function sendData(res: Response, status = 200) {
  res.status(status).json(await buildAdminData());
}

router.get("/data", async (_req, res, next) => {
  try {
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const body = userCreateSchema.parse(req.body);
    const hash = await hashPassword(body.password);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert({ username: body.username, password: hash, roles: body.role })
      .select("user_id, username, roles")
      .single();

    if (error || !user) {
      if (error?.code === "23505") {
        throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
      }
      dbFailure(error, "Could not create user", "USER_CREATE_FAILED");
    }

    if (body.role === "student") {
      const { error: profileError } = await supabaseAdmin.from("students").insert({
        user_id: user.user_id,
        full_name: body.full_name,
        student_number: `PENDING-${body.username}`,
        year_level: "1st Year",
        section: "Unassigned",
        course_year: "",
        username: body.username,
        password: hash,
      });
      if (profileError) {
        await supabaseAdmin.from("users").delete().eq("user_id", user.user_id);
        dbFailure(profileError, "Could not create student profile", "PROFILE_CREATE_FAILED");
      }
    }

    if (body.role === "teacher") {
      const { error: profileError } = await supabaseAdmin.from("teachers").insert({
        user_id: user.user_id,
        full_name: body.full_name,
        department: "Unassigned",
        specialization: "",
        username: body.username,
        password: hash,
      });
      if (profileError) {
        await supabaseAdmin.from("users").delete().eq("user_id", user.user_id);
        dbFailure(profileError, "Could not create teacher profile", "PROFILE_CREATE_FAILED");
      }
    }

    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = userUpdateSchema.parse(req.body);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("users")
      .select("user_id, username, roles")
      .eq("user_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read user", "USER_READ_FAILED");
    if (!existing) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    const currentRole = normalizeRole(existing.roles) ?? "admin";
    if (body.role && body.role !== currentRole) {
      throw new ApiError(
        409,
        "Changing an account role is not supported while its profile exists",
        "ROLE_CHANGE_UNSUPPORTED"
      );
    }

    const hash = body.password ? await hashPassword(body.password) : null;
    const userPatch: Record<string, unknown> = {};
    if (body.username) userPatch.username = body.username;
    if (hash) userPatch.password = hash;

    if (Object.keys(userPatch).length > 0) {
      const { error } = await supabaseAdmin.from("users").update(userPatch).eq("user_id", id);
      if (error?.code === "23505") {
        throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
      }
      if (error) dbFailure(error, "Could not update user", "USER_UPDATE_FAILED");
    }

    if (currentRole === "student" || currentRole === "teacher") {
      const table = currentRole === "student" ? "students" : "teachers";
      const profilePatch: Record<string, unknown> = {};
      if (body.username) profilePatch.username = body.username;
      if (body.full_name) profilePatch.full_name = body.full_name;
      if (hash) profilePatch.password = hash;
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await supabaseAdmin
          .from(table)
          .update(profilePatch)
          .eq("user_id", id);
        if (error) dbFailure(error, "Could not update profile", "PROFILE_UPDATE_FAILED");
      }
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    if (id === req.user!.user_id) {
      throw new ApiError(400, "You cannot delete your own account", "SELF_DELETE_BLOCKED");
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("user_id, roles")
      .eq("user_id", id)
      .maybeSingle();
    if (error) dbFailure(error, "Could not read user", "USER_READ_FAILED");
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    const role = normalizeRole(user.roles);
    if (role === "student") {
      const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .select("student_id")
        .eq("user_id", id)
        .maybeSingle();
      if (studentError) dbFailure(studentError, "Could not read student", "STUDENT_READ_FAILED");
      if (student) {
        const [grades, attendance, submissions] = await Promise.all([
          countRows("grades", "student_id", student.student_id),
          countRows("attendance", "student_id", student.student_id),
          countRows("student_quiz_submissions", "student_id", id),
        ]);
        if (grades + attendance + submissions > 0) {
          throw new ApiError(
            409,
            "Cannot delete this student because academic records exist",
            "DELETE_BLOCKED"
          );
        }
        await supabaseAdmin.from("students").delete().eq("student_id", student.student_id);
      }
    }

    if (role === "teacher") {
      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .select("teacher_id")
        .eq("user_id", id)
        .maybeSingle();
      if (teacherError) dbFailure(teacherError, "Could not read teacher", "TEACHER_READ_FAILED");
      if (teacher) {
        const [courses, classes, attendance] = await Promise.all([
          countRows("courses", "teacher_id", id),
          countRows("classes", "teacher_id", teacher.teacher_id),
          countRows("attendance_teachers", "teacher_id", teacher.teacher_id),
        ]);
        if (courses + classes + attendance > 0) {
          throw new ApiError(
            409,
            "Cannot delete this teacher because assigned courses or attendance exist",
            "DELETE_BLOCKED"
          );
        }
        await supabaseAdmin.from("teachers").delete().eq("teacher_id", teacher.teacher_id);
      }
    }

    const { error: deleteError } = await supabaseAdmin.from("users").delete().eq("user_id", id);
    if (deleteError) dbFailure(deleteError, "Could not delete user", "USER_DELETE_FAILED");

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.post("/students", async (req, res, next) => {
  try {
    const body = studentCreateSchema.parse(req.body);
    const hash = await hashPassword(body.password);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert({ username: body.username, password: hash, roles: "student" })
      .select("user_id")
      .single();
    if (error || !user) {
      if (error?.code === "23505") {
        throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
      }
      dbFailure(error, "Could not create student account", "STUDENT_CREATE_FAILED");
    }

    const { error: profileError } = await supabaseAdmin.from("students").insert({
      user_id: user.user_id,
      full_name: body.full_name,
      student_number: body.student_number,
      year_level: body.year_level,
      section: body.section,
      course_year: body.course_year,
      username: body.username,
      password: hash,
    });
    if (profileError) {
      await supabaseAdmin.from("users").delete().eq("user_id", user.user_id);
      if (profileError.code === "23505") {
        throw new ApiError(409, "That student number is already in use", "STUDENT_TAKEN");
      }
      dbFailure(profileError, "Could not create student", "STUDENT_CREATE_FAILED");
    }

    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/students/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = studentUpdateSchema.parse(req.body);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("students")
      .select("student_id, user_id")
      .eq("student_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read student", "STUDENT_READ_FAILED");
    if (!existing) throw new ApiError(404, "Student not found", "STUDENT_NOT_FOUND");

    const hash = body.password ? await hashPassword(body.password) : null;
    const studentPatch: Record<string, unknown> = {};
    if (body.username) studentPatch.username = body.username;
    if (body.full_name) studentPatch.full_name = body.full_name;
    if (body.student_number) studentPatch.student_number = body.student_number;
    if (body.year_level) studentPatch.year_level = body.year_level;
    if (body.section) studentPatch.section = body.section;
    if (body.course_year !== undefined) studentPatch.course_year = body.course_year;
    if (hash) studentPatch.password = hash;

    if (Object.keys(studentPatch).length > 0) {
      const { error } = await supabaseAdmin
        .from("students")
        .update(studentPatch)
        .eq("student_id", id);
      if (error?.code === "23505") {
        throw new ApiError(409, "That student number is already in use", "STUDENT_TAKEN");
      }
      if (error) dbFailure(error, "Could not update student", "STUDENT_UPDATE_FAILED");
    }

    if (existing.user_id) {
      const userPatch: Record<string, unknown> = {};
      if (body.username) userPatch.username = body.username;
      if (hash) userPatch.password = hash;
      if (Object.keys(userPatch).length > 0) {
        const { error } = await supabaseAdmin
          .from("users")
          .update(userPatch)
          .eq("user_id", existing.user_id);
        if (error?.code === "23505") {
          throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
        }
        if (error) dbFailure(error, "Could not update student account", "USER_UPDATE_FAILED");
      }
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/students/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { data: existing, error: readError } = await supabaseAdmin
      .from("students")
      .select("student_id, user_id")
      .eq("student_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read student", "STUDENT_READ_FAILED");
    if (!existing) throw new ApiError(404, "Student not found", "STUDENT_NOT_FOUND");

    const [grades, attendance, submissions] = await Promise.all([
      countRows("grades", "student_id", id),
      countRows("attendance", "student_id", id),
      existing.user_id
        ? countRows("student_quiz_submissions", "student_id", existing.user_id)
        : Promise.resolve(0),
    ]);
    if (grades + attendance + submissions > 0) {
      throw new ApiError(
        409,
        "Cannot delete this student because academic records exist",
        "DELETE_BLOCKED"
      );
    }

    await supabaseAdmin.from("students").delete().eq("student_id", id);
    if (existing.user_id) {
      await supabaseAdmin.from("users").delete().eq("user_id", existing.user_id);
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.post("/teachers", async (req, res, next) => {
  try {
    const body = teacherCreateSchema.parse(req.body);
    const hash = await hashPassword(body.password);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert({ username: body.username, password: hash, roles: "teacher" })
      .select("user_id")
      .single();
    if (error || !user) {
      if (error?.code === "23505") {
        throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
      }
      dbFailure(error, "Could not create teacher account", "TEACHER_CREATE_FAILED");
    }

    const { error: profileError } = await supabaseAdmin.from("teachers").insert({
      user_id: user.user_id,
      full_name: body.full_name,
      department: body.department,
      specialization: body.specialization,
      username: body.username,
      password: hash,
    });
    if (profileError) {
      await supabaseAdmin.from("users").delete().eq("user_id", user.user_id);
      dbFailure(profileError, "Could not create teacher", "TEACHER_CREATE_FAILED");
    }

    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/teachers/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = teacherUpdateSchema.parse(req.body);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("teachers")
      .select("teacher_id, user_id")
      .eq("teacher_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read teacher", "TEACHER_READ_FAILED");
    if (!existing) throw new ApiError(404, "Teacher not found", "TEACHER_NOT_FOUND");

    const hash = body.password ? await hashPassword(body.password) : null;
    const profilePatch: Record<string, unknown> = {};
    if (body.username) profilePatch.username = body.username;
    if (body.full_name) profilePatch.full_name = body.full_name;
    if (body.department !== undefined) profilePatch.department = body.department;
    if (body.specialization !== undefined) profilePatch.specialization = body.specialization;
    if (hash) profilePatch.password = hash;

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabaseAdmin
        .from("teachers")
        .update(profilePatch)
        .eq("teacher_id", id);
      if (error) dbFailure(error, "Could not update teacher", "TEACHER_UPDATE_FAILED");
    }

    if (existing.user_id) {
      const userPatch: Record<string, unknown> = {};
      if (body.username) userPatch.username = body.username;
      if (hash) userPatch.password = hash;
      if (Object.keys(userPatch).length > 0) {
        const { error } = await supabaseAdmin
          .from("users")
          .update(userPatch)
          .eq("user_id", existing.user_id);
        if (error?.code === "23505") {
          throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
        }
        if (error) dbFailure(error, "Could not update teacher account", "USER_UPDATE_FAILED");
      }
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/teachers/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { data: existing, error: readError } = await supabaseAdmin
      .from("teachers")
      .select("teacher_id, user_id")
      .eq("teacher_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read teacher", "TEACHER_READ_FAILED");
    if (!existing) throw new ApiError(404, "Teacher not found", "TEACHER_NOT_FOUND");

    const [courses, classes, attendance] = await Promise.all([
      existing.user_id
        ? countRows("courses", "teacher_id", existing.user_id)
        : Promise.resolve(0),
      countRows("classes", "teacher_id", id),
      countRows("attendance_teachers", "teacher_id", id),
    ]);
    if (courses + classes + attendance > 0) {
      throw new ApiError(
        409,
        "Cannot delete this teacher because assigned courses or attendance exist",
        "DELETE_BLOCKED"
      );
    }

    await supabaseAdmin.from("teachers").delete().eq("teacher_id", id);
    if (existing.user_id) {
      await supabaseAdmin.from("users").delete().eq("user_id", existing.user_id);
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.post("/sections", async (req, res, next) => {
  try {
    const body = sectionCreateSchema.parse(req.body);
    const { error } = await supabaseAdmin.from("sections").insert({
      section_name: body.section_name,
      program: body.program || null,
      year_level: body.year_level || null,
    });
    if (error?.code === "23505") {
      throw new ApiError(409, "That section already exists", "SECTION_TAKEN");
    }
    if (error) dbFailure(error, "Could not create section", "SECTION_CREATE_FAILED");
    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/sections/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = sectionUpdateSchema.parse(req.body);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("sections")
      .select("section_id, section_name")
      .eq("section_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read section", "SECTION_READ_FAILED");
    if (!existing) throw new ApiError(404, "Section not found", "SECTION_NOT_FOUND");

    const patch: Record<string, unknown> = {};
    if (body.section_name) patch.section_name = body.section_name;
    if (body.year_level !== undefined) patch.year_level = body.year_level || null;
    if (body.program !== undefined) patch.program = body.program || null;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("sections").update(patch).eq("section_id", id);
      if (error?.code === "23505") {
        throw new ApiError(409, "That section already exists", "SECTION_TAKEN");
      }
      if (error) dbFailure(error, "Could not update section", "SECTION_UPDATE_FAILED");
    }

    if (body.section_name && body.section_name !== existing.section_name) {
      const [studentError, courseError] = await Promise.all([
        supabaseAdmin
          .from("students")
          .update({ section: body.section_name })
          .eq("section", existing.section_name)
          .then((result) => result.error),
        supabaseAdmin
          .from("courses")
          .update({ section_name: body.section_name })
          .eq("section_name", existing.section_name)
          .then((result) => result.error),
      ]);
      if (studentError) dbFailure(studentError, "Could not update students", "SECTION_SYNC_FAILED");
      if (courseError) dbFailure(courseError, "Could not update courses", "SECTION_SYNC_FAILED");
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/sections/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { data: existing, error: readError } = await supabaseAdmin
      .from("sections")
      .select("section_id, section_name")
      .eq("section_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read section", "SECTION_READ_FAILED");
    if (!existing) throw new ApiError(404, "Section not found", "SECTION_NOT_FOUND");

    const [students, courses, classes] = await Promise.all([
      countRows("students", "section", existing.section_name),
      countRows("courses", "section_name", existing.section_name),
      countRows("classes", "section_id", id),
    ]);
    if (students + courses + classes > 0) {
      throw new ApiError(
        409,
        "Cannot delete this section because students, courses, or classes are linked",
        "DELETE_BLOCKED"
      );
    }

    const { error } = await supabaseAdmin.from("sections").delete().eq("section_id", id);
    if (error) dbFailure(error, "Could not delete section", "SECTION_DELETE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.post("/subjects", async (req, res, next) => {
  try {
    const body = subjectCreateSchema.parse(req.body);
    const { error } = await supabaseAdmin.from("subjects").insert({
      subject_code: body.subject_code,
      subject_name: body.subject_name,
      units: String(body.units),
    });
    if (error) dbFailure(error, "Could not create subject", "SUBJECT_CREATE_FAILED");
    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/subjects/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = subjectUpdateSchema.parse(req.body);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("subjects")
      .select("subject_id, subject_code")
      .eq("subject_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read subject", "SUBJECT_READ_FAILED");
    if (!existing) throw new ApiError(404, "Subject not found", "SUBJECT_NOT_FOUND");

    const patch: Record<string, unknown> = {};
    if (body.subject_code) patch.subject_code = body.subject_code;
    if (body.subject_name) patch.subject_name = body.subject_name;
    if (body.units !== undefined) patch.units = String(body.units);

    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin
        .from("subjects")
        .update(patch)
        .eq("subject_id", id);
      if (error) dbFailure(error, "Could not update subject", "SUBJECT_UPDATE_FAILED");
    }

    if (body.subject_code && body.subject_code !== existing.subject_code) {
      const { error: courseError } = await supabaseAdmin
        .from("courses")
        .update({ subject_code: body.subject_code })
        .eq("subject_code", existing.subject_code);
      if (courseError) dbFailure(courseError, "Could not update courses", "SUBJECT_SYNC_FAILED");
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/subjects/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { data: existing, error: readError } = await supabaseAdmin
      .from("subjects")
      .select("subject_id, subject_code")
      .eq("subject_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read subject", "SUBJECT_READ_FAILED");
    if (!existing) throw new ApiError(404, "Subject not found", "SUBJECT_NOT_FOUND");

    const linked = await countRows("courses", "subject_code", existing.subject_code);
    if (linked > 0) {
      throw new ApiError(
        409,
        "Cannot delete this subject because courses reference it",
        "DELETE_BLOCKED"
      );
    }

    const { error } = await supabaseAdmin.from("subjects").delete().eq("subject_id", id);
    if (error) dbFailure(error, "Could not delete subject", "SUBJECT_DELETE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

async function resolveTeacherId(teacherName: string | null | undefined) {
  if (!teacherName) return null;
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("user_id")
    .eq("full_name", teacherName)
    .maybeSingle();
  if (error) dbFailure(error, "Could not resolve teacher", "TEACHER_LOOKUP_FAILED");
  return data?.user_id ?? null;
}

async function ensureNoCourseConflict(
  courseId: number | null,
  values: z.infer<typeof courseSchema>,
  teacherId: string | null
) {
  if (values.start_time >= values.end_time) {
    throw new ApiError(400, "End time must be after start time", "INVALID_TIME_RANGE");
  }

  const { data, error } = await supabaseAdmin
    .from("courses")
    .select(
      "course_id, course_code, teacher_id, teacher_name, section_name, room, day, start_time, end_time"
    )
    .eq("day", values.day);
  if (error) dbFailure(error, "Could not check schedule conflicts", "CONFLICT_CHECK_FAILED");

  const conflict = (data ?? []).find((row) => {
    if (row.course_id === courseId) return false;
    if (!row.start_time || !row.end_time) return false;
    if (!(row.start_time < values.end_time && row.end_time > values.start_time)) return false;
    const sameTeacher = Boolean(teacherId) && row.teacher_id === teacherId;
    const sameSection =
      Boolean(values.section_name) && row.section_name === values.section_name;
    const sameRoom =
      Boolean(values.room) &&
      (row.room ?? "").trim().toLowerCase() ===
        (values.room ?? "").trim().toLowerCase();
    return sameTeacher || sameSection || sameRoom;
  });

  if (conflict) {
    throw new ApiError(
      409,
      `Schedule conflict with ${conflict.course_code}`,
      "SCHEDULE_CONFLICT",
      conflict
    );
  }
}

router.post("/courses", async (req, res, next) => {
  try {
    const body = courseSchema.parse(req.body);
    const teacherId = await resolveTeacherId(body.teacher_name);
    await ensureNoCourseConflict(null, body, teacherId);

    const { error } = await supabaseAdmin.from("courses").insert({
      course_code: body.course_code,
      course_name: body.course_name,
      credits: body.credits,
      subject_code: body.subject_code || null,
      year_level: body.year_level || null,
      section_name: body.section_name || null,
      teacher_name: body.teacher_name || null,
      teacher_id: teacherId,
      day: body.day,
      start_time: body.start_time,
      end_time: body.end_time,
      room: body.room || null,
    });
    if (error?.code === "23505") {
      throw new ApiError(409, "That course code already exists", "COURSE_TAKEN");
    }
    if (error) dbFailure(error, "Could not create course", "COURSE_CREATE_FAILED");
    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/courses/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = courseSchema.parse(req.body);
    const teacherId = await resolveTeacherId(body.teacher_name);
    await ensureNoCourseConflict(id, body, teacherId);

    const { error } = await supabaseAdmin
      .from("courses")
      .update({
        course_code: body.course_code,
        course_name: body.course_name,
        credits: body.credits,
        subject_code: body.subject_code || null,
        year_level: body.year_level || null,
        section_name: body.section_name || null,
        teacher_name: body.teacher_name || null,
        teacher_id: teacherId,
        day: body.day,
        start_time: body.start_time,
        end_time: body.end_time,
        room: body.room || null,
      })
      .eq("course_id", id);
    if (error?.code === "23505") {
      throw new ApiError(409, "That course code already exists", "COURSE_TAKEN");
    }
    if (error) dbFailure(error, "Could not update course", "COURSE_UPDATE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/courses/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const [attendance, grades, classes, quizzes] = await Promise.all([
      countRows("attendance", "course_id", id),
      countRows("grades", "course_id", id),
      countRows("classes", "course_id", id),
      countRows("quizzes", "course_id", id),
    ]);
    if (attendance + grades + classes + quizzes > 0) {
      throw new ApiError(
        409,
        "Cannot delete this course because attendance, grades, classes, or quizzes exist",
        "DELETE_BLOCKED"
      );
    }
    const { error } = await supabaseAdmin.from("courses").delete().eq("course_id", id);
    if (error) dbFailure(error, "Could not delete course", "COURSE_DELETE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

async function saveAttendance(record: z.infer<typeof attendanceSchema>) {
  const { data: existing, error: readError } = await supabaseAdmin
    .from("attendance")
    .select("attendance_id")
    .eq("course_id", record.course_id)
    .eq("student_id", record.student_id)
    .eq("attendance_date", record.date)
    .maybeSingle();
  if (readError) dbFailure(readError, "Could not read attendance", "ATTENDANCE_READ_FAILED");

  if (existing) {
    const { error } = await supabaseAdmin
      .from("attendance")
      .update({ status: record.status })
      .eq("attendance_id", existing.attendance_id);
    if (error) dbFailure(error, "Could not update attendance", "ATTENDANCE_UPDATE_FAILED");
    return;
  }

  const { error } = await supabaseAdmin.from("attendance").insert({
    course_id: record.course_id,
    student_id: record.student_id,
    attendance_date: record.date,
    status: record.status,
  });
  if (error) dbFailure(error, "Could not save attendance", "ATTENDANCE_CREATE_FAILED");
}

router.put("/attendance", async (req, res, next) => {
  try {
    const body = attendanceSchema.parse(req.body);
    await saveAttendance(body);
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.put("/attendance/bulk", async (req, res, next) => {
  try {
    const { records } = bulkAttendanceSchema.parse(req.body);
    for (const record of records) {
      await saveAttendance(record);
    }
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

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

router.put("/grades", async (req, res, next) => {
  try {
    const body = gradeSchema.parse(req.body);

    const [courseResult, studentResult] = await Promise.all([
      supabaseAdmin
        .from("courses")
        .select("course_name, subject_code")
        .eq("course_id", body.course_id)
        .maybeSingle(),
      supabaseAdmin
        .from("students")
        .select("user_id")
        .eq("student_id", body.student_id)
        .maybeSingle(),
    ]);
    if (courseResult.error) dbFailure(courseResult.error, "Could not read course", "COURSE_READ_FAILED");
    if (studentResult.error) dbFailure(studentResult.error, "Could not read student", "STUDENT_READ_FAILED");

    const terms = [body.prelim, body.midterm, body.prefinal, body.final].filter(
      (value): value is number => typeof value === "number"
    );
    const average =
      terms.length > 0 ? terms.reduce((sum, value) => sum + value, 0) / terms.length : null;
    const remarks = average === null ? "N/A" : average >= 75 ? "Passed" : "Failed";
    const status = average === null ? "Pending" : average >= 75 ? "Passed" : "Failed";

    const payload = {
      student_id: body.student_id,
      course_id: body.course_id,
      subject_name: courseResult.data?.course_name ?? "Unnamed course",
      subject_code: courseResult.data?.subject_code ?? null,
      user_id: studentResult.data?.user_id ?? null,
      prelim: body.prelim,
      midterm: body.midterm,
      prefinal: body.prefinal,
      final: body.final,
      grade_value: average,
      gpa: average === null ? null : gpaFor(average),
      remarks,
      status,
    };

    const { data: existing, error: readError } = await supabaseAdmin
      .from("grades")
      .select("grade_id")
      .eq("student_id", body.student_id)
      .eq("course_id", body.course_id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read grade", "GRADE_READ_FAILED");

    if (existing) {
      const { error } = await supabaseAdmin
        .from("grades")
        .update(payload)
        .eq("grade_id", existing.grade_id);
      if (error) dbFailure(error, "Could not update grade", "GRADE_UPDATE_FAILED");
    } else {
      const { error } = await supabaseAdmin.from("grades").insert(payload);
      if (error) dbFailure(error, "Could not save grade", "GRADE_CREATE_FAILED");
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.post("/announcements", async (req, res, next) => {
  try {
    const body = announcementCreateSchema.parse(req.body);
    const { error } = await supabaseAdmin.from("announcements").insert({
      title: body.title,
      content: body.body,
      audience: body.audience,
      author_name: req.user!.username,
    });
    if (error) dbFailure(error, "Could not create announcement", "ANNOUNCEMENT_CREATE_FAILED");
    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/announcements/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = announcementUpdateSchema.parse(req.body);
    const patch: Record<string, unknown> = {};
    if (body.title) patch.title = body.title;
    if (body.body) patch.content = body.body;
    if (body.audience) patch.audience = body.audience;
    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, "No changes supplied", "EMPTY_UPDATE");
    }
    const { error } = await supabaseAdmin
      .from("announcements")
      .update(patch)
      .eq("id", id);
    if (error) dbFailure(error, "Could not update announcement", "ANNOUNCEMENT_UPDATE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/announcements/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id);
    if (error) dbFailure(error, "Could not delete announcement", "ANNOUNCEMENT_DELETE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

export default router;
