import { Skeleton } from "./ui/skeleton";

export function HomeSkeleton() {
  return (
    <section
      className="home-dashboard__loading"
      aria-busy="true"
      aria-label="Chargement des données"
    >
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
      <div className="dashboard-grid">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </section>
  );
}
