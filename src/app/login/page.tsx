import Link from "next/link";

export default function LoginPage() {
  return <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 px-4 py-12">
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-700 text-2xl font-black text-white shadow-lg shadow-red-200">M</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">Med<span className="text-red-700">AI</span></h1>
        <p className="mt-1 text-sm text-slate-500">Clinical Intelligence Platform</p>
      </div>
      <div className="card border-red-100 shadow-xl shadow-slate-200/60">
        <h2 className="text-xl font-bold text-slate-950">Sign in</h2>
        <p className="mt-1 text-sm text-slate-500">Authorized clinical users only.</p>
        <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
          <input name="email" type="email" required autoComplete="username" placeholder="Email address" className="w-full rounded-lg border p-3" />
          <input name="password" type="password" required autoComplete="current-password" placeholder="Password" className="w-full rounded-lg border p-3" />
          <button className="btn w-full bg-red-700 text-white hover:bg-red-800">Sign in securely</button>
        </form>
        <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          Protected clinical workspace. Access is monitored and audited.
        </div>
      </div>
      <Link href="/setup" className="mt-4 block text-center text-xs text-slate-400 hover:text-red-700">Initial platform setup</Link>
    </div>
  </main>;
}
