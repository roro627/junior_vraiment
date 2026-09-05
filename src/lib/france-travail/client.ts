import { z } from "zod";

import type { FranceTravailEnvironment } from "@/lib/env";

import { FranceTravailError } from "./errors";
import {
  franceTravailOccupationListSchema,
  franceTravailOfferSchema,
  franceTravailTokenSchema,
  type FranceTravailOccupation,
  type FranceTravailOffer,
  type QuarantinedOffer,
  type SourceSearchValidation,
  validateSourceSearchPage,
} from "./schemas";

const searchParametersSchema = z.strictObject({
  grandDomainReference: z
    .string()
    .regex(/^[A-Z]\d{2}$/u)
    .optional(),
  occupationReference: z
    .string()
    .regex(/^[A-Z]\d{4}$/u)
    .optional(),
  keyword: z.string().trim().min(2).optional(),
  rangeStart: z.number().int().min(0).max(3000).default(0),
  rangeSize: z.number().int().min(1).max(150).default(150),
});

export type FranceTravailSearchParameters = z.input<
  typeof searchParametersSchema
>;

export type FranceTravailSourcePage = {
  items: FranceTravailOffer[];
  nextRange: string | null;
  total: number;
  validationStatus: SourceSearchValidation["status"];
  warnings: SourceSearchValidation["warnings"];
  quarantined: QuarantinedOffer[];
};

type TokenCache = {
  value: string;
  refreshAt: number;
};

export type FranceTravailClientOptions = {
  fetchImplementation?: typeof fetch;
  now?: () => number;
};

export type FranceTravailRequestOptions = {
  signal?: AbortSignal;
};

type ParsedContentRange = {
  start: number;
  end: number;
  total: number;
};

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function parseContentRange(value: string | null): ParsedContentRange {
  const match = /^offres (\d+)-(\d+)\/(\d+)$/u.exec(value ?? "");

  if (!match) {
    throw new FranceTravailError(
      "L’en-tête Content-Range France Travail est absent ou invalide.",
      "pagination_invalid",
      false,
    );
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);

  if (end < start || total < 0) {
    throw new FranceTravailError(
      "La plage de pagination France Travail est incohérente.",
      "pagination_invalid",
      false,
    );
  }

  return { start, end, total };
}

export class FranceTravailClient {
  private tokenCache: TokenCache | null = null;
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => number;

