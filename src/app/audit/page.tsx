import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/");
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: true } });
  return <main className="mx-auto max-w-7xl px-6 py-10"><h1 className="text-3xl font-bold">Audit & Safety</h1><p className="mt-2 text-slate-600">Protected audit trail for platform administration and clinical workflow events.</p>
  <div className="card mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Time</th><th className="p-3">User</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Details</th></tr></thead><tbody>{logs.map(l => <tr key={l.id} className="border-b"><td className="p-3">{l.createdAt.toLocaleString()}</td><td className="p-3">{l.user?.name ?? "System"}</td><td className="p-3">{l.action}</td><td className="p-3">{l.entity}</td><td className="p-3">{l.details}</td></tr>)}</tbody></table></div></main>;
}