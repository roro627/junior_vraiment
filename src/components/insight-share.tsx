"use client";

import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  captureAnalyticsEvent,
  type AnalyticsContext,
} from "@/lib/analytics/client";

import { Button } from "./ui/button";

type InsightShareProps = {
  slug: string;
  title: string;
  summary: string;
  canonicalUrl: string;
  analyticsContext: AnalyticsContext;
};

export function InsightShare({
  slug,
  title,
  summary,
  canonicalUrl,
  analyticsContext,
}: InsightShareProps) {
  const suggestedText = useMemo(
    () =>
      `${title}\n\n${summary}\n\nMéthode, période et offres vérifiables :\n${canonicalUrl}`,
    [canonicalUrl, summary, title],
  );
  const [shareText, setShareText] = useState(suggestedText);
  const [status, setStatus] = useState("");

  async function copy(value: string): Promise<boolean> {
    if (!navigator.clipboard) {
      setStatus(
        "La copie automatique n’est pas disponible dans ce navigateur.",
      );
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      setStatus("La copie a échoué. Sélectionnez le texte manuellement.");
      return false;
    }
  }

  async function copyLink() {
    if (!(await copy(canonicalUrl))) return;
    setStatus("Lien copié.");
    captureAnalyticsEvent(
      {
        name: "insight_shared",
        properties: { insight_slug: slug, share_method: "copy_link" },
      },
      analyticsContext,
    );
  }

  async function share() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title, text: shareText, url: canonicalUrl });
      setStatus("Partage ouvert.");
      captureAnalyticsEvent(
        {
          name: "insight_shared",
          properties: { insight_slug: slug, share_method: "native_share" },
        },
        analyticsContext,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Le partage natif n’a pas pu être ouvert.");
    }
  }

  function shareOnLinkedIn() {
    const trackedUrl = new URL(canonicalUrl);
    trackedUrl.searchParams.set("utm_source", "linkedin");
    trackedUrl.searchParams.set("utm_medium", "social");
    trackedUrl.searchParams.set("utm_campaign", "insight_share");
    trackedUrl.searchParams.set("utm_content", slug);
    const shareUrl = new URL("https://www.linkedin.com/sharing/share-offsite/");
    shareUrl.searchParams.set("url", trackedUrl.toString());

    window.open(shareUrl, "_blank", "noopener,noreferrer");
    setStatus("Fenêtre LinkedIn ouverte.");
    captureAnalyticsEvent(
      {
        name: "insight_shared",
        properties: { insight_slug: slug, share_method: "linkedin" },
      },
      analyticsContext,
    );
  }

  return (
    <section className="insight-share" aria-labelledby="partager-insight">
      <div>
        <p className="section-label">Faire circuler le constat</p>
        <h2 id="partager-insight">Partager avec tout le contexte</h2>
      </div>
      <label htmlFor="share-copy">Texte suggéré, modifiable</label>
      <textarea
        id="share-copy"
        value={shareText}
        onChange={(event) => setShareText(event.target.value)}
        rows={7}
      />
      <div className="insight-share__actions">
        <Button type="button" onClick={copyLink} variant="outline">
          {status === "Lien copié." ? <Check /> : <Copy />} Copier le lien
        </Button>
        <Button type="button" onClick={share}>
          <Share2 /> Partager
        </Button>
        <Button type="button" onClick={shareOnLinkedIn} variant="secondary">
          <ExternalLink /> LinkedIn
        </Button>
      </div>
      <p className="insight-share__status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
