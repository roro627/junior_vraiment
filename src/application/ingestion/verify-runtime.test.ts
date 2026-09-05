import { describe, expect, it } from "vitest";

import {
  assertHealthyRuntime,
  createVerifyRuntimeIdempotencyKey,
  RuntimeVerificationError,
  verifyRuntimeEnvironment,
} from "./verify-runtime";

const completeEnvironment = {
  APP_ENV: "test",
  DATABASE_URL: "postgresql://database.example/app",
  DATABASE_DIRECT_URL: "postgresql://database-direct.example/app",
  FRANCE_TRAVAIL_CLIENT_ID: "client-id",
  FRANCE_TRAVAIL_CLIENT_SECRET: "client-secret",
  FRANCE_TRAVAIL_TOKEN_URL: "https://auth.example/token",
  FRANCE_TRAVAIL_API_BASE_URL: "https://api.example",
  INGESTION_REQUESTS_PER_SECOND: "5",
  REVALIDATION_URL: "https://app.example/api/internal/revalidate",
  REVALIDATION_SECRET: "revalidation-secret",
} as const;

describe("Trigger.dev runtime verification", () => {
  it("reports a healthy supported worker without returning secret values", () => {
    const verification = verifyRuntimeEnvironment({
      environment: completeEnvironment,
      nodeVersion: "22.16.0",
    });

    expect(verification).toEqual({
      healthy: true,
      appEnvironment: "test",
      nodeVersion: "22.16.0",
      nodeMajor: 22,
      checkedEnvironmentVariableCount: 9,
      missingEnvironmentNames: [],
      problems: [],
    });
    expect(JSON.stringify(verification)).not.toContain("client-secret");
    expect(JSON.stringify(verification)).not.toContain("revalidation-secret");
  });

  it("lists missing variable names and rejects an unsupported runtime", () => {
    const verification = verifyRuntimeEnvironment({
      environment: {},
      nodeVersion: "20.19.0",
    });

    expect(verification.healthy).toBe(false);
    expect(verification.missingEnvironmentNames).toContain("DATABASE_URL");
    expect(verification.problems).toContain(
      "Node.js 22 ou supérieur est requis.",
    );
    expect(() =>
      assertHealthyRuntime({ environment: {}, nodeVersion: "20.19.0" }),
    ).toThrow(RuntimeVerificationError);
  });

  it("builds a stable idempotency key from non-secret deployment context", () => {
    expect(
      createVerifyRuntimeIdempotencyKey({
        appEnvironment: "production",
        deploymentVersion: "2026-09-04.1",
      }),
    ).toBe("verify-runtime:production:2026-09-04.1");
  });
});
