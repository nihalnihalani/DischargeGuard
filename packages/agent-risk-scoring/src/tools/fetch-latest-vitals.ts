/**
 * Fetch the latest FHIR Observations (vitals) for a patient.
 * Used to augment symptom-based risk scoring with objective measurements.
 */

const FHIR_BASE_URL = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";

export interface VitalSigns {
  patientId: string;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  oxygenSaturation?: number;
  weight?: number;
  weightUnit?: string;
  temperature?: number;
  respiratoryRate?: number;
  recordedAt?: string;
}

interface FhirObservation {
  resourceType: string;
  id: string;
  code: { coding: Array<{ system: string; code: string; display: string }> };
  valueQuantity?: { value: number; unit: string };
  component?: Array<{
    code: { coding: Array<{ system: string; code: string }> };
    valueQuantity?: { value: number; unit: string };
  }>;
  effectiveDateTime?: string;
  status: string;
}

interface FhirBundle {
  entry?: Array<{ resource: FhirObservation }>;
}

// LOINC codes for common vitals
const VITAL_LOINC = {
  HEART_RATE: "8867-4",
  BLOOD_PRESSURE: "55284-4", // panel
  SYSTOLIC_BP: "8480-6",
  DIASTOLIC_BP: "8462-4",
  OXYGEN_SAT: "2708-6",
  BODY_WEIGHT: "29463-7",
  BODY_TEMP: "8310-5",
  RESP_RATE: "9279-1",
};

async function fetchObservations(patientId: string, loincCode: string): Promise<FhirObservation[]> {
  const params = new URLSearchParams({
    patient: patientId,
    code: `http://loinc.org|${loincCode}`,
    _sort: "-date",
    _count: "1",
  });

  const url = `${FHIR_BASE_URL}/Observation?${params}`;
  try {
    const resp = await fetch(url, { headers: { Accept: "application/fhir+json" } });
    if (!resp.ok) return [];
    const bundle: FhirBundle = await resp.json() as FhirBundle;
    return (bundle.entry ?? []).map((e) => e.resource);
  } catch {
    return [];
  }
}

/**
 * Fetch the most recent vitals for a patient from FHIR.
 * Falls back gracefully if FHIR is unavailable.
 */
export async function fetchLatestVitals(patientId: string): Promise<VitalSigns> {
  const vitals: VitalSigns = { patientId };

  try {
    const [hrObs, bpObs, spo2Obs, weightObs, tempObs, rrObs] = await Promise.all([
      fetchObservations(patientId, VITAL_LOINC.HEART_RATE),
      fetchObservations(patientId, VITAL_LOINC.BLOOD_PRESSURE),
      fetchObservations(patientId, VITAL_LOINC.OXYGEN_SAT),
      fetchObservations(patientId, VITAL_LOINC.BODY_WEIGHT),
      fetchObservations(patientId, VITAL_LOINC.BODY_TEMP),
      fetchObservations(patientId, VITAL_LOINC.RESP_RATE),
    ]);

    if (hrObs[0]?.valueQuantity) {
      vitals.heartRate = hrObs[0].valueQuantity.value;
      vitals.recordedAt = hrObs[0].effectiveDateTime;
    }

    if (bpObs[0]?.component) {
      for (const comp of bpObs[0].component) {
        const code = comp.code.coding[0]?.code;
        if (code === VITAL_LOINC.SYSTOLIC_BP && comp.valueQuantity) {
          vitals.bloodPressureSystolic = comp.valueQuantity.value;
        }
        if (code === VITAL_LOINC.DIASTOLIC_BP && comp.valueQuantity) {
          vitals.bloodPressureDiastolic = comp.valueQuantity.value;
        }
      }
    }

    if (spo2Obs[0]?.valueQuantity) {
      vitals.oxygenSaturation = spo2Obs[0].valueQuantity.value;
    }

    if (weightObs[0]?.valueQuantity) {
      vitals.weight = weightObs[0].valueQuantity.value;
      vitals.weightUnit = weightObs[0].valueQuantity.unit;
    }

    if (tempObs[0]?.valueQuantity) {
      vitals.temperature = tempObs[0].valueQuantity.value;
    }

    if (rrObs[0]?.valueQuantity) {
      vitals.respiratoryRate = rrObs[0].valueQuantity.value;
    }
  } catch {
    // FHIR unavailable — return empty vitals
  }

  return vitals;
}

export function formatVitalsMarkdown(vitals: VitalSigns): string {
  const lines: string[] = ["### Latest Vitals"];

  if (vitals.heartRate !== undefined) lines.push(`- **Heart Rate:** ${vitals.heartRate} bpm`);
  if (vitals.bloodPressureSystolic !== undefined && vitals.bloodPressureDiastolic !== undefined) {
    lines.push(`- **Blood Pressure:** ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`);
  }
  if (vitals.oxygenSaturation !== undefined) lines.push(`- **O₂ Saturation:** ${vitals.oxygenSaturation}%`);
  if (vitals.weight !== undefined) lines.push(`- **Weight:** ${vitals.weight} ${vitals.weightUnit ?? "kg"}`);
  if (vitals.temperature !== undefined) lines.push(`- **Temperature:** ${vitals.temperature}°F`);
  if (vitals.respiratoryRate !== undefined) lines.push(`- **Respiratory Rate:** ${vitals.respiratoryRate} breaths/min`);
  if (vitals.recordedAt) lines.push(`- **Recorded:** ${new Date(vitals.recordedAt).toLocaleString()}`);

  if (lines.length === 1) {
    lines.push("_No vitals available in FHIR_");
  }

  return lines.join("\n");
}
