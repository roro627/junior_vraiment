import type { ReactNode } from "react";

/** The real, static introduction can paint while the database resolves filters. */
export function ExplorerIntroduction({ children }: { children?: ReactNode }) {
  return (
    <header className="explorer__introduction">
      <div>
        <p className="eyebrow">Observations vérifiables</p>
        <h1>Explorer les offres</h1>
        <p className="lead">
          Retrouvez les annonces derrière les indicateurs et ouvrez chaque
          preuve de classification.
        </p>
      </div>
      {children}
    </header>
  );
}
