import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export default async function SkinPage() {
  const user = await getCurrentUser();
  const organizationIds = user && user.role !== "SUPER_ADMIN"
    ? (await db.membership.findMany({ where: { userId: user.id, organization: { active: true } }, select: { organizationId: true } })).map(x => x.organizationId)
    : undefined;
  const analyses = user ? await db.analysis.findMany({ where: { kind: "SKIN", ...(organizationIds ? { organizationId: { in: organizationIds } } : {}) }, orderBy: { createdAt: "desc" }, take: 30, include: { patient: true } }) : null;
  return <main className="mx-auto max-w-7xl px-6 py-10"><h1 className="text-3xl font-bold">Skin AI</h1><p className="mt-2 text-slate-600">Skin-image case preparation and specialist review.</p>
    <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">This build does not diagnose skin disease. A validated dermatology model and clinical validation are required before clinical use.</div>
    <Link href="/skin/new" className="btn mt-5 bg-slate-900 text-white">Create skin case</Link>
    <div className="card mt-6"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Patient</th><th className="p-3">Model</th><th className="p-3">Status</th></tr></thead><tbody>{analyses.map(a => <tr key={a.id} className="border-b"><td className="p-3">{a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Unassigned"}</td><td className="p-3">{a.modelName}</td><td className="p-3">{a.status}</td></tr>)}</tbody></table></div>
  </main>;
}