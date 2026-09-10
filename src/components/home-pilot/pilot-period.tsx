import Link from "next/link";
import type { OverviewQuery } from "@/application/queries/contracts";
import { scopeParameters } from "./pilot-scope";

const periods = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
] as const;

export function PilotPeriod({ scope }: { scope: OverviewQuery }) {
  const options =
    scope.period === "current"
      ? [...periods, { value: "current" as const, label: "Jeu actuel" }]
      : periods;
  return (
    <nav className="pilot-period" aria-label="Période d’observation">
      {options.map(({ value, label }) => {
        const params = scopeParameters({ ...scope, period: value });
        return (
          <Link
            key={value}
            href={{ pathname: "/", query: Object.fromEntries(params) }}
            scroll={false}
            aria-current={scope.period === value ? "true" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
