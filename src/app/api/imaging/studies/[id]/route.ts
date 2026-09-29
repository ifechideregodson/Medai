import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganizationMember } from "@/lib/access";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await params;
  const study = await db.imagingStudy.findUnique({ where: { id }, include: { patient: true, series: { include: { assets: true } } } });
  if (!study) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await requireOrganizationMember(study.organizationId);
  return NextResponse.json({ study });
}