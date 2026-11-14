export type AnalyzerStatus = "COMPLETED" | "NEEDS_REVIEW";

export function enforceClinicianReview<T extends { status: AnalyzerStatus }>(
  response: T
): T {
  return { ...response, status: "NEEDS_REVIEW" };
}
