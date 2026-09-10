import { DataFreshnessBadge } from "./data-freshness-badge";
import { PilotHeader } from "./home-pilot/pilot-primitives";

type AppHeaderProps = {
  freshness?: "fresh" | "delayed" | "stale" | "partial" | "incident";
  dataAsOf?: string | null;
};

export function AppHeader({ freshness, dataAsOf = null }: AppHeaderProps) {
  return (
    <>
      <PilotHeader home={false} />
      {freshness ? (
        <div className="pilot-container site-freshness">
          <DataFreshnessBadge freshness={freshness} dataAsOf={dataAsOf} />
        </div>
      ) : null}
    </>
  );
}
