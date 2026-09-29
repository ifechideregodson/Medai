import crypto from "node:crypto";
import { db } from "@/lib/db";

export async function audit(action: string, entity: string, entityId?: string, details?: string, userId?: string) {
  const previous = await db.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { eventHash: true } });
  const createdAt = new Date();
  const payload = JSON.stringify({ action, entity, entityId: entityId ?? null, details: details ?? null, userId: userId ?? null, previousHash: previous?.eventHash ?? null, createdAt: createdAt.toISOString() });
  const eventHash = crypto.createHash("sha256").update(payload).digest("hex");
  return db.auditLog.create({ data: { action, entity, entityId, details, userId, previousHash: previous?.eventHash ?? null, eventHash, createdAt } });
}