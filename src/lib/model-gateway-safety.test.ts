import assert from "node:assert/strict";
import test from "node:test";
import { enforceClinicianReview } from "./model-gateway-safety";

test("external COMPLETED predictions are downgraded to NEEDS_REVIEW", () => {
  const result = enforceClinicianReview({
    status: "COMPLETED" as const,
    model: { name: "xray-v1", version: "sha256:abc" },
    findings: [{ label: "opacity", confidence: 0.91 }],
    limitations: []
  });

  assert.equal(result.status, "NEEDS_REVIEW");
  assert.deepEqual(result.model, { name: "xray-v1", version: "sha256:abc" });
  assert.deepEqual(result.findings, [{ label: "opacity", confidence: 0.91 }]);
});

test("external NEEDS_REVIEW predictions remain NEEDS_REVIEW", () => {
  const result = enforceClinicianReview({
    status: "NEEDS_REVIEW" as const,
    model: { name: "skin-v1", version: "sha256:def" }
  });

  assert.equal(result.status, "NEEDS_REVIEW");
});
