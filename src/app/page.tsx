import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const user = await getCurrentUser();
  const [patients, analyses, research] = await Promise.all([
    db.patient.count(),
    db.analysis.count(),
    db.researchProject.count()
  ]);
  return <main className="mx-auto max-w-7xl px-6 py-10">
    <div className="mb-8"><p className="text-sm font-semibold text-blue-700">CLINICAL INTELLIGENCE PLATFORM</p>
      <h1 className="mt-2 text-4xl font-bold">MedAI Clinical Workspace</h1>
      <p className="mt-3 text-slate-600">Welcome, {user?.name}. This environment uses real database records and authenticated access. It contains no seeded clinical data.</p>
    </div>
    <div className="grid gap-5 md:grid-cols-3">
      {[
        ["Patients", patients, "/patients"],
        ["AI Cases", analyses, "/imaging"],
        ["Research Projects", research, "/research"]
      ].map(([name, count, href]) => <Link href={href as string} key={name} className="card"><div className="text-sm text-slate-500">{name}</div><div className="mt-2 text-3xl font-bold">{count}</div></Link>)}
    </div>
    <div className="card mt-6 border-amber-200 bg-amber-50"><b>Clinical safety:</b> the platform does not fabricate diagnostic results. A validated model must be connected and clinically validated before diagnostic use.</div>
  </main>;
}