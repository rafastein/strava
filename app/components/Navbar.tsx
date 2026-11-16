"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, NavTabIcon, isNavTabActive } from "./nav-tabs";

type Props = {
  athleteName?: string;
  athleteAvatar?: string;
};

/**
 * Topo do site. No desktop mostra as cinco seções; no celular fica só a marca,
 * porque a navegação vai para a barra de abas do rodapé.
 */
export default function Navbar({ athleteName, athleteAvatar }: Props) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="ui-nav">
      <div className="ui-nav__inner">
        <Link href="/" className="ui-nav__brand">
          {athleteAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo do Strava, 28 px
            <img src={athleteAvatar} alt="" width={28} height={28} className="ui-nav__avatar" />
          ) : (
            <span className="ui-nav__dot" aria-hidden="true" />
          )}
          {athleteName ?? "Rafael"}
        </Link>

        <nav className="ui-nav__links" aria-label="Seções">
          {NAV_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="ui-nav__link"
              aria-current={isNavTabActive(tab, pathname) ? "page" : undefined}
            >
              <NavTabIcon tab={tab} size={18} />
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
