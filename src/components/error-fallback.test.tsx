import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorFallback } from "./error-fallback";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("@/lib/env.client", () => ({
  readSentryClientEnvironment: () => ({
    enabled: true,
    dsn: "https://public@example.ingest.sentry.io/42",
    environment: "test",
  }),
}));

afterEach(() => {
  cleanup();
  captureException.mockClear();
});

describe("ErrorFallback", () => {
  it("reports the failure and exposes a keyboard-operable retry", async () => {
    const retry = vi.fn();
    const error = new Error("incident test");
    const user = userEvent.setup();

    render(<ErrorFallback error={error} retry={retry} />);

    await waitFor(() => expect(captureException).toHaveBeenCalledWith(error));
    const button = screen.getByRole("button", { name: "Réessayer" });
    button.focus();
    await user.keyboard("{Enter}");

    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "État des données" }),
    ).toHaveAttribute("href", "/statut-donnees");
  });
});
