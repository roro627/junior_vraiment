import { Menu } from "lucide-react";
import Link from "next/link";

import { DataFreshnessBadge } from "./data-freshness-badge";

type AppHeaderProps = {
  freshness?: "fresh" | "delayed" | "stale" | "partial" | "incident";
  dataAsOf?: string | null;
};

const navigation = [
  { href: "/", label: "Observer" },
  { href: "/explorer", label: "Explorer les offres" },
  { href: "/insights", label: "Insights" },
  { href: "/methodologie", label: "Méthodologie" },
  { href: "/statut-donnees", label: "État des données" },
];

export function AppHeader({ freshness, dataAsOf = null }: AppHeaderProps) {
  const links = navigation.map(({ href, label }) => (
    <a href={href} key={href}>
      {label}
    </a>
  ));

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link
          className="wordmark"
          href="/"
          aria-label="Junior, vraiment ? — accueil"
        >
          <span aria-hidden="true" className="wordmark__mark">
            J
          </span>
          <span>
            Junior,
            <br />
            vraiment&nbsp;?
          </span>
        </Link>
        <nav className="desktop-navigation" aria-label="Navigation principale">
          {links}
        </nav>
        <div className="app-header__status">
          {freshness ? (
            <DataFreshnessBadge freshness={freshness} dataAsOf={dataAsOf} />
          ) : (
            <a className="header-status-link" href="/statut-donnees">
              État des données
            </a>
          )}
        </div>
        <details className="mobile-navigation">
          <summary aria-label="Ouvrir la navigation">
            <Menu aria-hidden="true" />
          </summary>
          <nav aria-label="Navigation mobile">{links}</nav>
        </details>
      </div>
    </header>
  );
}
