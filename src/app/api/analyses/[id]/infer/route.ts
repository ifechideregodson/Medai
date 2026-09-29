import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganizationMember } from "@/lib/access";
import { runModelInference } from "@/lib/model-gateway";
import { audit } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const { id } = await params;
    const analysis = await db.analysis.findUnique({ where: { id } });
    if (!analysis || !analysis.organizationId) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    await requireOrganizationMember(analysis.organizationId);
    if (!analysis.modelId) return NextResponse.json({ error: "NO_MODEL_ASSIGNED" }, { status: 409 });
    const result = await runModelInference(id);
    await audit("MODEL_INFERENCE", "ANALYSIS", id, JSON.stringify({ model: result.model }), user.id);
    return NextResponse.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "INFERENCE_FAILED";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : ["NO_MODEL_ASSIGNED","INFERENCE_CONFIGURATION_INVALID","MODEL_NOT_ACTIVE","MODEL_IDENTITY_MISMATCH"].includes(message) ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
