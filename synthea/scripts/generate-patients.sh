#!/bin/bash
# Generate synthetic patients using Synthea
# Targets heart failure, COPD, diabetes, stroke for rich discharge scenarios

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNTHEA_DIR="$(dirname "$SCRIPT_DIR")"
JAR="$SYNTHEA_DIR/synthea-with-dependencies.jar"

if [ ! -f "$JAR" ]; then
  echo "Downloading Synthea..."
  curl -L -o "$JAR" \
    "https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar"
fi

echo "Generating 50 synthetic patients..."
java -jar "$JAR" \
  -p 50 \
  --exporter.fhir.export true \
  --exporter.fhir.transaction_bundle true \
  --exporter.baseDirectory "$SYNTHEA_DIR/output" \
  Massachusetts

echo "✓ Generated patients in $SYNTHEA_DIR/output/fhir/"
echo "Run synthea/scripts/upload-to-hapi.sh to load into HAPI FHIR"
