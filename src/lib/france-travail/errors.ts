export type FranceTravailErrorCode =
  | "authentication_failed"
  | "contract_invalid"
  | "http_error"
  | "pagination_invalid"
  | "response_invalid";

export class FranceTravailError extends Error {
  override readonly name = "FranceTravailError";

  constructor(
    message: string,
    readonly code: FranceTravailErrorCode,
    readonly retryable: boolean,
    readonly statusCode: number | null = null,
  ) {
    super(message);
  }
}
