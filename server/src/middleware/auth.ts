import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./error";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { normalizeRole, type AuthUser, type Role } from "../lib/auth";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("user_id, username, roles, session_token")
      .eq("session_token", token)
      .maybeSingle();

    if (error) {
      throw new ApiError(500, "Session lookup failed", "SESSION_LOOKUP_FAILED");
    }

    if (!data) {
      throw new ApiError(401, "Session expired", "SESSION_EXPIRED");
    }

    const role = normalizeRole(data.roles);
    if (!role) {
      throw new ApiError(403, "Account has no valid role", "INVALID_ROLE");
    }

    const user: AuthUser = {
      user_id: data.user_id,
      username: data.username,
      roles: role,
      session_token: token,
    };

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required", "UNAUTHORIZED"));
      return;
    }

    if (!allowed.includes(req.user.roles)) {
      next(new ApiError(403, "Forbidden", "FORBIDDEN"));
      return;
    }

    next();
  };
}
