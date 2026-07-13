import Link from "next/link";

const legalLinks = [
  { href: "/legal/disclaimer", label: "免責聲明" },
  { href: "/legal/terms", label: "服務條款" },
  { href: "/legal/privacy", label: "隱私權政策" },
];

export function LegalPageShell({ title, updatedAt, children }: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
        <nav className="flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-slate-700">
              {link.label}
            </Link>
          ))}
        </nav>
        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-xs text-slate-400">最後更新：{updatedAt}</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </main>
  );
}
