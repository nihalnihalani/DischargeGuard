import { fhirRead, fhirSearch } from "./client.js";
import type {
  FhirCondition,
  FhirEncounter,
  FhirMedicationRequest,
  FhirObservation,
  FhirPatient,
  FhirProcedure,
} from "./types.js";

export async function getPatient(patientId: string): Promise<FhirPatient> {
  return fhirRead<FhirPatient>("Patient", patientId);
}

export async function getEncounter(encounterId: string): Promise<FhirEncounter> {
  return fhirRead<FhirEncounter>("Encounter", encounterId);
}

export async function getConditionsByEncounter(encounterId: string): Promise<FhirCondition[]> {
  return fhirSearch<FhirCondition>("Condition", { encounter: encounterId });
}

export async function getActiveConditionsByPatient(patientId: string): Promise<FhirCondition[]> {
  return fhirSearch<FhirCondition>("Condition", {
    patient: patientId,
    "clinical-status": "active",
  });
}

export async function getMedicationRequestsByEncounter(
  encounterId: string
): Promise<FhirMedicationRequest[]> {
  return fhirSearch<FhirMedicationRequest>("MedicationRequest", {
    encounter: encounterId,
    status: "active",
  });
}

export async function getMedicationRequestsByPatient(
  patientId: string,
  status = "active"
): Promise<FhirMedicationRequest[]> {
  return fhirSearch<FhirMedicationRequest>("MedicationRequest", {
    patient: patientId,
    status,
  });
}

export async function getProceduresByEncounter(encounterId: string): Promise<FhirProcedure[]> {
  return fhirSearch<FhirProcedure>("Procedure", { encounter: encounterId });
}

export async function getEmergencyEncountersSince(
  patientId: string,
  since: Date
): Promise<FhirEncounter[]> {
  return fhirSearch<FhirEncounter>("Encounter", {
    patient: patientId,
    class: "EMER",
    date: `ge${since.toISOString().split("T")[0]}`,
  });
}

export async function getObservationsByPatient(
  patientId: string,
  category = "vital-signs"
): Promise<FhirObservation[]> {
  return fhirSearch<FhirObservation>("Observation", {
    patient: patientId,
    category,
    _sort: "-date",
  });
}
