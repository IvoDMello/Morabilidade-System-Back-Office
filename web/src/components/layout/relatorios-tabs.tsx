"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/relatorios", label: "Portfólio" },
  { href: "/audiencia", label: "Audiência" },
] as const;

export function RelatoriosTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6 -mt-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              active
                ? "border-[#585a4f] text-[#585a4f]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
