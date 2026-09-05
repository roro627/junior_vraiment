"use client";

import { useEffect } from "react";

import { readSentryClientEnvironment } from "@/lib/env.client";

const sentry = readSentryClientEnvironment();

type ErrorFallbackProps = Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>;

export function ErrorFallback({ error, retry }: ErrorFallbackProps) {
  useEffect(() => {
    if (!sentry.enabled) return;
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <main className="fatal-error" id="contenu">
      <div className="fatal-error__card" role="alert">
        <p className="eyebrow">Incident temporaire</p>
        <h1>Cette page n’a pas pu être chargée.</h1>
        <p>
          Les données déjà publiées ne sont pas modifiées. Réessayez, ou
          consultez l’état des données si le problème persiste.
        </p>
        <div className="fatal-error__actions">
          <button className="button" type="button" onClick={retry}>
            Réessayer
          </button>
          <a className="button button--secondary" href="/statut-donnees">
            État des données
          </a>
        </div>
      </div>
    </main>
  );
}
