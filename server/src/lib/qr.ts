import crypto from "node:crypto";
import { env } from "../config/env";

// The signing key is derived from a server-only secret, so a student cannot forge a
// code for someone else: only this server can produce a valid signature.
const KEY = crypto
  .createHash("sha256")
  .update(`aclc-live-qr-v1:${env.SUPABASE_SERVICE_ROLE_KEY}`)
  .digest();

function signature(studentId: number, issuedAt: number): string {
  return crypto
    .createHmac("sha256", KEY)
    .update(`${studentId}|${issuedAt}`)
    .digest("hex")
    .slice(0, 24);
}

export function signQr(studentId: number, issuedAt: number): string {
  return `${studentId}|${issuedAt}|${signature(studentId, issuedAt)}`;
}

export interface QrClaims {
  studentId: number;
  issuedAt: number;
}

// Returns the claims when the payload has a valid signature, otherwise null.
export function verifyQr(payload: string): QrClaims | null {
  const parts = payload.split("|");
  if (parts.length !== 3) return null;
  const studentId = Number(parts[0]);
  const issuedAt = Number(parts[1]);
  if (!Number.isInteger(studentId) || studentId <= 0 || !Number.isFinite(issuedAt)) return null;

  const expected = Buffer.from(signature(studentId, issuedAt));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length) return null;
  return crypto.timingSafeEqual(expected, given) ? { studentId, issuedAt } : null;
}
