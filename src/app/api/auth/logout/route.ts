import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  session.destroy();
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/", url.origin));
}
