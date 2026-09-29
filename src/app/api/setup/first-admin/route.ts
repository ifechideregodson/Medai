import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  const setupSecret = req.headers.get("x-setup-secret");
  if (!process.env.FIRST_ADMIN_SETUP_SECRET || setupSecret !== process.env.FIRST_ADMIN_SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await db.user.count({ where: { role: Role.SUPER_ADMIN } });
  if (existing > 0) return NextResponse.json({ error: "Initial administrator already exists" }, { status: 409 });

  const body = await req.json();
  if (!body.email || !body.password || !body.name) return NextResponse.json({ error: "name, email and password are required" }, { status: 400 });
  const user = await createUser(body.email, body.password, body.name, Role.SUPER_ADMIN);
  return NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 201 });
}