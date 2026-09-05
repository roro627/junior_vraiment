const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("fr-FR");

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function formatRate(value: number | null): string | null {
  return value === null ? null : percentFormatter.format(value);
}

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatLongDate(value: string): string {
  return dateFormatter.format(new Date(value));
}
