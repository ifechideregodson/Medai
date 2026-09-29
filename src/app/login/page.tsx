import { authenticate, createSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const user = await authenticate(email, password);
    if (!user) redirect("/login?error=invalid");
    await createSession(user.id);
    redirect("/");
  }
  return <main className="mx-auto max-w-md px-6 py-20">
    <div className="card">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">Authorized users only.</p>
      <form action={login} className="mt-6 space-y-4">
        <input name="email" type="email" required autoComplete="username" placeholder="Email" className="w-full rounded-lg border p-3" />
        <input name="password" type="password" required autoComplete="current-password" placeholder="Password" className="w-full rounded-lg border p-3" />
        <button className="btn w-full justify-center bg-slate-900 text-white">Sign in</button>
      </form>
    </div>
  </main>;
}