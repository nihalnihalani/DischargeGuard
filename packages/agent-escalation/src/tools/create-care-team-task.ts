import { v4 as uuidv4 } from "uuid";
import type { CareTeamTask, EscalationUrgency, RiskAssessment } from "@dischargeguard/shared";

function determineUrgency(compositeScore: number): EscalationUrgency {
  if (compositeScore >= 76) return "emergent";
  if (compositeScore >= 51) return "urgent";
  return "routine";
}

function getDueWithinHours(urgency: EscalationUrgency): number {
  if (urgency === "emergent") return 2;
  if (urgency === "urgent") return 8;
  return 24;
}

function getAssignedTo(urgency: EscalationUrgency): string {
  if (urgency === "emergent") return "Attending Physician + Care Coordinator";
  if (urgency === "urgent") return "Care Coordinator + Primary Care Physician";
  return "Care Coordinator";
}

export function createCareTeamTask(
  assessment: RiskAssessment,
  additionalContext?: string
): CareTeamTask {
  const urgency = determineUrgency(assessment.compositeScore);
  const dueWithinHours = getDueWithinHours(urgency);
  const assignedTo = getAssignedTo(urgency);

  const recommendedActions: string[] = [];

  if (assessment.redFlagCount > 0) {
    recommendedActions.push(`Review red flag symptoms: ${assessment.keyFactors.filter(f => f.includes("Red flags")).join(", ")}`);
  }
  if (assessment.keyFactors.some(f => f.includes("adherence"))) {
    recommendedActions.push("Address medication adherence — confirm patient has access to all prescriptions");
  }
  if (urgency === "emergent") {
    recommendedActions.push("Consider telehealth visit within 2 hours");
    recommendedActions.push("Review latest vitals and labs from FHIR");
  } else if (urgency === "urgent") {
    recommendedActions.push("Schedule same-day or next-day phone/telehealth call");
    recommendedActions.push("Review LACE risk factors with care team");
  } else {
    recommendedActions.push("Schedule follow-up call within 24 hours");
  }

  if (assessment.laceScore >= 10) {
    recommendedActions.push(`High LACE score (${assessment.laceScore}/19) — consider intensified monitoring`);
  }

  const clinicalSummary = [
    `Patient ${assessment.patientName} (${assessment.patientId}) is on day ${assessment.dayPostDischarge} post-discharge with ${assessment.diagnosis}.`,
    `Composite risk score: ${assessment.compositeScore}/100 (${assessment.compositeRiskTier.toUpperCase()}).`,
    `LACE index: ${assessment.laceScore}/19 (${assessment.laceRiskTier}).`,
    assessment.keyFactors.length > 0 ? `Key concerns: ${assessment.keyFactors.join("; ")}.` : "",
    additionalContext ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: uuidv4(),
    patientId: assessment.patientId,
    patientName: assessment.patientName,
    urgency,
    dueWithinHours,
    clinicalSummary,
    recommendedActions,
    assignedTo,
    createdAt: new Date().toISOString(),
  };
}

export function formatTaskMarkdown(task: CareTeamTask): string {
  const urgencyEmoji = { emergent: "🚨", urgent: "⚠️", routine: "📋" }[task.urgency];

  return `## ${urgencyEmoji} Care Team Task — ${task.urgency.toUpperCase()}

**Task ID:** ${task.id}
**Patient:** ${task.patientName} (${task.patientId})
**Assigned To:** ${task.assignedTo}
**Due Within:** ${task.dueWithinHours} hour(s)
**Created:** ${new Date(task.createdAt).toLocaleString()}

### Clinical Summary
${task.clinicalSummary}

### Recommended Actions
${task.recommendedActions.map((a) => `- [ ] ${a}`).join("\n")}`;
}
