import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const statusStyles: Record<string,string> = {
  SIGNED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();

  const organizationIds = user.role === "SUPER_ADMIN"
    ? undefined
    : (await db.membership.findMany({ where: { userId: user.id }, select: { organizationId: true } })).map(x => x.organizationId);

  const reports = await db.clinicalReport.findMany({
    where: {
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
      ...(status ? { status } : {}),
      ...(q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { patient: { firstName: { contains: q, mode: "insensitive" } } },
          { patient: { lastName: { contains: q, mode: "insensitive" } } },
          { patient: { medicalId: { contains: q, mode: "insensitive" } } },
        ],
      } : {}),
    },
    include: { patient: true, author: true, reviewer: true, signedBy: true, analysis: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const signed = reports.filter(r => r.status === "SIGNED").length;
  const drafts = reports.filter(r => r.status !== "SIGNED").length;

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-red-700">Clinical documentation</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Reports workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Review signed and draft clinical reports linked to real patient cases, clinician review and model provenance.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3"><div className="text-xl font-bold text-emerald-700">{signed}</div><div className="text-emerald-700">Signed</div></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3"><div className="text-xl font-bold text-amber-700">{drafts}</div><div className="text-amber-700">Drafts</div></div>
      </div>
    </div>

    <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px_auto]" method="get">
      <input name="q" defaultValue={q} placeholder="Search patient, medical ID or report title…" className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
      <select name="status" defaultValue={status} className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100">
        <option value="">All statuses</option><option value="SIGNED">Signed</option><option value="DRAFT">Draft</option>
      </select>
      <button className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800">Search reports</button>
    </form>

    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Clinical report register</h2><p className="mt-1 text-xs text-slate-500">{reports.length} record{reports.length === 1 ? "" : "s"} shown</p></div>
      {reports.length === 0 ? <div className="px-5 py-14 text-center"><div className="mx-auto max-w-md"><h3 className="font-semibold text-slate-900">No clinical reports found</h3><p className="mt-2 text-sm text-slate-500">Reports will appear here after a real clinical analysis has completed review and a report has been created.</p></div></div> :
        <div className="divide-y divide-slate-100">
          {reports.map(r => <Link href={`/reports/${r.id}`} key={r.id} className="block p-5 transition hover:bg-red-50/40">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-slate-900">{r.title}</h3><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyles[r.status] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>{r.status}</span></div>
                <p className="mt-1 text-sm text-slate-600">{r.patient.firstName} {r.patient.lastName} · {r.patient.medicalId}</p>
                <p className="mt-2 text-xs text-slate-500">Updated {r.updatedAt.toLocaleString()} · Author {r.author.name}{r.signedBy ? ` · Signed by ${r.signedBy.name}` : ""}</p>
              </div>
              <div className="shrink-0 text-sm font-semibold text-red-700">Open report →</div>
            </div>
          </Link>)}
        </div>}
    </section>
  </main>;
}
