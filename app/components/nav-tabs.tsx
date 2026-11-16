import type { ReactNode } from "react";

export type NavTab = { href: string; label: string; paths: string[]; icon: ReactNode };

// As cinco seções do site. A barra do celular e o menu do desktop usam a mesma lista;
// as demais páginas ficam a um toque, em /treinos e /mais.
export const NAV_TABS: NavTab[] = [
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

export function isNavTabActive(tab: NavTab, pathname: string) {
  return tab.paths.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function NavTabIcon({ tab, size = 24 }: { tab: NavTab; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {tab.icon}
    </svg>
  );
}
