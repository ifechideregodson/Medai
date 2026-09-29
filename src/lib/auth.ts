import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_DAYS = 7;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createUser(email: string, password: string, name: string, role: any) {
  const passwordHash = await bcrypt.hash(password, 12);
  return db.user.create({ data: { email: email.toLowerCase().trim(), passwordHash, name, role } });
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const jar = await cookies();
  jar.set("medai_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get("medai_session")?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete("medai_session");
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireRole(roles: string[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get("medai_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return session.user;
}