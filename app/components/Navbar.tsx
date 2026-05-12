"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/buenos-aires", label: "Buenos Aires" },
  { href: "/longoes", label: "Longões" },
  { href: "/treinos-qualidade", label: "Qualidade" },
  { href: "/meias", label: "Meias" },
  { href: "/corridas-brasil", label: "Brasil" },
  { href: "/corridas-mundo", label: "Mundo" },
  { href: "/equipamentos", label: "Tênis" },
  { href: "/sisrun", label: "SisRUN" },
];

type Props = { athleteName?: string; athleteAvatar?: string; };

export default function Navbar({ athleteName, athleteAvatar }: Props) {
  const pathname = usePathname();
  return (
    <nav className="site-nav">
      <div className="site-nav__inner">
        <div className="site-nav__brand">
          {athleteAvatar && <img src={athleteAvatar} alt="" className="site-nav__avatar" />}
          <Link href="/" className="site-nav__logo">{athleteName?.toUpperCase() ?? "RAFAEL"}</Link>
          <span className="site-nav__dot" />
        </div>
        <div className="site-nav__links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`site-nav__link${pathname === l.href ? " site-nav__link--active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}