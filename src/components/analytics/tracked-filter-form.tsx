"use client";

import type { ComponentProps, FormEvent, ReactNode } from "react";

import { useAnalyticsCapture } from "@/components/providers/analytics-provider";
import type { AnalyticsContext } from "@/lib/analytics/client";
import { buildFilterChangeEvents } from "@/lib/analytics/filter-events";

type TrackedFilterFormProps = Omit<
  ComponentProps<"form">,
  "children" | "onSubmit"
> & {
  analyticsContext: AnalyticsContext;
  initialValues: Readonly<Record<string, string>>;
  children: ReactNode;
};

function submittedValues(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(
    [...new FormData(form).entries()]
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([name, value]) => [name, value]),
  );
}

export function TrackedFilterForm({
  analyticsContext,
  initialValues,
  children,
  ...formProps
}: TrackedFilterFormProps) {
  const capture = useAnalyticsCapture();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    for (const analyticsEvent of buildFilterChangeEvents(
      initialValues,
      submittedValues(event.currentTarget),
    )) {
      capture(analyticsEvent, analyticsContext);
    }
  }

  return (
    <form {...formProps} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
