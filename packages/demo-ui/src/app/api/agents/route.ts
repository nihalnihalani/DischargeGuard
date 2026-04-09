import { NextResponse } from "next/server";

const AGENT_URLS = [
  { name: "Monitoring Agent", url: process.env.MONITORING_AGENT_URL ?? "http://localhost:8001" },
  { name: "Risk Scoring Agent", url: process.env.RISK_SCORING_AGENT_URL ?? "http://localhost:8002" },
  { name: "Escalation Agent", url: process.env.ESCALATION_AGENT_URL ?? "http://localhost:8003" },
  { name: "Orchestrator Agent", url: process.env.ORCHESTRATOR_URL ?? "http://localhost:8004" },
];

interface AgentCard {
  name: string;
  description: string;
  url: string;
  version?: string;
  capabilities?: { streaming?: boolean; pushNotifications?: boolean };
  skills?: Array<{ id: string; name: string; description: string }>;
}

interface AgentStatus {
  name: string;
  url: string;
  online: boolean;
  card: AgentCard | null;
}

async function fetchAgentCard(name: string, url: string): Promise<AgentStatus> {
  try {
    const resp = await fetch(`${url}/.well-known/agent.json`, {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return { name, url, online: false, card: null };
    const card = (await resp.json()) as AgentCard;
    return { name, url, online: true, card };
  } catch {
    return { name, url, online: false, card: null };
  }
}

export async function GET() {
  const results = await Promise.all(
    AGENT_URLS.map((a) => fetchAgentCard(a.name, a.url))
  );
  return NextResponse.json({ agents: results });
}