  constructor(
    private readonly environment: FranceTravailEnvironment,
    options: FranceTravailClientOptions = {},
  ) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async search(
    parameters: FranceTravailSearchParameters,
    options: FranceTravailRequestOptions = {},
  ): Promise<FranceTravailSourcePage> {
    const parsedParameters = searchParametersSchema.parse(parameters);
    const rangeEnd =
      parsedParameters.rangeStart + parsedParameters.rangeSize - 1;

    if (rangeEnd > 3149) {
      throw new FranceTravailError(
        "La plage demandée dépasse la borne France Travail 0-3149.",
        "pagination_invalid",
        false,
      );
    }

    const url = this.createApiUrl("v2/offres/search");
    url.searchParams.set("sort", "1");
    url.searchParams.set("range", `${parsedParameters.rangeStart}-${rangeEnd}`);

    if (parsedParameters.occupationReference) {
      url.searchParams.set("codeROME", parsedParameters.occupationReference);
    }

    if (parsedParameters.grandDomainReference) {
      url.searchParams.set(
        "grandDomaine",
        parsedParameters.grandDomainReference,
      );
    }

    if (parsedParameters.keyword) {
      url.searchParams.set("motsCles", parsedParameters.keyword);
    }

    const response = await this.authorizedRequest(url, {
      headers: { Range: `offres=${parsedParameters.rangeStart}-${rangeEnd}` },
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (response.status === 204) {
      return {
        items: [],
        nextRange: null,
        total: 0,
        validationStatus: "valid",
        warnings: [],
        quarantined: [],
      };
    }
    const payload: unknown = await this.readJson(response);
    const validation = validateSourceSearchPage(payload);

    if (validation.status === "invalid_quarantined") {
      throw new FranceTravailError(
        "La réponse de recherche France Travail ne respecte pas le contrat racine.",
        "contract_invalid",
        false,
      );
    }

    const contentRange = parseContentRange(
      response.headers.get("content-range"),
    );
    const nextStart = contentRange.end + 1;
    const nextEnd = Math.min(nextStart + parsedParameters.rangeSize - 1, 3149);
    const nextRange =
      nextStart < contentRange.total && nextStart <= 3000
        ? `${nextStart}-${nextEnd}`
        : null;

    return {
      items: validation.offers,
      nextRange,
      total: contentRange.total,
      validationStatus: validation.status,
      warnings: validation.warnings,
      quarantined: validation.quarantined,
    };
  }

  async getById(
    id: string,
    options: FranceTravailRequestOptions = {},
  ): Promise<FranceTravailOffer> {
    const normalizedId = z.string().trim().min(1).parse(id);
    const response = await this.authorizedRequest(
      this.createApiUrl(`v2/offres/${encodeURIComponent(normalizedId)}`),
      options.signal ? { signal: options.signal } : {},
    );
    const payload: unknown = await this.readJson(response);
    const result = franceTravailOfferSchema.safeParse(payload);

    if (!result.success) {
      throw new FranceTravailError(
        "La réponse de détail France Travail ne respecte pas le contrat attendu.",
        "contract_invalid",
        false,
      );
    }

    return result.data;
  }

  async getReferenceData(
    options: FranceTravailRequestOptions = {},
  ): Promise<FranceTravailOccupation[]> {
    const response = await this.authorizedRequest(
      this.createApiUrl("v2/referentiel/metiers"),
      options.signal ? { signal: options.signal } : {},
    );
    const payload: unknown = await this.readJson(response);
    const result = franceTravailOccupationListSchema.safeParse(payload);

    if (!result.success) {
      throw new FranceTravailError(
        "Le référentiel métiers France Travail ne respecte pas le contrat attendu.",
        "contract_invalid",
        false,
      );
    }

    return result.data;
  }

  private createApiUrl(path: string): URL {
    return new URL(
      path,
      withTrailingSlash(this.environment.FRANCE_TRAVAIL_API_BASE_URL),
    );
  }

  private async authorizedRequest(
    url: URL,
    init: RequestInit = {},
  ): Promise<Response> {
    let response = await this.fetchWithToken(url, init, false);

    if (response.status === 401) {
      this.tokenCache = null;
      response = await this.fetchWithToken(url, init, true);
    }

    if (!response.ok) {
      throw new FranceTravailError(
        `France Travail a répondu avec le statut HTTP ${response.status}.`,
        "http_error",
        response.status === 429 || response.status >= 500,
        response.status,
      );
    }

    return response;
  }

  private async fetchWithToken(
    url: URL,
    init: RequestInit,
    forceRefresh: boolean,
  ): Promise<Response> {
    const token = await this.getAccessToken(forceRefresh);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");

    return this.fetchImplementation(url, { ...init, headers });
  }

  private async getAccessToken(forceRefresh: boolean): Promise<string> {
    if (
      !forceRefresh &&
      this.tokenCache &&
      this.tokenCache.refreshAt > this.now()
    ) {
      return this.tokenCache.value;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.environment.FRANCE_TRAVAIL_CLIENT_ID,
      client_secret: this.environment.FRANCE_TRAVAIL_CLIENT_SECRET,
      scope: "api_offresdemploiv2 o2dsoffre",
    });
    const response = await this.fetchImplementation(
      this.environment.FRANCE_TRAVAIL_TOKEN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );

    if (!response.ok) {
      throw new FranceTravailError(
        `L’authentification France Travail a échoué avec le statut HTTP ${response.status}.`,
        "authentication_failed",
        response.status === 429 || response.status >= 500,
        response.status,
      );
    }

    const payload: unknown = await this.readJson(response);
    const tokenResult = franceTravailTokenSchema.safeParse(payload);

    if (
      !tokenResult.success ||
      tokenResult.data.token_type.toLowerCase() !== "bearer"
    ) {
      throw new FranceTravailError(
        "La réponse d’authentification France Travail est invalide.",
        "response_invalid",
        false,
      );
    }

    this.tokenCache = {
      value: tokenResult.data.access_token,
      refreshAt:
        this.now() + Math.max(tokenResult.data.expires_in - 60, 1) * 1000,
    };

    return this.tokenCache.value;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new FranceTravailError(
        "France Travail a renvoyé une réponse qui n’est pas du JSON valide.",
        "response_invalid",
        false,
        response.status,
      );
    }
  }
}
