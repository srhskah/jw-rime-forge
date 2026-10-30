import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkWritePermission } from "@/lib/github/permission";
import { GitHubApiError } from "@/lib/github/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.accessToken || !session.login) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ error: "缺少 owner/repo" }, { status: 400 });
  }

  try {
    const result = await checkWritePermission({
      owner,
      repo,
      username: session.login,
      token: session.accessToken,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof GitHubApiError) {
      // Not a collaborator → treat as none
      if (e.status === 403 || e.status === 404) {
        return NextResponse.json({ permission: "none", canWrite: false });
      }
      return NextResponse.json(
        { error: e.message, rateLimited: e.rateLimited },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "权限查询失败" },
      { status: 500 }
    );
  }
}
