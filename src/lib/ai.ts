import { AnalysisStatus } from "@prisma/client";
import { getActiveModel } from "@/lib/model-registry";

type ClinicalAIResult = {
  status: AnalysisStatus;
  modelName: string;
  modelVersion: string;
  findings: unknown[];
  limitations: string[];
};

export async function runClinicalAI(
  input: { kind: "XRAY" | "SKIN" | "CLINICAL" }
): Promise<ClinicalAIResult> {
  const model = await getActiveModel(input.kind);

  if (!model || !model.endpoint) {
    return {
      status: AnalysisStatus.NEEDS_REVIEW,
      modelName: model?.name ?? "NO_ACTIVE_VALIDATED_MODEL",
      modelVersion: model?.version ?? "0",
      findings: [],
      limitations: [
        "No active validated model is configured.",
        "No diagnostic conclusion has been generated."
      ]
    };
  }

  throw new Error("MODEL_GATEWAY_NOT_IMPLEMENTED");
}