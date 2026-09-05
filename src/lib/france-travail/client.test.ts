import { describe, expect, it } from "vitest";

import type { FranceTravailEnvironment } from "@/lib/env";
import observedFixture from "@/tests/fixtures/france-travail/search-page.observed-redacted.json" with { type: "json" };

import { FranceTravailClient } from "./client";

const environment: FranceTravailEnvironment = {
  FRANCE_TRAVAIL_CLIENT_ID: "test-client",
  FRANCE_TRAVAIL_CLIENT_SECRET: "test-secret",
  FRANCE_TRAVAIL_TOKEN_URL:
    "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire",
  FRANCE_TRAVAIL_API_BASE_URL:
    "https://api.francetravail.io/partenaire/offresdemploi",
  INGESTION_REQUESTS_PER_SECOND: 5,
};

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

describe("FranceTravailClient", () => {
  it("maps the observed 204 search response to an empty page", async () => {
    const client = new FranceTravailClient(environment, {
      fetchImplementation: async (input) => {
        const url = String(input);
        if (url.includes("access_token")) {
          return jsonResponse({
            access_token: "token",
            token_type: "Bearer",
            expires_in: 1499,
          });
        }
        return new Response(null, { status: 204 });
      },
    });

    await expect(client.search({ keyword: "aucun résultat" })).resolves.toEqual(
      {
        items: [],
        nextRange: null,
        total: 0,
        validationStatus: "valid",
        warnings: [],
        quarantined: [],
      },
    );
  });

  it("authenticates and encapsulates source pagination", async () => {
    const responses = [
      jsonResponse({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 1499,
      }),
      jsonResponse(observedFixture, {
        status: 206,
        headers: { "Content-Range": "offres 0-0/2" },
      }),
    ];
    const requestedUrls: string[] = [];
    const fetchImplementation: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      const response = responses.shift();
      if (!response) {
        throw new Error("Unexpected test request");
      }
      return response;
    };
    const client = new FranceTravailClient(environment, {
      fetchImplementation,
      now: () => 1_000,
    });

    const page = await client.search({
      grandDomainReference: "M18",
      occupationReference: "M1805",
      rangeSize: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(page.nextRange).toBe("1-1");
    expect(requestedUrls[1]).toContain("codeROME=M1805");
    expect(requestedUrls[1]).toContain("grandDomaine=M18");
    expect(requestedUrls[1]).toContain("range=0-0");
  });

  it("renews the token once after an unauthorized response", async () => {
    const responses = [
      jsonResponse({
        access_token: "first",
        token_type: "Bearer",
        expires_in: 1499,
      }),
      jsonResponse({}, { status: 401 }),
      jsonResponse({
        access_token: "second",
        token_type: "Bearer",
        expires_in: 1499,
      }),
      jsonResponse(observedFixture, {
        status: 206,
        headers: { "Content-Range": "offres 0-0/1" },
      }),
    ];
    let requestCount = 0;
    const fetchImplementation: typeof fetch = async () => {
      requestCount += 1;
      const response = responses.shift();
      if (!response) {
        throw new Error("Unexpected test request");
      }
      return response;
    };
    const client = new FranceTravailClient(environment, {
      fetchImplementation,
    });

    await expect(client.search({ rangeSize: 1 })).resolves.toMatchObject({
      total: 1,
    });
    expect(requestCount).toBe(4);
  });
});
