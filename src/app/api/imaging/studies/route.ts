import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPatientInOrganization, requireOrganizationMember } from "@/lib/access";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  const orgs = user.role === "SUPER_ADMIN" ? undefined : (await db.membership.findMany({where:{userId:user.id},select:{organizationId:true}})).map(x=>x.organizationId);
  const studies = await db.imagingStudy.findMany({where: orgs ? {organizationId:{in:orgs}} : undefined, orderBy:{createdAt:"desc"}, take:100, include:{patient:true,series:{include:{assets:true}}}});
  return NextResponse.json({studies});
}

export async function POST(req:Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  const body = await req.json();
  const {organizationId,patientId,description,modality,studyInstanceUid,accessionNumber} = body;
  if (!organizationId || !patientId) return NextResponse.json({error:"organizationId and patientId are required"},{status:400});
  await requireOrganizationMember(organizationId);
  if (!(await getPatientInOrganization(patientId,organizationId))) return NextResponse.json({error:"Patient not found"},{status:404});
  const study = await db.imagingStudy.create({data:{organizationId,patientId,description,modality,studyInstanceUid,accessionNumber}});
  return NextResponse.json({study},{status:201});
}