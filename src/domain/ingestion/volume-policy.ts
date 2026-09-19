export type PartitionVolume = Readonly<{
  queryId: string;
  previous: number;
  current: number;
  missingFromRun?: number | undefined;
}>;

// An engineering noise floor, not a statistical confidence threshold.
const MINIMUM_BLOCKING_CHANGE = 5;

export function assessPartitionVolumes(partitions: readonly PartitionVolume[]) {
  const warnings: PartitionVolume[] = [];
  let blocking = false;
  for (const partition of partitions) {
    const { previous, current } = partition;
    if (
      ![previous, current].every(
        (count) => Number.isSafeInteger(count) && count >= 0,
      )
    ) {
      throw new RangeError(
        "Les volumes doivent être des entiers positifs ou nuls.",
      );
    }
    if (
      partition.missingFromRun !== undefined &&
      (!Number.isSafeInteger(partition.missingFromRun) ||
        partition.missingFromRun < 0 ||
        partition.missingFromRun > previous)
    ) {
      throw new RangeError("Le nombre d'offres absentes du run est invalide.");
    }
    const delta = current - previous;
    if (previous === 0 || Math.abs(delta) * 100 <= previous * 60) continue;
    // Growth in overlapping keyword partitions does not prove lost coverage.
    // Keep it auditable; the independent global-volume and integrity gates remain.
    // Queries overlap. An offer observed through another completed query is not
    // lost from the collection. Missing coverage evidence stays conservative.
    const missingFromRun = partition.missingFromRun ?? Math.abs(delta);
    if (
      delta > 0 ||
      Math.abs(delta) < MINIMUM_BLOCKING_CHANGE ||
      missingFromRun < MINIMUM_BLOCKING_CHANGE
    ) {
      warnings.push(partition);
    } else {
      blocking = true;
    }
  }
  return { blocking, warnings };
}
