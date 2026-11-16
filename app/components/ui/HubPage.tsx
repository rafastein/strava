import Link from "next/link";
import type { ReactNode } from "react";
import Navbar from "../Navbar";

export type HubLink = { href: string; label: string; description: string };

/** Página de índice de uma aba: título e a lista das páginas daquele assunto. */
export default function HubPage({
  title,
  description,
  links,
  children,
}: {
  title: string;
  description: string;
  links: HubLink[];
  /** Conteúdo acima da lista de páginas (resumo da aba). */
  children?: ReactNode;
}) {
  return (
    <div className="ui-page">
      <Navbar />
      <main className="ui-container" style={{ maxWidth: 720 }}>
        <header className="ui-header">
          <div>
            <h1 className="ui-title">{title}</h1>
            <p className="ui-muted">{description}</p>
          </div>
        </header>
        {children}
        <nav className="ui-card ui-list" aria-label={title}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="ui-row">
              <span className="ui-row__main">
                <span className="ui-row__title">{link.label}</span>
                <span className="ui-muted">{link.description}</span>
              </span>
              <svg className="ui-row__chevron" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
