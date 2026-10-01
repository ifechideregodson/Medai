import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { createUser, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getUserOrganizations, requireOrganizationAdmin } from "@/lib/access";

async function getOrganizationId(userId: string, requested?: string) {
  const memberships = await getUserOrganizations(userId);
  if (!memberships.length) return null;
  if (requested && memberships.some(m => m.organizationId === requested)) return requested;
  return memberships[0].organizationId;
}

async function createStaff(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  const organizationId = String(formData.get("organizationId") || "");
  await requireOrganizationAdmin(organizationId);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "DOCTOR") as Role;
  const allowed: Role[] = ["DOCTOR", "RADIOLOGIST", "DERMATOLOGIST", "RESEARCHER", "NURSE", "LAB_SCIENTIST", "PATIENT"];
  if (!name || !email || password.length < 12 || !allowed.includes(role)) {
    throw new Error("Name, email, a 12+ character password, and a permitted organization role are required.");
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists.");
  const user = await createUser(email, password, name, role);
  await db.membership.create({ data: { userId: user.id, organizationId } });
  await audit("CREATE", "OrganizationUser", user.id, JSON.stringify({ organizationId, role }), admin.id);
  revalidatePath("/organization");
}

async function toggleStaff(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  const organizationId = String(formData.get("organizationId") || "");
  await requireOrganizationAdmin(organizationId);
  const userId = String(formData.get("userId") || "");
  if (userId === admin.id) return;
  const membership = await db.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
  if (!membership) throw new Error("User is not a member of this organization.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const updated = await db.user.update({ where: { id: userId }, data: { active: !user.active } });
  await audit("UPDATE", "OrganizationUser", userId, JSON.stringify({ organizationId, active: updated.active }), admin.id);
  revalidatePath("/organization");
}

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN" && user.role !== "HOSPITAL_ADMIN") redirect("/");
  const params = await searchParams;
  const organizationId = await getOrganizationId(user.id, params.org);
  if (!organizationId) return <main className="mx-auto max-w-3xl px-6 py-16"><div className="card"><h1 className="text-2xl font-bold">No organization assigned</h1><p className="mt-2 text-slate-600">Your account is active, but it has not been assigned to an active organization yet. A platform administrator must assign your organization membership.</p></div></main>;

  const membership = await db.membership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId } } });
  if (user.role !== "SUPER_ADMIN" && (!membership || !await db.organization.findFirst({ where: { id: organizationId, active: true } }))) redirect("/");

  const [org, staff, patients, analyses, reports, studies, pendingReviews, recentAudit] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId } }),
    db.membership.findMany({ where: { organizationId }, include: { user: true }, orderBy: { createdAt: "desc" } }),
    db.patient.count({ where: { organizationId } }),
    db.analysis.count({ where: { organizationId } }),
    db.clinicalReport.count({ where: { organizationId } }),
    db.imagingStudy.count({ where: { organizationId } }),
    db.analysis.count({ where: { organizationId, reviewStatus: "PENDING" } }),
    db.auditLog.findMany({ where: { entity: { in: ["OrganizationUser", "Organization"] } }, orderBy: { createdAt: "desc" }, take: 10, include: { user: true } })
  ]);

  if (!org) redirect("/");
  const roles = ["DOCTOR", "RADIOLOGIST", "DERMATOLOGIST", "RESEARCHER", "NURSE", "LAB_SCIENTIST", "PATIENT"];

  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
    <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">Organization portal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{org.name}</h1>
          <p className="mt-2 text-sm text-slate-600">{org.type.replaceAll("_", " ")} · Organization-scoped clinical workspace</p>
        </div>
        {user.role === "HOSPITAL_ADMIN" && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm"><p className="font-semibold text-red-900">Signed in as organization administrator</p><p className="mt-1 text-xs text-red-700">Your access is limited to assigned organization data.</p></div>}
      </div>
      {user.role === "HOSPITAL_ADMIN" && (await getUserOrganizations(user.id)).length > 1 && <div className="mt-5 flex flex-wrap gap-2">{(await getUserOrganizations(user.id)).map(m => <Link key={m.organizationId} href={`/organization?org=${m.organizationId}`} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${m.organizationId === organizationId ? "border-red-700 bg-red-700 text-white" : "border-slate-200 text-slate-700 hover:border-red-200"}`}>{m.organization.name}</Link>)}</div>}
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {[["Patients", patients, "/patients"], ["Imaging studies", studies, "/imaging"], ["AI analyses", analyses, "/imaging"], ["Reports", reports, "/reports"], ["Pending review", pendingReviews, "/imaging"]].map(([label, value, href]) => <Link key={String(label)} href={String(href)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-red-200 hover:shadow-md"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-red-700">Open workspace →</p></Link>)}
    </section>

    {user.role === "HOSPITAL_ADMIN" && <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <div className="card">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Organization staff</h2><p className="mt-1 text-sm text-slate-500">Create and manage users belonging to this organization.</p></div><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{staff.length} members</span></div>
        <form action={createStaff} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input name="name" required placeholder="Full name" className="rounded-lg border p-3" />
          <input name="email" type="email" required placeholder="Email address" className="rounded-lg border p-3" />
          <input name="password" type="password" minLength={12} required placeholder="Temporary password (12+ characters)" className="rounded-lg border p-3 sm:col-span-2" />
          <select name="role" className="rounded-lg border p-3"><option value="DOCTOR">Doctor</option><option value="RADIOLOGIST">Radiologist</option><option value="DERMATOLOGIST">Dermatologist</option><option value="NURSE">Nurse</option><option value="LAB_SCIENTIST">Lab scientist</option><option value="RESEARCHER">Researcher</option><option value="PATIENT">Patient</option></select>
          <button className="btn bg-red-700 text-white hover:bg-red-800">Create organization user</button>
        </form>
        <div className="mt-5 divide-y divide-slate-100">{staff.map(m => <div key={m.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{m.user.name}</p><p className="text-xs text-slate-500">{m.user.email} · {m.user.role.replaceAll("_", " ")} · {m.user.active ? "Active" : "Disabled"}</p></div><form action={toggleStaff}><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="userId" value={m.userId}/><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">{m.user.active ? "Disable access" : "Enable access"}</button></form></div>)}</div>
      </div>

      <div className="space-y-6">
        <div className="card"><h2 className="text-xl font-bold">Organization access</h2><div className="mt-4 space-y-3 text-sm text-slate-600"><p>Staff sign in with their own email and password at the standard MedAI sign-in page.</p><p>Organization membership controls which organization records they can access. Platform administration remains separate.</p><p className="rounded-lg bg-red-50 p-3 text-red-800">Do not share administrator passwords between staff members.</p></div></div>
        <div className="card"><h2 className="text-xl font-bold">Recent organization administration</h2><div className="mt-4 space-y-3">{recentAudit.length ? recentAudit.map(log => <div key={log.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-sm font-medium text-slate-800">{log.action} · {log.entity}</p><p className="text-xs text-slate-500">{log.user?.name ?? "System"} · {log.createdAt.toLocaleString()}</p></div>) : <p className="text-sm text-slate-500">No organization administration events recorded yet.</p>}</div></div>
      </div>
    </section>}

    {user.role === "SUPER_ADMIN" && <section className="card mt-6"><h2 className="text-xl font-bold">Platform organization view</h2><p className="mt-2 text-sm text-slate-600">You are viewing the selected organization as the platform owner. Use the main Admin area for platform-wide user, model, storage, and organization controls.</p><div className="mt-4 flex flex-wrap gap-2">{roles.map(r => <span key={r} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{r.replaceAll("_", " ")}</span>)}</div></section>}
  </main>;
}
