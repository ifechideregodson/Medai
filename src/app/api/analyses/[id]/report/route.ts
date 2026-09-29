import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAnalysisForUser, requireReviewer } from "@/lib/clinical-review";
import { audit } from "@/lib/audit";

export async function POST(req: Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await requireReviewer(); const {id}=await params; const analysis=await getAnalysisForUser(id);
    if(!analysis||!analysis.patient||!analysis.organizationId)return NextResponse.json({error:"Analysis not found or not organization-scoped"},{status:404});
    if(analysis.reviewStatus!=="COMPLETED"||!analysis.clinicianReview)return NextResponse.json({error:"CLINICIAN_REVIEW_REQUIRED"},{status:409});
    if(analysis.reviewDecision==="ESCALATED")return NextResponse.json({error:"ESCALATED_CASE_CANNOT_BE_SIGNED"},{status:409});
    const body=await req.json(); const title=String(body.title||"Clinical Imaging Report").trim(); const reportBody=String(body.body||"").trim();
    if(!reportBody)return NextResponse.json({error:"Report body is required"},{status:400});
    const report=await db.clinicalReport.upsert({where:{analysisId:id},create:{patientId:analysis.patientId!,organizationId:analysis.organizationId,authorId:user.id,reviewerId:analysis.reviewedById||user.id,analysisId:id,title,body:reportBody,status:"SIGNED",signedAt:new Date(),signedById:user.id,modelNameSnapshot:analysis.modelName,modelVersionSnapshot:analysis.modelVersion,findingsSnapshot:analysis.findings,limitationsSnapshot:analysis.limitations},update:{reviewerId:analysis.reviewedById||user.id,title,body:reportBody,status:"SIGNED",signedAt:new Date(),signedById:user.id,modelNameSnapshot:analysis.modelName,modelVersionSnapshot:analysis.modelVersion,findingsSnapshot:analysis.findings,limitationsSnapshot:analysis.limitations}});
    await audit("REPORT_SIGNED","CLINICAL_REPORT",report.id,JSON.stringify({analysisId:id,model:analysis.modelName,version:analysis.modelVersion}),user.id);
    return NextResponse.json({report});
  }catch(e){const m=e instanceof Error?e.message:"REPORT_FAILED";return NextResponse.json({error:m},{status:m==="UNAUTHENTICATED"?401:m==="FORBIDDEN"||m==="REVIEWER_ROLE_REQUIRED"?403:500});}
}
