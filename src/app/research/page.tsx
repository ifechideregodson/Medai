import { db } from "@/lib/db";
export default async function ResearchPage() {
  const projects = await db.researchProject.findMany({ orderBy: { updatedAt: "desc" } });
  return <main className="mx-auto max-w-7xl px-6 py-10"><h1 className="text-3xl font-bold">AI Research Lab</h1><p className="mt-2 text-slate-600">Evidence organization, document analysis and reproducible dataset workflows.</p>
    <div className="mt-6 grid gap-5 md:grid-cols-3">
      <div className="card"><b>Literature</b><p className="mt-2 text-sm text-slate-600">Store papers, abstracts, citations and evidence notes.</p></div>
      <div className="card"><b>Datasets</b><p className="mt-2 text-sm text-slate-600">Prepare de-identified datasets for controlled statistical analysis.</p></div>
      <div className="card"><b>Analysis engine</b><p className="mt-2 text-sm text-slate-600">Run reproducible statistics and have AI explain the computed output.</p></div>
    </div>
    <div className="card mt-6"><h2 className="font-bold">Projects</h2>{projects.map(p => <div key={p.id} className="mt-3 rounded-xl bg-slate-50 p-4"><b>{p.title}</b><p className="text-sm text-slate-600">{p.description}</p></div>)}</div>
  </main>;
}