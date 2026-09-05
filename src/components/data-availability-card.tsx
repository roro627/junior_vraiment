export function DataAvailabilityCard() {
  return (
    <section className="availability-card" aria-labelledby="availability-title">
      <div>
        <p className="availability-label">Indicateur principal</p>
        <h2 id="availability-title">Pas assez de données</h2>
        <p className="availability-description">
          Une valeur apparaîtra lorsque le seuil méthodologique sera atteint.
        </p>
      </div>
      <span className="availability-badge">Publication suspendue</span>
    </section>
  );
}
