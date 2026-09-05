import "server-only";

import { readFranceTravailEnvironment } from "@/lib/env";

import { FranceTravailClient, type FranceTravailClientOptions } from "./client";

export function createFranceTravailClient(
  options: FranceTravailClientOptions = {},
): FranceTravailClient {
  return new FranceTravailClient(readFranceTravailEnvironment(), options);
}
