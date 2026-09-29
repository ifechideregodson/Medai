import Link from "next/link";
import { getAnalysisForUser } from "@/lib/clinical-review";
import { getCurrentUser } from "@/lib/auth";
import InferenceButton from "./InferenceButton";
import ClinicalAIResults from "./ClinicalAIResults";

export default async function ImagingCase({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const analysis = user ? await getAnalysisForUser(id) : null;
  if (!analysis) return <main className="mx-auto max-w-4xl px-6 py-10"><h1 className="text-2xl font-bold">Imaging case not found</h1></main>;
  const canReview = ["SUPER_ADMIN","HOSPITAL_ADMIN","DOCTOR","RADIOLOGIST","DERMATOLOGIST"].includes(user?.role ?? "");
  return <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
    <div className="flex items-start justify-between gap-4"><div><Link href="/imaging" className="text-sm text-slate-500">← Imaging queue</Link><h1 className="mt-2 text-3xl font-bold">{analysis.asset?.name ?? "Imaging case"}</h1><p className="text-slate-600">{analysis.patient ? `${analysis.patient.medicalId} — ${analysis.patient.firstName} ${analysis.patient.lastName}` : "No patient"}</p></div><span className="rounded-full border px-3 py-1 text-sm">{analysis.reviewStatus}</span></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card"><h2 className="text-lg font-semibold">Clinical image</h2>{analysis.asset ? <div className="mt-4"><div className="rounded-xl border bg-slate-950 p-2"><img src={`/api/assets/${analysis.asset.id}`} alt="Stored clinical image" className="mx-auto max-h-[520px] w-auto object-contain" /></div><p className="mt-2 text-xs text-slate-500">Private authenticated asset: {analysis.asset.mimeType ?? "unknown media type"}</p></div> : <p className="mt-4 text-sm text-slate-500">No stored asset is attached to this case.</p>}</section>
      <section className="space-y-6"><div className="card"><h2 className="text-lg font-semibold">Analysis record</h2><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><dt className="text-slate-500">Status</dt><dd>{analysis.status}</dd><dt className="text-slate-500">Model</dt><dd>{analysis.modelName} {analysis.modelVersion}</dd><dt className="text-slate-500">Review</dt><dd>{analysis.reviewDecision ?? "Pending"}</dd></dl><div className="mt-5"><InferenceButton id={analysis.id} disabled={!analysis.modelId || analysis.status === "RUNNING"} /></div><div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">AI findings are displayed only when returned by a configured validated model. This case does not invent a diagnostic conclusion.</div></div>
      <ClinicalAIResults analysis={analysis} />
      {canReview && <ReviewForm id={analysis.id} existing={analysis.clinicianReview ?? ""} decision={analysis.reviewDecision ?? ""} report={analysis.report?.body ?? ""} />}</section>
    </div>
  </main>;
}
import ReviewForm from "./ReviewForm";
