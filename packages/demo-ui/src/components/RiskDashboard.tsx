"use client";

import { useEffect, useState } from "react";

interface Patient {
  name: string;
  diagnosis: string;
  dayPostDischarge: number;
  score: number;
  tier: "low" | "medium" | "high" | "critical";
  trend: "improving" | "stable" | "worsening";
  escalation: boolean;
  laceScore: number;
}

// Demo patients — populated by real data when agents are running
const DEMO_PATIENTS: Patient[] = [
  {
    name: "Maria Garcia",
    diagnosis: "Heart Failure",
    dayPostDischarge: 3,
    score: 78,
    tier: "critical",
    trend: "worsening",
    escalation: true,
    laceScore: 12,
  },
  {
    name: "James Wilson",
    diagnosis: "COPD",
    dayPostDischarge: 7,
    score: 52,
    tier: "high",
    trend: "stable",
    escalation: false,
    laceScore: 9,
  },
  {
    name: "Dorothy Patel",
    diagnosis: "Diabetes",
    dayPostDischarge: 14,
    score: 28,
    tier: "medium",
    trend: "improving",
    escalation: false,
    laceScore: 5,
  },
];

const TIER_STYLE: Record<Patient["tier"], string> = {
  low: "text-green-400 bg-green-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  high: "text-orange-400 bg-orange-400/10",
  critical: "text-red-400 bg-red-400/10",
};

const TIER_EMOJI: Record<Patient["tier"], string> = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  critical: "🔴",
};

const TREND_EMOJI: Record<Patient["trend"], string> = {
  improving: "⬇️",
  stable: "➡️",
  worsening: "⬆️",
};

function ScoreBar({ score, tier }: { score: number; tier: Patient["tier"] }) {
  const barColor: Record<Patient["tier"], string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor[tier]}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono text-slate-300 w-10 text-right">{score}/100</span>
    </div>
  );
}

export function RiskDashboard() {
  const [patients] = useState<Patient[]>(DEMO_PATIENTS);
  const [isDemo] = useState(true);

  const critical = patients.filter((p) => p.tier === "critical").length;
  const high = patients.filter((p) => p.tier === "high").length;
  const escalations = patients.filter((p) => p.escalation).length;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Risk Dashboard
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {isDemo && " — demo data"}
          </p>
        </div>
        <div className="flex gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-red-400">
            <span className="font-bold">{critical}</span> Critical
          </span>
          <span className="flex items-center gap-1 text-orange-400">
            <span className="font-bold">{high}</span> High
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="font-bold text-red-400">🚨 {escalations}</span> Escalation
          </span>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_1fr_60px_1fr_80px_60px] gap-x-3 text-[10px] text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-700 px-2">
        <span>Patient</span>
        <span>Diagnosis</span>
        <span>Day</span>
        <span>Risk Score</span>
        <span>Tier</span>
        <span>Action</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-700/50">
        {patients.map((patient) => (
          <div
            key={patient.name}
            className={`grid grid-cols-[1fr_1fr_60px_1fr_80px_60px] gap-x-3 items-center py-2.5 px-2 rounded-lg transition-colors hover:bg-slate-700/30 ${
              patient.escalation ? "bg-red-500/5" : ""
            }`}
          >
            <div>
              <p className="text-xs font-medium text-slate-200">{patient.name}</p>
              <p className="text-[10px] text-slate-500">LACE: {patient.laceScore}/19</p>
            </div>
            <span className="text-xs text-slate-400">{patient.diagnosis}</span>
            <span className="text-xs text-slate-400">Day {patient.dayPostDischarge}</span>
            <ScoreBar score={patient.score} tier={patient.tier} />
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TIER_STYLE[patient.tier]}`}
            >
              {TIER_EMOJI[patient.tier]} {patient.tier.toUpperCase()}
            </span>
            <span className="text-xs">
              {patient.escalation ? (
                <span className="text-red-400 font-semibold">🚨 YES</span>
              ) : (
                <span className="text-slate-600">—</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Trend legend */}
      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-4 text-[10px] text-slate-500">
        <span>Trend:</span>
        {(["improving", "stable", "worsening"] as const).map((trend) => (
          <span key={trend} className="flex items-center gap-1">
            {TREND_EMOJI[trend]} {trend}
          </span>
        ))}
        <span className="ml-auto">Escalation threshold: ≥60/100</span>
      </div>
    </div>
  );
}
