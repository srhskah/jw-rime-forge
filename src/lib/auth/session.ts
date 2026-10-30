import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

/**
 * Encrypted httpOnly cookie session.
 * GitHub access token NEVER goes to localStorage / client JS.
 *
 * Future: migrate to GitHub App for per-repo fine-grained permissions
 * instead of the broad OAuth `repo` scope used in MVP.
 */
export type SessionData = {
  accessToken?: string;
  login?: string;
  name?: string | null;
  avatarUrl?: string | null;
  isLoggedIn: boolean;
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "",
  cookieName: "rime_forge_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  },
};

function resolvePassword(): string {
  const raw = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (raw.length >= 32) return raw;
  // Allow missing secret in build-time; runtime routes check separately
  return "dev-only-insecure-session-secret-change-me!!";
}

export async function getSession() {
  return getIronSession<SessionData>(cookies(), {
    ...sessionOptions,
    password: resolvePassword(),
  });
}

export function assertSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET (or NEXTAUTH_SECRET) must be set and at least 32 characters"
    );
  }
}
