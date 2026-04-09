#!/usr/bin/env bash
# start-all.sh — Start all DischargeGuard services
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Load .env if present
if [ -f .env ]; then
  set -a; source .env; set +a
fi

# Colors
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}"
echo "  ____  _          _                        ____                     _ "
echo " |  _ \(_)___  ___| |__   __ _ _ __ __ _  / ___|_   _  __ _ _ __ __| |"
echo " | | | | / __|/ __| '_ \ / _\` | '__/ _\` || |  _| | | |/ _\` | '__/ _\` |"
echo " | |_| | \__ \ (__| | | | (_| | | | (_| || |_| | |_| | (_| | | | (_| |"
echo " |____/|_|___/\___|_| |_|\__,_|_|  \__, | \____|\__,_|\__,_|_|  \__,_|"
echo "                                    |___/                               "
echo -e "${NC}"
echo -e "${GREEN}DischargeGuard — Post-Discharge Care Coordination${NC}"
echo ""

# Check required env vars
if [ -z "$GEMINI_API_KEY" ]; then
  echo -e "${YELLOW}Warning: GEMINI_API_KEY not set. AI features will be limited.${NC}"
fi
if [ -z "$FHIR_BASE_URL" ]; then
  echo -e "${YELLOW}Using default FHIR_BASE_URL: http://localhost:8080/fhir${NC}"
  export FHIR_BASE_URL="http://localhost:8080/fhir"
fi

# Build all packages first
echo "Building packages..."
npm run build --workspaces --if-present 2>/dev/null || true
echo -e "${GREEN}Build complete.${NC}"
echo ""

# Start agents in background
echo "Starting agents..."

cd "$ROOT/packages/agent-monitoring"
node dist/main.js &
MONITORING_PID=$!
echo -e "${GREEN}  [+] Monitoring Agent (PID: $MONITORING_PID) → http://localhost:${MONITORING_AGENT_PORT:-8001}${NC}"

cd "$ROOT/packages/agent-risk-scoring"
node dist/main.js &
RISK_PID=$!
echo -e "${GREEN}  [+] Risk Scoring Agent (PID: $RISK_PID) → http://localhost:${RISK_SCORING_AGENT_PORT:-8002}${NC}"

cd "$ROOT/packages/agent-escalation"
node dist/main.js &
ESCALATION_PID=$!
echo -e "${GREEN}  [+] Escalation Agent (PID: $ESCALATION_PID) → http://localhost:${ESCALATION_AGENT_PORT:-8003}${NC}"

# Wait for workers to come up before starting orchestrator
sleep 2

cd "$ROOT/packages/agent-orchestrator"
node dist/main.js &
ORCHESTRATOR_PID=$!
echo -e "${GREEN}  [+] Orchestrator Agent (PID: $ORCHESTRATOR_PID) → http://localhost:${ORCHESTRATOR_AGENT_PORT:-8004}${NC}"

echo ""
echo -e "${BLUE}Agent discovery:${NC}"
echo "  GET http://localhost:${MONITORING_AGENT_PORT:-8001}/.well-known/agent.json"
echo "  GET http://localhost:${RISK_SCORING_AGENT_PORT:-8002}/.well-known/agent.json"
echo "  GET http://localhost:${ESCALATION_AGENT_PORT:-8003}/.well-known/agent.json"
echo "  GET http://localhost:${ORCHESTRATOR_AGENT_PORT:-8004}/.well-known/agent.json"
echo ""
echo -e "${BLUE}MCP Server (stdio):${NC}"
echo "  node packages/mcp-server/dist/index.js"
echo ""
echo -e "${BLUE}Demo UI:${NC}"
echo "  cd packages/demo-ui && npm run dev"
echo "  → http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all agents."
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down agents..."
  kill $MONITORING_PID $RISK_PID $ESCALATION_PID $ORCHESTRATOR_PID 2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM

# Wait for any process to exit
wait
