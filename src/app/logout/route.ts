import { destroySession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";

export async function POST(request: Request) {
  await destroySession();
  // Use the incoming request origin so production never falls back to localhost.
  return NextResponse.redirect(appUrl("/login"), 303);
}