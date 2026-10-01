import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";

export default async function NewSkinCase() {
  const user = await getCurrentUser();
  const memberships = user
    ? await db.membership.findMany({
        where: { userId: user.id, organization: { active: true } },
        include: { organization: true },
      })
    : [];

  const patients = user && memberships.length
    ? await db.patient.findMany({
        where: { organizationId: { in: memberships.map((m) => m.organizationId) } },
        orderBy: { lastName: "asc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/skin" className="text-sm text-slate-500">← Skin AI</Link>
      <h1 className="mt-2 text-3xl font-bold">Upload skin image</h1>
      <p className="mt-2 text-slate-600">
        Upload a real clinical skin image into private storage. Uploading does not create a diagnostic conclusion.
      </p>
      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        Skin-image analysis requires an active, appropriately validated dermatology model. This workflow does not fabricate findings when a model is unavailable.
      </div>
      <form action="/api/assets/upload" method="post" encType="multipart/form-data" className="card mt-6 space-y-4">
        <select name="organizationId" required className="w-full rounded-lg border p-3">
          <option value="">Select organization</option>
          {memberships.map((m) => (
            <option key={m.organizationId} value={m.organizationId}>{m.organization.name}</option>
          ))}
        </select>
        <select name="patientId" required className="w-full rounded-lg border p-3">
          <option value="">Select patient</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.medicalId} — {p.firstName} {p.lastName}</option>
          ))}
        </select>
        <input type="hidden" name="type" value="SKIN_IMAGE" />
        <input type="file" name="file" accept="image/jpeg,image/png" required className="w-full rounded-lg border p-3" />
        <button className="btn bg-slate-900 text-white">Upload securely</button>
      </form>
    </main>
  );
}
