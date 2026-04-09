import { AgentDiscovery } from "@/components/AgentDiscovery";
import { ChatPanel } from "@/components/ChatPanel";
import { RiskDashboard } from "@/components/RiskDashboard";
import { FiveTsPanel } from "@/components/FiveTsPanel";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm">
              🏥
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">DischargeGuard</h1>
              <p className="text-[10px] text-slate-500">Post-Discharge Care Coordination</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              MCP Server
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              A2A Agents
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              FHIR R4
            </span>
            <span className="bg-blue-600/20 border border-blue-500/30 text-blue-300 px-2 py-1 rounded-full">
              Agents Assemble 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "30-Day Window", value: "Active", icon: "📅", color: "blue" },
            { label: "Patients Monitored", value: "3", icon: "👥", color: "purple" },
            { label: "Readmissions Prevented", value: "2", icon: "🏥", color: "green" },
            { label: "Risk Score Avg", value: "52.7", icon: "📊", color: "yellow" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-800 rounded-xl border border-slate-700 px-4 py-3 flex items-center gap-3"
            >
              <span className="text-xl">{stat.icon}</span>
              <div>
                <p className="text-lg font-bold text-white">{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 5Ts coverage */}
        <FiveTsPanel />

        {/* Main grid: Agent Discovery + Chat + Risk Dashboard */}
        <div className="grid grid-cols-[280px_1fr_1fr] gap-5">
          {/* Left: Agent Discovery */}
          <AgentDiscovery />

          {/* Middle: Chat */}
          <ChatPanel />

          {/* Right: Risk Dashboard */}
          <div className="space-y-4">
            <RiskDashboard />

            {/* Architecture note */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Pipeline Flow
              </h3>
              <div className="space-y-2">
                {[
                  { step: "1", label: "Check-In", agent: "Monitoring Agent", port: "8001", icon: "🩺" },
                  { step: "2", label: "Risk Score", agent: "Risk Scoring Agent", port: "8002", icon: "📊" },
                  { step: "3", label: "Escalate", agent: "Escalation Agent", port: "8003", icon: "🚨" },
                  { step: "→", label: "Orchestrate", agent: "Orchestrator", port: "8004", icon: "🎯" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-2 text-[11px]">
                    <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400 flex-shrink-0">
                      {item.step}
                    </span>
                    <span className="text-slate-400">{item.icon}</span>
                    <span className="text-slate-300 font-medium">{item.label}</span>
                    <span className="text-slate-600 ml-auto">:{item.port}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] text-slate-600 pt-2 pb-4">
          DischargeGuard — Built for Agents Assemble: The Healthcare AI Endgame 2026 •{" "}
          MCP Server + A2A Agents + FHIR R4 + Google Gemini
        </footer>
      </main>
    </div>
  );
}
