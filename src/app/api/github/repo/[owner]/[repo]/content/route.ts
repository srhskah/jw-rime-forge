import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getFileContent } from "@/lib/github/files";
import { GitHubApiError } from "@/lib/github/client";
import { parseDict } from "@/lib/rime/parse-dict";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const ref = url.searchParams.get("ref") ?? undefined;
  const parse = url.searchParams.get("parse"); // "dict" | null

  if (!path) {
    return NextResponse.json({ error: "缺少 path 参数" }, { status: 400 });
  }

  try {
    const session = await getSession();
    const file = await getFileContent({
      owner,
      repo,
      path,
      ref,
      token: session.accessToken ?? null,
    });

    if (parse === "dict") {
      const parsed = parseDict(file.content);
      return NextResponse.json({
        path,
        sha: file.sha,
        size: file.size,
        // Raw content for download — never re-serialized
        raw: file.content,
        headerRaw: parsed.headerRaw,
        entries: parsed.entries,
        columns: parsed.columns,
        name: parsed.name,
        sort: parsed.sort,
        largeWarning: parsed.largeWarning,
      });
    }

    return NextResponse.json({
      path,
      sha: file.sha,
      size: file.size,
      raw: file.content,
    });
  } catch (e) {
    if (e instanceof GitHubApiError) {
      return NextResponse.json(
        { error: e.message, rateLimited: e.rateLimited },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "读取文件失败" },
      { status: 500 }
    );
  }
}
