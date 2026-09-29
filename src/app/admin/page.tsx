import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createUser, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { getStorageHealth, repairPrivateObject } from "@/lib/storage";

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.SUPER_ADMIN) redirect("/");
  return user;
}

async function createManagedUser(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "DOCTOR") as Role;
  const organizationId = String(formData.get("organizationId") || "").trim();
  if (!email || !name || password.length < 12 || !Object.values(Role).includes(role)) throw new Error("Name, email, a 12+ character password, and a valid role are required.");
  const user = await createUser(email, password, name, role);
  if (organizationId) await db.membership.create({ data: { userId: user.id, organizationId } });
  await audit("CREATE", "User", user.id, JSON.stringify({ email, role, organizationId: organizationId || null }), owner.id);
  revalidatePath("/admin");
}

async function createOrganization(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "HOSPITAL").trim();
  if (!name) throw new Error("Organization name is required.");
  const org = await db.organization.create({ data: { name, type } });
  await audit("CREATE", "Organization", org.id, JSON.stringify({ name, type }), owner.id);
  revalidatePath("/admin");
}

async function toggleUser(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const id = String(formData.get("id") || "");
  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.id === owner.id) return;
  const updated = await db.user.update({ where: { id }, data: { active: !user.active } });
  await audit("UPDATE", "User", id, JSON.stringify({ active: updated.active }), owner.id);
  revalidatePath("/admin");
}

async function changeUserRole(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "") as Role;
  if (!Object.values(Role).includes(role)) return;
  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.id === owner.id) return;
  const updated = await db.user.update({ where: { id }, data: { role } });
  await audit("UPDATE", "User", id, JSON.stringify({ role: updated.role }), owner.id);
  revalidatePath("/admin");
}

