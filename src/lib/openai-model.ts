import { z } from "zod";

const outputSchema = z.object({
  status: z.enum(["COMPLETED", "NEEDS_REVIEW"]),
  model: z.object({ name: z.string().min(1), version: z.string().min(1) }),
  findings: z.array(z.object({
    label: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
    location: z.record(z.string(), z.number()).optional()
  })),
  limitations: z.array(z.string()).default([])
});

export async function runOpenAIImageAssessment(args: {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  configuredModel: string;
  configuredVersion: string;
  modality: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  const model = process.env.OPENAI_MODEL || args.configuredModel;
  const version = process.env.OPENAI_MODEL_VERSION || args.configuredVersion || model;
  const dataUrl = `data:${args.mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  const prompt = `You are an AI clinical decision-support component inside MedAI. Analyze the supplied ${args.modality} image only as an AI support assessment. Do not claim a definitive diagnosis. Return JSON only with this shape: {"status":"COMPLETED"|"NEEDS_REVIEW","model":{"name":"${model}","version":"${version}"},"findings":[{"label":"...","confidence":0.0,"location":{"x":0,"y":0}}],"limitations":["..."]}. Include uncertainty and limitations. Every result must remain subject to qualified clinician review and sign-off. If the image is unsuitable, say so in limitations and use NEEDS_REVIEW.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: dataUrl }
      ] }],
      text: { format: { type: "json_object" } }
    }),
    signal: AbortSignal.timeout(Number(process.env.MODEL_GATEWAY_TIMEOUT_MS || 60000))
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
  const payload = JSON.parse(raw);
  const text = typeof payload.output_text === "string" ? payload.output_text : extractOutputText(payload);
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
  const parsed = outputSchema.parse(JSON.parse(text));
  return { parsed, raw, actualModel: payload.model || model };
}

function extractOutputText(payload: any): string | null {
  const chunks: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("
") || null;
}