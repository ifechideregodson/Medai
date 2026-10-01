"use client";

import { FormEvent, useState } from "react";

export default function FirstAdminSetupPage() {
  const [setupSecret, setSetupSecret] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (!setupSecret.trim()) {
      setError("Enter the FIRST_ADMIN_SETUP_SECRET from Render.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/setup/first-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-secret": setupSecret.trim(),
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Unable to create the administrator.");
        return;
      }

      setMessage("Super-admin created successfully. You can now sign in at /login.");
      setSetupSecret("");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error. Check that the MedAI site is online and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-xl shadow-slate-200/60">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-red-700">MedAI Clinical Platform</p>
            <h1 className="mt-2 text-2xl font-bold">Create super-admin</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This page is only for creating the first platform owner. You need the
              FIRST_ADMIN_SETUP_SECRET configured in Render.
            </p>
          </div>

          {message && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Setup secret</span>
              <input
                type="password"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                autoComplete="off"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 outline-none focus:border-red-600"
                placeholder="FIRST_ADMIN_SETUP_SECRET"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Full name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-cyan-500"
                placeholder="Platform administrator"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Admin email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-cyan-500"
                placeholder="admin@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Password</span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-cyan-500"
                placeholder="At least 12 characters"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Confirm password</span>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-cyan-500"
                placeholder="Enter the password again"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Show password
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-red-700 px-4 py-3 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Creating administrator..." : "Create super-admin"}
            </button>
          </form>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            The setup secret is sent only to the MedAI server as a request header.
            Once a SUPER_ADMIN exists, the API refuses to create another initial administrator.
          </p>
        </div>
      </div>
    </main>
  );
}
