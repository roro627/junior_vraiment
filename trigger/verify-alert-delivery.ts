import { AbortTaskRunError, task } from "@trigger.dev/sdk";

/** Manual game day only: no schedule, no source call, no database access. */
export const verifyAlertDeliveryTask = task({
  id: "verify-alert-delivery",
  maxDuration: 30,
  retry: { maxAttempts: 1 },
  run: async (payload: { confirmation?: string }) => {
    if (payload.confirmation !== "SEND_IDENTIFIED_TEST_ALERT")
      return { testTriggered: false };
    throw new AbortTaskRunError(
      "TEST_ALERTE_JUNIOR_VRAIMENT — exercice autorisé ; aucune donnée publique modifiée.",
    );
  },
});
