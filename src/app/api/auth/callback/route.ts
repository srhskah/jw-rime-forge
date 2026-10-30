import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { githubFetch } from "@/lib/github/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") || "";
  const stateMatch = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/);
  const storedState = stateMatch ? decodeURIComponent(stateMatch[1]) : null;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?auth=invalid_state", url.origin));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?auth=misconfigured", url.origin));
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenData.access_token) {
    return NextResponse.redirect(
      new URL(
        `/?auth=token_error&msg=${encodeURIComponent(tokenData.error_description || tokenData.error || "unknown")}`,
        url.origin
      )
    );
  }

  const user = await githubFetch<{
    login: string;
    name: string | null;
    avatar_url: string | null;
  }>("/user", { token: tokenData.access_token });

  const session = await getSession();
  session.accessToken = tokenData.access_token;
  session.login = user.login;
  session.name = user.name;
  session.avatarUrl = user.avatar_url;
  session.isLoggedIn = true;
  await session.save();

  const res = NextResponse.redirect(new URL("/workspace", url.origin));
  res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
