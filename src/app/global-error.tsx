"use client";

import { useEffect } from "react";

import { readSentryClientEnvironment } from "@/lib/env.client";

const sentry = readSentryClientEnvironment();

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>;

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    if (!sentry.enabled) return;
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          background: "#f9f8ff",
          color: "#14162b",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <title>Erreur temporaire — Junior, vraiment ?</title>
        <main
          style={{
            display: "grid",
            minHeight: "100vh",
            padding: "1rem",
            placeItems: "center",
          }}
        >
          <div style={{ maxWidth: "38rem" }} role="alert">
            <p>Junior, vraiment ?</p>
            <h1>Le site n’a pas pu être chargé.</h1>
            <p>
              Réessayez dans un instant. Aucune donnée publiée n’a été modifiée.
            </p>
            <button
              type="button"
              onClick={retry}
              style={{
                background: "#5d21d2",
                border: 0,
                borderRadius: "0.625rem",
                color: "white",
                cursor: "pointer",
                font: "inherit",
                minHeight: "2.75rem",
                padding: "0.75rem 1rem",
              }}
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
