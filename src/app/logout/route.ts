import { destroySession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await destroySession();
  // Use the incoming request origin so production never falls back to localhost.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}