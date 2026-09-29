import { NextResponse } from "next/server";
import { requireReviewer } from "@/lib/clinical-review";
import { buildReportDraft } from "@/lib/clinical-report";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{await requireReviewer();const {id}=await params;const draft=await buildReportDraft(id);if(!draft)return NextResponse.json({error:"Analysis not found"},{status:404});return NextResponse.json({title:draft.title,body:draft.body});}catch(e){const m=e instanceof Error?e.message:"DRAFT_FAILED";return NextResponse.json({error:m},{status:m==="UNAUTHENTICATED"?401:m==="FORBIDDEN"||m==="REVIEWER_ROLE_REQUIRED"?403:500});}}
