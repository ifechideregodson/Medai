import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganizationMember } from "@/lib/access";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const study = await db.imagingStudy.findUnique({ where: { id }, include: { series: { include: { assets: true } } } });
  if (!study) return NextResponse.json({ error: "Study not found" }, { status: 404 });
  await requireOrganizationMember(study.organizationId);
  return NextResponse.json({ studyId: id, series: study.series });
}