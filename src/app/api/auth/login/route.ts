import { NextResponse } from "next/server";

/**
 * GitHub OAuth App login.
 * Scopes: read:user + repo
 * (MVP accepts broad `repo` scope; future: migrate to GitHub App for
 * per-repository fine-grained permissions.)
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID 未配置" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  // const origin = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const origin = process.env.APP_URL || process.env.URL || `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/auth/callback`;
  const state = crypto.randomUUID();

  const res = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent("read:user repo")}&state=${encodeURIComponent(state)}`
  );
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
