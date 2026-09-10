import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { readFileSync, realpathSync } from "node:fs";

// Use the SDK already pinned by the installed Trigger CLI, not another dependency.
// No default task, timestamp or run: a copied historical command must not replay work.
const [operation, target, attemptText, confirmation] = process.argv.slice(2);
const projectRef = readFileSync("trigger.config.ts", "utf8").match(
  /project:\s*"(proj_[a-z0-9]+)"/u,
)?.[1];
if (!projectRef) throw new Error("Trigger project is not configured.");

let call;
if (
  operation === "rollback" &&
  /^[a-zA-Z0-9][a-zA-Z0-9._:+-]{0,127}$/u.test(target ?? "") &&
  attemptText === "--confirm-rollback"
) {
  call = {
    name: "trigger_task",
    arguments: {
      projectRef,
      environment: "prod",
      taskId: "rollback-dataset",
      payload: {
        targetDatasetVersion: target,
        reasonCode: "PUBLICATION_CONTRACT_MISMATCH",
      },
    },
  };
} else if (operation === "worker") {
  call = {
    name: "get_current_worker",
    arguments: { projectRef, environment: "prod" },
  };
} else if (operation === "run" && /^run_[a-z0-9]+$/u.test(target ?? "")) {
  call = {
    name: "get_run_details",
    arguments: {
      projectRef,
      environment: "prod",
      runId: target,
      maxTraceLines: 10,
    },
  };
} else if (
  operation === "recover" &&
  target &&
  Number.isFinite(Date.parse(target)) &&
  [2, 3].includes(Number(attemptText)) &&
  confirmation === "--confirm-recollection"
) {
  const timestamp = new Date(target).toISOString();
  call = {
    name: "trigger_task",
    arguments: {
      projectRef,
      environment: "prod",
      taskId: "recover-france-travail-collection",
      payload: {
        timestamp,
        attempt: Number(attemptText),
        confirmation: "RECOLLECT_WITHOUT_DELETING_PREVIOUS_ATTEMPT",
      },
      options: { idempotencyKey: `recovery-${timestamp}-${attemptText}` },
    },
  };
} else if (
  operation === "republish" &&
  /^[0-9a-f-]{36}$/u.test(target ?? "") &&
  attemptText === "--confirm-publication"
) {
  call = {
    name: "trigger_task",
    arguments: {
      projectRef,
      environment: "prod",
      taskId: "republish-current-methodology",
      payload: {
        expectedIngestionRunId: target,
        confirmation: "RECLASSIFY_AND_PUBLISH_NEW_IMMUTABLE_DATASET",
      },
    },
  };
} else if (operation !== "tools") {
  process.stderr.write(
    "Usage: node scripts/trigger-operations.mjs tools | worker | run RUN_ID | recover PLANNED_ISO_TIMESTAMP ATTEMPT --confirm-recollection | republish INGESTION_UUID --confirm-publication | rollback DATASET_VERSION --confirm-rollback\n",
  );
  process.exit(1);
}

const requireCli = createRequire(
  realpathSync("node_modules/trigger.dev/package.json"),
);
const { Client } = await import(
  pathToFileURL(requireCli.resolve("@modelcontextprotocol/sdk/client/index.js"))
    .href
);
const { StdioClientTransport } = await import(
  pathToFileURL(requireCli.resolve("@modelcontextprotocol/sdk/client/stdio.js"))
    .href
);
const client = new Client({ name: "junior-operations", version: "1.0.0" });
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [
        path.resolve("node_modules/trigger.dev/dist/esm/index.js"),
        "mcp",
        "--project-ref",
        projectRef,
        "--skip-telemetry",
      ],
      stderr: "ignore",
    }),
  );
  const result = call
    ? await client.callTool(call)
    : {
        tools: (await client.listTools()).tools.filter(({ name }) =>
          ["get_current_worker", "get_run_details", "trigger_task"].includes(
            name,
          ),
        ),
      };
  process.stdout.write(
    JSON.stringify(result)
      .replace(
        /(?:postgres(?:ql)?:\/\/|tr_[a-z]+_|Bearer\s+)[^\s"\\]+/giu,
        "[REDACTED]",
      )
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL REDACTED]"),
  );
  if (result.isError) process.exitCode = 1;
} catch {
  process.stderr.write(
    "Trigger operation failed. Inspect authentication and configuration; sensitive details withheld.\n",
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
