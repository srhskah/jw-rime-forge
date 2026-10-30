import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.login) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      login: session.login,
      name: session.name ?? null,
      avatarUrl: session.avatarUrl ?? null,
    },
  });
}
