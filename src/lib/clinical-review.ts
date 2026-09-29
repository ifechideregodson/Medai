import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const reviewerRoles = new Set(["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "RADIOLOGIST", "DERMATOLOGIST"]);

export async function requireReviewer() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (!reviewerRoles.has(user.role)) throw new Error("REVIEWER_ROLE_REQUIRED");
  return user;
}

export async function getAnalysisForUser(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const analysis = await db.analysis.findUnique({
    where: { id },
    include: { patient: true, asset: true, model: true, report: true, inferenceRuns: { orderBy: { createdAt: "desc" } }, annotations: { orderBy: { createdAt: "desc" }, include: { author: true } } }
  });
  if (!analysis) return null;
  if (user.role === "SUPER_ADMIN") return analysis;
  if (!analysis.organizationId) throw new Error("FORBIDDEN");
  const membership = await db.membership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: analysis.organizationId } } });
  if (!membership) throw new Error("FORBIDDEN");
  return analysis;
}