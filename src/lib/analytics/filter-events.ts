import type { AnalyticsEvent } from "./client";

type FilterChangedEvent = Extract<AnalyticsEvent, { name: "filter_changed" }>;

const trackedFields = [
  ["job", "job_family"],
  ["tech", "technology"],
  ["contract", "contract_type"],
  ["remote", "remote_mode"],
  ["period", "period"],
  ["classification", "classification"],
] as const satisfies ReadonlyArray<
  readonly [string, FilterChangedEvent["properties"]["filter_name"]]
>;

function areaFilterName(
  value: string,
): FilterChangedEvent["properties"]["filter_name"] {
  if (value.startsWith("department:")) return "department";
  if (value.startsWith("commune:")) return "city";
  return "region";
}

function normalizedValueId(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64)
    .replace(/-+$/gu, "");
}

function eventForValue(
  field: string,
  filterName: FilterChangedEvent["properties"]["filter_name"],
  value: string,
  action: FilterChangedEvent["properties"]["action"],
): FilterChangedEvent | null {
  const valueId = normalizedValueId(value);
  if (!valueId) return null;

  return {
    name: "filter_changed",
    properties: {
      filter_name: field === "area" ? areaFilterName(value) : filterName,
      action,
      value_id: valueId,
    },
  };
}

function eventsForChange(
  field: string,
  filterName: FilterChangedEvent["properties"]["filter_name"],
  before: string,
  after: string,
): FilterChangedEvent[] {
  if (before === after) return [];
  if (!before) {
    const event = eventForValue(field, filterName, after, "add");
    return event ? [event] : [];
  }
  if (!after) {
    const event = eventForValue(field, filterName, before, "clear");
    return event ? [event] : [];
  }

  return [
    eventForValue(field, filterName, before, "remove"),
    eventForValue(field, filterName, after, "add"),
  ].filter((event): event is FilterChangedEvent => event !== null);
}

export function buildFilterChangeEvents(
  initialValues: Readonly<Record<string, string>>,
  submittedValues: Readonly<Record<string, string>>,
): FilterChangedEvent[] {
  const events = trackedFields.flatMap(([field, filterName]) =>
    eventsForChange(
      field,
      filterName,
      initialValues[field] ?? "",
      submittedValues[field] ?? "",
    ),
  );
  events.push(
    ...eventsForChange(
      "area",
      "region",
      initialValues["area"] === "france" ? "" : (initialValues["area"] ?? ""),
      submittedValues["area"] === "france"
        ? ""
        : (submittedValues["area"] ?? ""),
    ),
  );
  return events;
}
