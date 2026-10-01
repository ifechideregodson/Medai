import Link from "next/link";
import type { Route } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const statusStyles: Record<string, string> = {
  QUEUED: "bg-slate-100 text-slate-700",
  RUNNING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  NEEDS_REVIEW: "bg-red-100 text-red-800",
  FAILED: "bg-red-100 text-red-800",
};

export default async function Home() {
  const user = await getCurrentUser();

  const [patients, analyses, reports, research, recentAnalyses, pendingReviews] = await Promise.all([
    db.patient.count(),
    db.analysis.count(),
    db.clinicalReport.count(),
    db.researchProject.count(),
    db.analysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { patient: true, asset: true },
    }),
    db.analysis.count({ where: { reviewStatus: "PENDING" } }),
  ]);

  const cards = [
    { label: "Patients", value: patients, href: "/patients", detail: "Patient records" },
    { label: "AI cases", value: analyses, href: "/imaging", detail: "Recorded analyses" },
    { label: "Reports", value: reports, href: "/reports", detail: "Clinical reports" },
    { label: "Research", value: research, href: "/research", detail: "Research projects" },
  ] as const;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">
              Clinical intelligence platform
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Clinical Workspace
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Welcome, {user?.name}. Manage authenticated clinical records, imaging
              analyses, clinician review, reports, and research from one workspace.
            </p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm">
            <p className="font-semibold text-red-800">Review queue</p>
            <p className="mt-1 text-2xl font-bold text-red-900">{pendingReviews}</p>
            <p className="text-xs text-red-700">cases awaiting review</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            href={card.href as Route}
            key={card.label}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{card.label}</span>
              <span className="text-red-700 transition group-hover:translate-x-0.5">→</span>
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-950">{card.value}</div>
            <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-950">Recent clinical activity</h2>
              <p className="mt-1 text-xs text-slate-500">Live records from the database</p>
            </div>
            <Link href="/imaging" className="text-sm font-semibold text-red-700 hover:text-red-800">
              View imaging
            </Link>
          </div>

          {recentAnalyses.length ? (
            <div className="divide-y divide-slate-100">
              {recentAnalyses.map((analysis) => (
                <Link
                  key={analysis.id}
                  href={analysis.kind === "XRAY" ? `/imaging/${analysis.id}` : "/skin"}
                  className="block px-5 py-4 transition hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {analysis.asset?.name ?? `${analysis.kind} analysis`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {analysis.patient
                          ? `${analysis.patient.firstName} ${analysis.patient.lastName}`
                          : "No patient assigned"}{" "}
                        · {analysis.kind}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[analysis.status] ?? "bg-slate-100 text-slate-700"}`}
                    >
                      {analysis.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="font-medium text-slate-700">No clinical activity yet</p>
              <p className="mt-1 text-sm text-slate-500">
                New records will appear here after authenticated clinical activity is recorded.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">Clinical workflow</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {[
                ["01", "Record patient and study"],
                ["02", "Store the clinical asset securely"],
                ["03", "Run a configured model"],
                ["04", "Clinician reviews the output"],
                ["05", "Finalize and sign the report"],
              ].map(([number, label]) => (
                <li key={number} className="flex gap-3">
                  <span className="font-mono text-xs font-bold text-red-700">{number}</span>
                  <span className="text-slate-600">{label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-semibold text-red-900">Clinical safety</h2>
            <p className="mt-2 text-sm leading-6 text-red-800">
              MedAI does not invent diagnostic findings or seeded patient records.
              Model output remains decision-support information and requires qualified
              clinician review and sign-off.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
