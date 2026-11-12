import { Router, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { hashPassword, normalizeRole, type Role } from "../lib/auth";

const router = Router();

router.use(requireAuth, requireRole(["admin"]));

type TeacherAttendanceStatus = "Present" | "On Leave" | "Absent";
type AnnouncementAudience = "Everyone" | "Students" | "Teachers";

interface DbUser {
  user_id: string;
  username: string;
  roles: string;
  approval_status: string | null;
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
  department_id: number | null;
  specialization: string;
  username: string;
}

interface DbCourse {
  course_id: number;
  course_code: string;
  course_name: string;
}

interface DbSection {
  section_id: number;
  section_name: string;
  course_id: number;
  year_level: string | null;
}

interface DbSubject {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  units: string;
  year_level: string;
  course_id: number | null;
}

interface DbClass {
  class_id: number;
  subject_id: number;
  section_id: number;
  teacher_id: number | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
}

interface DbTeacherAttendance {
  att_teacher_id: number;
  teacher_id: number | null;
  date: string;
  status: string;
  time_in: string | null;
  time_out: string | null;
  teacher_name: string | null;
  department: string | null;
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
  department_id: z.number().int().positive().nullable().optional(),
  specialization: z.string().trim().max(150).optional().default(""),
});

const teacherUpdateSchema = teacherCreateSchema.partial({ password: true });

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

// Course = a degree program (BSIT, BSHM, ...)
const courseSchema = z.object({
  course_code: z.string().trim().min(1).max(30),
  course_name: z.string().trim().min(1).max(200),
});

const courseUpdateSchema = courseSchema.partial();

const sectionCreateSchema = z.object({
  section_name: z.string().trim().min(1).max(100),
  year_level: z.enum(YEAR_LEVELS),
  course_id: z.coerce.number().int().positive(),
});

const sectionUpdateSchema = sectionCreateSchema.partial();

// Subject belongs to one year level, and to one course, or to none (= general, every course).
const subjectCreateSchema = z.object({
  subject_code: z.string().trim().min(1).max(50),
  subject_name: z.string().trim().min(1).max(200),
  units: z.coerce.number().positive().max(12),
  year_level: z.enum(YEAR_LEVELS),
  course_id: z.number().int().positive().nullable().optional(),
});

const subjectUpdateSchema = subjectCreateSchema.partial();

// Class = a subject given to a section, with a teacher and (optionally) a schedule.
const classBaseSchema = z.object({
  teacher_id: z.number().int().positive().nullable().optional(),
  day: z.enum(DAY_NAMES).nullable().optional(),
  start_time: timeSchema.nullable().optional(),
  end_time: timeSchema.nullable().optional(),
  room: optionalText,
});

const classCreateSchema = classBaseSchema.extend({
  subject_id: z.coerce.number().int().positive(),
  section_id: z.coerce.number().int().positive(),
});

