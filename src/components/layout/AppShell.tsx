"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpen, Brain, HelpCircle, Layers, Library, UserCircle } from "lucide-react";
import { cx } from "@/lib/utils/format";

const navigation = [
  { href: "/library", label: "Bibliothek", icon: Library },
  { href: "/learn", label: "KI-Lernen", icon: Brain },
  { href: "/flashcards", label: "Karteikarten", icon: Layers },
  { href: "/quiz", label: "Quiz", icon: HelpCircle },
  { href: "/account", label: "Konto", icon: UserCircle },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f6f7f4] pb-16 md:pb-0">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-[#dfe6df] bg-white px-4 py-5 md:block">
        <Link href="/library" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2f6f73] text-white">
            <BookOpen size={21} />
          </span>
          <span>
            <span className="block text-lg font-semibold">StudyPilot</span>
            <span className="block text-xs text-[#667085]">Notizen schreiben. Inhalte verstehen. Besser lernen.</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href === "/library" && pathname.startsWith("/notebook"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-[#475467] transition",
                  active && "bg-[#e8f3f1] text-[#1d5b5d]",
                  !active && "hover:bg-[#f1f4ef] hover:text-[#18202f]",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen md:pl-64">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-[#dfe6df] bg-white md:hidden">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href === "/library" && pathname.startsWith("/notebook"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-[#1d5b5d]" : "text-[#667085]",
              )}
            >
              <Icon size={19} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
