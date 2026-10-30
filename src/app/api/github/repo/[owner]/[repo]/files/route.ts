import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { discoverRimeFiles } from "@/lib/github/files";
import { GitHubApiError } from "@/lib/github/client";
import { resolveGitHubToken } from "@/lib/github/token";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const url = new URL(request.url);
  const branch = url.searchParams.get("branch") ?? undefined;

  try {
    const session = await getSession();
    const result = await discoverRimeFiles({
      owner,
      repo,
      branch,
      token: resolveGitHubToken(session.accessToken),
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
      { error: e instanceof Error ? e.message : "发现文件失败" },
      { status: 500 }
    );
  }
}
