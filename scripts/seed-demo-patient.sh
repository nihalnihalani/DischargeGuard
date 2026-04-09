#!/usr/bin/env bash
# seed-demo-patient.sh — Seed Maria Garcia demo patient directly via FHIR API
# No Synthea needed — creates minimal FHIR resources for the demo scenario.
set -e

FHIR_BASE="${FHIR_BASE_URL:-http://localhost:8080/fhir}"
CONTENT_TYPE="Content-Type: application/fhir+json"
ACCEPT="Accept: application/fhir+json"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${GREEN}Seeding DischargeGuard demo patient...${NC}"
echo "FHIR Base: $FHIR_BASE"

# Check HAPI FHIR is running
if ! curl -sf "$FHIR_BASE/metadata" -H "$ACCEPT" > /dev/null 2>&1; then
  echo -e "${RED}Error: HAPI FHIR not running at $FHIR_BASE${NC}"
  echo "Start it with: docker compose up -d"
  exit 1
fi

echo -e "${GREEN}HAPI FHIR is running.${NC}"

# ── 1. Create Patient: Maria Garcia ──────────────────────────────────────────
echo ""
echo "Creating Patient: Maria Garcia..."
PATIENT_RESPONSE=$(curl -sf -X POST "$FHIR_BASE/Patient" \
  -H "$CONTENT_TYPE" \
  -H "$ACCEPT" \
  -d '{
    "resourceType": "Patient",
    "id": "demo-maria-garcia",
    "name": [{"use": "official", "family": "Garcia", "given": ["Maria"]}],
    "gender": "female",
    "birthDate": "1958-03-15",
    "address": [{"city": "Springfield", "state": "IL", "postalCode": "62701"}],
    "telecom": [{"system": "phone", "value": "217-555-0123"}]
  }')
PATIENT_ID=$(echo "$PATIENT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "demo-maria-garcia")
echo -e "${GREEN}  Patient ID: $PATIENT_ID${NC}"

# ── 2. Create Practitioner: Dr. Sarah Chen ───────────────────────────────────
echo "Creating Practitioner: Dr. Sarah Chen (PCP)..."
PRACTITIONER_RESPONSE=$(curl -sf -X POST "$FHIR_BASE/Practitioner" \
  -H "$CONTENT_TYPE" \
  -H "$ACCEPT" \
  -d '{
    "resourceType": "Practitioner",
    "id": "demo-dr-chen",
    "name": [{"family": "Chen", "given": ["Sarah"], "prefix": ["Dr."]}],
    "telecom": [{"system": "email", "value": "sarah.chen@springfield-hospital.org"}]
  }')
PCP_ID=$(echo "$PRACTITIONER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "demo-dr-chen")
echo -e "${GREEN}  Practitioner ID: $PCP_ID${NC}"

# ── 3. Create Discharge Encounter (3 days ago) ───────────────────────────────
DISCHARGE_DATE=$(date -v-3d +%Y-%m-%dT12:00:00+00:00 2>/dev/null || date -d "3 days ago" +%Y-%m-%dT12:00:00+00:00 2>/dev/null || echo "2026-04-05T12:00:00+00:00")
ADMIT_DATE=$(date -v-8d +%Y-%m-%dT08:00:00+00:00 2>/dev/null || date -d "8 days ago" +%Y-%m-%dT08:00:00+00:00 2>/dev/null || echo "2026-03-31T08:00:00+00:00")

echo "Creating Encounter (5-day admission, discharged $DISCHARGE_DATE)..."
ENCOUNTER_RESPONSE=$(curl -sf -X POST "$FHIR_BASE/Encounter" \
  -H "$CONTENT_TYPE" \
  -H "$ACCEPT" \
  -d "{
    \"resourceType\": \"Encounter\",
    \"id\": \"demo-encounter-garcia\",
    \"status\": \"finished\",
    \"class\": {\"system\": \"http://terminology.hl7.org/CodeSystem/v3-ActCode\", \"code\": \"EMER\"},
    \"subject\": {\"reference\": \"Patient/$PATIENT_ID\"},
    \"period\": {\"start\": \"$ADMIT_DATE\", \"end\": \"$DISCHARGE_DATE\"},
    \"participant\": [{\"individual\": {\"reference\": \"Practitioner/$PCP_ID\"}}],
    \"hospitalization\": {
      \"dischargeDisposition\": {
        \"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/discharge-disposition\", \"code\": \"home\", \"display\": \"Home\"}]
      }
    }
  }")
