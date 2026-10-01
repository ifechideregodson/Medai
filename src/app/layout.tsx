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
        <header className="sticky top-0 z-50 border-b border-red-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-700 text-lg font-black text-white">M</span>
              <span className="text-xl font-extrabold tracking-tight text-slate-950">Med<span className="text-red-700">AI</span></span>
            </Link>
            {user && (
              <div className="flex min-w-0 items-center gap-3">
                <nav className="hidden items-center gap-1 lg:flex">
                  {[
                    ["/", "Dashboard"], ["/patients", "Patients"], ["/imaging", "Imaging AI"],
                    ["/skin", "Skin AI"], ["/research", "Research"], ["/reports", "Reports"],
                    ["/audit", "Audit"], ["/models", "Models"]
                  ].map(([href, label]) => (
                    <Link key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700">{label}</Link>
                  ))}
                  {user.role === "SUPER_ADMIN" && <Link href="/admin" className="ml-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800">Admin</Link>}
                </nav>
                <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                <div className="hidden max-w-32 truncate text-right text-xs sm:block">
                  <div className="truncate font-semibold text-slate-800">{user.name}</div>
                  <div className="text-slate-500">{user.role.replace("_", " ")}</div>
                </div>
                <form action="/logout" method="post"><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">Sign out</button></form>
              </div>
            )}
          </div>
          {user && (
            <nav className="overflow-x-auto border-t border-red-50 bg-red-50/40 px-4 py-2 lg:hidden">
              <div className="mx-auto flex w-max max-w-7xl gap-1">
                {[
                  ["/", "Dashboard"], ["/patients", "Patients"], ["/imaging", "Imaging AI"],
                  ["/skin", "Skin AI"], ["/research", "Research"], ["/reports", "Reports"],
                  ["/audit", "Audit"], ["/models", "Models"], ...(user.role === "SUPER_ADMIN" ? [["/admin", "Admin"]] : [])
                ].map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white hover:text-red-700">{label}</Link>)}
              </div>
            </nav>
          )}
        </header>
        {children}
        <footer className="border-t border-red-100 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 text-xs text-slate-500 sm:px-6">
            <span className="font-semibold text-red-700">MedAI Clinical Platform</span> · Clinical infrastructure. AI outputs require validated models and qualified clinical review before patient-care use.
          </div>
        </footer>
      </body>
    </html>
  );
}
