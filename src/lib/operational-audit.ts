type OperationalAuditEvent = Readonly<{
  event: "revalidation_completed";
  datasetVersion: string;
  tagCount: number;
  occurredAt: string;
}>;

export function writeOperationalAudit(event: OperationalAuditEvent): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}