async function assignMembership(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const userId = String(formData.get("userId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  if (!userId || !organizationId) return;
  await db.membership.upsert({ where: { userId_organizationId: { userId, organizationId } }, update: {}, create: { userId, organizationId } });
  await audit("GRANT", "Membership", `${userId}:${organizationId}`, "Organization membership assigned", owner.id);
  revalidatePath("/admin");
}

async function toggleOrganization(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const id = String(formData.get("id") || "");
  const org = await db.organization.findUnique({ where: { id } });
  if (!org) return;
  const updated = await db.organization.update({ where: { id }, data: { active: !org.active } });
  await audit("UPDATE", "Organization", id, JSON.stringify({ active: updated.active }), owner.id);
  revalidatePath("/admin");
}

async function createModel(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const name = String(formData.get("name") || "").trim();
  const version = String(formData.get("version") || "").trim();
  const modality = String(formData.get("modality") || "").trim();
  const intendedUse = String(formData.get("intendedUse") || "").trim();
  const validationInfo = String(formData.get("validationInfo") || "").trim();
  const provider = String(formData.get("provider") || "CUSTOM").trim().toUpperCase();
  const endpoint = String(formData.get("endpoint") || "").trim();
  if (!name || !version || !modality || !intendedUse || !["OPENAI", "CUSTOM"].includes(provider)) throw new Error("Model name, version, modality, intended use and provider are required.");
  if (provider === "CUSTOM" && !endpoint) throw new Error("A custom model requires an endpoint.");
  const model = await db.modelRegistry.create({ data: { name, version, modality, intendedUse, validationInfo: validationInfo || null, provider, endpoint: provider === "CUSTOM" ? endpoint : null } });
  await audit("CREATE", "ModelRegistry", model.id, JSON.stringify({ name, version, modality, provider }), owner.id);
  revalidatePath("/admin"); revalidatePath("/models");
}

async function activateModel(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const id = String(formData.get("id") || "");
  const model = await db.modelRegistry.findUnique({ where: { id } });
  if (!model) return;
  await db.$transaction([
    db.modelRegistry.updateMany({ where: { modality: model.modality }, data: { status: "RETIRED" } }),
    db.modelRegistry.update({ where: { id }, data: { status: "ACTIVE" } })
  ]);
  await audit("ACTIVATE", "ModelRegistry", id, JSON.stringify({ name: model.name, version: model.version, modality: model.modality }), owner.id);
  revalidatePath("/admin"); revalidatePath("/models");
}

async function retireModel(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const id = String(formData.get("id") || "");
  const model = await db.modelRegistry.findUnique({ where: { id } });
  if (!model) return;
  await db.modelRegistry.update({ where: { id }, data: { status: "RETIRED" } });
  await audit("RETIRE", "ModelRegistry", id, JSON.stringify({ name: model.name, version: model.version }), owner.id);
  revalidatePath("/admin"); revalidatePath("/models");
}

async function repairAsset(formData: FormData) {
  "use server";
  const owner = await requireOwner();
  const id = String(formData.get("id") || "");
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset?.storageKey) return;
  const result = await repairPrivateObject(asset.storageKey, asset.metadata, asset.mimeType || "application/octet-stream");
  const parsed = asset.metadata ? (() => { try { return JSON.parse(asset.metadata); } catch { return {}; } })() : {};
  const existing = parsed.storage || {};
  const currentLocations = Array.isArray(existing.locations) ? existing.locations : [];
  const merged = [...currentLocations];
  for (const location of result.repaired) if (!merged.some((x: any) => x.provider === location.provider)) merged.push(location);
  const cloudinary = result.repaired.find(x => x.provider === "cloudinary")?.cloudinary || existing.cloudinary || null;
  await db.asset.update({ where: { id }, data: { metadata: JSON.stringify({ ...parsed, storage: { ...existing, key: asset.storageKey, locations: merged, primary: existing.primary || merged[0]?.provider || null, cloudinary } }) } });
  await audit("STORAGE_REPAIR", "Asset", id, JSON.stringify({ repaired: result.repaired.map(x => x.provider), errors: result.errors }), owner.id);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const owner = await requireOwner();
  const [users, organizations, patients, analyses, reports, studies, assets, research, auditCount, storage, models, recentAudit, recentPatients] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, include: { memberships: { include: { organization: true } } } }),
    db.organization.findMany({ orderBy: { createdAt: "desc" } }),
    db.patient.count(), db.analysis.count(), db.clinicalReport.count(), db.imagingStudy.count(), db.asset.count(), db.researchProject.count(), db.auditLog.count(), getStorageHealth(),
    db.modelRegistry.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { user: true } }),
    db.patient.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { organization: true } })
  ]);
  const repairableAssets = await db.asset.findMany({ where: { storageKey: { not: null } }, orderBy: { createdAt: "desc" }, take: 30 });

  return <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
    <div><p className="text-sm font-semibold text-blue-700">OWNER CONTROL CENTER</p><h1 className="mt-2 text-4xl font-bold">MedAI Administration</h1><p className="mt-2 text-slate-600">Signed in as {owner.name}. Operational controls are restricted to the platform super administrator.</p></div>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Users", users.length],["Organizations", organizations.length],["Patients", patients],["AI Analyses", analyses],["Imaging Studies", studies],["Reports", reports],["Stored Assets", assets],["Research Projects", research],["Audit Events", auditCount]].map(([label,value])=><div className="card" key={String(label)}><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-3xl font-bold">{value}</div></div>)}</section>

    <section className="grid gap-6 lg:grid-cols-2">
      <div className="card"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Storage health</h2><span className="text-sm font-semibold">{storage.overall.toUpperCase()}</span></div><div className="mt-5 space-y-3">{[storage.s3,storage.cloudinary].map(p=><div key={p.name} className="flex items-center justify-between rounded-lg border p-3"><div><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.message}</div></div><span className={p.ok?"text-sm font-bold text-emerald-700":"text-sm font-bold text-red-700"}>{p.ok?"● ONLINE":"● OFFLINE"}</span></div>)}</div><p className="mt-4 text-xs text-slate-500">S3 is preferred. Cloudinary is the secondary protected copy and failover provider.</p></div>
      <div className="card"><h2 className="text-xl font-bold">Create organization</h2><form action={createOrganization} className="mt-4 grid gap-3"><input name="name" required placeholder="Hospital / clinic name" className="rounded-lg border p-3"/><input name="type" defaultValue="HOSPITAL" placeholder="Type" className="rounded-lg border p-3"/><button className="btn bg-slate-900 text-white">Create organization</button></form></div>
    </section>

    <section className="card"><h2 className="text-xl font-bold">Organizations</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{organizations.map(o=><div key={o.id} className="rounded-lg border p-4 flex items-center justify-between"><div><b>{o.name}</b><div className="text-xs text-slate-500">{o.type} · created {o.createdAt.toLocaleDateString()}</div></div><form action={toggleOrganization}><input type="hidden" name="id" value={o.id}/><button className="rounded border px-3 py-1">{o.active?"Disable":"Enable"}</button></form></div>)}</div></section>

    <section className="card"><h2 className="text-xl font-bold">AI model control</h2><p className="mt-1 text-sm text-slate-500">Activating a model retires other models for the same modality. Activation does not itself establish clinical validation.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Model</th><th className="p-2">Modality</th><th className="p-2">Status</th><th className="p-2">Controls</th></tr></thead><tbody>{models.map(m=><tr className="border-b" key={m.id}><td className="p-2"><b>{m.name} {m.version}</b><div className="text-xs text-slate-500">{m.intendedUse}</div></td><td className="p-2">{m.modality}</td><td className="p-2">{m.status}</td><td className="p-2 flex gap-2">{m.status!=="ACTIVE"&&<form action={activateModel}><input type="hidden" name="id" value={m.id}/><button className="rounded border px-3 py-1">Activate</button></form>}{m.status==="ACTIVE"&&<form action={retireModel}><input type="hidden" name="id" value={m.id}/><button className="rounded border px-3 py-1">Retire</button></form>}</td></tr>)}</tbody></table></div></section>

    <section className="card"><h2 className="text-xl font-bold">Configure AI model provider</h2><p className="mt-1 text-sm text-slate-500">Register a provider in the model registry. OpenAI uses the server-side OPENAI_API_KEY and OPENAI_MODEL settings; it does not expose credentials to the browser.</p><form action={createModel} className="mt-4 grid gap-3 md:grid-cols-3"><input name="name" required placeholder="Model ID, e.g. gpt-5.6-luna" className="rounded-lg border p-3"/><input name="version" required placeholder="Version, e.g. current" className="rounded-lg border p-3"/><select name="provider" defaultValue="OPENAI" className="rounded-lg border p-3"><option value="OPENAI">OpenAI</option><option value="CUSTOM">Custom gateway</option></select><select name="modality" defaultValue="XRAY" className="rounded-lg border p-3"><option value="XRAY">XRAY</option><option value="SKIN">SKIN</option><option value="CLINICAL">CLINICAL</option></select><input name="intendedUse" required placeholder="Intended use" className="rounded-lg border p-3"/><input name="validationInfo" placeholder="Validation information" className="rounded-lg border p-3"/><input name="endpoint" placeholder="Custom endpoint (only for Custom)" className="rounded-lg border p-3 md:col-span-2"/><button className="btn bg-blue-700 text-white">Register model</button></form></section>

