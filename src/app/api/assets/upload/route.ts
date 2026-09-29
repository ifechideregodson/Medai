import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { AssetType } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganizationMember, getPatientInOrganization } from "@/lib/access";
import { putPrivateObject } from "@/lib/storage";
import { extractDicomMetadata } from "@/lib/dicom";

const MAX_BYTES = 25 * 1024 * 1024;
const allowed = new Set(["image/jpeg", "image/png", "application/pdf", "application/dicom", "application/octet-stream"]);

function assetType(value: string) {
  if (!Object.values(AssetType).includes(value as AssetType)) return null;
  return value as AssetType;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const form = await req.formData();
    const file = form.get("file");
    const patientId = String(form.get("patientId") || "");
    const organizationId = String(form.get("organizationId") || "");
    const type = assetType(String(form.get("type") || ""));
    if (!(file instanceof File) || !patientId || !organizationId || !type) return NextResponse.json({ error: "file, patientId, organizationId and valid type are required" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "File size must be between 1 byte and 25 MB" }, { status: 413 });
    if (!allowed.has(file.type || "application/octet-stream")) return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
    await requireOrganizationMember(organizationId);
    const patient = await getPatientInOrganization(patientId, organizationId);
    if (!patient) return NextResponse.json({ error: "Patient not found in organization" }, { status: 404 });
    const id = crypto.randomUUID();
    let dicom: Awaited<ReturnType<typeof extractDicomMetadata>> | null = null;
    if (file.type === "application/dicom" || file.name.toLowerCase().endsWith(".dcm")) {
      try { dicom = await extractDicomMetadata(new Uint8Array(await file.arrayBuffer())); } catch { return NextResponse.json({ error: "INVALID_DICOM" }, { status: 422 }); }
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
    const key = `organizations/${organizationId}/patients/${patientId}/assets/${id}-${safeName}`;
    const storage = await putPrivateObject(key, bytes, file.type || "application/octet-stream");
    let studyId: string | undefined; let seriesId: string | undefined;
    if (dicom?.studyInstanceUid) {
      const study = await db.imagingStudy.upsert({ where: { studyInstanceUid: dicom.studyInstanceUid }, update: { description: dicom.studyDescription, modality: dicom.modality, accessionNumber: dicom.accessionNumber }, create: { organizationId, patientId, studyInstanceUid: dicom.studyInstanceUid, description: dicom.studyDescription, modality: dicom.modality, accessionNumber: dicom.accessionNumber } });
      studyId = study.id;
      if (dicom.seriesInstanceUid) { const series = await db.imagingSeries.upsert({ where: { seriesInstanceUid: dicom.seriesInstanceUid }, update: { studyId: study.id, seriesNumber: dicom.seriesNumber, modality: dicom.modality, description: dicom.seriesDescription, bodyPart: dicom.bodyPart }, create: { studyId: study.id, seriesInstanceUid: dicom.seriesInstanceUid, seriesNumber: dicom.seriesNumber, modality: dicom.modality, description: dicom.seriesDescription, bodyPart: dicom.bodyPart } }); seriesId = series.id; }
    }
    const asset = await db.asset.create({ data: { id, organizationId, patientId, studyId, seriesId, name: file.name, type, mimeType: file.type || null, storageKey: key, metadata: JSON.stringify({ size: file.size, uploadedById: user.id, dicom, storage: { key, primary: storage.primary.provider, locations: storage.locations, cloudinary: storage.locations.find((location) => location.provider === "cloudinary")?.cloudinary || null } }) } });
    await db.auditLog.create({ data: { userId: user.id, action: "ASSET_UPLOAD", entity: "Asset", entityId: asset.id, details: JSON.stringify({ organizationId, patientId, type, size: file.size, storagePrimary: storage.primary.provider, storageProviders: storage.locations.map((location) => location.provider) }) } });
    return NextResponse.json({ asset: { id: asset.id, name: asset.name, type: asset.type, mimeType: asset.mimeType, createdAt: asset.createdAt }, storage: { mode: "REDUNDANT_PRIVATE", primary: storage.primary.provider, providers: storage.locations.map((location) => location.provider) } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPLOAD_FAILED";
    const status = message === "FORBIDDEN" ? 403 : message.startsWith("PRIVATE_STORAGE_UNAVAILABLE") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
