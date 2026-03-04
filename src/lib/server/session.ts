import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

export const PARENT_SESSION_COOKIE = "herohabits_parent_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface ParentSession {
  iat: number;
  exp: number;
  role: "parent";
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", env.parentSessionSecret)
    .update(payloadB64)
    .digest("base64url");
}

export function issueParentSession(now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const exp = iat + SESSION_TTL_SECONDS;
  const payload: ParentSession = { iat, exp, role: "parent" };
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyParentSession(token: string | undefined): ParentSession | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, signature] = parts;
  const expected = sign(payloadB64);

  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  const payloadRaw = base64urlDecode(payloadB64);
  const payload = JSON.parse(payloadRaw) as ParentSession;
  if (!payload.exp || payload.role !== "parent") {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return null;
  }

  return payload;
}

export const parentSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
