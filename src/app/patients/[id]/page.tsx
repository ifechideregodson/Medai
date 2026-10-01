import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type TimelineItem = { at: Date; kind: string; title: string; detail?: string; href?: string };

export default async function PatientWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const orgIds = user.role === "SUPER_ADMIN"
    ? undefined
    : (await db.membership.findMany({ where: { userId: user.id }, select: { organizationId: true } })).map(x => x.organizationId);

  const patient = await db.patient.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    include: {
      organization: true,
      encounters: { orderBy: { createdAt: "desc" }, take: 25 },
      imagingStudies: { orderBy: { createdAt: "desc" }, include: { series: { include: { assets: true } } }, take: 25 },
      analyses: { orderBy: { createdAt: "desc" }, include: { model: true, asset: true, report: true, inferenceRuns: { orderBy: { createdAt: "desc" }, take: 1 } }, take: 50 },
      reports: { orderBy: { updatedAt: "desc" }, include: { author: true, reviewer: true, signedBy: true }, take: 50 },
      consents: { orderBy: { updatedAt: "desc" }, include: { recordedBy: true }, take: 50 },
      assets: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!patient) notFound();

  const timeline: TimelineItem[] = [];
  for (const e of patient.encounters) timeline.push({ at: e.createdAt, kind: "Encounter", title: e.status === "OPEN" ? "Open clinical encounter" : "Clinical encounter closed", detail: e.symptoms || e.notes || undefined });
  for (const s of patient.imagingStudies) timeline.push({ at: s.createdAt, kind: "Imaging", title: s.description || `${s.modality || "Imaging"} study`, detail: s.accessionNumber || undefined, href: `/imaging/studies/${s.id}` });
  for (const a of patient.analyses) timeline.push({ at: a.createdAt, kind: "AI analysis", title: `${a.kind} analysis · ${a.status}`, detail: a.modelName ? `${a.modelName} ${a.modelVersion}` : undefined, href: `/imaging/${a.id}` });
  for (const r of patient.reports) timeline.push({ at: r.updatedAt, kind: "Report", title: r.title, detail: r.status, href: `/reports/${r.id}` });
  for (const c of patient.consents) timeline.push({ at: c.updatedAt, kind: "Consent", title: c.purpose, detail: c.status });
  for (const a of patient.assets) timeline.push({ at: a.createdAt, kind: "Clinical asset", title: a.name, detail: a.type });
  timeline.sort((a,b)=>b.at.getTime()-a.at.getTime());

  const openEncounters = patient.encounters.filter(x=>x.status==="OPEN").length;
  const completedAnalyses = patient.analyses.filter(x=>x.status==="COMPLETED").length;
  const signedReports = patient.reports.filter(x=>x.status==="SIGNED").length;

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <Link href="/patients" className="text-sm font-semibold text-slate-500 hover:text-red-700">← Patients</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{patient.firstName} {patient.lastName}</h1>
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{patient.medicalId}</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">Patient clinical workspace{patient.organization ? ` · ${patient.organization.name}` : ""}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="text-lg font-bold text-slate-900">{openEncounters}</div><div className="text-slate-500">Open visits</div></div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="text-lg font-bold text-slate-900">{completedAnalyses}</div><div className="text-slate-500">Completed AI</div></div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><div className="text-lg font-bold text-slate-900">{signedReports}</div><div className="text-slate-500">Signed reports</div></div>
      </div>
    </div>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Demographics</p><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-slate-500">Date of birth</dt><dd>{patient.dateOfBirth?.toLocaleDateString() ?? "Not recorded"}</dd></div><div><dt className="text-slate-500">Sex</dt><dd>{patient.sex ?? "Not recorded"}</dd></div><div><dt className="text-slate-500">Phone</dt><dd>{patient.phone ?? "Not recorded"}</dd></div></dl></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Clinical history</p><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{patient.history || "No clinical history recorded."}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Allergies</p><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{patient.allergies || "No allergies recorded."}</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Consents</p><p className="mt-3 text-2xl font-bold text-slate-900">{patient.consents.length}</p><p className="text-xs text-slate-500">recorded consent entries</p></div>
    </section>

    <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Unified clinical timeline</h2><p className="mt-1 text-xs text-slate-500">Recorded events across visits, imaging, AI analyses, reports, assets and consent.</p></div>
        {timeline.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">No clinical events have been recorded for this patient.</div> :
        <div className="divide-y divide-slate-100">{timeline.map((item,i)=><div key={`${item.kind}-${item.at.toISOString()}-${i}`} className="flex gap-4 p-5"><div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-700"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wider text-red-700">{item.kind}</span><time className="text-xs text-slate-400">{item.at.toLocaleString()}</time></div><div className="mt-1 font-semibold text-slate-900">{item.href ? <Link className="hover:text-red-700" href={item.href}>{item.title}</Link> : item.title}</div>{item.detail && <p className="mt-1 text-sm text-slate-600">{item.detail}</p>}</div></div>)}</div>}
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Clinical records</h2></div><div className="divide-y divide-slate-100 text-sm">
          <Link href="/imaging" className="flex justify-between p-4 hover:bg-red-50/40"><span>Imaging studies</span><b>{patient.imagingStudies.length}</b></Link>
          <Link href="/reports" className="flex justify-between p-4 hover:bg-red-50/40"><span>Clinical reports</span><b>{patient.reports.length}</b></Link>
          <div className="flex justify-between p-4"><span>AI analyses</span><b>{patient.analyses.length}</b></div>
          <div className="flex justify-between p-4"><span>Clinical assets</span><b>{patient.assets.length}</b></div>
          <div className="flex justify-between p-4"><span>Encounters</span><b>{patient.encounters.length}</b></div>
        </div></section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Consent register</h2></div>{patient.consents.length===0?<p className="p-5 text-sm text-slate-500">No consent records.</p>:<div className="divide-y divide-slate-100">{patient.consents.slice(0,8).map(c=><div key={c.id} className="p-4"><div className="font-semibold text-slate-900">{c.purpose}</div><div className="mt-1 text-xs text-slate-500">{c.status} · {c.updatedAt.toLocaleString()}</div></div>)}</div>}</section>
      </div>
    </div>
  </main>;
}