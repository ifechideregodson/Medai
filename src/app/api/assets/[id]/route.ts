import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganizationMember } from "@/lib/access";
import { getPrivateObject } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const { id } = await params;
    const asset = await db.asset.findUnique({ where: { id }, include: { patient: true } });
    if (!asset || !asset.storageKey || !asset.organizationId) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    await requireOrganizationMember(asset.organizationId);
    const object = await getPrivateObject(asset.storageKey, asset.metadata);
    if (!object.Body) return NextResponse.json({ error: "Object not found" }, { status: 404 });
    const headers = new Headers();
    headers.set("Content-Type", asset.mimeType || object.ContentType || "application/octet-stream");
    headers.set("Cache-Control", "private, no-store");
    if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));
    const bytes = object.Body instanceof Uint8Array
      ? object.Body
      : await object.Body.transformToByteArray();
    return new NextResponse(bytes, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ASSET_READ_FAILED";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 500 });
  }
}
