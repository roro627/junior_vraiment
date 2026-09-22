export function isStorageText(value: string): boolean {
  return !value.includes("\u0000") && value.isWellFormed();
}

// Loose source fields are retained in JSONB, including their property names.
export function hasStorageCompatibleText(value: unknown): boolean {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === "string" && !isStorageText(current)) return false;
    if (current !== null && typeof current === "object") {
      for (const [key, child] of Object.entries(current)) {
        if (!isStorageText(key)) return false;
        pending.push(child);
      }
    }
  }
  return true;
}
