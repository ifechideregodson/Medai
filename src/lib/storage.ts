import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || "us-east-1";

function s3Client() {
  if (!bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3_STORAGE_NOT_CONFIGURED");
  }
  return new S3Client({
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
  });
}

function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function configureCloudinary() {
  if (!cloudinaryConfigured()) throw new Error("CLOUDINARY_STORAGE_NOT_CONFIGURED");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  return cloudinary;
}

function cloudinaryResourceType(contentType: string) {
  return contentType.startsWith("image/") ? "image" : "raw";
}

function cloudinaryPublicId(key: string) {
  return `medai/${key.replace(/^\\/+/, "").replace(/\\.[^/.]+$/, "")}`;
}

export type StorageLocation = {
  provider: "s3" | "cloudinary";
  key: string;
  cloudinary?: { publicId: string; resourceType: "image" | "raw"; format?: string; assetId?: string };
};

export async function putToS3(key: string, body: Uint8Array, contentType: string) {
  await s3Client().send(new PutObjectCommand({ Bucket: bucket!, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION || undefined }));
  return { provider: "s3" as const, key };
}

export async function putToCloudinary(key: string, body: Uint8Array, contentType: string) {
  const cld = configureCloudinary();
  const resourceType = cloudinaryResourceType(contentType);
  const publicId = cloudinaryPublicId(key);
  const result = await new Promise<any>((resolve, reject) => {
    const stream = cld.uploader.upload_stream({
      resource_type: resourceType,
      type: "authenticated",
      public_id: publicId,
      overwrite: true,
      use_filename: false,
      unique_filename: false
    }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
    stream.end(Buffer.from(body));
  });
  return { provider: "cloudinary" as const, key, cloudinary: { publicId: result.public_id, resourceType, format: result.format || undefined, assetId: result.asset_id || undefined } };
}

/**
 * High-availability clinical storage:
 * - writes to both providers when both are configured;
 * - if one provider is unavailable, the other can still accept the upload;
 * - the database records both locations in metadata;
 * - reads prefer S3 and automatically fall back to Cloudinary when S3 fails.
 */
export async function putPrivateObject(key: string, body: Uint8Array, contentType: string) {
  const errors: string[] = [];
  let s3: StorageLocation | null = null;
  let cld: StorageLocation | null = null;

  if (bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    try { s3 = await putToS3(key, body, contentType); } catch (error) { errors.push(`s3:${error instanceof Error ? error.message : "failed"}`); }
  }
  if (cloudinaryConfigured()) {
    try { cld = await putToCloudinary(key, body, contentType); } catch (error) { errors.push(`cloudinary:${error instanceof Error ? error.message : "failed"}`); }
  }

  if (!s3 && !cld) {
    throw new Error(`PRIVATE_STORAGE_UNAVAILABLE${errors.length ? `:${errors.join(" | ")}` : ""}`);
  }

  return { primary: s3 ?? cld!, locations: [s3, cld].filter(Boolean) as StorageLocation[], errors };
}

function parseCloudinaryLocation(metadata?: string | null): Extract<StorageLocation, { provider: "cloudinary" }> | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    const c = parsed?.storage?.cloudinary;
    if (!c?.publicId || !c?.resourceType) return null;
    return { provider: "cloudinary", key: parsed.storage.key || "", cloudinary: c };
  } catch { return null; }
}

async function getFromCloudinary(location: Extract<StorageLocation, { provider: "cloudinary" }>) {
  const cld = configureCloudinary();
  const c = location.cloudinary!;
  const format = c.format || "bin";
  const url = cld.utils.private_download_url(c.publicId, format, { resource_type: c.resourceType, type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 });
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`CLOUDINARY_DOWNLOAD_HTTP_${response.status}`);
  return { Body: new Uint8Array(await response.arrayBuffer()), ContentLength: Number(response.headers.get("content-length") || 0) || undefined, ContentType: response.headers.get("content-type") || undefined };
}

export async function getPrivateObject(key: string, metadata?: string | null) {
  const cloudinaryLocation = parseCloudinaryLocation(metadata);
  try {
    return await s3Client().send(new GetObjectCommand({ Bucket: bucket!, Key: key }));
  } catch (s3Error) {
    if (cloudinaryLocation) return getFromCloudinary(cloudinaryLocation);
    throw s3Error;
  }
}

async function bodyToBytes(body: NonNullable<Awaited<ReturnType<typeof getPrivateObject>>["Body"]>) {
  return body instanceof Uint8Array ? body : await body.transformToByteArray();
}

export async function repairPrivateObject(key: string, metadata: string | null | undefined, contentType: string) {
  const parsed = metadata ? (() => { try { return JSON.parse(metadata); } catch { return null; } })() : null;
  const locations: StorageLocation[] = parsed?.storage?.locations || [];
  const providers = new Set(locations.map((l: StorageLocation) => l.provider));
  const source = providers.has("s3") || providers.has("cloudinary") ? await getPrivateObject(key, metadata) : null;
  if (!source?.Body) throw new Error("NO_STORAGE_COPY_AVAILABLE");
  const bytes = await bodyToBytes(source.Body);
  const repaired: StorageLocation[] = [];
  const errors: string[] = [];
  if (!providers.has("s3") && bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    try { repaired.push(await putToS3(key, bytes, contentType)); } catch (e) { errors.push(`s3:${e instanceof Error ? e.message : "failed"}`); }
  }
  if (!providers.has("cloudinary") && cloudinaryConfigured()) {
    try { repaired.push(await putToCloudinary(key, bytes, contentType)); } catch (e) { errors.push(`cloudinary:${e instanceof Error ? e.message : "failed"}`); }
  }
  return { repaired, errors };
}

export async function getStorageHealth() {
  const result = {
    s3: { name: "AWS S3", ok: false, message: "Not configured" },
    cloudinary: { name: "Cloudinary", ok: false, message: "Not configured" },
    overall: "offline" as "healthy" | "degraded" | "offline"
  };
  if (bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    try {
      await s3Client().send(new (await import("@aws-sdk/client-s3")).HeadBucketCommand({ Bucket: bucket }));
      result.s3 = { name: "AWS S3", ok: true, message: `Bucket ${bucket} reachable` };
    } catch (e) {
      result.s3 = { name: "AWS S3", ok: false, message: e instanceof Error ? e.message : "Health check failed" };
    }
  }
  if (cloudinaryConfigured()) {
    try {
      await configureCloudinary().api.ping();
      result.cloudinary = { name: "Cloudinary", ok: true, message: "API reachable" };
    } catch (e) {
      result.cloudinary = { name: "Cloudinary", ok: false, message: e instanceof Error ? e.message : "Health check failed" };
    }
  }
  const online = Number(result.s3.ok) + Number(result.cloudinary.ok);
  result.overall = online === 2 ? "healthy" : online === 1 ? "degraded" : "offline";
  return result;
}