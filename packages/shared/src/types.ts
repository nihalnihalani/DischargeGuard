// ─── FHIR Resource Slices ───────────────────────────────────────────────────

export interface FhirCodeableConcept {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
  text?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirDosage {
  text?: string;
  timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  doseAndRate?: Array<{ doseQuantity?: { value?: number; unit?: string } }>;
}

export interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: Array<{ given?: string[]; family?: string; text?: string }>;
  birthDate?: string;
  gender?: string;
  communication?: Array<{ language?: FhirCodeableConcept; preferred?: boolean }>;
}

export interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  status?: string;
  class?: { system?: string; code?: string; display?: string };
  type?: FhirCodeableConcept[];
  subject?: FhirReference;
  period?: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  hospitalization?: {
    dischargeDisposition?: FhirCodeableConcept;
  };
}

export interface FhirCondition {
  resourceType: "Condition";
  id: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  onsetDateTime?: string;
  recordedDate?: string;
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status?: string;
  intent?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  dosageInstruction?: FhirDosage[];
}

export interface FhirProcedure {
  resourceType: "Procedure";
  id: string;
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  performedPeriod?: FhirPeriod;
  performedDateTime?: string;
}

export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  valueString?: string;
  component?: Array<{
    code?: FhirCodeableConcept;
    valueQuantity?: { value?: number; unit?: string };
  }>;
}

export interface FhirBundle {
  resourceType: "Bundle";
  id?: string;
  type?: string;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{ resource?: unknown; fullUrl?: string }>;
}

// ─── DischargeGuard Domain Types ────────────────────────────────────────────

export interface LaceBreakdown {
  L: number;
  A: number;
  C: number;
  E: number;
  total: number;
}

export type RiskTier = "low" | "medium" | "high";
export type MonitoringFrequency = "daily" | "every-3-days" | "weekly";

export interface ReadmissionRisk {
  laceScore: number;
  breakdown: LaceBreakdown;
  riskTier: RiskTier;
  monitoringFrequency: MonitoringFrequency;
  charlsonDetails: Array<{ category: string; weight: number; conditions: string[] }>;
  edVisitsLast6Months: number;
  lengthOfStayDays: number;
}

export interface MedicationSummary {
  id: string;
  name: string;
  rxNormCode?: string;
  dose?: string;
  frequency?: string;
  status: "new" | "stopped" | "dose-changed" | "unchanged";
  changeDescription?: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "major" | "moderate" | "minor";
  description: string;
}

export interface MonitoringMilestone {
  day: number;
  tasks: string[];
  symptomsToWatch: string[];
}

export interface DischargePlan {
  patientId: string;
  encounterId: string;
  patientName: string;
  diagnosis: string;
  instructions: string;
  monitoringPlan: {
    milestones: MonitoringMilestone[];
    checkInFrequency: MonitoringFrequency;
  };
  conditions: Array<{ code: string; display: string }>;
  medications: Array<{ name: string; dose: string; frequency: string; purpose: string }>;
}

// ─── A2A Protocol Types ──────────────────────────────────────────────────────

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  url: string;
  capabilities: { streaming: boolean; pushNotifications: boolean };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples?: string[];
  }>;
}

export interface A2AMessage {
  role: "user" | "agent";
  parts: Array<{ type: "text"; text: string }>;
}

export interface A2ATask {
  id: string;
  sessionId?: string;
  status: {
    state: "submitted" | "working" | "completed" | "failed";
    message?: A2AMessage;
    timestamp: string;
  };
  history?: A2AMessage[];
  artifacts?: Array<{
    name?: string;
    description?: string;
    parts: Array<{ type: "text"; text: string }>;
  }>;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ─── Monitoring / Check-In Types ────────────────────────────────────────────

export interface CheckInResult {
  patientId: string;
  checkinDate: string;
  dayPostDischarge: number;
  diagnosis: string;
  questions: string[];
  responses: string;
  extractedEntities: ClinicalEntity[];
  redFlags: string[];
  medicationAdherenceIssues: string[];
}

export interface ClinicalEntity {
  text: string;
  category: "MEDICAL_CONDITION" | "MEDICATION" | "ANATOMY" | "TEST_TREATMENT_PROCEDURE" | "DOSAGE" | "OTHER";
  score: number;
  negated: boolean;
}

// ─── Risk Scoring Types ──────────────────────────────────────────────────────

export type CompositeRiskTier = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  patientId: string;
  patientName: string;
  diagnosis: string;
  dayPostDischarge: number;
  compositeScore: number;
  compositeRiskTier: CompositeRiskTier;
  laceScore: number;
  laceRiskTier: RiskTier;
  symptomSeverityScore: number;
  redFlagCount: number;
  trend: "improving" | "stable" | "worsening";
  escalationNeeded: boolean;
  keyFactors: string[];
  assessedAt: string;
}

// ─── Escalation Types ────────────────────────────────────────────────────────

export type EscalationUrgency = "routine" | "urgent" | "emergent";

export interface CareTeamTask {
  id: string;
  patientId: string;
  patientName: string;
  urgency: EscalationUrgency;
  dueWithinHours: number;
  clinicalSummary: string;
  recommendedActions: string[];
  assignedTo: string;
  createdAt: string;
}

export interface FhirCommunication {
  resourceType: "Communication";
  id: string;
  status: "in-progress" | "completed";
  category: Array<FhirCodeableConcept>;
  priority: "routine" | "urgent" | "asap" | "stat";
  subject: FhirReference;
  recipient: FhirReference[];
  payload: Array<{ contentString: string }>;
  sent: string;
}

export interface EscalationResult {
  task: CareTeamTask;
  fhirCommunication: FhirCommunication;
  medicationAlerts: string[];
}
