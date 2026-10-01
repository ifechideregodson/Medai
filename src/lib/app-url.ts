const PRODUCTION_ORIGIN = "https://medai-clinical-platform.onrender.com";

export function getAppOrigin() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (!configured) return PRODUCTION_ORIGIN;
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return PRODUCTION_ORIGIN;
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") return PRODUCTION_ORIGIN;
    return parsed.origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

export function appUrl(path: string) {
  return new URL(path, getAppOrigin());
}
