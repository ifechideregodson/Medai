import "./globals.css";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "MedAI Clinical Platform",
  description: "Clinical decision support and medical research workspace"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-xl font-bold text-slate-900">MedAI</Link>
            {user && <div className="flex items-center gap-5">
              <nav className="flex gap-5 text-sm text-slate-600">
                <Link href="/">Dashboard</Link>
                <Link href="/patients">Patients</Link>
                <Link href="/imaging">Imaging AI</Link>
                <Link href="/skin">Skin AI</Link>
                <Link href="/research">Research Lab</Link>
                <Link href="/audit">Audit</Link>
                <Link href="/reports">Reports</Link>
                <Link href="/models">Models</Link>
                {user.role === "SUPER_ADMIN" && <Link href="/admin" className="font-semibold text-blue-700">Owner Admin</Link>}
              </nav>
              <form action="/logout" method="post"><button className="text-sm font-semibold text-red-700">Sign out</button></form>
            </div>}
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-7xl px-6 py-8 text-xs text-slate-500">
          Clinical platform infrastructure. AI outputs require validated models and qualified clinical review before patient-care use.
        </footer>
      </body>
    </html>
  );
}