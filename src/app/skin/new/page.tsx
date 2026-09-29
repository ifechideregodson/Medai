import { db } from "@/lib/db";
import { runClinicalAI } from "@/lib/ai";
import { redirect } from "next/navigation";

export default async function NewSkinCase() {
  const patients = await db.patient.findMany({ orderBy: { lastName: "asc" } });
  async function createCase(formData: FormData) {
    "use server";
    const patientId = String(formData.get("patientId") || "");
    const name = String(formData.get("name") || "Skin image");
    const patient = patientId ? await db.patient.findUnique({ where: { id: patientId } }) : null;
    const asset = await db.asset.create({ data: { patientId: patient?.id, name, type: "SKIN_IMAGE" } });
    const ai = await runClinicalAI({ kind: "SKIN" });
    await db.analysis.create({ data: { patientId: patient?.id, assetId: asset.id, kind: "SKIN", modelName: ai.modelName, modelVersion: ai.modelVersion, status: ai.status, findings: JSON.stringify(ai.findings), limitations: JSON.stringify(ai.limitations) } });
    redirect("/skin");
  }
  return <main className="mx-auto max-w-2xl px-6 py-10"><h1 className="text-3xl font-bold">New skin case</h1><form action={createCase} className="card mt-6 space-y-4">
    <select name="patientId" className="w-full rounded-lg border p-3"><option value="">No patient selected</option>{patients.map(p => <option key={p.id} value={p.id}>{p.medicalId} — {p.firstName} {p.lastName}</option>)}</select>
    <input name="name" className="w-full rounded-lg border p-3" placeholder="Image/case name" />
    <button className="btn bg-slate-900 text-white">Queue for specialist review</button>
  </form></main>;
}