import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { bodyToBytes, getPrivateObject } from "@/lib/storage";
import { runOpenAIImageAssessment } from "@/lib/openai-model";

const responseSchema = z.object({
  status: z.enum(["COMPLETED", "NEEDS_REVIEW"]),
  model: z.object({ name: z.string().min(1), version: z.string().min(1) }),
  findings: z.array(z.object({
    label: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
    location: z.record(z.string(), z.number()).optional()
  })),
  limitations: z.array(z.string()).default([])
});

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/dicom"
]);

function parseMetadata(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function assertUsableImage(mimeType: string | null) {
  if (!mimeType || !IMAGE_TYPES.has(mimeType.toLowerCase())) {
    throw new Error("UNSUPPORTED_CLINICAL_IMAGE");
  }
}

export async function runModelInference(analysisId: string) {
  const analysis = await db.analysis.findUnique({
    where: { id: analysisId },
    include: { asset: true, model: true }
  });

  if (!analysis?.asset?.storageKey || !analysis.model) {
    throw new Error("INFERENCE_CONFIGURATION_INVALID");
  }

  if (analysis.model.status !== "ACTIVE") {
    throw new Error("MODEL_NOT_ACTIVE");
  }

  if (!analysis.asset.mimeType) {
    throw new Error("CLINICAL_ASSET_MIME_TYPE_MISSING");
  }

  assertUsableImage(analysis.asset.mimeType);

  const existingRun = await db.inferenceRun.findFirst({
    where: { analysisId, status: "RUNNING" },
    orderBy: { startedAt: "desc" }
  });
  if (existingRun) {
    throw new Error("INFERENCE_ALREADY_RUNNING");
  }

  const object = await getPrivateObject(
    analysis.asset.storageKey,
    analysis.asset.metadata
  );
  if (!object.Body) throw new Error("SOURCE_ASSET_NOT_FOUND");

  const bytes = await bodyToBytes(object.Body);
  if (!bytes.length) throw new Error("SOURCE_ASSET_EMPTY");

  const requestHash = crypto.createHash("sha256").update(bytes).digest("hex");
  const startedAt = new Date();

  const run = await db.inferenceRun.create({
    data: {
      analysisId,
      modelId: analysis.model.id,
      status: "RUNNING",
      requestHash,
      startedAt
    }
  });

  await db.analysis.update({
    where: { id: analysisId },
    data: {
      status: "RUNNING",
      limitations: JSON.stringify([])
    }
  });

  try {
    let parsed: z.infer<typeof responseSchema>;
    let raw: string;

    if (analysis.model.provider === "OPENAI") {
      const result = await runOpenAIImageAssessment({
        bytes,
        mimeType: analysis.asset.mimeType,
        fileName: analysis.asset.name,
        configuredModel: analysis.model.name,
        configuredVersion: analysis.model.version,
        modality: analysis.kind
      });

      parsed = result.parsed;
      raw = result.raw;

      if (
        parsed.model.name !== result.actualModel &&
        parsed.model.name !== analysis.model.name
      ) {
        throw new Error("MODEL_IDENTITY_MISMATCH");
      }
    } else {
      if (!analysis.model.endpoint) {
        throw new Error("MODEL_ENDPOINT_NOT_CONFIGURED");
      }

      const form = new FormData();
      const uploadBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;

      form.append(
        "file",
        new Blob([uploadBuffer], {
          type: analysis.asset.mimeType
        }),
        analysis.asset.name
      );
      form.append("model_name", analysis.model.name);
      form.append("model_version", analysis.model.version);
      form.append("request_hash", requestHash);

      const headers: Record<string, string> = {};
      if (process.env.MODEL_GATEWAY_API_KEY) {
        headers.authorization = `Bearer ${process.env.MODEL_GATEWAY_API_KEY}`;
      }

      const response = await fetch(analysis.model.endpoint, {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(
          Number(process.env.MODEL_GATEWAY_TIMEOUT_MS || 60000)
        )
      });

      raw = await response.text();
      if (!response.ok) throw new Error(`MODEL_HTTP_${response.status}`);

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error("MODEL_RESPONSE_NOT_JSON");
      }

      parsed = responseSchema.parse(json);

      if (
        parsed.model.name !== analysis.model.name ||
        parsed.model.version !== analysis.model.version
      ) {
        throw new Error("MODEL_IDENTITY_MISMATCH");
      }
    }

    const limitations = parsed.limitations.length
      ? parsed.limitations
      : ["AI output requires qualified clinician review before clinical use."];

    await db.$transaction([
      db.inferenceRun.update({
        where: { id: run.id },
        data: {
          status: parsed.status,
          rawResponse: raw,
          completedAt: new Date()
        }
      }),
      db.analysis.update({
        where: { id: analysisId },
        data: {
          status:
            parsed.status === "COMPLETED" ? "COMPLETED" : "NEEDS_REVIEW",
          findings: JSON.stringify(parsed.findings),
          limitations: JSON.stringify(limitations),
          modelName: parsed.model.name,
          modelVersion: parsed.model.version
        }
      })
    ]);

    return { ...parsed, limitations };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "MODEL_INFERENCE_FAILED";

    await db.$transaction([
      db.inferenceRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date()
        }
      }),
      db.analysis.update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          findings: JSON.stringify([]),
          limitations: JSON.stringify([
            "Model inference failed. No clinical conclusion was produced.",
            message
          ])
        }
      })
    ]);

    throw error;
  }
}