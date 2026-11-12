import type { Role } from "../types";

export function homePath(role: Role): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  return "/student/dashboard";
}

export function roleLabel(role: Role): string {
  if (role === "admin") return "Administrator";
  if (role === "teacher") return "Teacher";
  return "Student";
}
