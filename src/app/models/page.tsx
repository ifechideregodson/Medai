import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export default async function Models() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN" && user.role !== "MODEL_ADMIN") redirect("/");
  const rows = await db.modelRegistry.findMany({ orderBy: { updatedAt: "desc" } });
  return <main className="mx-auto max-w-7xl px-6 py-10"><h1 className="text-3xl font-bold">Model Registry</h1><p className="mt-2 text-slate-600">Clinical models are explicitly versioned and must be activated only after validation.</p><div className="card mt-6">{rows.length === 0 ? <p className="p-6 text-sm text-slate-500">No clinical models are registered.</p> : rows.map(m => <div className="border-b p-4" key={m.id}><b>{m.name} {m.version}</b><div>{m.modality} — {m.status}</div><div className="text-sm">{m.intendedUse}</div></div>)}</div></main>;
}