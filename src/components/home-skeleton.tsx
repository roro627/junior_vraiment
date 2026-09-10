import { PilotIntroduction } from "./home-pilot/pilot-primitives";

export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement des données">
      <div className="pilot-container pilot-hero">
        <PilotIntroduction />
        <div className="pilot-headline pilot-loading">
          <p className="pilot-kicker">Lecture des dernières observations</p>
          <div className="pilot-loading__number" aria-hidden="true" />
          <p>Les chiffres arrivent, avec leur contexte.</p>
        </div>
        <div className="pilot-hero__meta">
          <span>Actualisation des données et de leur périmètre…</span>
        </div>
      </div>
      <div className="pilot-container pilot-metrics" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div className="pilot-metric pilot-loading__metric" key={index} />
        ))}
      </div>
    </div>
  );
}
