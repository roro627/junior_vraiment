"use client";

import { FileSearch } from "lucide-react";
import { useRef, useState } from "react";

import type { PublicOffer } from "@/application/queries/contracts";
import type { AnalyticsContext } from "@/lib/analytics/client";
import {
  analyticsClassificationLabel,
  analyticsRankBucket,
  primaryAnalyticsEvidenceKind,
} from "@/lib/analytics/offer-events";

import { useAnalyticsCapture } from "./providers/analytics-provider";
import { Button } from "./ui/button";

type EvidencePanelProps = {
  offer: PublicOffer;
  rank: number;
  analyticsContext: AnalyticsContext;
};

type EvidenceDialogComponent =
  (typeof import("./evidence-dialog"))["EvidenceDialog"];

export function EvidencePanel({
  offer,
  rank,
  analyticsContext,
}: EvidencePanelProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [Dialog, setDialog] = useState<EvidenceDialogComponent | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const capture = useAnalyticsCapture();

  async function openEvidence() {
    setFailed(false);
    setLoading(true);
    try {
      // The closed panel needs no focus trap, portal or detailed proof renderer.
      const { EvidenceDialog } = await import("./evidence-dialog");
      setDialog(() => EvidenceDialog);
      setOpen(true);
      const classification = analyticsClassificationLabel(offer);
      capture(
        {
          name: "offer_opened",
          properties: {
            classification,
            entry_point: "offer_table",
            rank_bucket: analyticsRankBucket(rank),
          },
        },
        analyticsContext,
      );
      const evidenceKind = primaryAnalyticsEvidenceKind(offer);
      if (evidenceKind) {
        capture(
          {
            name: "evidence_expanded",
            properties: { classification, evidence_kind: evidenceKind },
          },
          analyticsContext,
        );
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={loading}
        disabled={loading}
        onClick={() => void openEvidence()}
      >
        <FileSearch data-icon="inline-start" />{" "}
        {loading ? "Ouverture…" : "Voir la preuve"}
      </Button>
      {failed ? (
        <span role="status">Impossible d’ouvrir les preuves. Réessayez.</span>
      ) : null}
      {Dialog ? (
        <Dialog
          open={open}
          offer={offer}
          analyticsContext={analyticsContext}
          onClose={() => setOpen(false)}
          returnFocus={() => triggerRef.current?.focus()}
        />
      ) : null}
    </>
  );
}
