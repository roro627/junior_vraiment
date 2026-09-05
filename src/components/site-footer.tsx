import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Junior, vraiment&nbsp;?</strong>
        <span>Observatoire indépendant du marché tech junior français.</span>
      </div>
      <nav aria-label="Liens de pied de page">
        <Link href="/methodologie">Méthodologie</Link>
        <Link href="/insights">Insights</Link>
        <Link href="/statut-donnees">État des données</Link>
        <Link href="/limites">Limites</Link>
        <Link href="/a-propos">À propos</Link>
        <Link href="/signaler">Signaler une erreur</Link>
      </nav>
    </footer>
  );
}
