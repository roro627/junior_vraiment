export type OperationalSample = Readonly<{
  members: number;
  ambiguous: number;
  durationMs: number;
}>;

/** Prior samples must be distinct days under the same query/classifier versions. */
export function assessOperationalChanges(
  current: OperationalSample,
  previous: readonly OperationalSample[],
): string[] {
  for (const sample of [current, ...previous]) {
    if (
      ![sample.members, sample.ambiguous, sample.durationMs].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      ) ||
      sample.ambiguous > sample.members
    ) {
      throw new RangeError("Invalid operational aggregate");
    }
  }
  const reasons: string[] = [];
  const prior = previous[0];
  if (prior && prior.members > 0 && current.members * 100 < prior.members * 60)
    reasons.push("VOLUME_DROP_OVER_40_PERCENT");
  if (
    prior &&
    prior.members > 0 &&
    prior.ambiguous > 0 &&
    current.members > 0 &&
    current.ambiguous / current.members > (2 * prior.ambiguous) / prior.members
  )
    reasons.push("AMBIGUITY_MORE_THAN_DOUBLED");
  if (previous.length >= 7) {
    const durations = previous
      .slice(0, 7)
      .map((sample) => sample.durationMs)
      .sort((a, b) => a - b);
    const median = durations[3]!;
    if (median > 0 && current.durationMs > 2 * median)
      reasons.push("DURATION_OVER_TWICE_SEVEN_DAY_MEDIAN");
  }
  return reasons;
}

export const OPERATIONAL_MESSAGES: Readonly<Record<string, string>> = {
  DATA_NOT_FRESH: "La mise à jour des données est retardée.",
  LAST_RUN_NOT_SUCCEEDED:
    "La dernière collecte complète n’a pas abouti normalement ; le dernier jeu validé est conservé.",
  DATA_OLDER_THAN_30H:
    "Les données publiées n’ont pas été actualisées depuis plus de 30 heures.",
  NO_SUCCESS_WITHIN_30H:
    "Aucune collecte complète réussie n’a été confirmée depuis 30 heures.",
  STATUS_RESPONSE_STALE:
    "La fraîcheur du contrôle de disponibilité ne peut pas être confirmée.",
  INCOMPLETE_QUERIES:
    "Une partie des recherches de la dernière collecte est incomplète.",
  VALIDATION_BELOW_98_PERCENT:
    "Le taux de validation de la dernière collecte est insuffisant.",
  VOLUME_DROP_OVER_40_PERCENT:
    "Le volume observé a fortement diminué à périmètre comparable ; une vérification est en cours.",
  AMBIGUITY_MORE_THAN_DOUBLED:
    "La part d’offres ambiguës a augmenté à méthode comparable ; une vérification est en cours.",
  DURATION_OVER_TWICE_SEVEN_DAY_MEDIAN:
    "La durée de collecte dépasse son niveau habituel.",
};
