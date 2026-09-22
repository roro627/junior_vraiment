// @vitest-environment node
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { readDatabaseEnvironment, readToolEnvironment } from "@/lib/env";
import { validateSourceSearchPage } from "@/lib/france-travail/schemas";
import { normalizeFranceTravailOffer } from "@/lib/france-travail/normalize";
import { classifyOffer } from "@/domain/classification/classifier";
import { offersSearchParamsSchema } from "@/application/queries/contracts";
import { storeNormalizedOffer } from "./store-normalized-offer";
import { storeClassification } from "./store-classification";
import { getPublicOffers } from "./queries/public-offers";
import { readCurrentDataset } from "./queries/current-dataset";

vi.mock("./queries/current-dataset", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./queries/current-dataset")>();
  return {
    ...original,
    readCurrentDataset: vi.fn(original.readCurrentDataset),
  };
});

describe.runIf(readToolEnvironment().RUN_LIVE_DATABASE === "1")(
  "security boundaries on isolated PostgreSQL fixtures",
  () => {
    it("quarantines incompatible offers, stores valid/encoded text idempotently and masks a closed historical member", async () => {
      const sql = neon(readDatabaseEnvironment().DATABASE_DIRECT_URL);
      const current = await readCurrentDataset(sql);
      const suffix = randomUUID();
      const offerIds: string[] = [];
      let datasetId: string | undefined;
      const now = new Date("2098-05-01T00:00:00Z");
      const source = {
        id: "security-" + suffix,
        intitule: "Développeur junior",
        description: "2 ans d'expérience requis &#0; &#x110000; &#X1F600;",
        entreprise: { nom: "Entreprise synthétique" },
        lieuTravail: { libelle: "Lieu synthétique" },
        origineOffre: { urlOrigine: "https://example.invalid/security" },
      };
      const page = validateSourceSearchPage({
        resultats: [
          { ...source, contact: { nested: ["\u0000"] } },
          { ...source, unknown: { ["\ud800"]: true } },
          source,
          {
            ...source,
            id: source.id + "-valid",
            description: "Débutant accepté 😀",
          },
        ],
      });
      expect(page.quarantined).toHaveLength(2);
      expect(page.offers).toHaveLength(2);
      await sql.query("select $1::jsonb", [JSON.stringify(page.quarantined)]);
      try {
        for (const input of page.offers) {
          const offer = normalizeFranceTravailOffer(input);
          const stored = await storeNormalizedOffer({
            sql,
            sourceId: current.sourceId,
            offer,
            observedAt: now,
            rawPayloadRetentionDays: 1,
          });
          offerIds.push(stored.offerId);
          const retry = await storeNormalizedOffer({
            sql,
            sourceId: current.sourceId,
            offer,
            observedAt: now,
            rawPayloadRetentionDays: 1,
          });
          expect(retry.snapshotId).toBe(stored.snapshotId);
          expect(retry.snapshotCreated).toBe(false);
          await storeClassification({
            sql,
            snapshotId: stored.snapshotId,
            classification: classifyOffer(offer),
            classifiedAt: now,
          });
        }
        const [created] = await sql.query(
          "insert into published_datasets (dataset_version, source_id, ingestion_run_id, classifier_version, metric_versions, query_set_version, taxonomy_versions, source_cutoff_at, computed_at, published_at, status, is_current, quality_summary) select $1, source_id, ingestion_run_id, classifier_version, metric_versions, query_set_version, taxonomy_versions, $2, $2, $2, 'published', false, quality_summary from published_datasets where id = $3 returning id",
          ["security-" + suffix, now, current.datasetId],
        );
        datasetId = String(created!["id"]);
        await sql.query(
          "insert into published_dataset_offers(dataset_id, offer_id, snapshot_id, classification_id, job_families) select $1, snapshot.offer_id, snapshot.id, classification.id, '{}'::text[] from offer_snapshots snapshot join classifications classification on classification.snapshot_id=snapshot.id where snapshot.offer_id = $2 and snapshot.valid_to is null",
          [datasetId, offerIds[0]],
        );
        vi.mocked(readCurrentDataset).mockResolvedValue({
          ...current,
          datasetId,
          datasetVersion: "security-" + suffix,
          sourceCutoffAt: now,
        });
        const read = () =>
          getPublicOffers({
            sql,
            query: offersSearchParamsSchema.parse({ period: "current" }),
            cursorSecret: "synthetic-cursor-secret",
            generatedAt: now,
          });
        expect((await read()).data.items[0]).toMatchObject({
          availability: "active",
          companyName: "Entreprise synthétique",
          source: { offerUrl: source.origineOffre.urlOrigine },
        });
        await sql.query(
          "update offers set missing_since = $1, closed_at = $1 where id = $2",
          [now, offerIds[0]],
        );
        const closed = await read();
        expect(closed.data.items[0]).toMatchObject({
          availability: "closed",
          companyName: null,
          locationLabel: null,
          source: { offerUrl: null },
          classification: { contradictoryJunior: true },
        });
        expect(closed.data.items[0]?.evidence.length).toBeGreaterThan(0);
        expect(closed.meta.sampleSize).toBe(1);
        const [stillCurrent] = await sql.query(
          "select id from published_datasets where is_current = true",
          [],
        );
        expect(stillCurrent!["id"]).toBe(current.datasetId);
      } finally {
        vi.mocked(readCurrentDataset).mockReset();
        if (datasetId)
          await sql.query("delete from published_datasets where id = $1", [
            datasetId,
          ]);
        for (const offerId of offerIds)
          await sql.query("delete from offers where id = $1", [offerId]);
      }
    }, 60000);
  },
);
