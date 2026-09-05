export type NormalizedText = {
  value: string;
  sourceIndexByNormalizedIndex: number[];
};

export function normalizeTextForMatching(source: string): NormalizedText {
  let value = "";
  const sourceIndexByNormalizedIndex: number[] = [];
  let previousWasSpace = false;

  for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
    const character = source[sourceIndex] ?? "";
    const normalizedCharacter = character
      .normalize("NFKC")
      .toLocaleLowerCase("fr-FR")
      .replace(/[’‘`]/g, "'");

    for (const normalizedUnit of normalizedCharacter) {
      const isSpace = /\s/u.test(normalizedUnit);
      if (isSpace && previousWasSpace) {
        continue;
      }

      value += isSpace ? " " : normalizedUnit;
      sourceIndexByNormalizedIndex.push(sourceIndex);
      previousWasSpace = isSpace;
    }
  }

  return { value, sourceIndexByNormalizedIndex };
}

export function sourceRangeForNormalizedMatch(
  normalized: NormalizedText,
  start: number,
  end: number,
): { start: number; end: number } {
  const sourceStart = normalized.sourceIndexByNormalizedIndex[start] ?? start;
  const lastNormalizedIndex = Math.max(start, end - 1);
  const sourceEnd =
    (normalized.sourceIndexByNormalizedIndex[lastNormalizedIndex] ??
      lastNormalizedIndex) + 1;

  return { start: sourceStart, end: sourceEnd };
}
