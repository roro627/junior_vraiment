import { cn } from "@/lib/utils";

import { EvidenceTrigger, type EvidenceTriggerProps } from "./evidence-trigger";
import { buttonVariants } from "./ui/button";

type EvidencePanelProps = Omit<EvidenceTriggerProps, "triggerClassName">;

export function EvidencePanel(props: EvidencePanelProps) {
  // Resolve the shared design-system classes on the server; the trigger does
  // not need to ship a class-merging engine just to toggle a dialog.
  return (
    <EvidenceTrigger
      {...props}
      triggerClassName={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    />
  );
}
