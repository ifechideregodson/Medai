import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default function NewPatient() {
  async function createPatient(formData: FormData) {
    "use server";
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const sex = String(formData.get("sex") || "").trim();
    if (!firstName || !lastName) return;
    const count = await db.patient.count();
    await db.patient.create({ data: { medicalId: `MED-${String(count + 1).padStart(6, "0")}`, firstName, lastName, sex } });
    redirect("/patients");
  }
  return <main className="mx-auto max-w-2xl px-6 py-10"><h1 className="text-3xl font-bold">New patient</h1>
    <form action={createPatient} className="card mt-6 space-y-4">
      <input name="firstName" required placeholder="First name" className="w-full rounded-lg border p-3" />
      <input name="lastName" required placeholder="Last name" className="w-full rounded-lg border p-3" />
      <select name="sex" className="w-full rounded-lg border p-3"><option value="">Sex not specified</option><option>Female</option><option>Male</option><option>Intersex</option></select>
      <button className="btn bg-slate-900 text-white" type="submit">Create patient</button>
    </form></main>;
}