const teacherAttendanceSchema = z.object({
  teacher_id: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["Present", "On Leave", "Absent"]),
  time_in: z.string().trim().max(20).nullable().optional(),
  time_out: z.string().trim().max(20).nullable().optional(),
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

function teacherStatusOf(value: string): TeacherAttendanceStatus {
  return value === "Present" || value === "On Leave" ? value : "Absent";
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

const hm = (value: string | null): string | null => (value ? value.slice(0, 5) : null);

async function buildAdminData() {
  const [
    usersResult,
    studentsResult,
    teachersResult,
    departmentsResult,
    coursesResult,
    sectionsResult,
    subjectsResult,
    classesResult,
    teacherAttendanceResult,
    announcementsResult,
  ] = await Promise.all([
    supabaseAdmin.from("users").select("user_id, username, roles, approval_status"),
    supabaseAdmin
      .from("students")
      .select(
        "student_id, user_id, full_name, student_number, year_level, section, username, course_year"
      ),
    supabaseAdmin
      .from("teachers")
      .select("teacher_id, user_id, full_name, department_id, specialization, username"),
    supabaseAdmin.from("departments").select("department_id, department_name"),
    supabaseAdmin.from("courses").select("course_id, course_code, course_name"),
    supabaseAdmin.from("sections").select("section_id, section_name, course_id, year_level"),
    supabaseAdmin
      .from("subjects")
      .select("subject_id, subject_code, subject_name, units, year_level, course_id"),
    supabaseAdmin
      .from("classes")
      .select("class_id, subject_id, section_id, teacher_id, day, start_time, end_time, room"),
    supabaseAdmin
      .from("attendance_teachers")
      .select(
        "att_teacher_id, teacher_id, date, status, time_in, time_out, teacher_name, department"
      ),
    supabaseAdmin
      .from("announcements")
      .select("id, title, content, audience, created_at, author_name"),
  ]);

  for (const result of [
    usersResult,
    studentsResult,
    teachersResult,
    departmentsResult,
    coursesResult,
    sectionsResult,
    subjectsResult,
    classesResult,
    teacherAttendanceResult,
    announcementsResult,
  ]) {
    if (result.error) dbFailure(result.error, "Could not load admin data", "ADMIN_DATA_FAILED");
  }

  const users = (usersResult.data ?? []) as DbUser[];
  const students = (studentsResult.data ?? []) as DbStudent[];
  const teachers = (teachersResult.data ?? []) as DbTeacher[];
  const departments = (departmentsResult.data ?? []) as { department_id: number; department_name: string }[];
  const departmentById = new Map(departments.map((row) => [row.department_id, row.department_name]));
  const courses = (coursesResult.data ?? []) as DbCourse[];
  const sections = (sectionsResult.data ?? []) as DbSection[];
  const subjects = (subjectsResult.data ?? []) as DbSubject[];
  const classes = (classesResult.data ?? []) as DbClass[];
  const teacherAttendance = (teacherAttendanceResult.data ?? []) as DbTeacherAttendance[];
  const announcements = (announcementsResult.data ?? []) as DbAnnouncement[];

  const studentByUser = new Map(
    students.filter((row) => row.user_id).map((row) => [row.user_id as string, row])
  );
  const teacherByUser = new Map(
    teachers.filter((row) => row.user_id).map((row) => [row.user_id as string, row])
  );
  const teacherById = new Map(teachers.map((row) => [row.teacher_id, row]));
  const courseById = new Map(courses.map((row) => [row.course_id, row]));
  const sectionById = new Map(sections.map((row) => [row.section_id, row]));
  const subjectById = new Map(subjects.map((row) => [row.subject_id, row]));

  const studentCountBySection = new Map<string, number>();
  for (const student of students) {
    studentCountBySection.set(
      student.section,
      (studentCountBySection.get(student.section) ?? 0) + 1
    );
  }
  const classCountBySection = new Map<number, number>();
  for (const item of classes) {
    classCountBySection.set(item.section_id, (classCountBySection.get(item.section_id) ?? 0) + 1);
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
        status:
          row.approval_status === "pending"
            ? ("Pending" as const)
            : row.approval_status === "rejected"
              ? ("Rejected" as const)
              : ("Active" as const),
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
      department_id: row.department_id,
      department: row.department_id ? (departmentById.get(row.department_id) ?? "") : "",
      specialization: row.specialization,
      status: "Active" as const,
    })),
    departments: departments.map((row) => ({
      department_id: row.department_id,
      department_name: row.department_name,
      teacher_count: teachers.filter((teacher) => teacher.department_id === row.department_id).length,
    })),
    courses: courses.map((row) => ({
      course_id: row.course_id,
      course_code: row.course_code,
      course_name: row.course_name,
      section_count: sections.filter((item) => item.course_id === row.course_id).length,
      subject_count: subjects.filter((item) => item.course_id === row.course_id).length,
    })),
    sections: sections.map((row) => ({
      section_id: row.section_id,
      section_name: row.section_name,
      course_id: row.course_id,
      course_code: courseById.get(row.course_id)?.course_code ?? "",
      year_level: row.year_level ?? "",
      student_count: studentCountBySection.get(row.section_name) ?? 0,
      class_count: classCountBySection.get(row.section_id) ?? 0,
    })),
    subjects: subjects.map((row) => ({
      subject_id: row.subject_id,
      subject_code: row.subject_code,
      subject_name: row.subject_name,
      units: Number(row.units) || 0,
      year_level: row.year_level,
      course_id: row.course_id,
      course_code: row.course_id ? (courseById.get(row.course_id)?.course_code ?? null) : null,
    })),
    classes: classes.map((row) => {
      const subject = subjectById.get(row.subject_id);
      const section = sectionById.get(row.section_id);
      const teacher = row.teacher_id ? teacherById.get(row.teacher_id) : undefined;
      return {
        class_id: row.class_id,
        subject_id: row.subject_id,
        subject_code: subject?.subject_code ?? "",
        subject_name: subject?.subject_name ?? "",
        section_id: row.section_id,
        section_name: section?.section_name ?? "",
        course_code: section ? (courseById.get(section.course_id)?.course_code ?? "") : "",
        year_level: section?.year_level ?? subject?.year_level ?? "",
        teacher_id: row.teacher_id,
        teacher_name: teacher?.full_name ?? null,
        day: row.day,
        start_time: hm(row.start_time),
        end_time: hm(row.end_time),
        room: row.room,
        enrolled: section ? (studentCountBySection.get(section.section_name) ?? 0) : 0,
      };
    }),
    teacherAttendance: teacherAttendance
      .filter((row) => row.teacher_id !== null)
      .map((row) => ({
        id: row.att_teacher_id,
        teacher_id: row.teacher_id as number,
        date: row.date,
        status: teacherStatusOf(row.status),
        time_in: row.time_in,
        time_out: row.time_out,
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

// Approve or reject a self-registered account.
router.patch("/users/:id/approval", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { decision } = z.object({ decision: z.enum(["approve", "reject"]) }).parse(req.body);

    const { data: user, error: readError } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read user", "USER_READ_FAILED");
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    const { error } = await supabaseAdmin
      .from("users")
      .update({ approval_status: decision === "approve" ? "approved" : "rejected" })
      .eq("user_id", id);
    if (error) dbFailure(error, "Could not update approval", "APPROVAL_FAILED");

    await sendData(res);
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
          Promise.resolve(0),
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

// A student's year and course follow their section; "Unassigned" keeps what was typed.
async function resolveStudentPlacement(section: string, year: string, courseYear: string) {
  if (!section || section === "Unassigned") {
    return { section: "Unassigned", year_level: year, course_year: courseYear };
  }
  const { data, error } = await supabaseAdmin
    .from("sections")
    .select("section_name, year_level, course_id")
    .eq("section_name", section)
    .maybeSingle();
  if (error) dbFailure(error, "Could not read section", "SECTION_READ_FAILED");
  if (!data) throw new ApiError(400, "That section does not exist", "SECTION_NOT_FOUND");

  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("course_code")
    .eq("course_id", data.course_id)
    .maybeSingle();
  return {
    section: data.section_name as string,
    year_level: (data.year_level as string | null) || year,
    course_year: (course?.course_code as string | undefined) ?? courseYear,
  };
}

async function ensureStudentNumberFree(studentNumber: string, exceptId: number | null) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("student_id")
    .eq("student_number", studentNumber)
    .limit(2);
  if (error) dbFailure(error, "Could not check student number", "STUDENT_NUMBER_CHECK_FAILED");
  if ((data ?? []).some((row) => row.student_id !== exceptId)) {
    throw new ApiError(409, "That student number is already in use", "STUDENT_TAKEN");
  }
}

router.post("/students", async (req, res, next) => {
  try {
    const body = studentCreateSchema.parse(req.body);
    await ensureStudentNumberFree(body.student_number, null);
    const placement = await resolveStudentPlacement(body.section, body.year_level, body.course_year);
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
      year_level: placement.year_level,
      section: placement.section,
      course_year: placement.course_year,
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
    if (body.student_number) await ensureStudentNumberFree(body.student_number, id);

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
    if (body.section) {
      const placement = await resolveStudentPlacement(
        body.section,
        body.year_level ?? "1st Year",
        body.course_year ?? ""
      );
      studentPatch.section = placement.section;
      studentPatch.year_level = placement.year_level;
      studentPatch.course_year = placement.course_year;
    } else {
      if (body.year_level) studentPatch.year_level = body.year_level;
      if (body.course_year !== undefined) studentPatch.course_year = body.course_year;
    }
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
      department_id: body.department_id ?? null,
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
    if (body.department_id !== undefined) profilePatch.department_id = body.department_id;
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
      Promise.resolve(0),
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

// ───────────────────────── Courses (degree programs) ─────────────────────────

router.post("/courses", async (req, res, next) => {
  try {
    const body = courseSchema.parse(req.body);
    const { error } = await supabaseAdmin.from("courses").insert({
      course_code: body.course_code.toUpperCase(),
      course_name: body.course_name,
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
    const body = courseUpdateSchema.parse(req.body);
    const patch: Record<string, unknown> = {};
    if (body.course_code) patch.course_code = body.course_code.toUpperCase();
    if (body.course_name) patch.course_name = body.course_name;
    if (Object.keys(patch).length === 0) throw new ApiError(400, "No changes supplied", "EMPTY_UPDATE");

    const { error } = await supabaseAdmin.from("courses").update(patch).eq("course_id", id);
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
    const [sections, subjects] = await Promise.all([
      countRows("sections", "course_id", id),
      countRows("subjects", "course_id", id),
    ]);
    if (sections + subjects > 0) {
      throw new ApiError(
        409,
        `Cannot delete this course: ${sections} section(s) and ${subjects} subject(s) belong to it`,
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

// ───────────────────────── Sections ─────────────────────────

// A section's year/course may only change if every class it already has still fits.
async function ensureSectionStillFits(
  sectionId: number,
  newYear: string | undefined,
  newCourseId: number | undefined
) {
  if (newYear === undefined && newCourseId === undefined) return;
  const { data: classes, error } = await supabaseAdmin
    .from("classes")
    .select("subject_id")
    .eq("section_id", sectionId);
  if (error) dbFailure(error, "Could not check classes", "CLASS_CHECK_FAILED");
  const ids = (classes ?? []).map((row) => row.subject_id as number);
  if (ids.length === 0) return;

  const { data: subjects, error: subjectError } = await supabaseAdmin
    .from("subjects")
    .select("subject_code, year_level, course_id")
    .in("subject_id", ids);
  if (subjectError) dbFailure(subjectError, "Could not check subjects", "SUBJECT_CHECK_FAILED");

  const bad = (subjects ?? []).filter(
    (subject) =>
      (newYear !== undefined && subject.year_level !== newYear) ||
      (newCourseId !== undefined &&
        subject.course_id !== null &&
        subject.course_id !== newCourseId)
  );
  if (bad.length > 0) {
    throw new ApiError(
      409,
      `Can't change this section: it already has ${bad.map((s) => s.subject_code).join(", ")}, which wouldn't fit. Remove those classes first.`,
      "SECTION_IN_USE"
    );
  }
}

router.post("/sections", async (req, res, next) => {
  try {
    const body = sectionCreateSchema.parse(req.body);
    const { error } = await supabaseAdmin.from("sections").insert({
      section_name: body.section_name,
      year_level: body.year_level,
      course_id: body.course_id,
    });
    if (error?.code === "23505") {
      throw new ApiError(409, "That section already exists", "SECTION_TAKEN");
    }
    if (error?.code === "23503") {
      throw new ApiError(404, "Course not found", "COURSE_NOT_FOUND");
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

    await ensureSectionStillFits(id, body.year_level, body.course_id);

    const patch: Record<string, unknown> = {};
    if (body.section_name) patch.section_name = body.section_name;
    if (body.year_level) patch.year_level = body.year_level;
    if (body.course_id) patch.course_id = body.course_id;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("sections").update(patch).eq("section_id", id);
      if (error?.code === "23505") {
        throw new ApiError(409, "That section already exists", "SECTION_TAKEN");
      }
      if (error?.code === "23503") {
        throw new ApiError(404, "Course not found", "COURSE_NOT_FOUND");
      }
      if (error) dbFailure(error, "Could not update section", "SECTION_UPDATE_FAILED");
    }

    // students store the section name as text, so keep it in sync on rename
    if (body.section_name && body.section_name !== existing.section_name) {
      const { error } = await supabaseAdmin
        .from("students")
        .update({ section: body.section_name })
        .eq("section", existing.section_name);
      if (error) dbFailure(error, "Could not update students", "SECTION_SYNC_FAILED");
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

    const [students, classes] = await Promise.all([
      countRows("students", "section", existing.section_name),
      countRows("classes", "section_id", id),
    ]);
    if (students + classes > 0) {
      throw new ApiError(
        409,
        `Cannot delete this section: ${students} student(s) and ${classes} class(es) are linked`,
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

// ───────────────────────── Subjects ─────────────────────────

// A subject's year/course may only change if every section already using it still fits.
async function ensureSubjectStillFits(
  subjectId: number,
  subjectCode: string,
  newYear: string | undefined,
  newCourseId: number | null | undefined
) {
  if (newYear === undefined && newCourseId === undefined) return;
  const { data: classes, error } = await supabaseAdmin
    .from("classes")
    .select("section_id")
    .eq("subject_id", subjectId);
  if (error) dbFailure(error, "Could not check classes", "CLASS_CHECK_FAILED");
  const ids = (classes ?? []).map((row) => row.section_id as number);
  if (ids.length === 0) return;

  const { data: sections, error: sectionError } = await supabaseAdmin
    .from("sections")
    .select("section_name, year_level, course_id")
    .in("section_id", ids);
  if (sectionError) dbFailure(sectionError, "Could not check sections", "SECTION_CHECK_FAILED");

  const bad = (sections ?? []).filter(
    (section) =>
      (newYear !== undefined && section.year_level && section.year_level !== newYear) ||
      (newCourseId !== undefined && newCourseId !== null && section.course_id !== newCourseId)
  );
  if (bad.length > 0) {
    throw new ApiError(
      409,
      `Can't change ${subjectCode}: it is already given to ${bad.map((s) => s.section_name).join(", ")}. Remove those classes first.`,
      "SUBJECT_IN_USE"
    );
  }
}

router.post("/subjects", async (req, res, next) => {
  try {
    const body = subjectCreateSchema.parse(req.body);
    const { error } = await supabaseAdmin.from("subjects").insert({
      subject_code: body.subject_code,
      subject_name: body.subject_name,
      units: String(body.units),
      year_level: body.year_level,
      course_id: body.course_id ?? null,
    });
    if (error?.code === "23505") {
      throw new ApiError(409, "That subject code already exists", "SUBJECT_TAKEN");
    }
    if (error?.code === "23503") {
      throw new ApiError(404, "Course not found", "COURSE_NOT_FOUND");
    }
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

    await ensureSubjectStillFits(id, existing.subject_code, body.year_level, body.course_id);

    const patch: Record<string, unknown> = {};
    if (body.subject_code) patch.subject_code = body.subject_code;
    if (body.subject_name) patch.subject_name = body.subject_name;
    if (body.units !== undefined) patch.units = String(body.units);
    if (body.year_level) patch.year_level = body.year_level;
    if (body.course_id !== undefined) patch.course_id = body.course_id;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("subjects").update(patch).eq("subject_id", id);
      if (error?.code === "23505") {
        throw new ApiError(409, "That subject code already exists", "SUBJECT_TAKEN");
      }
      if (error?.code === "23503") {
        throw new ApiError(404, "Course not found", "COURSE_NOT_FOUND");
      }
      if (error) dbFailure(error, "Could not update subject", "SUBJECT_UPDATE_FAILED");
    }

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/subjects/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const linked = await countRows("classes", "subject_id", id);
    if (linked > 0) {
      throw new ApiError(
        409,
        `Cannot delete this subject: ${linked} class(es) use it`,
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

// ───────────────────────── Classes (subject + section + teacher + schedule) ─────────────────────────

// A subject can only be given to a section of its own year, and of its own course
// (or to any course when the subject is general).
async function ensureClassRules(subjectId: number, sectionId: number) {
  const [subjectResult, sectionResult] = await Promise.all([
    supabaseAdmin
      .from("subjects")
      .select("subject_code, year_level, course_id")
      .eq("subject_id", subjectId)
      .maybeSingle(),
    supabaseAdmin
      .from("sections")
      .select("section_name, year_level, course_id")
      .eq("section_id", sectionId)
      .maybeSingle(),
  ]);
  if (subjectResult.error) dbFailure(subjectResult.error, "Could not read subject", "SUBJECT_READ_FAILED");
  if (sectionResult.error) dbFailure(sectionResult.error, "Could not read section", "SECTION_READ_FAILED");
  const subject = subjectResult.data;
  const section = sectionResult.data;
  if (!subject) throw new ApiError(404, "Subject not found", "SUBJECT_NOT_FOUND");
  if (!section) throw new ApiError(404, "Section not found", "SECTION_NOT_FOUND");

  if (section.year_level && subject.year_level !== section.year_level) {
    throw new ApiError(
      400,
      `${subject.subject_code} is a ${subject.year_level} subject and can't be given to ${section.section_name} (${section.year_level})`,
      "SUBJECT_YEAR_MISMATCH"
    );
  }
  if (subject.course_id !== null && subject.course_id !== section.course_id) {
    throw new ApiError(
      400,
      `${subject.subject_code} belongs to a different course than ${section.section_name}`,
      "SUBJECT_COURSE_MISMATCH"
    );
  }
}

interface Slot {
  day: string;
  start_time: string;
  end_time: string;
}

// day + start + end are all set or all empty (an unscheduled class).
function readSlot(
  day: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined
): Slot | null {
  const given = [day, start, end].filter(Boolean).length;
  if (given === 0) return null;
  if (given < 3 || !day || !start || !end) {
    throw new ApiError(400, "Set the day, start time and end time together", "INCOMPLETE_SCHEDULE");
  }
  if (start >= end) {
    throw new ApiError(400, "End time must be after start time", "INVALID_TIME_RANGE");
  }
  return { day, start_time: start, end_time: end };
}

// Two classes clash when they overlap in time on the same day AND share the
// teacher, the section, or the room.
async function ensureNoClassConflict(
  classId: number | null,
  slot: Slot,
  sectionId: number,
  teacherId: number | null,
  room: string | null | undefined
) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("class_id, subject_id, section_id, teacher_id, day, start_time, end_time, room")
    .eq("day", slot.day);
  if (error) dbFailure(error, "Could not check schedule conflicts", "CONFLICT_CHECK_FAILED");

  const wantedRoom = (room ?? "").trim().toLowerCase();
  for (const row of (data ?? []) as DbClass[]) {
    if (row.class_id === classId) continue;
    if (!row.start_time || !row.end_time) continue;
    const start = row.start_time.slice(0, 5);
    const end = row.end_time.slice(0, 5);
    if (!(start < slot.end_time && end > slot.start_time)) continue;

    const reasons: string[] = [];
    if (teacherId !== null && row.teacher_id === teacherId) reasons.push("teacher");
    if (row.section_id === sectionId) reasons.push("section");
    if (wantedRoom && (row.room ?? "").trim().toLowerCase() === wantedRoom) reasons.push("room");
    if (reasons.length === 0) continue;

    const [subject, section] = await Promise.all([
      supabaseAdmin.from("subjects").select("subject_code").eq("subject_id", row.subject_id).maybeSingle(),
      supabaseAdmin.from("sections").select("section_name").eq("section_id", row.section_id).maybeSingle(),
    ]);
    throw new ApiError(
      409,
      `Schedule conflict with ${subject.data?.subject_code ?? "another class"} for ${section.data?.section_name ?? "another section"} (${start}-${end}) — same ${reasons.join(", ")}`,
      "SCHEDULE_CONFLICT"
    );
  }
}

router.post("/classes", async (req, res, next) => {
  try {
    const body = classCreateSchema.parse(req.body);
    await ensureClassRules(body.subject_id, body.section_id);

    const slot = readSlot(body.day, body.start_time, body.end_time);
    const teacherId = body.teacher_id ?? null;
    if (slot) await ensureNoClassConflict(null, slot, body.section_id, teacherId, body.room);

    const { error } = await supabaseAdmin.from("classes").insert({
      subject_id: body.subject_id,
      section_id: body.section_id,
      teacher_id: teacherId,
      day: slot?.day ?? null,
      start_time: slot?.start_time ?? null,
      end_time: slot?.end_time ?? null,
      room: body.room || null,
    });
    if (error?.code === "23505") {
      throw new ApiError(409, "That subject is already given to this section", "CLASS_TAKEN");
    }
    if (error?.code === "23503") {
      throw new ApiError(404, "Teacher, subject or section not found", "CLASS_REFERENCE_NOT_FOUND");
    }
    if (error) dbFailure(error, "Could not create class", "CLASS_CREATE_FAILED");
    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

// Change who teaches it and/or when and where. Omitted fields are kept; null clears.
router.patch("/classes/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = classBaseSchema.parse(req.body);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("classes")
      .select("class_id, subject_id, section_id, teacher_id, day, start_time, end_time, room")
      .eq("class_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read class", "CLASS_READ_FAILED");
    if (!existing) throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");

    const teacherId = body.teacher_id !== undefined ? body.teacher_id : existing.teacher_id;
    const room = body.room !== undefined ? body.room || null : existing.room;
    const slot = readSlot(
      body.day !== undefined ? body.day : existing.day,
      body.start_time !== undefined ? body.start_time : existing.start_time?.slice(0, 5),
      body.end_time !== undefined ? body.end_time : existing.end_time?.slice(0, 5)
    );
    if (slot) await ensureNoClassConflict(id, slot, existing.section_id, teacherId, room);

    const { error } = await supabaseAdmin
      .from("classes")
      .update({
        teacher_id: teacherId,
        day: slot?.day ?? null,
        start_time: slot?.start_time ?? null,
        end_time: slot?.end_time ?? null,
        room,
      })
      .eq("class_id", id);
    if (error?.code === "23503") {
      throw new ApiError(404, "Teacher not found", "TEACHER_NOT_FOUND");
    }
    if (error) dbFailure(error, "Could not update class", "CLASS_UPDATE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

// Take a class off the timetable but keep it (and its teacher).
router.delete("/classes/:id/schedule", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { error } = await supabaseAdmin
      .from("classes")
      .update({ day: null, start_time: null, end_time: null, room: null })
      .eq("class_id", id);
    if (error) dbFailure(error, "Could not clear schedule", "SCHEDULE_CLEAR_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/classes/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const [attendance, grades, quizzes] = await Promise.all([
      countRows("attendance", "class_id", id),
      countRows("grades", "class_id", id),
      countRows("quizzes", "class_id", id),
    ]);
    if (attendance + grades + quizzes > 0) {
      throw new ApiError(
        409,
        "Cannot delete this class because attendance, grades, or quizzes exist for it",
        "DELETE_BLOCKED"
      );
    }
    const { error } = await supabaseAdmin.from("classes").delete().eq("class_id", id);
    if (error) dbFailure(error, "Could not delete class", "CLASS_DELETE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

// ───────────────────────── Departments ─────────────────────────

const departmentSchema = z.object({
  department_name: z.string().trim().min(2).max(150),
});

router.post("/departments", async (req, res, next) => {
  try {
    const body = departmentSchema.parse(req.body);
    const { error } = await supabaseAdmin
      .from("departments")
      .insert({ department_name: body.department_name });
    if (error?.code === "23505") {
      throw new ApiError(409, "That department already exists", "DEPARTMENT_TAKEN");
    }
    if (error) dbFailure(error, "Could not create department", "DEPARTMENT_CREATE_FAILED");
    await sendData(res, 201);
  } catch (error) {
    next(error);
  }
});

router.patch("/departments/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = departmentSchema.parse(req.body);

    const { data: existing, error: readError } = await supabaseAdmin
      .from("departments")
      .select("department_id, department_name")
      .eq("department_id", id)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read department", "DEPARTMENT_READ_FAILED");
    if (!existing) throw new ApiError(404, "Department not found", "DEPARTMENT_NOT_FOUND");

    const { error } = await supabaseAdmin
      .from("departments")
      .update({ department_name: body.department_name })
      .eq("department_id", id);
    if (error?.code === "23505") {
      throw new ApiError(409, "That department already exists", "DEPARTMENT_TAKEN");
    }
    if (error) dbFailure(error, "Could not update department", "DEPARTMENT_UPDATE_FAILED");

    // teacher attendance keeps the department name as a snapshot; keep it in step
    await supabaseAdmin
      .from("attendance_teachers")
      .update({ department: body.department_name })
      .eq("department", existing.department_name);

    await sendData(res);
  } catch (error) {
    next(error);
  }
});

router.delete("/departments/:id", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const teachers = await countRows("teachers", "department_id", id);
    if (teachers > 0) {
      throw new ApiError(
        409,
        `Cannot delete this department: ${teachers} teacher(s) belong to it`,
        "DELETE_BLOCKED"
      );
    }
    const { error } = await supabaseAdmin.from("departments").delete().eq("department_id", id);
    if (error) dbFailure(error, "Could not delete department", "DEPARTMENT_DELETE_FAILED");
    await sendData(res);
  } catch (error) {
    next(error);
  }
});

// Teacher attendance: one record per teacher per day (upsert).
router.put("/teacher-attendance", async (req, res, next) => {
  try {
    const body = teacherAttendanceSchema.parse(req.body);

    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .select("teacher_id, full_name, department_id")
      .eq("teacher_id", body.teacher_id)
      .maybeSingle();
    if (teacherError) dbFailure(teacherError, "Could not read teacher", "TEACHER_READ_FAILED");
    if (!teacher) throw new ApiError(404, "Teacher not found", "TEACHER_NOT_FOUND");

    let departmentName: string | null = null;
    if (teacher.department_id) {
      const { data: department } = await supabaseAdmin
        .from("departments")
        .select("department_name")
        .eq("department_id", teacher.department_id)
        .maybeSingle();
      departmentName = department?.department_name ?? null;
    }

    // Time in/out only makes sense for a teacher who actually came in.
    const present = body.status === "Present";
    const payload = {
      teacher_id: teacher.teacher_id,
      teacher_name: teacher.full_name,
      department: departmentName,
      date: body.date,
      status: body.status,
      time_in: present ? body.time_in || null : null,
      time_out: present ? body.time_out || null : null,
    };

    const { data: existing, error: readError } = await supabaseAdmin
      .from("attendance_teachers")
      .select("att_teacher_id")
      .eq("teacher_id", body.teacher_id)
      .eq("date", body.date)
      .maybeSingle();
    if (readError) dbFailure(readError, "Could not read attendance", "ATTENDANCE_READ_FAILED");

    if (existing) {
      const { error } = await supabaseAdmin
        .from("attendance_teachers")
        .update(payload)
        .eq("att_teacher_id", existing.att_teacher_id);
      if (error) dbFailure(error, "Could not update attendance", "ATTENDANCE_UPDATE_FAILED");
    } else {
      const { error } = await supabaseAdmin.from("attendance_teachers").insert(payload);
      if (error) dbFailure(error, "Could not save attendance", "ATTENDANCE_CREATE_FAILED");
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
