import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ApiError } from "../middleware/error";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  generateSessionToken,
  hashPassword,
  loadProfile,
  normalizeRole,
  verifyPassword,
  type Role,
  type SessionUser,
} from "../lib/auth";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again later.",
    code: "RATE_LIMITED",
  },
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many signup attempts. Try again later.",
    code: "RATE_LIMITED",
  },
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username contains invalid characters"),
  role: z.enum(["student", "teacher"]),
  section: z.string().trim().max(100).optional(),
  department_id: z.number().int().positive().optional(),
  specialization: z.string().trim().max(150).optional(),
  password: z.string().min(8).max(200),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(8).max(200),
});

const adminRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many admin registration attempts. Try again later.",
    code: "RATE_LIMITED",
  },
});

const adminRegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username contains invalid characters"),
  password: z.string().min(8).max(200),
});

async function buildSessionUser(user: {
  user_id: string;
  username: string;
  roles: string | null;
}): Promise<SessionUser> {
  const role = normalizeRole(user.roles);
  if (!role) {
    throw new ApiError(403, "Account has no valid role", "INVALID_ROLE");
  }

  const profile = await loadProfile(user.user_id, role);
  return {
    user_id: user.user_id,
    username: user.username,
    roles: role,
    profile,
  };
}

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("user_id, username, password, roles, approval_status")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      throw new ApiError(500, "Login lookup failed", "LOGIN_LOOKUP_FAILED");
    }

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new ApiError(401, "Invalid username or password", "INVALID_CREDENTIALS");
    }

    // Checked only after the password is verified so usernames cannot be probed.
    if (user.approval_status === "pending") {
      throw new ApiError(
        403,
        "Your account is still waiting for admin approval. Please try again later.",
        "ACCOUNT_PENDING"
      );
    }
    if (user.approval_status === "rejected") {
      throw new ApiError(
        403,
        "Your registration was not approved. Please contact the registrar.",
        "ACCOUNT_REJECTED"
      );
    }

    const token = generateSessionToken();
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ session_token: token })
      .eq("user_id", user.user_id);

    if (updateError) {
      throw new ApiError(500, "Could not start session", "SESSION_WRITE_FAILED");
    }

    const sessionUser = await buildSessionUser(user);
    res.json({ token, user: sessionUser });
  } catch (error) {
    next(error);
  }
});

// Public list of sections so students can pick theirs while registering.
async function loadSectionsWithCourse() {
  const [sectionsResult, coursesResult] = await Promise.all([
    supabaseAdmin
      .from("sections")
      .select("section_name, year_level, course_id")
      .order("section_name"),
    supabaseAdmin.from("courses").select("course_id, course_code"),
  ]);
  if (sectionsResult.error || coursesResult.error) {
    throw new ApiError(500, "Could not load sections", "SECTIONS_FAILED");
  }
  const codeById = new Map(
    (coursesResult.data ?? []).map((row) => [row.course_id as number, row.course_code as string])
  );
  return (sectionsResult.data ?? []).map((row) => ({
    section_name: row.section_name as string,
    year_level: (row.year_level as string | null) ?? null,
    course_code: codeById.get(row.course_id as number) ?? null,
  }));
}

router.get("/sections", async (_req, res, next) => {
  try {
    res.json({ sections: await loadSectionsWithCourse() });
  } catch (error) {
    next(error);
  }
});

// Public list of departments so faculty can pick theirs while registering.
router.get("/departments", async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("department_id, department_name")
      .order("department_name");
    if (error) throw new ApiError(500, "Could not load departments", "DEPARTMENTS_FAILED");
    res.json({ departments: data ?? [] });
  } catch (error) {
    next(error);
  }
});

