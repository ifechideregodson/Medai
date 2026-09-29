import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAnalysisForUser, requireReviewer } from "@/lib/clinical-review";
import { audit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireReviewer();
    const { id } = await params;
    const analysis = await getAnalysisForUser(id);
    if (!analysis) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    const body = await req.json();
    const decision = String(body.decision || "").toUpperCase();
    const review = String(body.review || "").trim();
    if (!review) return NextResponse.json({ error: "Clinical review text is required" }, { status: 400 });
    if (!['ACCEPTED','REJECTED','ESCALATED'].includes(decision)) return NextResponse.json({ error: "Invalid review decision" }, { status: 400 });
    const updated = await db.analysis.update({ where: { id }, data: { clinicianReview: review, reviewedAt: new Date(), reviewedById: user.id, reviewStatus: "COMPLETED", reviewDecision: decision } });
    await audit("CLINICAL_REVIEW", "ANALYSIS", id, JSON.stringify({ decision }), user.id);
    return NextResponse.json({ analysis: updated });
  } catch (e) {
    const m = e instanceof Error ? e.message : "REVIEW_FAILED";
    const status = m === "UNAUTHENTICATED" ? 401 : m === "FORBIDDEN" || m === "REVIEWER_ROLE_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: m }, { status });
  }
}
