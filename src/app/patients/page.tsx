import { db } from "@/lib/db";
import Link from "next/link";

export default async function PatientsPage() {
  const patients = await db.patient.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return <main className="mx-auto max-w-7xl px-6 py-10">
    <div className="mb-6 flex items-center justify-between"><div><h1 className="text-3xl font-bold">Patients</h1><p className="text-slate-600">Clinical records workspace.</p></div><Link className="btn bg-slate-900 text-white" href="/patients/new">New patient</Link></div>
    <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Medical ID</th><th className="p-3">Patient</th><th className="p-3">Sex</th><th className="p-3">Created</th></tr></thead><tbody>
      {patients.map(p => <tr key={p.id} className="border-b last:border-0"><td className="p-3 font-mono">{p.medicalId}</td><td className="p-3">{p.firstName} {p.lastName}</td><td className="p-3">{p.sex ?? "—"}</td><td className="p-3">{p.createdAt.toLocaleDateString()}</td></tr>)}
    </tbody></table></div>
  </main>;
}