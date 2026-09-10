export function ExplorerSkeleton() {
  return (
    <div
      className="explorer__results-layout explorer-skeleton"
      aria-busy="true"
    >
      <span className="sr-only">Chargement des offres</span>
      <div className="explorer-skeleton__filters" />
      <div className="explorer-skeleton__results" />
    </div>
  );
}
