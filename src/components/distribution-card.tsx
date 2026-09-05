import type { CSSProperties } from "react";

import { formatInteger, formatRate } from "@/lib/format";

type DistributionItem = {
  key: string;
  label: string;
  count: number;
  share: number | null;
};

type DistributionCardProps = {
  id: string;
  title: string;
  items: readonly DistributionItem[];
  description: string;
};

export function DistributionCard({
  id,
  title,
  items,
  description,
}: DistributionCardProps) {
  return (
    <section
      className="distribution-card"
      aria-labelledby={`distribution-${id}`}
    >
      <header>
        <h2 id={`distribution-${id}`}>{title}</h2>
        <p>{description}</p>
      </header>
      <ul className="distribution-list">
        {items.map((item) => (
          <li key={item.key}>
            <div className="distribution-list__label">
              <span>{item.label}</span>
              <span>
                {formatInteger(item.count)}
                {item.share === null ? "" : ` · ${formatRate(item.share)}`}
              </span>
            </div>
            <span
              aria-hidden="true"
              className="distribution-list__track"
              style={
                {
                  "--distribution-share": `${Math.max(2, (item.share ?? 0) * 100)}%`,
                } as CSSProperties
              }
            >
              <span />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
