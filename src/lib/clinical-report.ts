import { db } from "@/lib/db";
import { getAnalysisForUser } from "@/lib/clinical-review";

function parseJson(value: string | null | undefined) {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

export async function buildReportDraft(id: string) {
  const analysis = await getAnalysisForUser(id);
  if (!analysis) return null;
  const findings = parseJson(analysis.findings) as Array<{label?:string;confidence?:number;location?:Record<string,number>}>;
  const limitations = parseJson(analysis.limitations) as string[];
  const lines = [
    "CLINICAL IMAGING REPORT",
    "",
    `Study/Asset: ${analysis.asset?.name ?? "Not specified"}`,
    `Analysis type: ${analysis.kind}`,
    `Model: ${analysis.modelName} ${analysis.modelVersion}`,
    "",
    "AI-GENERATED FINDINGS",
    findings.length ? findings.map((f,i) => `${i+1}. ${f.label ?? "Unspecified finding"}${typeof f.confidence === "number" ? ` — confidence ${(f.confidence*100).toFixed(1)}%` : ""}`).join("\n") : "No model findings are available.",
    "",
    "LIMITATIONS",
    limitations.length ? limitations.map((x,i)=>`${i+1}. ${x}`).join("\n") : "No limitations supplied by the model.",
    "",
    "CLINICIAN REVIEW",
    analysis.clinicianReview || "Pending clinician review.",
  ];
  return { title: "Clinical Imaging Report", body: lines.join("\n"), analysis };
}