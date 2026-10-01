import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import PrintButton from "../PrintButton";

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const orgIds = user.role === "SUPER_ADMIN" ? undefined : (await db.membership.findMany({ where: { userId: user.id }, select: { organizationId: true } })).map(x => x.organizationId);
  const report = await db.clinicalReport.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    include: { patient: true, author: true, reviewer: true, signedBy: true, analysis: { include: { inferenceRuns: { orderBy: { createdAt: "desc" }, take: 10 } } } },
  });
  if (!report) notFound();

  const findings = (() => { try { return report.findingsSnapshot ? JSON.parse(report.findingsSnapshot) : []; } catch { return []; } })();
  const limitations = (() => { try { const v = report.limitationsSnapshot ? JSON.parse(report.limitationsSnapshot) : []; return Array.isArray(v) ? v : [String(v)]; } catch { return report.limitationsSnapshot ? [report.limitationsSnapshot] : []; } })();

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 print:max-w-none print:px-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href="/reports" className="text-sm font-semibold text-slate-600 hover:text-red-700">← Reports workspace</Link>
      <PrintButton />
    </div>
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <header className="border-b-4 border-red-700 px-6 py-6 sm:px-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row">
          <div><p className="text-xs font-bold uppercase tracking-widest text-red-700">MedAI Clinical Platform</p><h1 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">{report.title}</h1><p className="mt-2 text-sm text-slate-500">Clinical report · {report.status}</p></div>
          {report.status === "SIGNED" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">SIGNED<br/><span className="text-xs font-medium">{report.signedAt?.toLocaleString()}</span></div>}
        </div>
      </header>
      <div className="grid gap-6 px-6 py-7 sm:px-10 lg:grid-cols-[1fr_260px]">
        <div>
          <section><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Report</h2><div className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-800">{report.body}</div></section>
          {findings.length > 0 && <section className="mt-7"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Recorded AI findings</h2><div className="mt-3 space-y-2">{findings.map((f: any, i: number) => <div key={i} className="rounded-xl border border-slate-200 p-4 text-sm"><div className="font-semibold text-slate-900">{f.label ?? "Finding"}</div>{typeof f.confidence === "number" && <div className="mt-1 text-slate-600">Confidence: {(f.confidence * 100).toFixed(1)}%</div>}{f.location && <div className="mt-1 text-slate-500">Location: {f.location}</div>}</div>)}</div></section>}
          {limitations.length > 0 && <section className="mt-7"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Limitations / safety notes</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">{limitations.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></section>}
        </div>
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 p-4"><h2 className="font-bold text-slate-900">Patient</h2><p className="mt-2 text-sm text-slate-700">{report.patient.firstName} {report.patient.lastName}</p><p className="text-xs text-slate-500">{report.patient.medicalId}</p></section>
          <section className="rounded-xl border border-slate-200 p-4 text-sm"><h2 className="font-bold text-slate-900">Provenance</h2><dl className="mt-3 space-y-2"><div><dt className="text-xs text-slate-500">Model</dt><dd>{report.modelNameSnapshot ?? "Not recorded"}</dd></div><div><dt className="text-xs text-slate-500">Version</dt><dd>{report.modelVersionSnapshot ?? "Not recorded"}</dd></div><div><dt className="text-xs text-slate-500">Author</dt><dd>{report.author.name}</dd></div><div><dt className="text-xs text-slate-500">Reviewer</dt><dd>{report.reviewer?.name ?? "Not recorded"}</dd></div></dl></section>
          {report.analysis && <section className="rounded-xl border border-slate-200 p-4 text-sm"><h2 className="font-bold text-slate-900">Inference history</h2><p className="mt-2 text-slate-600">{report.analysis.inferenceRuns.length} recorded inference run{report.analysis.inferenceRuns.length === 1 ? "" : "s"}.</p><Link className="mt-3 inline-block font-semibold text-red-700" href={`/imaging/${report.analysis.id}`}>Open source case →</Link></section>}
        </aside>
      </div>
      <footer className="border-t border-slate-100 px-6 py-5 text-xs text-slate-500 sm:px-10">This document reflects the recorded clinical review and report state in MedAI. AI output is decision support and must not be treated as a standalone diagnosis.</footer>
    </article>
  </main>;
}
