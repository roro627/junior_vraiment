export type PartitionVolume = Readonly<{
  queryId: string;
  previous: number;
  current: number;
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
    const delta = current - previous;
    if (previous === 0 || Math.abs(delta) * 100 <= previous * 60) continue;
    if (Math.abs(delta) < MINIMUM_BLOCKING_CHANGE) {
      warnings.push(partition);
    } else {
      blocking = true;
    }
  }
  return { blocking, warnings };
}