<section className="card"><h2 className="text-xl font-bold">Create user</h2><p className="mt-1 text-sm text-slate-500">Passwords are hashed server-side. Use a temporary password and require a secure reset workflow before production use.</p><form action={createManagedUser} className="mt-4 grid gap-3 md:grid-cols-4"><input name="name" required placeholder="Full name" className="rounded-lg border p-3"/><input name="email" required type="email" placeholder="Email" className="rounded-lg border p-3"/><input name="password" required minLength={12} type="password" placeholder="Temporary password (12+)" className="rounded-lg border p-3"/><select name="role" defaultValue="DOCTOR" className="rounded-lg border p-3">{Object.values(Role).map(r=><option key={r} value={r}>{r}</option>)}</select><select name="organizationId" className="rounded-lg border p-3 md:col-span-3"><option value="">No organization assignment</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button className="btn bg-blue-700 text-white">Create user</button></form></section>

    <section className="card overflow-x-auto"><h2 className="text-xl font-bold">Users & access</h2><table className="mt-4 w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">User</th><th className="p-2">Role</th><th className="p-2">Organizations</th><th className="p-2">Status</th><th className="p-2">Controls</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-b align-top"><td className="p-2"><b>{u.name}</b><div className="text-xs text-slate-500">{u.email}</div></td><td className="p-2"><form action={changeUserRole}><input type="hidden" name="id" value={u.id}/><select name="role" defaultValue={u.role} disabled={u.id===owner.id} className="rounded border p-1">{Object.values(Role).map(r=><option key={r}>{r}</option>)}</select><button disabled={u.id===owner.id} className="ml-2 rounded border px-2 py-1">Save</button></form></td><td className="p-2"><div className="space-y-1">{u.memberships.map(m=><div key={m.id}>{m.organization.name}</div>)}</div><form action={assignMembership} className="mt-2 flex gap-2"><input type="hidden" name="userId" value={u.id}/><select name="organizationId" className="rounded border p-1"><option value="">Add organization</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button className="rounded border px-2 py-1">Add</button></form></td><td className="p-2">{u.active?<span className="font-semibold text-emerald-700">Active</span>:<span className="font-semibold text-red-700">Disabled</span>}</td><td className="p-2"><form action={toggleUser}><input type="hidden" name="id" value={u.id}/><button disabled={u.id===owner.id} className="rounded border px-3 py-1">{u.active?"Disable":"Enable"}</button></form></td></tr>)}</tbody></table></section>

    <section className="card"><h2 className="text-xl font-bold">Patient oversight</h2><p className="mt-1 text-sm text-slate-500">Read-only owner view. Patient-care changes should be performed through the clinical workflow and remain audited.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Medical ID</th><th className="p-2">Patient</th><th className="p-2">Organization</th><th className="p-2">Created</th></tr></thead><tbody>{recentPatients.map(p=><tr key={p.id} className="border-b"><td className="p-2">{p.medicalId}</td><td className="p-2">{p.firstName} {p.lastName}</td><td className="p-2">{p.organization?.name || "—"}</td><td className="p-2">{p.createdAt.toLocaleString()}</td></tr>)}</tbody></table></div></section>

    <section className="card"><h2 className="text-xl font-bold">Storage repair</h2><p className="mt-1 text-sm text-slate-500">If one provider is missing a copy, repair attempts to copy the available protected asset to the missing configured provider.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Asset</th><th className="p-2">Type</th><th className="p-2">Created</th><th className="p-2">Action</th></tr></thead><tbody>{repairableAssets.map(a=><tr key={a.id} className="border-b"><td className="p-2">{a.name}</td><td className="p-2">{a.type}</td><td className="p-2">{a.createdAt.toLocaleString()}</td><td className="p-2"><form action={repairAsset}><input type="hidden" name="id" value={a.id}/><button className="rounded border px-3 py-1">Repair copies</button></form></td></tr>)}</tbody></table></div></section>

    <section className="card"><h2 className="text-xl font-bold">Recent audit activity</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Entity</th><th className="p-2">Details</th></tr></thead><tbody>{recentAudit.map(l=><tr key={l.id} className="border-b align-top"><td className="p-2">{l.createdAt.toLocaleString()}</td><td className="p-2">{l.user?.email||"System"}</td><td className="p-2">{l.action}</td><td className="p-2">{l.entity}</td><td className="p-2 max-w-xl break-words">{l.details}</td></tr>)}</tbody></table></div></section>

    <section className="card"><h2 className="text-xl font-bold">Owner safety controls</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><div className="rounded-lg bg-slate-50 p-4"><b>Clinical review</b><p className="mt-1 text-sm text-slate-600">AI outputs remain subject to qualified clinician review and signoff.</p></div><div className="rounded-lg bg-slate-50 p-4"><b>Model governance</b><p className="mt-1 text-sm text-slate-600">Only explicitly activated model versions can be selected as active for a modality.</p></div><div className="rounded-lg bg-slate-50 p-4"><b>Private storage</b><p className="mt-1 text-sm text-slate-600">Clinical assets should remain protected in both configured storage providers.</p></div></div></section>
  </main>;
}
