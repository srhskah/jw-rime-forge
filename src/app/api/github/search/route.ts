import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { searchRimeRepos } from "@/lib/github/search";
import { GitHubApiError } from "@/lib/github/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const sort = (url.searchParams.get("sort") as "stars" | "updated" | "best-match") || "stars";
  const page = Number(url.searchParams.get("page") || "1");

  try {
    const session = await getSession();
    const result = await searchRimeRepos({
      q,
      sort,
      page,
      token: session.accessToken ?? null,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof GitHubApiError) {
      return NextResponse.json(
        { error: e.message, rateLimited: e.rateLimited },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "搜索失败" },
      { status: 500 }
    );
  }
}
