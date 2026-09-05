import { queue } from "@trigger.dev/sdk";

export const datasetPublicationQueue = queue({
  name: "dataset-publication",
  concurrencyLimit: 1,
});
