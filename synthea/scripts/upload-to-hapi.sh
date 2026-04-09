#!/bin/bash
# Upload Synthea-generated FHIR bundles to HAPI FHIR server

set -e

FHIR_URL="${FHIR_BASE_URL:-http://localhost:8080/fhir}"
FHIR_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")/output/fhir"

if [ ! -d "$FHIR_DIR" ]; then
  echo "Error: $FHIR_DIR not found. Run generate-patients.sh first."
  exit 1
fi

echo "Uploading FHIR bundles to $FHIR_URL..."

# Upload hospital and practitioner info first
for special in hospitalInformation practitionerInformation; do
  if ls "$FHIR_DIR/${special}"*.json 1>/dev/null 2>&1; then
    for f in "$FHIR_DIR/${special}"*.json; do
      echo "  → $f"
      curl -s -X POST "$FHIR_URL" \
        -H "Content-Type: application/fhir+json" \
        -d @"$f" | jq -r '.resourceType // .issue[0].diagnostics' 2>/dev/null || true
    done
  fi
done

# Upload patient bundles
count=0
for f in "$FHIR_DIR"/*.json; do
  name=$(basename "$f")
  if [[ "$name" == *"hospitalInformation"* ]] || [[ "$name" == *"practitionerInformation"* ]]; then
    continue
  fi
  echo "  → $name"
  curl -s -X POST "$FHIR_URL" \
    -H "Content-Type: application/fhir+json" \
    -d @"$f" | jq -r '(.resourceType + ": " + (.total | tostring)) // .issue[0].diagnostics' 2>/dev/null || true
  ((count++))
done

echo ""
echo "✓ Uploaded $count patient bundles to $FHIR_URL"
echo ""
echo "Sample patient query:"
echo "  curl $FHIR_URL/Patient?_count=5 | jq '.entry[].resource | {id, name: .name[0].text}'"
