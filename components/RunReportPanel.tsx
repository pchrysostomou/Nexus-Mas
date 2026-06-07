"use client";

import { CheckCircle2, FileText, RadioTower, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

type AgentReport = {
  agentId?: string;
  expectedOutput?: string;
  tool?: string;
  ok?: boolean;
  summary?: string;
  durationMs?: number;
  details?: string[];
};

type RunReport = {
  runId: string;
  createdAt: string;
  command: string;
  status: "ready" | "needs_review" | string;
  checksPassed: number;
  checksTotal: number;
  nextStep: string;
  agentReports: AgentReport[];
  artifacts?: {
    json?: string;
    markdown?: string;
  };
};

const agentLabel: Record<string, string> = {
  analyst: "Analyst",
  builder: "Builder",
  designer: "Designer",
  qa: "QA Sentinel",
  researcher: "Researcher",
  security: "Security"
};

export function RunReportPanel() {
  const [report, setReport] = useState<RunReport | null>(null);
  const [source, setSource] = useState("checking");

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function pullReport() {
      try {
        const response = await fetch("/api/agents/report");
        const payload = (await response.json()) as { report?: RunReport | null; source?: string };

        if (mounted) {
          setReport(payload.report ?? null);
          setSource(payload.source ?? "unknown");
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(pullReport, 6000);
        }
      }
    }

    void pullReport();

    return () => {
      mounted = false;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const ready = report?.status === "ready";

  return (
    <section className="rounded-lg border border-cyan-300/18 bg-slate-950/56 p-3 backdrop-blur-xl">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
            <FileText className="h-4 w-4 text-cyan-300" />
            Run Report
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
            {report?.runId ?? (source === "offline" ? "report offline" : "waiting for report")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              ready ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/10 text-amber-200"
            }`}
          >
            {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
            {report ? report.status : source}
          </span>
          <span className="inline-flex items-center gap-2 rounded border border-cyan-300/18 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
            <RadioTower className="h-3.5 w-3.5" />
            {report ? `${report.checksPassed}/${report.checksTotal} checks` : "no run"}
          </span>
        </div>
      </div>

      {report ? (
        <>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
            <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next Step</p>
              <p className="mt-1 text-sm leading-5 text-slate-200">{report.nextStep}</p>
            </div>
            <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Artifact</p>
              <p className="mt-1 truncate font-mono text-[11px] text-cyan-100/80">{report.artifacts?.markdown ?? "report artifact pending"}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {report.agentReports.map((item) => (
              <div
                className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2"
                key={`${report.runId}-${item.agentId}-${item.tool}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-white">{agentLabel[item.agentId ?? ""] ?? item.agentId ?? "Agent"}</p>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                      item.ok ? "border-emerald-300/20 text-emerald-200" : "border-amber-300/20 text-amber-200"
                    }`}
                  >
                    {item.ok ? "ok" : "warn"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{item.summary ?? "No summary recorded"}</p>
                <p className="mt-2 truncate font-mono text-[10px] text-cyan-200/70">
                  {item.tool ?? "tool"} {typeof item.durationMs === "number" ? `/ ${item.durationMs}ms` : ""}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-400">
          Waiting for the next Python MAS report artifact
        </div>
      )}
    </section>
  );
}
