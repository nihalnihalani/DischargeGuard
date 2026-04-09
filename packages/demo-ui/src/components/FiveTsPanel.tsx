"use client";

const FIVE_TS = [
  {
    id: "talk",
    label: "Talk",
    icon: "💬",
    description: "Conversational check-ins",
    example: "Day-3 HF check-in: Maria reports weight gain, edema, dyspnea...",
    color: "blue",
  },
  {
    id: "template",
    label: "Template",
    icon: "📋",
    description: "Discharge instructions",
    example: "Heart Failure Discharge Plan — 30-day monitoring schedule...",
    color: "purple",
  },
  {
    id: "table",
    label: "Table",
    icon: "📊",
    description: "Risk dashboard",
    example: "3 patients | 🔴 1 Critical | 🟠 1 High | 🚨 1 Escalation",
    color: "yellow",
  },
  {
    id: "transaction",
    label: "Transaction",
    icon: "🔗",
    description: "FHIR Communication",
    example: 'FHIR Communication sent to PCP: "Urgent: Maria Garcia — CRITICAL risk..."',
    color: "green",
  },
  {
    id: "task",
    label: "Task",
    icon: "✅",
    description: "Care team tasks",
    example: "URGENT Task — Care Coordinator: Contact Maria Garcia within 4 hours",
    color: "red",
  },
];

const COLOR_STYLES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    text: "text-blue-300",
    badge: "bg-blue-500/20 text-blue-300",
  },
  purple: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
    text: "text-purple-300",
    badge: "bg-purple-500/20 text-purple-300",
  },
  yellow: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    text: "text-yellow-300",
    badge: "bg-yellow-500/20 text-yellow-300",
  },
  green: {
    border: "border-green-500/30",
    bg: "bg-green-500/5",
    text: "text-green-300",
    badge: "bg-green-500/20 text-green-300",
  },
  red: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    text: "text-red-300",
    badge: "bg-red-500/20 text-red-300",
  },
};

export function FiveTsPanel() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
          5Ts Output Coverage
        </h2>
        <p className="text-[10px] text-slate-500 mt-0.5">All hackathon output types demonstrated</p>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {FIVE_TS.map((t) => {
          const styles = COLOR_STYLES[t.color];
          return (
            <div
              key={t.id}
              className={`rounded-lg p-3 border ${styles.border} ${styles.bg} flex flex-col gap-1.5`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">{t.icon}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${styles.badge}`}>
                  {t.label}
                </span>
              </div>
              <p className={`text-[10px] font-medium ${styles.text}`}>{t.description}</p>
              <p className="text-[9px] text-slate-500 leading-relaxed">{t.example}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
