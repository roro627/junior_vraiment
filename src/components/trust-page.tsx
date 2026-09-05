import type { ReactNode } from "react";

import { AppHeader } from "./app-header";
import { SiteFooter } from "./site-footer";

type TrustPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  navigation?: ReadonlyArray<{ href: string; label: string }>;
  children: ReactNode;
};

export function TrustPage({
  eyebrow,
  title,
  lead,
  navigation = [],
  children,
}: TrustPageProps) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <AppHeader />
      <main className="trust-page" id="contenu">
        <header className="trust-page__header">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
        </header>
        <div className="trust-page__layout">
          {navigation.length > 0 ? (
            <aside className="trust-page__navigation">
              <nav aria-label={`Sommaire — ${title}`}>
                <p>Sur cette page</p>
                {navigation.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
            </aside>
          ) : null}
          <article className="trust-page__content">{children}</article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
