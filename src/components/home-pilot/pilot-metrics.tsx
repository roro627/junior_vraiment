import type { OverviewResponse } from "@/application/queries/contracts";
import { formatInteger, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PilotMetrics({
  sampleSize,
  beginnerFriendly,
  salaryTransparency,
}: {
  sampleSize: number;
  beginnerFriendly: OverviewResponse["data"]["beginnerFriendly"];
  salaryTransparency: OverviewResponse["data"]["salaryTransparency"];
}) {
  return (
    <section
      className="pilot-container pilot-metrics"
      aria-label="Indicateurs complémentaires"
    >
      <div className="pilot-metric">
        <p className="pilot-metric__number">{formatInteger(sampleSize)}</p>
        <h2>Offres analysées</h2>
        <p className="pilot-metric__detail">
          Offres distinctes du périmètre sélectionné.
        </p>
      </div>
      <div className="pilot-metric">
        <p
          className={cn(
            "pilot-metric__number",
            beginnerFriendly.value === null && "pilot-metric__number--empty",
          )}
        >
          {formatRate(beginnerFriendly.value) ?? "Pas assez de données"}
        </p>
        <h2>
          <a href="/methodologie#accessible">Accessibles aux débutants</a>
        </h2>
        <p className="pilot-metric__detail">
          {formatInteger(beginnerFriendly.numerator)} sur{" "}
          {formatInteger(beginnerFriendly.denominator)} offres classables
          <br />
          Couverture :{" "}
          {formatRate(beginnerFriendly.coverage) ?? "non calculable"}
        </p>
      </div>
      <div className="pilot-metric">
        <p
          className={cn(
            "pilot-metric__number",
            salaryTransparency.value === null && "pilot-metric__number--empty",
          )}
        >
          {formatRate(salaryTransparency.value) ?? "Pas assez de données"}
        </p>
        <h2>
          <a href="/methodologie#salaire">Salaire affiché</a>
        </h2>
        <p className="pilot-metric__detail">
          {formatInteger(salaryTransparency.numerator)} sur{" "}
          {formatInteger(salaryTransparency.denominator)} offres
          <br />
          Couverture :{" "}
          {formatRate(salaryTransparency.coverage) ?? "non calculable"}
        </p>
      </div>
    </section>
  );
}
