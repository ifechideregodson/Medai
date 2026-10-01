import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewPatient() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const memberships = user.role === "SUPER_ADMIN"
    ? await db.organization.findMany({ where: { active: true }, orderBy: { name: "asc" } })
    : await db.organization.findMany({ where: { active: true, memberships: { some: { userId: user.id } } }, orderBy: { name: "asc" } });

  async function createPatient(formData: FormData) {
    "use server";
    const current = await getCurrentUser();
    if (!current) redirect("/login");
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const sex = String(formData.get("sex") || "").trim() || null;
    const dateOfBirthValue = String(formData.get("dateOfBirth") || "").trim();
    const phone = String(formData.get("phone") || "").trim() || null;
    const allergies = String(formData.get("allergies") || "").trim() || null;
    const history = String(formData.get("history") || "").trim() || null;
    const organizationId = String(formData.get("organizationId") || "").trim() || null;
    if (!firstName || !lastName || !organizationId) return;

    if (current.role !== "SUPER_ADMIN") {
      const membership = await db.membership.findUnique({ where: { userId_organizationId: { userId: current.id, organizationId } } });
      if (!membership) return;
    } else {
      const organization = await db.organization.findFirst({ where: { id: organizationId, active: true } });
      if (!organization) return;
    }

    const medicalId = `MED-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    await db.patient.create({
      data: {
        medicalId,
        firstName,
        lastName,
        sex,
        phone,
        allergies,
        history,
        dateOfBirth: dateOfBirthValue ? new Date(dateOfBirthValue + "T00:00:00.000Z") : null,
        organizationId,
        ownerId: current.id,
      },
    });
    redirect("/patients");
  }

  return <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
    <p className="text-sm font-semibold uppercase tracking-wider text-red-700">Clinical records</p>
    <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Register patient</h1>
    <p className="mt-2 text-sm text-slate-600">Create a real patient record. No sample or demo records are generated.</p>
    <form action={createPatient} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="firstName" required placeholder="First name" className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
        <input name="lastName" required placeholder="Last name" className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />
      </div>
      <select name="organizationId" required className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-red-500">
        <option value="">Select organization</option>
        {memberships.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="dateOfBirth" type="date" className="w-full rounded-xl border border-slate-300 p-3" />
        <select name="sex" className="w-full rounded-xl border border-slate-300 p-3"><option value="">Sex not specified</option><option>Female</option><option>Male</option><option>Intersex</option></select>
      </div>
      <input name="phone" placeholder="Phone (optional)" className="w-full rounded-xl border border-slate-300 p-3" />
      <textarea name="allergies" rows={3} placeholder="Known allergies (optional)" className="w-full rounded-xl border border-slate-300 p-3" />
      <textarea name="history" rows={5} placeholder="Relevant clinical history (optional)" className="w-full rounded-xl border border-slate-300 p-3" />
      <button className="w-full rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800" type="submit">Create patient record</button>
    </form>
  </main>;
}