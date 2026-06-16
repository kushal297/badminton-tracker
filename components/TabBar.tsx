"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; emoji: string; match: (p: string) => boolean };

const TABS: Tab[] = [
  {
    href: "/",
    label: "Games",
    emoji: "🏸",
    match: (p) => p === "/" || p.startsWith("/sessions") || p.startsWith("/new"),
  },
  {
    href: "/stats",
    label: "Stats",
    emoji: "📊",
    match: (p) => p.startsWith("/stats") || p.startsWith("/players"),
  },
  {
    href: "/insights",
    label: "Insights",
    emoji: "📈",
    match: (p) => p.startsWith("/insights"),
  },
  {
    href: "/beers",
    label: "Beers",
    emoji: "🍺",
    match: (p) => p.startsWith("/beers"),
  },
];

export function TabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex w-full max-w-2xl items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.68rem] font-medium transition-colors ${
                  active ? "text-court" : "text-muted hover:text-ink"
                }`}
              >
                <span className={`text-xl leading-none transition-transform ${active ? "scale-110" : "opacity-70"}`} aria-hidden>
                  {tab.emoji}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
