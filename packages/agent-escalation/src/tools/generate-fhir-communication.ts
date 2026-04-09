import { v4 as uuidv4 } from "uuid";
import type { FhirCommunication, CareTeamTask } from "@dischargeguard/shared";

function urgencyToPriority(urgency: CareTeamTask["urgency"]): FhirCommunication["priority"] {
  if (urgency === "emergent") return "stat";
  if (urgency === "urgent") return "urgent";
  return "routine";
}

/**
 * Generate a FHIR R4 Communication resource for care coordination escalation.
 * This is the Transaction output (one of the 5Ts).
 */
export function generateFhirCommunication(task: CareTeamTask): FhirCommunication {
  const priority = urgencyToPriority(task.urgency);

  return {
    resourceType: "Communication",
    id: uuidv4(),
    status: "in-progress",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/communication-category",
            code: "alert",
            display: "Alert",
          },
        ],
      },
    ],
    priority,
    subject: {
      reference: `Patient/${task.patientId}`,
      display: task.patientName,
    },
    recipient: [
      {
        display: task.assignedTo,
      },
    ],
    payload: [
      {
        contentString: task.clinicalSummary,
      },
      {
        contentString: `Recommended Actions: ${task.recommendedActions.join(" | ")}`,
      },
    ],
    sent: new Date().toISOString(),
  };
}

export function formatFhirCommunicationMarkdown(comm: FhirCommunication): string {
  return `## FHIR Communication Resource (Transaction Output)

\`\`\`json
${JSON.stringify(comm, null, 2)}
\`\`\`

**Summary:**
- Resource Type: Communication
- Status: ${comm.status}
- Priority: **${comm.priority.toUpperCase()}**
- Patient: ${comm.subject.display}
- Recipient: ${comm.recipient.map((r) => r.display).join(", ")}
- Sent: ${new Date(comm.sent).toLocaleString()}`;
}
