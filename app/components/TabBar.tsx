"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Tab = { href: string; label: string; paths: string[]; icon: ReactNode };

// Cada aba reúne as páginas do mesmo assunto; as demais ficam a um toque, em /treinos e /mais.
const TABS: Tab[] = [
  {
    href: "/",
    label: "Hoje",
    paths: ["/"],
    icon: (<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>),
  },
  {
    href: "/treinos",
    label: "Treinos",
    paths: ["/treinos", "/longoes", "/treinos-qualidade", "/coros", "/sisrun"],
    icon: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  },
  {
    href: "/provas",
    label: "Provas",
    paths: ["/provas", "/meias", "/buenos-aires"],
    icon: (<><path d="M6 21V4" /><path d="M6 5h11l-2 4 2 4H6" /></>),
  },
  {
    href: "/carga",
    label: "Carga",
    paths: ["/carga"],
    icon: (<><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></>),
  },
  {
    href: "/mais",
    label: "Mais",
    paths: ["/mais", "/equipamentos", "/27-capitais", "/corridas-brasil", "/corridas-mundo", "/glossario"],
    icon: (<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>),
  },
];

function isActive(tab: Tab, pathname: string) {
  return tab.paths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default function TabBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="ui-tabbar" aria-label="Navegação principal">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="ui-tabbar__item"
          aria-current={isActive(tab, pathname) ? "page" : undefined}
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {tab.icon}
          </svg>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
