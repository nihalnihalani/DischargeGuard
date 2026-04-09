import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DischargeGuard — Post-Discharge Care Coordination",
  description: "AI-powered 30-day readmission prevention with MCP Server + A2A Agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100">{children}</body>
    </html>
  );
}
