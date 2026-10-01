import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicPath =
    path === "/login" ||
    path === "/setup" ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/api/setup/first-admin";
  if (publicPath) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get("medai_session")?.value);
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api/health).*)"] };
