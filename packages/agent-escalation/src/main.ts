import { createA2aServer } from "@dischargeguard/shared";
import { runEscalationAgent } from "./agent.js";
import agentCardJson from "../agent.json" with { type: "json" };
import type { AgentCard } from "@dischargeguard/shared";

const PORT = parseInt(process.env.ESCALATION_AGENT_PORT ?? "8003", 10);
const agentCard = agentCardJson as AgentCard;

const app = createA2aServer(agentCard, runEscalationAgent);

app.listen(PORT, () => {
  console.log(`[Escalation Agent] Running on http://localhost:${PORT}`);
  console.log(`[Escalation Agent] AgentCard: http://localhost:${PORT}/.well-known/agent.json`);
});
