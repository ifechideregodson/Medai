import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await authenticate(email, password);

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  }

  const { token, expiresAt } = await createSession(user.id);

  const destination =
    user.role === "SUPER_ADMIN"
      ? "/admin"
      : user.role === "HOSPITAL_ADMIN"
        ? "/organization"
        : "/";

  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.set("medai_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
  return response;
}
