import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicPath =
    path === "/login" ||
    path === "/setup" ||
    path.startsWith("/setup/") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/api/setup/first-admin" ||
    path === "/api/auth/login";
  if (publicPath) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get("medai_session")?.value);
  if (!hasSession) return NextResponse.redirect(appUrl("/login"));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api/health).*)"] };
