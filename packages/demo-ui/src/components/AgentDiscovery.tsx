"use client";

import { useEffect, useState } from "react";

interface AgentSkill {
  id: string;
  name: string;
  description: string;
}

interface AgentCard {
  name: string;
  description: string;
  url: string;
  version?: string;
  skills?: AgentSkill[];
}

interface AgentStatus {
  name: string;
  url: string;
  online: boolean;
  card: AgentCard | null;
}

const AGENT_ICONS: Record<string, string> = {
  "Monitoring Agent": "🩺",
  "Risk Scoring Agent": "📊",
  "Escalation Agent": "🚨",
  "Orchestrator Agent": "🎯",
};

export function AgentDiscovery() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/agents");
      const data = (await resp.json()) as { agents: AgentStatus[] };
      setAgents(data.agents);
    } catch {
      // Show placeholder agents if API fails
      setAgents([
        { name: "Monitoring Agent", url: "http://localhost:8001", online: false, card: null },
        { name: "Risk Scoring Agent", url: "http://localhost:8002", online: false, card: null },
        { name: "Escalation Agent", url: "http://localhost:8003", online: false, card: null },
        { name: "Orchestrator Agent", url: "http://localhost:8004", online: false, card: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAgents();
    const interval = setInterval(() => void fetchAgents(), 10_000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = agents.filter((a) => a.online).length;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          Agent Discovery
        </h2>
        <span className="text-xs text-slate-500">
          {loading ? "Scanning..." : `${onlineCount}/${agents.length} online`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className={`rounded-lg p-3 border transition-colors ${
              agent.online
                ? "bg-slate-700/50 border-blue-500/30"
                : "bg-slate-900/50 border-slate-700"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none mt-0.5">
                {AGENT_ICONS[agent.name] ?? "🤖"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      agent.online ? "bg-green-400" : "bg-slate-600"
                    }`}
                  />
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {agent.card?.name ?? agent.name}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {agent.online ? agent.url.replace("http://localhost:", "port ") : "offline"}
                </p>
                {agent.card?.skills && agent.card.skills.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {agent.card.skills.slice(0, 2).map((skill) => (
                      <span
                        key={skill.id}
                        className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => void fetchAgents()}
        className="mt-3 w-full text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1"
      >
        ↻ Refresh
      </button>
    </div>
  );
}
