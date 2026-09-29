import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function requireOrganizationMember(organizationId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role === "SUPER_ADMIN") return user;
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } }
  });
  if (!membership) throw new Error("FORBIDDEN");
  return user;
}

export async function getPatientInOrganization(patientId: string, organizationId: string) {
  return db.patient.findFirst({ where: { id: patientId, organizationId } });
}