router.post("/signup", signupLimiter, async (req, res, next) => {
  try {
    const { full_name, username, role, password, section, department_id, specialization } =
      signupSchema.parse(req.body);

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) {
      throw new ApiError(500, "Signup lookup failed", "SIGNUP_LOOKUP_FAILED");
    }

    if (existing) {
      throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
    }

    // Students must pick one of the real sections (when any exist).
    let sectionRow: {
      section_name: string;
      course_code: string | null;
      year_level: string | null;
    } | null = null;
    if (role === "student") {
      const sections = await loadSectionsWithCourse();
      if (sections.length > 0) {
        sectionRow = sections.find((item) => item.section_name === section) ?? null;
        if (!sectionRow) {
          throw new ApiError(400, "Please choose your section", "SECTION_REQUIRED");
        }
      }
    }

    // Faculty must pick one of the real departments (when any exist).
    let departmentId: number | null = null;
    if (role === "teacher") {
      const { data: departments, error: departmentError } = await supabaseAdmin
        .from("departments")
        .select("department_id");
      if (departmentError) {
        throw new ApiError(500, "Could not load departments", "DEPARTMENTS_FAILED");
      }
      if ((departments ?? []).length > 0) {
        const match = (departments ?? []).find((item) => item.department_id === department_id);
        if (!match) throw new ApiError(400, "Please choose your department", "DEPARTMENT_REQUIRED");
        departmentId = match.department_id as number;
      }
    }

    const hash = await hashPassword(password);

    // New accounts wait for an admin to approve them; no session is issued yet.
    const { data: user, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({ username, password: hash, roles: role, approval_status: "pending" })
      .select("user_id, username, roles")
      .single();

    if (insertError || !user) {
      if (insertError?.code === "23505") {
        throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
      }
      console.error("Signup user insert failed", insertError);
      throw new ApiError(500, "Could not create account", "SIGNUP_FAILED");
    }

    const profileError =
      role === "student"
        ? (
            await supabaseAdmin.from("students").insert({
              user_id: user.user_id,
              full_name,
              student_number: `PENDING-${username}`,
              year_level: sectionRow?.year_level || "1st Year",
              section: sectionRow?.section_name ?? "Unassigned",
              course_year: sectionRow?.course_code || "N/A",
              username,
              password: hash,
            })
          ).error
        : (
            await supabaseAdmin.from("teachers").insert({
              user_id: user.user_id,
              full_name,
              department_id: departmentId,
              specialization: specialization || "N/A",
              username,
              password: hash,
            })
          ).error;

    if (profileError) {
      console.error("Signup profile insert failed", profileError);
      await supabaseAdmin.from("users").delete().eq("user_id", user.user_id);
      throw new ApiError(
        500,
        "Could not create your profile. Please contact the registrar.",
        "SIGNUP_PROFILE_FAILED"
      );
    }

    res.status(201).json({
      status: "pending",
      message: "Registration submitted. You can sign in once an admin approves your account.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin-register", adminRegisterLimiter, async (req, res, next) => {
  try {
    const { username, password } = adminRegisterSchema.parse(req.body);

    const { data: existingAdmins, error: adminLookupError } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .ilike("roles", "admin%")
      .limit(1);

    if (adminLookupError) {
      throw new ApiError(500, "Admin lookup failed", "ADMIN_LOOKUP_FAILED");
    }

    if (existingAdmins && existingAdmins.length > 0) {
      throw new ApiError(
        403,
        "An admin account already exists. Please use the sign-in page.",
        "ADMIN_EXISTS"
      );
    }

    const { data: existingUser, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();

    if (lookupError) {
      throw new ApiError(500, "Signup lookup failed", "SIGNUP_LOOKUP_FAILED");
    }

    if (existingUser) {
      throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
    }

    const hash = await hashPassword(password);
    const { error: insertError } = await supabaseAdmin
      .from("users")
      .insert({ username, password: hash, roles: "admin" });

    if (insertError) {
      if (insertError.code === "23505") {
        throw new ApiError(409, "That username is already taken", "USERNAME_TAKEN");
      }
      throw new ApiError(500, "Could not create admin account", "ADMIN_CREATE_FAILED");
    }

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/session", requireAuth, async (req, res, next) => {
  try {
    const current = req.user!;
    const sessionUser = await buildSessionUser({
      user_id: current.user_id,
      username: current.username,
      roles: current.roles,
    });

    res.json({ user: sessionUser });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ session_token: null })
      .eq("user_id", req.user!.user_id);

    if (error) {
      throw new ApiError(500, "Logout failed", "LOGOUT_FAILED");
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = changePasswordSchema.parse(req.body);

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("user_id, password, roles")
      .eq("user_id", req.user!.user_id)
      .maybeSingle();

    if (error) {
      throw new ApiError(500, "Password lookup failed", "PASSWORD_LOOKUP_FAILED");
    }

    if (!user || !(await verifyPassword(current_password, user.password))) {
      throw new ApiError(400, "Current password is incorrect", "INVALID_PASSWORD");
    }

    const hash = await hashPassword(new_password);
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ password: hash })
      .eq("user_id", user.user_id);

    if (updateError) {
      throw new ApiError(500, "Password update failed", "PASSWORD_UPDATE_FAILED");
    }

    const role: Role | null = normalizeRole(user.roles);
    if (role === "student" || role === "teacher") {
      const table = role === "student" ? "students" : "teachers";
      const { error: profileError } = await supabaseAdmin
        .from(table)
        .update({ password: hash })
        .eq("user_id", user.user_id);

      if (profileError) {
        throw new ApiError(
          500,
          "Password updated in users but profile sync failed",
          "PROFILE_SYNC_FAILED"
        );
      }
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
