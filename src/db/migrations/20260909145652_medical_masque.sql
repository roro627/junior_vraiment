ALTER TABLE "classifications" ADD COLUMN "junior_observation_version" text;--> statement-breakpoint
ALTER TABLE "classifications" ADD COLUMN "junior_observation_status" text;--> statement-breakpoint
ALTER TABLE "classifications" ADD COLUMN "junior_observation_contradictory" boolean;--> statement-breakpoint
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_junior_observation_check" CHECK (
      ("classifications"."junior_observation_version" is null and "classifications"."junior_observation_status" is null and "classifications"."junior_observation_contradictory" is null)
      or ("classifications"."junior_observation_version" is not null and length("classifications"."junior_observation_version") > 0
        and "classifications"."junior_observation_status" is not null and "classifications"."junior_observation_status" in ('resolved', 'unknown', 'ambiguous')
        and (("classifications"."junior_observation_status" = 'resolved' and "classifications"."junior_observation_contradictory" is not null
          and "classifications"."claims_junior" is true and "classifications"."minimum_experience_months" is not null
          and (("classifications"."junior_observation_contradictory" is true and "classifications"."minimum_experience_months" >= 24)
            or ("classifications"."junior_observation_contradictory" is false and "classifications"."minimum_experience_months" < 24)))
          or ("classifications"."junior_observation_status" <> 'resolved' and "classifications"."junior_observation_contradictory" is null)))
    );