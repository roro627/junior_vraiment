export const requiredWorkerEnvironmentNames = [
  "DATABASE_URL",
  "DATABASE_DIRECT_URL",
  "FRANCE_TRAVAIL_CLIENT_ID",
  "FRANCE_TRAVAIL_CLIENT_SECRET",
  "FRANCE_TRAVAIL_TOKEN_URL",
  "FRANCE_TRAVAIL_API_BASE_URL",
  "INGESTION_REQUESTS_PER_SECOND",
  "REVALIDATION_URL",
  "REVALIDATION_SECRET",
] as const;

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export type RuntimeVerification = Readonly<{
  healthy: boolean;
  appEnvironment: string;
  nodeVersion: string;
  nodeMajor: number | null;
  checkedEnvironmentVariableCount: number;
  missingEnvironmentNames: readonly string[];
  problems: readonly string[];
}>;

export class RuntimeVerificationError extends Error {
  readonly code = "RUNTIME_VERIFICATION_FAILED";

  constructor(readonly verification: RuntimeVerification) {
    super(
      `Runtime invalide : ${verification.problems.join(" ") || "cause inconnue"}`,
    );
    this.name = "RuntimeVerificationError";
  }
}

function parseNodeMajor(nodeVersion: string) {
  const [major] = nodeVersion.split(".");
  const parsed = Number.parseInt(major ?? "", 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function verifyRuntimeEnvironment(input: {
  environment: RuntimeEnvironment;
  nodeVersion: string;
}): RuntimeVerification {
  const missingEnvironmentNames = requiredWorkerEnvironmentNames.filter(
    (name) => !input.environment[name]?.trim(),
  );
  const nodeMajor = parseNodeMajor(input.nodeVersion);
  const problems: string[] = [];

  if (nodeMajor === null || nodeMajor < 22) {
    problems.push("Node.js 22 ou supérieur est requis.");
  }
  if (missingEnvironmentNames.length > 0) {
    problems.push(
      `Variables absentes : ${missingEnvironmentNames.join(", ")}.`,
    );
  }

  return {
    healthy: problems.length === 0,
    appEnvironment: input.environment["APP_ENV"]?.trim() || "development",
    nodeVersion: input.nodeVersion,
    nodeMajor,
    checkedEnvironmentVariableCount: requiredWorkerEnvironmentNames.length,
    missingEnvironmentNames,
    problems,
  };
}

export function assertHealthyRuntime(input: {
  environment: RuntimeEnvironment;
  nodeVersion: string;
}) {
  const verification = verifyRuntimeEnvironment(input);
  if (!verification.healthy) {
    throw new RuntimeVerificationError(verification);
  }

  return verification;
}

export function createVerifyRuntimeIdempotencyKey(input: {
  appEnvironment: string;
  deploymentVersion: string;
}) {
  return `verify-runtime:${input.appEnvironment}:${input.deploymentVersion}`;
}
