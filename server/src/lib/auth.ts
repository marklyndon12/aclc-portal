import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export type Role = "admin" | "teacher" | "student";

export interface AuthUser {
  user_id: string;
  username: string;
  roles: Role;
  session_token: string;
}

export interface SessionUser {
  user_id: string;
  username: string;
  roles: Role;
  profile: Record<string, unknown> | null;
}

export function normalizeRole(value: string | null | undefined): Role | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("admin")) return "admin";
  if (raw.startsWith("teacher")) return "teacher";
  if (raw.startsWith("student")) return "student";
  return null;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash || !hash.startsWith("$2")) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

export async function loadProfile(
  userId: string,
  role: Role
): Promise<Record<string, unknown> | null> {
  if (role === "student") {
    const { data, error } = await supabaseAdmin
      .from("students")
      .select("student_id, user_id, full_name, student_number, year_level, section, course_year")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  if (role === "teacher") {
    const { data, error } = await supabaseAdmin
      .from("teachers")
      .select("teacher_id, user_id, full_name, department_id, specialization")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    let department: string | null = null;
    if (data.department_id) {
      const { data: row } = await supabaseAdmin
        .from("departments")
        .select("department_name")
        .eq("department_id", data.department_id)
        .maybeSingle();
      department = row?.department_name ?? null;
    }
    return {
      teacher_id: data.teacher_id,
      user_id: data.user_id,
      full_name: data.full_name,
      department,
      specialization: data.specialization,
    };
  }

  return null;
}
