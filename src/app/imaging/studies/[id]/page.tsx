import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requireOrganizationMember } from "@/lib/access";
import DicomViewer from "./DicomViewer";

export default async function StudyPage({params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(); if(!user) return <main className="mx-auto max-w-5xl p-8">Sign in required. </main>;
 const {id}=await params; const study=await db.imagingStudy.findUnique({where:{id},include:{patient:true,series:{include:{assets:true}}}});
 if(!study) return <main className="mx-auto max-w-5xl p-8">Study not found. </main>;
 await requireOrganizationMember(study.organizationId);
 return <main className="mx-auto max-w-7xl px-6 py-10 space-y-6">
  <Link href="/imaging" className="text-sm underline">← Imaging</Link>
  <header><h1 className="text-3xl font-bold">{study.description || "DICOM Imaging Study"}</h1><p className="text-slate-600">{study.patient.medicalId} — {study.patient.firstName} {study.patient.lastName}</p></header>
  <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
   <section className="card"><h2 className="font-semibold">Study series</h2><div className="mt-4 space-y-3">{study.series.map(series=><div key={series.id} className="rounded-xl border p-4"><div className="font-medium">Series {series.seriesNumber ?? "—"} {series.description ? `— ${series.description}` : ""}</div><div className="text-sm text-slate-500">{series.modality || "Unknown modality"} · {series.assets.length} asset(s)</div>{series.assets.map(asset=><div key={asset.id} className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3"><span>{asset.name}</span><Link className="btn bg-slate-900 text-white" href={`/api/assets/${asset.id}`}>Open asset</Link></div>)}</div>)}{study.series.length===0&&<p className="text-sm text-slate-500">No series have been attached to this study.</p>}</div></section>
   <aside className="card"><h2 className="font-semibold">DICOM metadata</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">Study UID</dt><dd className="break-all">{study.studyInstanceUid || "—"}</dd></div><div><dt className="text-slate-500">Accession</dt><dd>{study.accessionNumber || "—"}</dd></div><div><dt className="text-slate-500">Modality</dt><dd>{study.modality || "—"}</dd></div><div><dt className="text-slate-500">Study date</dt><dd>{study.studyDate ? study.studyDate.toISOString().slice(0,10) : "—"}</dd></div></dl></aside>
  </div>
  {study.series.flatMap(s=>s.assets).length > 0 && <section className="card"><h2 className="mb-4 font-semibold">Imaging workstation</h2><DicomViewer assetId={study.series.flatMap(s=>s.assets)[0].id} name={study.series.flatMap(s=>s.assets)[0].name}/></section>}
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">DICOM metadata is treated as clinical information. Viewer rendering and diagnostic interpretation remain separate from metadata extraction and require appropriate clinical validation.</div>
  </main>;
}