ENCOUNTER_ID=$(echo "$ENCOUNTER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "demo-encounter-garcia")
echo -e "${GREEN}  Encounter ID: $ENCOUNTER_ID${NC}"

# ── 4. Create Conditions ─────────────────────────────────────────────────────
echo "Creating Conditions (Heart Failure + Hypertension + CKD)..."

for condition in \
  '{"snomed":"84114007","display":"Heart failure","weight":1}' \
  '{"snomed":"38341003","display":"Hypertension","weight":1}' \
  '{"snomed":"431855005","display":"Chronic kidney disease stage 2","weight":2}' \
  '{"snomed":"73211009","display":"Diabetes mellitus type 2","weight":1}'; do
  SNOMED=$(echo "$condition" | python3 -c "import sys,json; print(json.load(sys.stdin)['snomed'])")
  DISPLAY=$(echo "$condition" | python3 -c "import sys,json; print(json.load(sys.stdin)['display'])")
  curl -sf -X POST "$FHIR_BASE/Condition" \
    -H "$CONTENT_TYPE" \
    -H "$ACCEPT" \
    -d "{
      \"resourceType\": \"Condition\",
      \"clinicalStatus\": {\"coding\": [{\"system\": \"http://terminology.hl7.org/CodeSystem/condition-clinical\", \"code\": \"active\"}]},
      \"code\": {\"coding\": [{\"system\": \"http://snomed.info/sct\", \"code\": \"$SNOMED\", \"display\": \"$DISPLAY\"}], \"text\": \"$DISPLAY\"},
      \"subject\": {\"reference\": \"Patient/$PATIENT_ID\"},
      \"encounter\": {\"reference\": \"Encounter/$ENCOUNTER_ID\"}
    }" > /dev/null
  echo -e "  ${GREEN}✓${NC} $DISPLAY (SNOMED: $SNOMED)"
done

# ── 5. Create Medications ─────────────────────────────────────────────────────
echo "Creating Discharge Medications..."

for med in \
  '{"rxnorm":"202991","name":"Furosemide 40mg oral tablet","dosage":"Take 1 tablet by mouth every morning"}' \
  '{"rxnorm":"197361","name":"Lisinopril 10mg oral tablet","dosage":"Take 1 tablet by mouth daily"}' \
  '{"rxnorm":"308460","name":"Carvedilol 6.25mg oral tablet","dosage":"Take 1 tablet by mouth twice daily with food"}' \
  '{"rxnorm":"617312","name":"Atorvastatin 40mg oral tablet","dosage":"Take 1 tablet by mouth at bedtime"}' \
  '{"rxnorm":"860975","name":"Spironolactone 25mg oral tablet","dosage":"Take 1 tablet by mouth daily"}'; do
  RXNORM=$(echo "$med" | python3 -c "import sys,json; print(json.load(sys.stdin)['rxnorm'])")
  NAME=$(echo "$med" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
  DOSAGE=$(echo "$med" | python3 -c "import sys,json; print(json.load(sys.stdin)['dosage'])")
  curl -sf -X POST "$FHIR_BASE/MedicationRequest" \
    -H "$CONTENT_TYPE" \
    -H "$ACCEPT" \
    -d "{
      \"resourceType\": \"MedicationRequest\",
      \"status\": \"active\",
      \"intent\": \"order\",
      \"medicationCodeableConcept\": {
        \"coding\": [{\"system\": \"http://www.nlm.nih.gov/research/umls/rxnorm\", \"code\": \"$RXNORM\", \"display\": \"$NAME\"}],
        \"text\": \"$NAME\"
      },
      \"subject\": {\"reference\": \"Patient/$PATIENT_ID\"},
      \"encounter\": {\"reference\": \"Encounter/$ENCOUNTER_ID\"},
      \"authoredOn\": \"$DISCHARGE_DATE\",
      \"dosageInstruction\": [{\"text\": \"$DOSAGE\"}],
      \"dispenseRequest\": {\"numberOfRepeatsAllowed\": 3, \"expectedSupplyDuration\": {\"value\": 30, \"unit\": \"days\"}}
    }" > /dev/null
  echo -e "  ${GREEN}✓${NC} $NAME"
done

# ── 6. Create past ED visits (for LACE E component) ──────────────────────────
echo "Creating past ED visits (2 in past 6 months for LACE-E=2)..."

for i in 1 2; do
  VISIT_DATE=$(date -v-"$((i*45))"d +%Y-%m-%dT14:00:00+00:00 2>/dev/null || date -d "$((i*45)) days ago" +%Y-%m-%dT14:00:00+00:00 2>/dev/null || echo "2026-02-${i}5T14:00:00+00:00")
  curl -sf -X POST "$FHIR_BASE/Encounter" \
    -H "$CONTENT_TYPE" \
    -H "$ACCEPT" \
    -d "{
      \"resourceType\": \"Encounter\",
      \"status\": \"finished\",
      \"class\": {\"system\": \"http://terminology.hl7.org/CodeSystem/v3-ActCode\", \"code\": \"EMER\"},
      \"subject\": {\"reference\": \"Patient/$PATIENT_ID\"},
      \"period\": {\"start\": \"$VISIT_DATE\", \"end\": \"$VISIT_DATE\"}
    }" > /dev/null
  echo -e "  ${GREEN}✓${NC} ED visit $i"
done

echo ""
echo -e "${GREEN}✅ Demo patient seeded successfully!${NC}"
echo ""
echo "Patient: Maria Garcia"
echo "  FHIR Patient ID: $PATIENT_ID"
echo "  Encounter ID:    $ENCOUNTER_ID"
echo "  LACE Score:      L=4 (5 days) + A=3 (emergency) + C=5 (4+ comorbidities) + E=2 (2 ED visits) = 14"
echo "  Risk Tier:       HIGH"
echo ""
echo "Test the MCP tools:"
echo "  generate_discharge_plan:      { patientId: \"$PATIENT_ID\", encounterId: \"$ENCOUNTER_ID\" }"
echo "  calculate_readmission_risk:   { patientId: \"$PATIENT_ID\", encounterId: \"$ENCOUNTER_ID\" }"
echo "  reconcile_medications:        { patientId: \"$PATIENT_ID\", encounterId: \"$ENCOUNTER_ID\" }"
