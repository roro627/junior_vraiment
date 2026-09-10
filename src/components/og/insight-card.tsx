import type { InsightOgModel } from "@/lib/seo/build-og-model";
import { ogTokens } from "@/styles/og-tokens";

export function InsightOgCard({ model }: { model: InsightOgModel }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "54px 64px",
        background: ogTokens.surface,
        color: ogTokens.ink,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 27,
          fontWeight: 700,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            height: 46,
            borderRadius: 11,
            background: ogTokens.brand,
            color: ogTokens.onBrand,
          }}
        >
          J
        </div>
        Junior, vraiment&nbsp;?
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 54 }}>
        <div
          style={{
            display: "flex",
            minWidth: 340,
            color: ogTokens.ink,
            fontSize: 132,
            fontWeight: 760,
            letterSpacing: "-8px",
            lineHeight: 1,
          }}
        >
          {model.value}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 17 }}>
          <div
            style={{
              display: "flex",
              maxWidth: 680,
              fontSize: 42,
              fontWeight: 690,
              letterSpacing: "-1.7px",
              lineHeight: 1.13,
            }}
          >
            {model.title}
          </div>
          <div style={{ display: "flex", color: ogTokens.muted, fontSize: 25 }}>
            {model.fraction} · {model.sample}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 24,
          borderTop: `1px solid ${ogTokens.border}`,
          color: ogTokens.muted,
          fontSize: 20,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <span>{model.territory}</span>
          <span>·</span>
          <span>{model.period}</span>
          <span>·</span>
          <span>{model.source}</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span>{model.method}</span>
          <span>·</span>
          <span>{model.domain}</span>
        </div>
      </div>
    </div>
  );
}
