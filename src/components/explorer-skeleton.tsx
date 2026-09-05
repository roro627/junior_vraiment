export function ExplorerSkeleton() {
  return (
    <main className="explorer explorer-skeleton" id="contenu" aria-busy="true">
      <span className="sr-only">Chargement des offres</span>
      <div className="explorer-skeleton__title" />
      <div className="explorer-skeleton__filters" />
      <div className="explorer-skeleton__results" />
    </main>
  );
}
