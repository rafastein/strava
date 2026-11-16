"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, NavTabIcon, isNavTabActive } from "./nav-tabs";

/** Barra de abas fixa no rodapé, só no celular (o desktop usa o menu da Navbar). */
export default function TabBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="ui-tabbar" aria-label="Navegação principal">
      {NAV_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="ui-tabbar__item"
          aria-current={isNavTabActive(tab, pathname) ? "page" : undefined}
        >
          <NavTabIcon tab={tab} />
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
